import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Place } from "@/lib/places/types";
import { rankPlaces, type Recommendation, type TripPreferences } from "@/lib/places/ranking";

/**
 * Recommendation API.
 *
 * Flow: trip preferences -> places provider (real venue data) -> ranking engine
 * -> cached in `trip_enrichment` -> rendered by the UI.
 *
 * No AI is involved and nothing is invented: names, coordinates, addresses,
 * cuisines, amenities and photos all come from the provider, and any field the
 * provider does not publish stays empty.
 */

const Input = z.object({
  trip_id: z.string().uuid(),
  kind: z.enum(["restaurant", "hotel"]),
  limit: z.number().int().min(6).max(48).default(12),
  refresh: z.boolean().optional(),
});

type TripRow = {
  id: string;
  city: string;
  country: string;
  days: number;
  budget: number;
  currency: string;
  travel_style: string;
  interests: string[] | null;
  traveling_with: string | null;
  has_children: boolean | null;
  food_preferences: string | null;
  accessibility_needs: string | null;
  walking_preference: string | null;
  plan: unknown;
};

function itineraryPoints(plan: unknown): Array<{ lat: number; lng: number }> {
  const out: Array<{ lat: number; lng: number }> = [];
  const p = plan as { itinerary?: Array<Record<string, unknown>>; activities?: Array<Record<string, unknown>> } | null;
  const push = (v: unknown) => {
    const o = v as { lat?: number; lng?: number } | undefined;
    if (o && typeof o.lat === "number" && typeof o.lng === "number" && (o.lat !== 0 || o.lng !== 0)) {
      out.push({ lat: o.lat, lng: o.lng });
    }
  };
  for (const day of p?.itinerary ?? []) {
    for (const slot of ["morning", "lunch", "afternoon", "sunset", "dinner", "night"]) push(day[slot]);
  }
  for (const a of p?.activities ?? []) push(a);
  return out;
}

