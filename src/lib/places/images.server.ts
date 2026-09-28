import type { PlacePhoto } from "./types";

/**
 * Real venue imagery resolution.
 *
 * Hard rule: we only ever attach a photo that is *known* to depict the venue.
 * We never fall back to stock photography or generated imagery for a named
 * place — a missing photo renders as a typographic placeholder in the UI.
 *
 * Current sources (no API key required):
 *  - OSM `image` tag (a direct URL published by the venue/mappers)
 *  - OSM `wikimedia_commons` tag -> Wikimedia Commons Special:FilePath
 *  - OSM `wikidata` tag -> Wikidata P18 (image) -> Commons Special:FilePath
 */

const COMMONS_FILEPATH = "https://commons.wikimedia.org/wiki/Special:FilePath/";

function commonsUrl(file: string, width = 800) {
  const clean = file.replace(/^File:/i, "").trim();
  return `${COMMONS_FILEPATH}${encodeURIComponent(clean)}?width=${width}`;
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

/** Resolve Wikidata ids to their P18 image file names in one batch call. */
export async function resolveWikidataImages(
  ids: string[],
  signal?: AbortSignal,
): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter((id) => /^Q\d+$/.test(id)))].slice(0, 50);
  if (unique.length === 0) return {};
  const url =
    "https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&props=claims&ids=" +
    unique.join("|");
  try {
    const res = await fetch(url, {
      signal,
      headers: { Accept: "application/json", "User-Agent": "JourneyPilotAI/1.0 (travel planner)" },
    });
    if (!res.ok) return {};
    const json = (await res.json()) as {
      entities?: Record<string, { claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: string } } }>> }>;
    };
    const out: Record<string, string> = {};
    for (const [id, entity] of Object.entries(json.entities ?? {})) {
      const file = entity.claims?.["P18"]?.[0]?.mainsnak?.datavalue?.value;
      if (typeof file === "string" && file) out[id] = file;
    }
    return out;
  } catch {
    return {};
  }
}

export function photoFromTags(
  tags: Record<string, string>,
  wikidataImages: Record<string, string>,
): PlacePhoto | undefined {
  const commons = tags["wikimedia_commons"];
  if (commons && /^File:/i.test(commons)) {
    return {
      url: commonsUrl(commons),
      source: "wikimedia",
      kind: "real",
      verified: true,
      credit: "Wikimedia Commons",
      creditUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(commons)}`,
    };
  }
  const qid = tags["wikidata"];
  if (qid && wikidataImages[qid]) {
    return {
      url: commonsUrl(wikidataImages[qid]!),
      source: "wikimedia",
      kind: "real",
      verified: true,
      credit: "Wikimedia Commons",
      creditUrl: `https://www.wikidata.org/wiki/${qid}`,
    };
  }
  const img = tags["image"];
  if (img && isHttpUrl(img)) {
    return { url: img.trim(), source: "venue", kind: "real", verified: true, credit: "Venue / OpenStreetMap" };
  }
  return undefined;
}
