import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Shared cache for Google Places search responses (searchText / searchNearby),
 * keyed by endpoint + request body + field mask. Discovery for a destination
 * issues the same requests for every trip there, so the second trip to a city
 * costs no Google calls at all (and stays clear of the connector's daily cap).
 *
 * 30 days is the longest Google's terms allow Places content to be cached.
 * Only successful responses are stored; a failed request is retried next time.
 * The table is service-role only (no RLS policies), so users can't poison it.
 */
const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

type Creds = { lovableKey: string; connectionKey: string };

function cacheKey(endpoint: string, body: unknown, mask: string) {
  return createHash("sha256").update(`${endpoint}\n${mask}\n${JSON.stringify(body)}`).digest("hex");
}

/** POST to a Places search endpoint and return `places`, or null when the request failed. */
export async function cachedPlacesSearch<T>(
  endpoint: "places:searchText" | "places:searchNearby",
  body: Record<string, unknown>,
  mask: string,
  creds: Creds,
): Promise<T[] | null> {
  const key = cacheKey(endpoint, body, mask);

  try {
    const { data } = await supabaseAdmin
      .from("google_places_cache")
      .select("response, fetched_at")
      .eq("cache_key", key)
      .maybeSingle();
    if (data && Date.now() - new Date(data.fetched_at).getTime() < TTL_MS) {
      return ((data.response as { places?: T[] } | null)?.places ?? []) as T[];
    }
  } catch {
    // Cache unavailable: fall through to Google.
  }

  let places: T[];
  try {
    const res = await fetch(`${GATEWAY}/places/v1/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.lovableKey}`,
        "X-Connection-Api-Key": creds.connectionKey,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": mask,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    places = ((await res.json()) as { places?: T[] }).places ?? [];
  } catch {
    return null;
  }

  try {
    await supabaseAdmin.from("google_places_cache").upsert({
      cache_key: key,
      endpoint,
      response: { places } as never,
      fetched_at: new Date().toISOString(),
    });
  } catch {
    // Best effort: a failed write only means the next request goes to Google again.
  }
  return places;
}
