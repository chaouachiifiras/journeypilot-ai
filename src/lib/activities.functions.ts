import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SpotPhoto } from "@/lib/places/photospot.server";
import type { ActivityBadge, ActivityCategory, RawActivity, RankedActivity } from "@/lib/places/activity-ranking";

/**
 * ACTIVITIES & EXPERIENCES API.
 *
 * Modular by design, mirroring the Photo Spots architecture:
 *   A. discovery      → activity-discovery.server.ts (real Google places only)
 *   B. ranking        → activity-ranking.ts (pure, personalization included)
 *   C. imagery        → photospot.server.ts (verified real photos, ranked)
 *   D. maps linking   → exact Google place ids returned to the client
 *   E. itinerary      → suggestion + explicit user confirmation, never automatic
 *
 * Image availability plays no part in whether an activity is recommended, and
 * no field is ever invented: unknown data is simply omitted.
 */

const DISCOVERY = "activity_discovery";
const IMAGES = "activity_images";

const Input = z.object({
  trip_id: z.string().uuid(),
  limit: z.number().int().min(1).max(48).default(8),
  refresh: z.boolean().optional(),
});

export type ActivityItem = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  mapsUrl?: string;
  website?: string;
  category: ActivityCategory;
  categories: ActivityCategory[];
  typeLabel?: string;
  summary?: string;
  rating?: number;
  reviews?: number;
  priceLevel?: number;
  openingHours?: string[];
  badges: ActivityBadge[];
  why: string[];
  score: number;
  distanceKm?: number;
  bestTime?: string;
  typicalMinutes?: number;
  photo: SpotPhoto | null;
};

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
  accessibility_needs: string | null;
  walking_preference: string | null;
  plan: PlanShape | null;
};

type PlanShape = {
  itinerary?: Array<Record<string, unknown> & { day?: number; title?: string }>;
  activities?: Array<{ name?: string; lat?: number; lng?: number }>;
};

const SLOTS = ["morning", "lunch", "afternoon", "sunset", "dinner", "night"] as const;

function planPoints(plan: PlanShape | null) {
  const out: Array<{ lat: number; lng: number; day?: number }> = [];
  for (const day of plan?.itinerary ?? []) {
    for (const slot of SLOTS) {
      const v = day[slot] as { lat?: number; lng?: number } | undefined;
      if (v && typeof v.lat === "number" && typeof v.lng === "number" && (v.lat || v.lng)) {
        out.push({ lat: v.lat, lng: v.lng, day: typeof day.day === "number" ? day.day : undefined });
      }
    }
  }
  for (const a of plan?.activities ?? []) {
    if (typeof a?.lat === "number" && typeof a?.lng === "number" && (a.lat || a.lng)) out.push({ lat: a.lat, lng: a.lng });
  }
  return out;
}

