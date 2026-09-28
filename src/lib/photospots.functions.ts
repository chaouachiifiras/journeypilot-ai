import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SpotPhoto } from "@/lib/places/photospot.server";
import type { DiscoveredSpot } from "@/lib/places/photospot-discovery.server";

/**
 * Photo Spots API — two clearly separated stages.
 *
 * STAGE A (discovery + ranking): a broad pool of real photography locations is
 * discovered for the destination and ranked by iconic importance, photographic
 * value and the traveller's own preferences. Image availability plays no part.
 *
 * STAGE B (imagery): only for the spots that are actually displayed, the single
 * best verified real photograph of that exact location is resolved. A spot with
 * no good enough frame keeps its place and shows "Photo unavailable".
 *
 * Both stages are cached in `trip_enrichment`.
 */

const Input = z.object({
  trip_id: z.string().uuid(),
  limit: z.number().int().min(1).max(40).default(8),
  refresh: z.boolean().optional(),
});

const DISCOVERY = "photo_spot_discovery";
const IMAGES = "photo_spot_images";

export type PhotoSpotItem = {
  name: string;
  lat?: number;
  lng?: number;
  category: DiscoveredSpot["category"];
  score: number;
  reasons: string[];
  summary?: string;
  rating?: number;
  reviews?: number;
  mapsUrl?: string;
  style?: string;
  tip?: string;
  bestTime?: string;
  fromPlan?: boolean;
  photo: SpotPhoto | null;
};

export const getPhotoSpots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: tripRow, error } = await supabase
      .from("trips")
      .select("id, city, country, plan, interests, travel_style, traveling_with, walking_preference, has_children")
      .eq("id", data.trip_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tripRow) throw new Error("Trip not found");

    const trip = tripRow as unknown as {
      city: string;
      country: string;
      interests: string[] | null;
      travel_style: string;
      traveling_with: string | null;
      walking_preference: string | null;
      has_children: boolean;
      plan: {
        photo_spots?: Array<{ name?: string; lat?: number; lng?: number; style?: string; tip?: string; best_time?: string }>;
      } | null;
    };

    /* ---------------- Stage A: discovery + ranking ---------------- */

    let spots: DiscoveredSpot[] = [];
    let candidateCount = 0;

    if (!data.refresh) {
      const { data: cached } = await supabase
        .from("trip_enrichment")
        .select("place_data")
        .eq("trip_id", data.trip_id)
        .eq("category", DISCOVERY)
        .eq("status", "ready")
        .maybeSingle();
      const payload = cached?.place_data as { spots?: DiscoveredSpot[]; candidateCount?: number } | null;
      if (payload?.spots?.length) {
        spots = payload.spots;
        candidateCount = payload.candidateCount ?? 0;
      }
    }

    if (spots.length === 0) {
      const { discoverPhotoSpots } = await import("@/lib/places/photospot-discovery.server");
      const found = await discoverPhotoSpots(trip.city, trip.country, {
        interests: trip.interests ?? [],
        travelStyle: trip.travel_style,
        companions: trip.traveling_with,
        walking: trip.walking_preference,
        hasChildren: trip.has_children,
        planSpots: (trip.plan?.photo_spots ?? [])
          .filter((s) => !!s?.name)
          .map((s) => ({
            name: s.name!,
            lat: s.lat,
            lng: s.lng,
            style: s.style,
            tip: s.tip,
            best_time: s.best_time,
          })),
      });
      spots = found.spots.slice(0, 40);
      candidateCount = found.candidateCount;

      if (spots.length) {
        await supabase.from("trip_enrichment").delete().eq("trip_id", data.trip_id).eq("category", DISCOVERY);
        await supabase.from("trip_enrichment").insert({
          trip_id: data.trip_id,
          category: DISCOVERY,
          source_query: `photography locations in ${trip.city}, ${trip.country}`,
          status: "ready",
          place_data: { fetched_at: new Date().toISOString(), candidateCount, spots } as never,
        });
      }
    }

    const visible = spots.slice(0, data.limit);

    /* ---------------- Stage B: best real photograph ---------------- */

    const cacheKey = (s: DiscoveredSpot) => s.placeId || `name:${s.name}`;
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

    const missing = visible.filter((s) => !(cacheKey(s) in photoCache));
    if (missing.length) {
      const { bestPhotoForPlace, bestPhotoForSpot } = await import("@/lib/places/photospot.server");
      const resolved = await Promise.all(
        missing.map(async (s) => {
          const photo = s.placeId
            ? await bestPhotoForPlace({
                name: s.name,
                lat: s.lat,
                lng: s.lng,
                placeId: s.placeId,
                mapsUrl: s.mapsUrl,
                photoRefs: s.photoRefs,
              }).catch(() => null)
            : await bestPhotoForSpot({ name: s.name, lat: s.lat, lng: s.lng }, trip.city, trip.country).catch(
                () => null,
              );
          return [cacheKey(s), photo] as const;
        }),
      );
      for (const [k, v] of resolved) photoCache[k] = v;

      await supabase.from("trip_enrichment").delete().eq("trip_id", data.trip_id).eq("category", IMAGES);
      await supabase.from("trip_enrichment").insert({
        trip_id: data.trip_id,
        category: IMAGES,
        source_query: `photo spot imagery in ${trip.city}, ${trip.country}`,
        status: "ready",
        place_data: { fetched_at: new Date().toISOString(), photos: photoCache } as never,
      });
    }

    const items: PhotoSpotItem[] = visible.map((s) => ({
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      category: s.category,
      score: Math.round(s.score * 100) / 100,
      reasons: s.reasons,
      summary: s.summary,
      rating: s.rating,
      reviews: s.reviews,
      mapsUrl: s.mapsUrl,
      style: s.planStyle,
      tip: s.planTip,
      bestTime: s.bestTime,
      fromPlan: s.fromPlan,
      photo: photoCache[cacheKey(s)] ?? null,
    }));

    return { items, total: spots.length, candidateCount };
  });
