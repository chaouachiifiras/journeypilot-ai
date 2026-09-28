import type { Place, PlaceQuery, PlacesProvider, PriceLevel } from "../types";
import { photoFromTags, resolveWikidataImages } from "../images.server";

/**
 * OpenStreetMap provider (Overpass API + Nominatim geocoding).
 *
 * Chosen for this milestone because it returns REAL venues with real names,
 * real coordinates, real addresses, real cuisine/amenity tags and — where
 * mappers supplied them — real, venue-specific photographs. No API key needed.
 *
 * It does not publish crowd-sourced review scores or live prices, so those
 * fields stay undefined rather than being invented. A commercial provider can
 * be dropped in later behind the same `PlacesProvider` interface.
 */

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const UA = "JourneyPilotAI/1.0 (travel itinerary planner)";

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type GeoArea = {
  lat: number;
  lng: number;
  /** [south, north, west, east] administrative bounding box from Nominatim. */
  bbox?: [number, number, number, number];
  /** Radius in metres derived from the administrative bounding box. */
  radius: number;
  displayName?: string;
};

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ *
 * Simple process-level caches: deduplicate concurrent identical calls  *
 * and avoid re-hitting Nominatim/Overpass for the same destination.    *
 * ------------------------------------------------------------------ */
type CacheEntry<T> = { at: number; value: T };
const GEO_TTL = 24 * 60 * 60 * 1000;
const SEARCH_TTL = 6 * 60 * 60 * 1000;
const geoCache = new Map<string, CacheEntry<GeoArea | null>>();
const searchCache = new Map<string, CacheEntry<Place[]>>();
const inflight = new Map<string, Promise<unknown>>();

function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

function fresh<T>(map: Map<string, CacheEntry<T>>, key: string, ttl: number): T | undefined {
  const hit = map.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  if (hit) map.delete(key);
  return undefined;
}

const EARTH_R = 6371;
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

/**
 * Geocode a destination and read back its administrative extent, so results
 * can be constrained to the city the traveller actually selected.
 */
export async function geocodeCity(city: string, country: string): Promise<GeoArea | null> {
  const key = `${city.toLowerCase()}|${country.toLowerCase()}`;
  const cached = fresh(geoCache, key, GEO_TTL);
  if (cached !== undefined) return cached;

  return dedupe(`geo:${key}`, async () => {
    const url =
      "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=0&q=" +
      encodeURIComponent(`${city}, ${country}`);
    let value: GeoArea | null = null;
    try {
      value = await withTimeout(async (signal) => {
        const res = await fetch(url, { signal, headers: { "User-Agent": UA, Accept: "application/json" } });
        if (!res.ok) return null;
        const rows = (await res.json()) as Array<{
          lat: string;
          lon: string;
          boundingbox?: [string, string, string, string];
          display_name?: string;
        }>;
        const first = rows[0];
        if (!first) return null;
        const lat = Number(first.lat);
        const lng = Number(first.lon);
        let bbox: GeoArea["bbox"];
        let radius = 6000;
        if (first.boundingbox) {
          const [s, n, w, e] = first.boundingbox.map(Number) as [number, number, number, number];
          if ([s, n, w, e].every(Number.isFinite)) {
            bbox = [s, n, w, e];
            // Half-diagonal of the admin area, clamped to a sane search radius.
            const half = distanceKm({ lat: s, lng: w }, { lat: n, lng: e }) / 2;
            radius = Math.round(Math.min(15, Math.max(3, half)) * 1000);
          }
        }
        return { lat, lng, bbox, radius, displayName: first.display_name };
      }, 12_000);
    } catch {
      value = null;
    }
    geoCache.set(key, { at: Date.now(), value });
    return value;
  });
}

export type SettlementMatch = { name: string; admin?: string; lat: number; lng: number };

const SETTLEMENT_TTL = 60 * 60 * 1000;
const settlementCache = new Map<string, CacheEntry<SettlementMatch[]>>();

const SETTLEMENT_TYPES = new Set(["city", "town", "village", "municipality", "hamlet"]);

// Country borders are effectively static, so this is cached far longer than
// the other geo lookups.
const COUNTRY_GEO_TTL = 30 * 24 * 60 * 60 * 1000;
const countryGeoCache = new Map<string, CacheEntry<GeoArea | null>>();

/**
 * Geocodes a country's own administrative extent from its ISO 3166-1 code,
 * so a settlement search can be geographically boxed to that country. This
 * is what makes 1-2 letter queries usable at all: without a bounding box,
 * "S" matches thousands of places worldwide and the country's own cities
 * never make it into the ranked results Photon returns.
 */
