import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Global, cross-trip photo cache keyed by place name (+ city). Reuses the
 * same verified Google Places / Wikimedia Commons resolution as the Photo
 * Spots tab (see photospot.server.ts) instead of a separate Unsplash
 * pipeline — no extra API key, and every photo already carries a credit.
 * `place_photos` stores every result, including "no good photo found"
 * (url: null), so the same landmark is never re-resolved across trips.
 */

const Input = z.object({
  city: z.string().min(1),
  country: z.string().optional(),
  places: z
    .array(
      z.object({
        name: z.string().min(1),
        lat: z.number().optional(),
        lng: z.number().optional(),
      }),
    )
    .min(1)
    .max(40),
});

export type PlacePhotoLite = {
  url: string;
  source: "google" | "wikimedia";
  credit?: string;
  creditUrl?: string;
} | null;

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function placeKey(name: string, city: string) {
  return `${normalize(name)}|${normalize(city)}`;
}

type PlacePhotoRow = {
  place_key: string;
  url: string | null;
  source: string | null;
  credit: string | null;
  credit_url: string | null;
};

export const getPlacePhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const keys = data.places.map((p) => placeKey(p.name, data.city));

    const { data: rows } = await supabase
      .from("place_photos")
      .select("place_key, url, source, credit, credit_url")
      .in("place_key", keys);

    const cache = new Map<string, PlacePhotoRow>(
      ((rows as PlacePhotoRow[] | null) ?? []).map((r) => [r.place_key, r]),
    );
    const missing = data.places.filter((p) => !cache.has(placeKey(p.name, data.city)));

    if (missing.length) {
      const { bestPhotoForSpot } = await import("@/lib/places/photospot.server");
      const resolved = await Promise.all(
        missing.map(async (p) => {
          const photo = await bestPhotoForSpot(
            { name: p.name, lat: p.lat, lng: p.lng },
            data.city,
            data.country,
            { preferExterior: true },
          ).catch(() => null);
          return { key: placeKey(p.name, data.city), name: p.name, photo };
        }),
      );

      await supabase.from("place_photos").upsert(
        resolved.map((r) => ({
          place_key: r.key,
          place_name: r.name,
          city: data.city,
          url: r.photo?.url ?? null,
          source: r.photo?.source ?? null,
          credit: r.photo?.credit ?? null,
          credit_url: r.photo?.creditUrl ?? null,
          width: r.photo?.width ?? null,
          height: r.photo?.height ?? null,
        })),
        { onConflict: "place_key" },
      );

      for (const r of resolved) {
        cache.set(r.key, {
          place_key: r.key,
          url: r.photo?.url ?? null,
          source: r.photo?.source ?? null,
          credit: r.photo?.credit ?? null,
          credit_url: r.photo?.creditUrl ?? null,
        });
      }
    }

    const out: Record<string, PlacePhotoLite> = {};
    for (const p of data.places) {
      const row = cache.get(placeKey(p.name, data.city));
      out[p.name] =
        row?.url != null
          ? {
              url: row.url,
              source: (row.source as "google" | "wikimedia") ?? "google",
              credit: row.credit ?? undefined,
              creditUrl: row.credit_url ?? undefined,
            }
          : null;
    }
    return out;
  });