async function loadTrip(supabase: { from: (t: string) => any }, tripId: string): Promise<TripRow> {
  const { data, error } = await supabase
    .from("trips")
    .select(
      "id, city, country, days, budget, currency, travel_style, interests, traveling_with, has_children, accessibility_needs, walking_preference, plan",
    )
    .eq("id", tripId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Trip not found");
  return data as TripRow;
}

export const getActivities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trip = await loadTrip(supabase, data.trip_id);

    /* ------------- A. Discovery (cached per trip) ------------- */

    let pool: RawActivity[] = [];
    let candidateCount = 0;

    if (!data.refresh) {
      const { data: cached } = await supabase
        .from("trip_enrichment")
        .select("place_data")
        .eq("trip_id", data.trip_id)
        .eq("category", DISCOVERY)
        .eq("status", "ready")
        .maybeSingle();
      const payload = cached?.place_data as { activities?: RawActivity[]; candidateCount?: number } | null;
      if (payload?.activities?.length) {
        pool = payload.activities;
        candidateCount = payload.candidateCount ?? 0;
      }
    }

    let providerError: string | null = null;
    if (!pool.length) {
      try {
        const { discoverActivities } = await import("@/lib/places/activity-discovery.server");
        const found = await discoverActivities(trip.city, trip.country);
        pool = found.activities;
        candidateCount = found.candidateCount;
        if (pool.length) {
          await supabase.from("trip_enrichment").delete().eq("trip_id", data.trip_id).eq("category", DISCOVERY);
          await supabase.from("trip_enrichment").insert({
            trip_id: data.trip_id,
            category: DISCOVERY,
            source_query: `activities and experiences in ${trip.city}, ${trip.country}`,
            status: "ready",
            place_data: { fetched_at: new Date().toISOString(), candidateCount, activities: pool } as never,
          });
        }
      } catch (err) {
        providerError = err instanceof Error ? err.message : "Activity provider unavailable";
      }
    }

    /* ------------- B + C. Ranking and personalization ------------- */

    const points = planPoints(trip.plan);
    const center = points.length
      ? {
          lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
          lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
        }
      : undefined;

    const { rankActivities } = await import("@/lib/places/activity-ranking");
    const ranked: RankedActivity[] = rankActivities(pool, {
      interests: trip.interests ?? [],
      travelStyle: (["budget", "standard", "luxury"].includes(trip.travel_style)
        ? trip.travel_style
        : "standard") as "budget" | "standard" | "luxury",
      companions: trip.traveling_with,
      hasChildren: trip.has_children ?? false,
      walking: trip.walking_preference,
      accessibility: trip.accessibility_needs,
      budget: trip.budget,
      currency: trip.currency,
      days: trip.days,
      center,
      itineraryPoints: points,
      planNames: (trip.plan?.activities ?? []).map((a) => a?.name ?? "").filter(Boolean),
    });

    const visible = ranked.slice(0, data.limit);

    /* ------------- D. Imagery, only for what is displayed ------------- */

    let photoCache: Record<string, SpotPhoto | null> = {};
    if (!data.refresh) {
      const { data: cachedImgs } = await supabase
        .from("trip_enrichment")
        .select("place_data")
        .eq("trip_id", data.trip_id)
        .eq("category", IMAGES)
        .eq("status", "ready")
        .maybeSingle();
      photoCache = ((cachedImgs?.place_data as { photos?: Record<string, SpotPhoto | null> } | null)?.photos) ?? {};
    }

    const missing = visible.filter((r) => !(r.activity.placeId in photoCache));
    if (missing.length) {
      const { bestPhotoForPlace } = await import("@/lib/places/photospot.server");
      const resolved = await Promise.all(
        missing.map(async (r) => {
          const a = r.activity;
          const photo = await bestPhotoForPlace(
            {
              name: a.name,
              lat: a.lat,
              lng: a.lng,
              placeId: a.placeId,
              mapsUrl: a.mapsUrl,
              photoRefs: a.photoRefs,
            },
            // Activity cards read best with the recognisable outside of the place.
            { preferExterior: true },
          ).catch(() => null);
          return [a.placeId, photo] as const;
        }),
      );
      for (const [k, v] of resolved) photoCache[k] = v;

      await supabase.from("trip_enrichment").delete().eq("trip_id", data.trip_id).eq("category", IMAGES);
      await supabase.from("trip_enrichment").insert({
        trip_id: data.trip_id,
        category: IMAGES,
        source_query: `activity imagery in ${trip.city}, ${trip.country}`,
        status: "ready",
        place_data: { fetched_at: new Date().toISOString(), photos: photoCache } as never,
      });
    }

    /* ------------- Saved + already-added state ------------- */

    const [{ data: saved }, { data: added }] = await Promise.all([
      supabase.from("saved_places").select("provider_place_id").eq("user_id", userId).eq("kind", "activity"),
      supabase.from("trip_activities").select("provider_place_id, day, time_slot").eq("trip_id", data.trip_id).eq("user_id", userId),
    ]);

    const items: ActivityItem[] = visible.map((r) => {
      const a = r.activity;
      return {
        placeId: a.placeId,
        name: a.name,
        lat: a.lat,
        lng: a.lng,
        address: a.address,
        mapsUrl: a.mapsUrl,
        website: a.website,
        category: r.category,
        categories: a.categories,
        typeLabel: a.typeLabel,
        summary: a.summary,
        rating: a.rating,
        reviews: a.reviews,
        priceLevel: a.priceLevel,
        openingHours: a.openingHours,
        badges: r.badges,
        why: r.why,
        score: Math.round(r.score * 100) / 100,
        distanceKm: r.distanceKm,
        bestTime: r.bestTime,
        typicalMinutes: r.typicalMinutes,
        photo: photoCache[a.placeId] ?? null,
      };
    });

    return {
      items,
      total: ranked.length,
      candidateCount,
      providerError,
      attribution: "Google",
      savedIds: (saved ?? []).map((s: { provider_place_id: string }) => s.provider_place_id),
      addedIds: (added ?? []).map((s: { provider_place_id: string }) => s.provider_place_id),
      realPhotoCount: items.filter((i) => !!i.photo).length,
    };
  });

