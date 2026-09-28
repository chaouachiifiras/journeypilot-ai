import { googleCredentials, resolveGooglePhotoUrl } from "./providers/google.server";

/**
 * Photo Spot imagery — "best photograph of THIS exact place".
 *
 * Two-stage, on purpose:
 *   1. Exact-location resolution. The spot is matched to a real place (Google
 *      Places, biased to the spot's own coordinates) or to Wikimedia Commons
 *      photographs geotagged within a few hundred metres AND whose title
 *      matches the spot. Anything that cannot be tied to the exact location is
 *      discarded — never a generic city shot, never a nearby landmark.
 *   2. Image-quality ranking. Among the verified real candidates we score
 *      composition, resolution, framing, aesthetic signals and curation
 *      badges, then keep the single strongest image.
 *
 * Hard rules: only real photographs, never generated or stock imagery, never a
 * photo of another place, and no image at all rather than a weak one.
 * Image availability never influences which spot is recommended — the spot is
 * chosen by the existing planner logic, the photo is resolved afterwards.
 */

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

export type SpotPhoto = {
  url: string;
  source: "google" | "wikimedia";
  kind: "real";
  verified: true;
  credit?: string;
  creditUrl?: string;
  width?: number;
  height?: number;
  /** 0..1 image-quality score produced by the ranking layer. */
  score: number;
  /** Human readable justification for why this frame won. */
  reasons: string[];
  /** Exact place this photograph belongs to. */
  placeName: string;
  placeId?: string;
  mapsUrl?: string;
};

const STOP = new Set([
  "the", "a", "of", "de", "du", "la", "le", "les", "des", "and", "at", "in", "on", "view",
  "viewpoint", "point", "spot", "photo", "from", "to", "square", "street", "avenue",
]);

function tokens(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function overlap(a: string, b: string) {
  const ta = tokens(a);
  const tb = new Set(tokens(b));
  if (ta.length === 0) return 0;
  return ta.filter((t) => tb.has(t)).length / ta.length;
}

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ------------------------------------------------------------------ */
/* Image quality ranking                                               */
/* ------------------------------------------------------------------ */

/** Words that signal a spectacular travel frame in a photograph's own title. */
const AESTHETIC = [
  ["golden hour", 0.22], ["sunset", 0.2], ["sunrise", 0.18], ["blue hour", 0.2],
  ["twilight", 0.16], ["dusk", 0.15], ["night", 0.12], ["illuminated", 0.12],
  ["panorama", 0.18], ["panoramic", 0.18], ["skyline", 0.16], ["aerial", 0.14],
  ["from above", 0.12], ["reflection", 0.12], ["dramatic", 0.12], ["fog", 0.08],
] as const;

/** Frames that are documentary, not inspiring — never a hero image. */
const REJECT = [
  "map", "plan of", "diagram", "logo", "coat of arms", "plaque", "sign ", "signage",
  "poster", "ticket", "brochure", "screenshot", "scaffold", "construction",
  "under renovation", "graffiti tag", "toilet", "parking", "blurry", "test image",
  "drawing", "engraving", "painting", "lithograph", "postcard", "1900", "19th century",
];

type Candidate = {
  url: string;
  source: "google" | "wikimedia";
  width?: number;
  height?: number;
  title?: string;
  credit?: string;
  creditUrl?: string;
  /** Provider's own ordering (0 = provider's first pick). */
  index: number;
  /** Curation badge, e.g. Commons "Featured picture" / "Quality image". */
  curated?: "featured" | "quality";
  /** 0..1 confidence the frame depicts the exact requested location. */
  locationConfidence: number;
  placeName: string;
  placeId?: string;
  mapsUrl?: string;
  resolver?: () => Promise<string | null>;
};

type Scored = { candidate: Candidate; score: number; reasons: string[] };

/** Words describing the outside of a place — the frame travellers recognise. */
const EXTERIOR = ["exterior", "facade", "entrance", "outside", "building", "view of", "aerial", "panorama", "skyline", "from the"];
/** Interior / documentary frames: fine, but weaker as an activity hero image. */
const INTERIOR = ["interior", "inside", "hall", "lobby", "exhibit", "gallery room", "corridor", "staircase", "detail of", "close-up"];

function scoreCandidate(c: Candidate, opts?: { preferExterior?: boolean }): Scored | null {
  const title = (c.title ?? "").toLowerCase();
  if (REJECT.some((r) => title.includes(r))) return null;

  const reasons: string[] = [];
  let score = 0;

  // Activity cards want the recognisable outside of the place, not a detail shot.
  if (opts?.preferExterior && title) {
    if (EXTERIOR.some((w) => title.includes(w))) {
      score += 0.12;
      reasons.push("shows the place itself from outside");
    } else if (INTERIOR.some((w) => title.includes(w))) {
      score -= 0.1;
    }
  }

  // 1. Exact-location relevance — mandatory, and the heaviest single factor.
  score += c.locationConfidence * 0.3;
  if (c.locationConfidence >= 0.9) reasons.push("verified as the exact recommended location");

  // 2. Resolution / technical quality.
  const px = (c.width ?? 0) * (c.height ?? 0);
  if (px > 0) {
    const res = Math.min(1, px / (4000 * 3000));
    score += res * 0.2;
    if (px >= 6_000_000) reasons.push(`high resolution (${c.width}×${c.height})`);
    else if (px < 700_000) score -= 0.15;
  } else {
    score += 0.1; // unknown size: neutral, Google serves large renders
  }

  // 3. Composition / framing — cinematic landscape framing reads best in the card.
  if (c.width && c.height) {
    const ar = c.width / c.height;
    if (ar >= 1.4 && ar <= 2.1) {
      score += 0.16;
      reasons.push("cinematic landscape framing");
    } else if (ar >= 1.15) score += 0.1;
    else if (ar >= 0.85) score += 0.04;
    else score -= 0.08; // tall verticals crop badly in a wide editorial hero
  } else {
    score += 0.08;
  }

  // 4. Aesthetic signals published with the photograph (light, scenery, depth).
  for (const [word, weight] of AESTHETIC) {
    if (title.includes(word)) {
      score += weight;
      reasons.push(`${word} atmosphere`);
      break;
    }
  }

  // 5. Curation — human-reviewed photographic excellence.
  if (c.curated === "featured") {
    score += 0.28;
    reasons.push("Wikimedia Featured picture (peer-reviewed photographic quality)");
  } else if (c.curated === "quality") {
    score += 0.18;
    reasons.push("Wikimedia Quality image");
  }

  // 6. Provider ranking — Google orders a place's photos by usefulness.
  score += Math.max(0, 0.12 - c.index * 0.02);
  if (c.source === "google" && c.index === 0) reasons.push("Google's top-ranked photo for this place");

  // 7. Attributed authorship correlates with deliberate photography.
  if (c.credit) score += 0.04;

  return { candidate: c, score: Math.max(0, Math.min(1, score)), reasons };
}

/* ------------------------------------------------------------------ */
/* Google Places candidates                                            */
/* ------------------------------------------------------------------ */

const SPOT_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.googleMapsUri",
  "places.businessStatus",
  "places.photos",
].join(",");