async function geocodeCountry(countryCode: string): Promise<GeoArea | null> {
  const cc = countryCode.toUpperCase();
  const cached = fresh(countryGeoCache, cc, COUNTRY_GEO_TTL);
  if (cached !== undefined) return cached;

  return dedupe(`countrygeo:${cc}`, async () => {
    let value: GeoArea | null = null;
    try {
      const name = new Intl.DisplayNames(["en"], { type: "region" }).of(cc) ?? cc;
      const url =
        "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&featureType=country&q=" +
        encodeURIComponent(name);
      value = await withTimeout(async (signal) => {
        const res = await fetch(url, { signal, headers: { "User-Agent": UA, Accept: "application/json" } });
        if (!res.ok) return null;
        const rows = (await res.json()) as Array<{
          lat: string;
          lon: string;
          boundingbox?: [string, string, string, string];
        }>;
        const first = rows[0];
        if (!first) return null;
        const lat = Number(first.lat);
        const lng = Number(first.lon);
        let bbox: GeoArea["bbox"];
        if (first.boundingbox) {
          const [s, n, w, e] = first.boundingbox.map(Number) as [number, number, number, number];
          if ([s, n, w, e].every(Number.isFinite)) bbox = [s, n, w, e];
        }
        return { lat, lng, bbox, radius: 0 };
      }, 10_000);
    } catch {
      value = null;
    }
    countryGeoCache.set(cc, { at: Date.now(), value });
    return value;
  });
}

/**
 * Real cities/towns/villages inside a given country matching a partial name —
 * powers the trip planner's destination autocomplete so users can only pick a
 * place that actually exists.
 *
 * Uses Photon (photon.komoot.io), not Nominatim: Nominatim's /search is a
 * full-text index over *complete* place names and does not do prefix
 * matching — "Sous" or "Souss" return nothing at all for "Sousse", only the
 * fully-typed name works, which made the field feel broken while typing.
 * Photon is built on the same OSM data specifically for incremental
 * autocomplete and matches on partial words.
 *
 * Boxed to the selected country's own bounding box (via `geocodeCountry`)
 * whenever that's resolvable: with a 1-2 letter query, an unboxed search is
 * dominated by places worldwide and the country's own cities are buried
 * past Photon's result window. `countrycode` is still checked per result
 * as a safety net, since a bounding box can graze a neighbouring country.
 */
// Photon's public instance only understands these as the `lang` param (it picks which
// translated name field comes back); anything else — ar, zh, nl, etc. — returns zero
// results instead of falling back, so every unsupported UI language must be clamped
// to one of these before it reaches Photon. The search itself still works the same;
// only which name variant is *returned* changes.
const PHOTON_SUPPORTED_LANGS = new Set(["en", "de", "fr"]);