/* ------------------------------------------------------------------ */
/* Save / unsave                                                       */
/* ------------------------------------------------------------------ */

export const toggleSavedActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        trip_id: z.string().uuid(),
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
      .eq("provider", "google")
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
      kind: "activity",
      provider: "google",
      provider_place_id: data.provider_place_id,
      name: data.name,
      place_data: (data.place_data ?? {}) as never,
    });
    if (error) throw new Error(error.message);
    return { saved: true };
  });

/* ------------------------------------------------------------------ */
/* Itinerary integration                                               */
/* ------------------------------------------------------------------ */

/**
 * Suggests the day and moment that fit an activity best, using the traveller's
 * real itinerary geography, the activity's natural time of day and its typical
 * length. It NEVER modifies the itinerary — the user confirms explicitly.
 */
export const suggestItinerarySlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        trip_id: z.string().uuid(),
        lat: z.number(),
        lng: z.number(),
        best_time: z.string().optional(),
        typical_minutes: z.number().int().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const trip = await loadTrip(context.supabase, data.trip_id);
    const { distanceKm } = await import("@/lib/places/activity-ranking");

    // Nearest itinerary day by geography — the least travel time for the user.
    const perDay = new Map<number, { lat: number; lng: number; n: number }>();
    for (const p of planPoints(trip.plan)) {
      if (p.day == null) continue;
      const agg = perDay.get(p.day) ?? { lat: 0, lng: 0, n: 0 };
      perDay.set(p.day, { lat: agg.lat + p.lat, lng: agg.lng + p.lng, n: agg.n + 1 });
    }

    let day: number | undefined;
    let km: number | undefined;
    for (const [d, agg] of perDay) {
      const dist = distanceKm(agg.lat / agg.n, agg.lng / agg.n, data.lat, data.lng);
      if (km == null || dist < km) {
        km = dist;
        day = d;
      }
    }

    const slot =
      /sunset/i.test(data.best_time ?? "") ? "sunset"
      : /evening|night/i.test(data.best_time ?? "") ? "night"
      : /morning/i.test(data.best_time ?? "") ? "morning"
      : /full day/i.test(data.best_time ?? "") ? "morning"
      : "afternoon";

    const dayTitle =
      (trip.plan?.itinerary ?? []).find((d) => d.day === day)?.title as string | undefined;

    return {
      day: day ?? 1,
      timeSlot: slot,
      distanceKm: km != null ? Math.round(km * 10) / 10 : undefined,
      dayTitle,
      durationMinutes: data.typical_minutes,
      days: trip.days,
    };
  });

export const addActivityToItinerary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        trip_id: z.string().uuid(),
        provider_place_id: z.string().min(1),
        name: z.string().min(1),
        category: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        day: z.number().int().min(1).max(60),
        time_slot: z.string().min(1),
        duration_minutes: z.number().int().optional(),
        activity_data: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("trip_activities").upsert(
      {
        user_id: userId,
        trip_id: data.trip_id,
        provider: "google",
        provider_place_id: data.provider_place_id,
        name: data.name,
        category: data.category ?? null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        day: data.day,
        time_slot: data.time_slot,
        duration_minutes: data.duration_minutes ?? null,
        activity_data: (data.activity_data ?? {}) as never,
      },
      { onConflict: "user_id,trip_id,provider,provider_place_id" },
    );
    if (error) throw new Error(error.message);
    return { added: true, day: data.day, timeSlot: data.time_slot };
  });

export const removeActivityFromItinerary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ trip_id: z.string().uuid(), provider_place_id: z.string().min(1) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("trip_activities")
      .delete()
      .eq("user_id", context.userId)
      .eq("trip_id", data.trip_id)
      .eq("provider_place_id", data.provider_place_id);
    if (error) throw new Error(error.message);
    return { removed: true };
  });