export const getRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const category = data.kind === "hotel" ? "hotels" : "restaurants";

    const { data: tripRow, error: tripErr } = await supabase
      .from("trips")
      .select(
        "id, city, country, days, budget, currency, travel_style, interests, traveling_with, has_children, food_preferences, accessibility_needs, walking_preference, plan",
      )
      .eq("id", data.trip_id)
      .maybeSingle();
    if (tripErr) throw new Error(tripErr.message);
    if (!tripRow) throw new Error("Trip not found");
    const trip = tripRow as unknown as TripRow;

    // 1. Cached raw provider results for this trip (avoids hammering the API).
    let places: Place[] | null = null;
    let providerId = "osm";
    if (!data.refresh) {
      const { data: cached } = await supabase
        .from("trip_enrichment")
        .select("place_data, source_query, status")
        .eq("trip_id", data.trip_id)
        .eq("category", category)
        .eq("status", "ready")
        .maybeSingle();
      const payload = cached?.place_data as { places?: Place[]; provider?: string } | null;
      // Ignore a cache written by a different provider (e.g. old OSM results).
      const { getPlacesProvider } = await import("@/lib/places/provider.server");
      const activeId = getPlacesProvider().id;
      if (payload?.places?.length && (payload.provider ?? "osm") === activeId) {
        places = payload.places;
        providerId = payload.provider ?? providerId;
      }

    }

    // 2. Fetch from the active places provider.
    let providerError: string | null = null;
    if (!places) {
      try {
        const { getPlacesProvider } = await import("@/lib/places/provider.server");
        const provider = getPlacesProvider();
        providerId = provider.id;
        places = await provider.search({
          kind: data.kind,
          city: trip.city,
          country: trip.country,
          limit: 300,
        });
        if (places.length) {
          await supabase
            .from("trip_enrichment")
            .delete()
            .eq("trip_id", data.trip_id)
            .eq("category", category);
          await supabase.from("trip_enrichment").insert({
            trip_id: data.trip_id,
            category,
            source_query: `${data.kind} in ${trip.city}, ${trip.country}`,
            status: "ready",
            place_data: { provider: providerId, fetched_at: new Date().toISOString(), places } as never,
          });
        }
      } catch (err) {
        providerError = err instanceof Error ? err.message : "Place provider unavailable";
        places = [];
      }
    }

    // 3. Saved places feed the personalization signal and the UI toggle state.
    const { data: saved } = await supabase
      .from("saved_places")
      .select("provider_place_id, name, place_data")
      .eq("user_id", userId);
    const savedIds = (saved ?? []).map((s) => s.provider_place_id as string);
    const savedNames = (saved ?? []).map((s) => s.name as string);
    const savedCuisines = (saved ?? []).flatMap(
      (s) => ((s.place_data as { cuisines?: string[] } | null)?.cuisines ?? []) as string[],
    );

    const points = itineraryPoints(trip.plan);
    const center =
      points.length > 0
        ? {
            lat: points.reduce((a, p) => a + p.lat, 0) / points.length,
            lng: points.reduce((a, p) => a + p.lng, 0) / points.length,
          }
        : undefined;

    const prefs: TripPreferences = {
      city: trip.city,
      country: trip.country,
      days: trip.days,
      budget: trip.budget,
      currency: trip.currency,
      travelStyle: (["budget", "standard", "luxury"].includes(trip.travel_style)
        ? trip.travel_style
        : "standard") as TripPreferences["travelStyle"],
      interests: trip.interests ?? [],
      companions: (trip.traveling_with as TripPreferences["companions"]) ?? null,
      hasChildren: trip.has_children ?? false,
      foodPreferences: trip.food_preferences,
      accessibility: trip.accessibility_needs,
      walking: (trip.walking_preference as TripPreferences["walking"]) ?? null,
      center,
      itineraryPoints: points,
      savedNames,
      savedCuisines,
    };

    /**
     * Every real venue competes on merit — a missing photo NEVER excludes a
     * venue. Ranking happens first, imagery is resolved afterwards, only for
     * the venues that will actually be displayed.
     */
    const recommendations: Recommendation[] = rankPlaces(places ?? [], prefs, data.limit);

    const { resolveGooglePhotoUrl } = await import("@/lib/places/providers/google.server");
    const { illustrativePhoto } = await import("@/lib/places/illustrative.server");

    await Promise.all(
      recommendations.map(async (rec) => {
        const place = rec.place;
        // Priority 1 — a real Google photo of this exact venue.
        if (!place.photo?.verified && place.photoRef) {
          const url = await resolveGooglePhotoUrl(place.photoRef);
          if (url) {
            place.photo = {
              url,
              source: "google",
              kind: "real",
              verified: true,
              credit: place.photoCredit ? `Photo: ${place.photoCredit} / Google` : "Google",
              creditUrl: place.mapsUrl,
            };
          }
        }
        // Priority 2 — an already verified OSM / Wikimedia / venue photo: kept as is.
        // Priority 3 — a clearly labelled illustrative image, when a provider exists.
        if (!place.photo) {
          const illustrative = await illustrativePhoto(place);
          if (illustrative) place.photo = illustrative;
        }
      }),
    );

    const withRealPhoto = recommendations.filter((r) => r.place.photo?.kind === "real").length;

    return {
      kind: data.kind,
      provider: providerId,
      attribution: providerId === "google" ? "Google" : "© OpenStreetMap contributors",
      totalCandidates: places?.length ?? 0,
      realPhotoCount: withRealPhoto,
      providerError,
      savedIds,
      recommendations,
    };
  });


export const toggleSavedPlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        trip_id: z.string().uuid(),
        kind: z.enum(["restaurant", "hotel"]),
        provider: z.string().min(1),
        provider_place_id: z.string().min(1),
        name: z.string().min(1),
        place_data: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("saved_places")
      .select("id")
      .eq("user_id", userId)
      .eq("trip_id", data.trip_id)
      .eq("provider", data.provider)
      .eq("provider_place_id", data.provider_place_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("saved_places").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { saved: false };
    }
    const { error } = await supabase.from("saved_places").insert({
      user_id: userId,
      trip_id: data.trip_id,
      kind: data.kind,
      provider: data.provider,
      provider_place_id: data.provider_place_id,
      name: data.name,
      place_data: (data.place_data ?? {}) as never,
    });
    if (error) throw new Error(error.message);
    return { saved: true };
  });