export async function searchSettlements(query: string, countryCode: string, lang: string): Promise<SettlementMatch[]> {
  const q = query.trim();
  if (q.length < 1 || !countryCode) return [];
  const photonLang = PHOTON_SUPPORTED_LANGS.has(lang) ? lang : "en";
  const key = `${countryCode.toLowerCase()}|${photonLang}|${q.toLowerCase()}`;
  const cached = fresh(settlementCache, key, SETTLEMENT_TTL);
  if (cached !== undefined) return cached;

  return dedupe(`settlement:${key}`, async () => {
    const area = await geocodeCountry(countryCode).catch(() => null);
    const bboxParam = area?.bbox
      ? `&bbox=${area.bbox[2]},${area.bbox[0]},${area.bbox[3]},${area.bbox[1]}`
      : "";
    const url =
      "https://photon.komoot.io/api/?osm_tag=place&limit=30" +
      `&lang=${encodeURIComponent(photonLang)}` +
      bboxParam +
      `&q=${encodeURIComponent(q)}`;
    let value: SettlementMatch[] = [];
    try {
      value = await withTimeout(async (signal) => {
        const res = await fetch(url, { signal, headers: { "User-Agent": UA, Accept: "application/json" } });
        if (!res.ok) return [];
        const json = (await res.json()) as {
          features?: Array<{
            geometry?: { coordinates?: [number, number] };
            properties?: { name?: string; osm_value?: string; state?: string; countrycode?: string };
          }>;
        };
        const seen = new Set<string>();
        const out: SettlementMatch[] = [];
        for (const f of json.features ?? []) {
          const p = f.properties ?? {};
          if ((p.countrycode ?? "").toLowerCase() !== countryCode.toLowerCase()) continue;
          if (!p.osm_value || !SETTLEMENT_TYPES.has(p.osm_value)) continue;
          const name = p.name;
          const coords = f.geometry?.coordinates;
          if (!name || !coords) continue;
          const [lng, lat] = coords;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const admin = p.state ?? undefined;
          const dedupeKey = `${name.toLowerCase()}|${(admin ?? "").toLowerCase()}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          out.push({ name, admin, lat, lng });
          if (out.length >= 8) break;
        }
        return out;
      }, 8_000);
    } catch {
      value = [];
    }
    settlementCache.set(key, { at: Date.now(), value });
    return value;
  });
}

/**
 * Category filters.
 * Restaurants: only venues whose primary purpose is serving food/drink on site.
 * Hotels: only tourism accommodation types — never generic buildings or offices.
 */
function buildQuery(kind: PlaceQuery["kind"], lat: number, lng: number, radius: number) {
  const common = `["name"]["disused"!~"."]["abandoned"!~"."]["was:amenity"!~"."]["construction"!~"."]`;
  const filter =
    kind === "restaurant"
      ? `nwr["amenity"~"^(restaurant|cafe|fast_food|bistro|food_court|ice_cream)$"]${common}(around:${radius},${lat},${lng});` +
        `nwr["amenity"="bar"]["cuisine"]${common}(around:${radius},${lat},${lng});` +
        `nwr["amenity"="pub"]["food"="yes"]${common}(around:${radius},${lat},${lng});`
      : `nwr["tourism"~"^(hotel|guest_house|hostel|motel|resort|apartment)$"]${common}(around:${radius},${lat},${lng});`;
  return `[out:json][timeout:50];(${filter});out center tags 800;`;
}

async function runOverpass(body: string): Promise<OverpassElement[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < OVERPASS_ENDPOINTS.length * 2; attempt++) {
    const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length]!;
    if (attempt >= OVERPASS_ENDPOINTS.length) await new Promise((r) => setTimeout(r, 1500));
    try {
      return await withTimeout(async (signal) => {
        const res = await fetch(endpoint, {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
          body: "data=" + encodeURIComponent(body),
        });
        if (!res.ok) throw new Error(`Overpass ${res.status}`);
        const json = (await res.json()) as { elements?: OverpassElement[]; remark?: string };
        // Overpass answers 200 with a `remark` when it ran out of time/memory;
        // treat that as a failure so the next mirror gets a chance.
        if (json.remark && !(json.elements ?? []).length) throw new Error(`Overpass: ${json.remark}`);
        return json.elements ?? [];
      }, 55_000);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Overpass request failed");
}

function num(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function priceFromTags(tags: Record<string, string>, kind: PlaceQuery["kind"]): PriceLevel | undefined {
  // OSM does not carry a price level field; derive only from explicit signals.
  const explicit = tags["price_level"] ?? tags["price:range"] ?? tags["price"];
  if (explicit) {
    const dollars = explicit.match(/[$€£¥]+/)?.[0]?.length;
    if (dollars) return Math.min(4, Math.max(1, dollars)) as PriceLevel;
  }
  if (kind === "restaurant") {
    if (tags["amenity"] === "fast_food") return 1;
    if (tags["cuisine"]?.includes("fine_dining")) return 4;
  } else {
    if (tags["tourism"] === "hostel") return 1;
    if (tags["tourism"] === "guest_house") return 2;
    const stars = num(tags["stars"]);
    if (stars) return Math.min(4, Math.max(1, Math.round(stars - 1))) as PriceLevel;
  }
  return undefined;
}

const AMENITY_TAGS: Array<[string, string, string]> = [
  ["internet_access", "wlan", "Wi-Fi"],
  ["internet_access", "yes", "Wi-Fi"],
  ["swimming_pool", "yes", "Pool"],
  ["air_conditioning", "yes", "Air conditioning"],
  ["breakfast", "yes", "Breakfast"],
  ["parking", "yes", "Parking"],
  ["spa", "yes", "Spa"],
  ["outdoor_seating", "yes", "Outdoor seating"],
  ["takeaway", "yes", "Takeaway"],
  ["delivery", "yes", "Delivery"],
  ["reservation", "yes", "Reservations"],
  ["dog", "yes", "Pet friendly"],
  ["wheelchair", "yes", "Step-free access"],
];

function toPlace(el: OverpassElement, kind: PlaceQuery["kind"], wikidataImages: Record<string, string>): Place | null {
  const tags = el.tags ?? {};
  const name = tags["name"];
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!name || lat == null || lng == null) return null;

  const cuisines = (tags["cuisine"] ?? "")
    .split(";")
    .map((c) => c.trim().replace(/_/g, " "))
    .filter(Boolean);

  const amenities: string[] = [];
  for (const [key, value, label] of AMENITY_TAGS) {
    if (tags[key] === value && !amenities.includes(label)) amenities.push(label);
  }
  if (tags["stars"]) amenities.push(`${num(tags["stars"])}-star`);

  const addressParts = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const area = tags["addr:suburb"] ?? tags["addr:neighbourhood"] ?? tags["addr:district"] ?? tags["addr:city"];

  return {
    kind,
    name,
    lat,
    lng,
    address: [addressParts, tags["addr:city"]].filter(Boolean).join(", ") || undefined,
    area: area || undefined,
    cuisines: cuisines.length ? cuisines : undefined,
    stars: kind === "hotel" ? num(tags["stars"]) : undefined,
    priceLevel: priceFromTags(tags, kind),
    priceNote: tags["price:range"] ?? tags["price"] ?? undefined,
    amenities,
    flags: {
      vegetarian: tags["diet:vegetarian"] === "yes" || tags["diet:vegetarian"] === "only",
      vegan: tags["diet:vegan"] === "yes" || tags["diet:vegan"] === "only",
      halal: tags["diet:halal"] === "yes" || tags["diet:halal"] === "only",
      kosher: tags["diet:kosher"] === "yes" || tags["diet:kosher"] === "only",
      glutenFree: tags["diet:gluten_free"] === "yes",
      outdoorSeating: tags["outdoor_seating"] === "yes",
      takeaway: tags["takeaway"] === "yes",
      fastFood: tags["amenity"] === "fast_food",
      fineDining: /fine_dining/.test(tags["cuisine"] ?? "") || (num(tags["stars"]) ?? 0) >= 5,
      familyFriendly: tags["kids_area"] === "yes" || tags["child_care"] === "yes" || tags["highchair"] === "yes",
      wheelchair: tags["wheelchair"] === "yes",
      localChain: Boolean(tags["brand"]),
      guesthouse: tags["tourism"] === "guest_house",
      hostel: tags["tourism"] === "hostel",
      apartment: tags["tourism"] === "apartment",
    },
    website: tags["website"] ?? tags["contact:website"] ?? undefined,
    phone: tags["phone"] ?? tags["contact:phone"] ?? undefined,
    openingHours: tags["opening_hours"] ?? undefined,
    photo: photoFromTags(tags, wikidataImages),
    source: {
      provider: "osm",
      id: `${el.type}/${el.id}`,
      url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      attribution: "© OpenStreetMap contributors",
    },
  };
}

/** Keep only venues that really sit inside the selected destination. */
function insideDestination(place: Place, area: GeoArea, cityName: string): boolean {
  if (area.bbox) {
    const [s, n, w, e] = area.bbox;
    const pad = 0.01; // ~1 km tolerance for boundary-hugging addresses
    const inBox = place.lat >= s - pad && place.lat <= n + pad && place.lng >= w - pad && place.lng <= e + pad;
    if (!inBox) return false;
  }
  // An explicit, conflicting addr:city is the strongest possible signal.
  const addrCity = place.address?.split(",").pop()?.trim().toLowerCase();
  if (addrCity && cityName && addrCity.length > 2) {
    const target = cityName.toLowerCase();
    if (!addrCity.includes(target) && !target.includes(addrCity)) {
      // Only reject when it is also far from the centre — many suburbs are legitimate.
      if (distanceKm({ lat: area.lat, lng: area.lng }, place) > area.radius / 1000) return false;
    }
  }
  return true;
}

export const osmProvider: PlacesProvider = {
  id: "osm",
  attribution: "© OpenStreetMap contributors",
  async search(query: PlaceQuery): Promise<Place[]> {
    let area: GeoArea | null = null;
    if (query.lat != null && query.lng != null) {
      area = { lat: query.lat, lng: query.lng, radius: query.radius ?? 8000 };
    } else {
      area = await geocodeCity(query.city, query.country);
      if (!area) return [];
    }
    const radius = query.radius ?? area.radius;
    const cacheKey = `${query.kind}|${area.lat.toFixed(3)}|${area.lng.toFixed(3)}|${radius}`;
    const cached = fresh(searchCache, cacheKey, SEARCH_TTL);
    if (cached) return cached.slice(0, query.limit ?? 400);

    return dedupe(`search:${cacheKey}`, async () => {
      const elements = await runOverpass(buildQuery(query.kind, area!.lat, area!.lng, radius));

      const qids = elements
        .map((el) => el.tags?.["wikidata"])
        .filter((v): v is string => typeof v === "string");
      const wikidataImages = await resolveWikidataImages(qids);

      const places: Place[] = [];
      const seen = new Set<string>();
      for (const el of elements) {
        const place = toPlace(el, query.kind, wikidataImages);
        if (!place) continue;
        if (!insideDestination(place, area!, query.city)) continue;
        const dedupeKey = `${place.name.toLowerCase()}|${place.lat.toFixed(3)}|${place.lng.toFixed(3)}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        places.push(place);
      }
      searchCache.set(cacheKey, { at: Date.now(), value: places });
      return places.slice(0, query.limit ?? 400);
    });
  },
};