type GSpotPhoto = {
  name?: string;
  widthPx?: number;
  heightPx?: number;
  authorAttributions?: Array<{ displayName?: string; uri?: string }>;
};

type GSpotPlace = {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
  businessStatus?: string;
  photos?: GSpotPhoto[];
};

async function searchSpot(
  textQuery: string,
  creds: { lovableKey: string; connectionKey: string },
  spot: { lat?: number; lng?: number },
): Promise<GSpotPlace[]> {
  const body: Record<string, unknown> = { textQuery, pageSize: 5 };
  if (typeof spot.lat === "number" && typeof spot.lng === "number" && (spot.lat || spot.lng)) {
    body["locationBias"] = {
      circle: { center: { latitude: spot.lat, longitude: spot.lng }, radius: 1500 },
    };
  }
  try {
    const res = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.lovableKey}`,
        "X-Connection-Api-Key": creds.connectionKey,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": SPOT_MASK,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    return ((await res.json()) as { places?: GSpotPlace[] }).places ?? [];
  } catch {
    return [];
  }
}

async function googleCandidates(
  spot: { name: string; lat?: number; lng?: number },
  city: string,
  country?: string,
): Promise<Candidate[]> {
  const creds = googleCredentials();
  if (!creds) return [];
  const where = [city, country].filter(Boolean).join(", ");

  /**
   * Planner spots are often described ("Sidi Bou Said blue and white terrace"),
   * which Google cannot match verbatim. We progressively simplify to the core
   * landmark name — the exact-location gate below still applies to every
   * result, so simplifying can never smuggle in a different place.
   */
  const core = tokens(spot.name).slice(0, 3).join(" ");
  const queries = [`${spot.name}, ${where}`];
  if (core && core.toLowerCase() !== spot.name.toLowerCase().trim()) queries.push(`${core}, ${where}`);

  let places: GSpotPlace[] = [];
  for (const q of queries) {
    places = await searchSpot(q, creds, spot);
    if (places.length) break;
  }

  // Pick the single place that is genuinely the recommended spot.
  let best: { place: GSpotPlace; confidence: number } | null = null;
  for (const p of places) {
    const name = p.displayName?.text;
    const lat = p.location?.latitude;
    const lng = p.location?.longitude;
    if (!name || typeof lat !== "number" || typeof lng !== "number") continue;
    const nameMatch = Math.max(overlap(spot.name, name), overlap(name, spot.name));
    const d =
      typeof spot.lat === "number" && typeof spot.lng === "number" && (spot.lat || spot.lng)
        ? distanceM(spot.lat, spot.lng, lat, lng)
        : 0;
    // Exact-location gate: the name must match, or it must be essentially on the spot.
    const near = d <= 400;
    if (nameMatch < 0.5 && !(near && nameMatch > 0)) continue;
    if (d > 2500) continue;
    const confidence = Math.min(1, nameMatch * 0.75 + (near ? 0.25 : 0.1));
    if (!best || confidence > best.confidence) best = { place: p, confidence };
  }
  if (!best) return [];

  const place = best.place;
  return (place.photos ?? []).slice(0, 8).map((ph, index) => ({
    url: "",
    source: "google" as const,
    width: ph.widthPx,
    height: ph.heightPx,
    credit: ph.authorAttributions?.[0]?.displayName
      ? `Photo: ${ph.authorAttributions[0].displayName} / Google`
      : "Google",
    creditUrl: ph.authorAttributions?.[0]?.uri ?? place.googleMapsUri,
    index,
    locationConfidence: best!.confidence,
    placeName: place.displayName?.text ?? spot.name,
    placeId: place.id,
    mapsUrl: place.googleMapsUri,
    resolver: ph.name ? () => resolveGooglePhotoUrl(ph.name!, 1600) : undefined,
  }));
}

/* ------------------------------------------------------------------ */
/* Wikimedia Commons candidates (geotagged, title-matched)             */
/* ------------------------------------------------------------------ */

type CommonsPage = {
  title?: string;
  imageinfo?: Array<{
    url?: string;
    thumburl?: string;
    width?: number;
    height?: number;
    thumbwidth?: number;
    thumbheight?: number;
    descriptionurl?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
};

async function commonsCandidates(spot: {
  name: string;
  lat?: number;
  lng?: number;
}): Promise<Candidate[]> {
  if (typeof spot.lat !== "number" || typeof spot.lng !== "number" || (!spot.lat && !spot.lng)) {
    return [];
  }
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
    // Wide enough to catch a curated shot of a whole quarter/square/landmark
    // area, not just what's geotagged within a few doors of the AI-estimated
    // coordinate (which is itself only approximate for itinerary stops).
    // ggslimit stays at 50: Commons only returns full imageinfo (url/size)
    // for the first 50 hits regardless of a higher ggslimit, so asking for
    // more just means the tail silently arrives with no usable details.
    "&generator=geosearch&ggsnamespace=6&ggslimit=50&ggsradius=900" +
    `&ggscoord=${spot.lat}%7C${spot.lng}` +
    "&prop=imageinfo&iiprop=url%7Csize%7Cextmetadata&iiurlwidth=1600";
  let pages: Record<string, CommonsPage> = {};
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "JourneyPilotAI/1.0 (travel planner)" },
    });
    if (!res.ok) return [];
    pages = ((await res.json()) as { query?: { pages?: Record<string, CommonsPage> } }).query?.pages ?? {};
  } catch {
    return [];
  }

  const out: Candidate[] = [];
  let index = 0;
  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0];
    const title = (page.title ?? "").replace(/^File:/, "").replace(/\.[a-z]+$/i, "");
    const src = info?.thumburl ?? info?.url;
    if (!src || !title) continue;
    // Commons now appends tracking params to `url` (e.g. `...jpg?utm_source=…`),
    // so the extension no longer sits at the very end of the string — matching
    // only `$` silently dropped every single Commons candidate everywhere in
    // the app. Strip the query string before checking the extension.
    if (!/\.(jpe?g|png|webp)$/i.test((info?.url ?? "").split("?")[0] ?? "")) continue;
    const width = info?.width ?? 0;
    const height = info?.height ?? 0;
    if (width < 1200 || height < 800) continue; // low-quality frames are dropped

    // Exact-location gate: the file title must name the spot.
    const nameMatch = Math.max(overlap(spot.name, title), overlap(title, spot.name) * 0.8);
    if (nameMatch < 0.5) continue;

    const meta = info?.extmetadata ?? {};
    const categories = (meta["Categories"]?.value ?? "").toLowerCase();
    const artist = (meta["Artist"]?.value ?? "").replace(/<[^>]*>/g, "").trim();
    const license = meta["LicenseShortName"]?.value ?? "Wikimedia Commons";

    out.push({
      url: src,
      source: "wikimedia",
      // Score on the original file's dimensions, not the ~1600px preview
      // (`thumbwidth`/`thumbheight`) used for `url` — scoring on the
      // thumbnail systematically undervalued genuinely high-resolution
      // Commons photos against Google's (which report their true size),
      // so a well-matched Commons photo could lose to a generic Google
      // business photo purely on this measurement mismatch.
      width,
      height,
      title,
      credit: `${artist || "Wikimedia Commons"} · ${license}`,
      creditUrl: info?.descriptionurl,
      index: index++,
      curated: categories.includes("featured pictures")
        ? "featured"
        : categories.includes("quality images")
          ? "quality"
          : undefined,
      locationConfidence: Math.min(1, 0.6 + nameMatch * 0.4),
      placeName: spot.name,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** Minimum quality a frame must reach to be shown at all. */
const MIN_SCORE = 0.4;

/**
 * Stage B for an already-resolved real place (Stage A discovery).
 *
 * The location is known exactly (Google place id), so no place matching is
 * needed — we only rank that place's own real photographs, with Wikimedia
 * Commons as a geotagged fallback. Never a photo of anywhere else.
 */
export async function bestPhotoForPlace(place: {
  name: string;
  lat?: number;
  lng?: number;
  placeId?: string;
  mapsUrl?: string;
  photoRefs?: Array<{ name: string; widthPx?: number; heightPx?: number; author?: string; authorUri?: string }>;
}, opts?: { preferExterior?: boolean }): Promise<SpotPhoto | null> {
  const own: Candidate[] = (place.photoRefs ?? []).slice(0, 8).map((ph, index) => ({
    url: "",
    source: "google" as const,
    width: ph.widthPx,
    height: ph.heightPx,
    credit: ph.author ? `Photo: ${ph.author} / Google` : "Google",
    creditUrl: ph.authorUri ?? place.mapsUrl,
    index,
    locationConfidence: 1,
    placeName: place.name,
    placeId: place.placeId,
    mapsUrl: place.mapsUrl,
    resolver: () => resolveGooglePhotoUrl(ph.name, 1600),
  }));

  const commons = await commonsCandidates({ name: place.name, lat: place.lat, lng: place.lng }).catch(() => []);
  return pickBest([...own, ...commons], opts);
}

async function pickBest(
  candidates: Candidate[],
  opts?: { preferExterior?: boolean },
): Promise<SpotPhoto | null> {
  const scored = candidates
    .map((c) => scoreCandidate(c, opts))
    .filter((s): s is Scored => !!s && s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  for (const s of scored.slice(0, 4)) {
    const c = s.candidate;
    const url = c.url || (c.resolver ? await c.resolver() : null);
    if (!url) continue;
    return {
      url,
      source: c.source,
      kind: "real",
      verified: true,
      credit: c.credit,
      creditUrl: c.creditUrl,
      width: c.width,
      height: c.height,
      score: Math.round(s.score * 100) / 100,
      reasons: s.reasons,
      placeName: c.placeName,
      placeId: c.placeId,
      mapsUrl: c.mapsUrl,
    };
  }
  return null;
}

export async function bestPhotoForSpot(
  spot: { name: string; lat?: number; lng?: number },
  city: string,
  country?: string,
  opts?: { preferExterior?: boolean },
): Promise<SpotPhoto | null> {
  const [google, commons] = await Promise.all([
    googleCandidates(spot, city, country).catch(() => []),
    commonsCandidates(spot).catch(() => []),
  ]);

  const scored = [...google, ...commons]
    .map((c) => scoreCandidate(c, opts))
    .filter((s): s is Scored => !!s && s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  // Resolve lazily, strongest first, until one actually yields a real URL.
  for (const s of scored.slice(0, 4)) {
    const c = s.candidate;
    const url = c.url || (c.resolver ? await c.resolver() : null);
    if (!url) continue;
    return {
      url,
      source: c.source,
      kind: "real",
      verified: true,
      credit: c.credit,
      creditUrl: c.creditUrl,
      width: c.width,
      height: c.height,
      score: Math.round(s.score * 100) / 100,
      reasons: s.reasons,
      placeName: c.placeName,
      placeId: c.placeId,
      mapsUrl: c.mapsUrl,
    };
  }
  return null;
}
