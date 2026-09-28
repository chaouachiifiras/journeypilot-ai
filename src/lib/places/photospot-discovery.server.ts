import { googleCredentials } from "./providers/google.server";

/**
 * Photo Spot DISCOVERY (Stage A).
 *
 * Finds a broad pool of real photography locations for any destination in the
 * world, then ranks them by photographic value. This stage never looks at
 * whether a good photograph is available — image resolution happens afterwards
 * in Stage B (`photospot.server.ts`), so an iconic place is never dropped just
 * because no usable frame exists.
 *
 * The system is destination-agnostic: nothing about Paris, Dubai, Tokyo or any
 * other city is hardcoded. Iconic locations emerge from real Google signals
 * (how many people rate a place, how it is typed, how often it surfaces across
 * independent "famous / iconic / must-see" style queries).
 */

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

const MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.googleMapsUri",
  "places.types",
  "places.primaryTypeDisplayName",
  "places.rating",
  "places.userRatingCount",
  "places.editorialSummary",
  "places.businessStatus",
  "places.photos",
].join(",");

export type SpotCategory = "iconic" | "viewpoint" | "scenic" | "local";

export type DiscoveredSpot = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  mapsUrl?: string;
  types: string[];
  rating?: number;
  reviews?: number;
  summary?: string;
  photoRefs: Array<{ name: string; widthPx?: number; heightPx?: number; author?: string; authorUri?: string }>;
  category: SpotCategory;
  /** How many independent discovery queries surfaced this place. */
  hits: number;
  score: number;
  reasons: string[];
  /** Present when the planner itself recommended this location. */
  fromPlan?: boolean;
  planStyle?: string;
  planTip?: string;
  bestTime?: string;
};

type GPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
  types?: string[];
  primaryTypeDisplayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  editorialSummary?: { text?: string };
  businessStatus?: string;
  photos?: Array<{
    name?: string;
    widthPx?: number;
    heightPx?: number;
    authorAttributions?: Array<{ displayName?: string; uri?: string }>;
  }>;
};

/**
 * Destination-agnostic photography archetypes. Each is a real intent a travel
 * photographer has anywhere in the world; the destination name is the only
 * variable part.
 */
const ARCHETYPES: Array<{ q: (d: string) => string; category: SpotCategory; weight: number }> = [
  { q: (d) => `iconic landmarks in ${d}`, category: "iconic", weight: 1 },
  { q: (d) => `most famous monuments in ${d}`, category: "iconic", weight: 1 },
  { q: (d) => `must see tourist attractions in ${d}`, category: "iconic", weight: 0.95 },
  { q: (d) => `famous architecture in ${d}`, category: "iconic", weight: 0.9 },
  { q: (d) => `best viewpoints in ${d}`, category: "viewpoint", weight: 0.95 },
  { q: (d) => `panoramic observation deck in ${d}`, category: "viewpoint", weight: 0.9 },
  { q: (d) => `rooftop view of ${d} skyline`, category: "viewpoint", weight: 0.85 },
  { q: (d) => `sunset viewpoint in ${d}`, category: "viewpoint", weight: 0.85 },
  { q: (d) => `famous bridge in ${d}`, category: "scenic", weight: 0.8 },
  { q: (d) => `waterfront promenade in ${d}`, category: "scenic", weight: 0.75 },
  { q: (d) => `best beach near ${d}`, category: "scenic", weight: 0.7 },
  { q: (d) => `beautiful park or garden in ${d}`, category: "scenic", weight: 0.7 },
  { q: (d) => `historic square in ${d}`, category: "scenic", weight: 0.75 },
  { q: (d) => `most instagrammable places in ${d}`, category: "local", weight: 0.8 },
  { q: (d) => `hidden gem photo spot in ${d}`, category: "local", weight: 0.7 },
  { q: (d) => `famous street in ${d}`, category: "local", weight: 0.7 },
  { q: (d) => `photogenic old town in ${d}`, category: "local", weight: 0.7 },
  { q: (d) => `scenic neighborhood in ${d}`, category: "local", weight: 0.65 },
  { q: (d) => `best photo spots in ${d}`, category: "iconic", weight: 0.9 },
  { q: (d) => `famous temple cathedral or mosque in ${d}`, category: "iconic", weight: 0.85 },
  { q: (d) => `landmark tower in ${d}`, category: "iconic", weight: 0.9 },
];

/** Place types that photograph well, with their photographic weight. */
const TYPE_BONUS: Record<string, number> = {
  tourist_attraction: 0.1,
  historical_landmark: 0.12,
  historical_place: 0.1,
  monument: 0.12,
  observation_deck: 0.14,
  scenic_point: 0.14,
  viewpoint: 0.14,
  national_park: 0.1,
  park: 0.06,
  garden: 0.06,
  beach: 0.1,
  bridge: 0.1,
  plaza: 0.08,
  church: 0.07,
  mosque: 0.07,
  hindu_temple: 0.07,
  buddhist_temple: 0.07,
  synagogue: 0.06,
  place_of_worship: 0.05,
  cultural_landmark: 0.1,
  art_gallery: 0.03,
  museum: 0.03,
  marina: 0.06,
  amusement_park: 0.03,
  archaeological_site: 0.12,
  historical_landmark_and_museum: 0.1,
};

/** Types that are not photography destinations, whatever their rating. */
const TYPE_REJECT = new Set([
  "lodging", "hotel", "restaurant", "cafe", "bar", "supermarket", "shopping_mall",
  "store", "clothing_store", "gas_station", "parking", "bank", "atm", "hospital",
  "pharmacy", "car_rental", "travel_agency", "airport", "train_station", "bus_station",
  "real_estate_agency", "insurance_agency", "gym", "spa", "night_club", "school",
  "dentist", "doctor", "post_office", "government_office",
]);

const STOP = new Set(["the", "a", "of", "de", "du", "la", "le", "les", "des", "and", "at", "in", "on", "el", "al"]);

function norm(v: string) {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function similarity(a: string, b: string) {
  const ta = norm(a);
  const tb = new Set(norm(b));
  if (!ta.length) return 0;
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

async function textSearch(
  textQuery: string,
  creds: { lovableKey: string; connectionKey: string },
  center?: { lat: number; lng: number },
  radius = 30000,
): Promise<GPlace[]> {
  const body: Record<string, unknown> = { textQuery, pageSize: 20 };
  if (center) body["locationBias"] = { circle: { center: { latitude: center.lat, longitude: center.lng }, radius } };
  try {
    const res = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.lovableKey}`,
        "X-Connection-Api-Key": creds.connectionKey,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": MASK,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    return ((await res.json()) as { places?: GPlace[] }).places ?? [];
  } catch {
    return [];
  }
}

/**
 * Popularity sweep. Text queries can miss a mega-city's most photographed
 * landmark simply because the destination has hundreds of attractions, so we
 * also ask Google for the most POPULAR attractions around several points of
 * the destination. Fully destination-agnostic.
 */
async function popularitySweep(
  creds: { lovableKey: string; connectionKey: string },
  center: { lat: number; lng: number },
): Promise<GPlace[]> {
  const offsets = [
    [0, 0],
    [0.045, 0],
    [-0.045, 0],
    [0, 0.055],
    [0, -0.055],
    [0.04, 0.05],
    [0.04, -0.05],
    [-0.04, 0.05],
    [-0.04, -0.05],
  ];
  const rounds = await Promise.all(
    offsets.map(async ([dLat, dLng]) => {
      try {
        const res = await fetch(`${GATEWAY}/places/v1/places:searchNearby`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${creds.lovableKey}`,
            "X-Connection-Api-Key": creds.connectionKey,
            "Content-Type": "application/json",
            "X-Goog-FieldMask": MASK,
          },
          body: JSON.stringify({
            includedTypes: ["tourist_attraction", "historical_landmark", "observation_deck"],
            maxResultCount: 20,
            rankPreference: "POPULARITY",
            locationRestriction: {
              circle: { center: { latitude: center.lat + dLat!, longitude: center.lng + dLng! }, radius: 5000 },
            },
          }),
        });
        if (!res.ok) return [];
        return ((await res.json()) as { places?: GPlace[] }).places ?? [];
      } catch {
        return [];
      }
    }),
  );
  return rounds.flat();
}

async function destinationCenter(
  destination: string,
  creds: { lovableKey: string; connectionKey: string },
) {
  const places = await textSearch(destination, creds);
  const p = places[0];
  const lat = p?.location?.latitude;
  const lng = p?.location?.longitude;
  return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : undefined;
}

export type SpotPreferences = {
  interests?: string[];
  travelStyle?: string;
  companions?: string | null;
  walking?: string | null;
  hasChildren?: boolean;
  /** Locations the planner already put in the itinerary. */
  planSpots?: Array<{ name: string; lat?: number; lng?: number; style?: string; tip?: string; best_time?: string }>;
};

/** Interest keyword → place signals, used only for re-ordering, never filtering. */
const INTEREST_SIGNALS: Array<{ match: RegExp; words: string[] }> = [
  { match: /nature|hiking|outdoor|garden|park/i, words: ["park", "garden", "national_park", "beach", "scenic_point", "natural"] },
  { match: /beach|sea|coast|water/i, words: ["beach", "marina", "waterfront", "harbor", "corniche"] },
  { match: /architect|design|modern/i, words: ["historical_landmark", "monument", "cultural_landmark", "tower", "bridge"] },
  { match: /history|herit|museum|culture/i, words: ["historical", "museum", "monument", "ruins", "medina", "old"] },
  { match: /night|nightlife|city|urban/i, words: ["observation_deck", "skyline", "tower", "plaza", "district"] },
  { match: /food|market/i, words: ["market", "souk", "bazaar", "street"] },
  { match: /relig|spirit/i, words: ["church", "mosque", "temple", "cathedral", "place_of_worship"] },
];

function scoreSpot(
  s: Omit<DiscoveredSpot, "score" | "reasons">,
  center: { lat: number; lng: number } | undefined,
  prefs: SpotPreferences,
  archetypeWeight: number,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // 1. Iconic importance — how many real travellers have reviewed the place.
  const reviews = s.reviews ?? 0;
  const fame = Math.min(1, Math.log10(reviews + 1) / 5); // 100k reviews ≈ 1
  score += fame * 0.34;
  if (reviews >= 50000) reasons.push(`world-famous (${reviews.toLocaleString()} reviews)`);
  else if (reviews >= 8000) reasons.push(`major landmark (${reviews.toLocaleString()} reviews)`);

  // 2. Recognizability — surfaced by several independent "famous / iconic" queries.
  score += Math.min(0.14, (s.hits - 1) * 0.05);
  if (s.hits >= 3) reasons.push(`appears across ${s.hits} independent iconic-landmark searches`);

  // 3. Quality of the place itself.
  if (typeof s.rating === "number") {
    score += Math.max(0, Math.min(1, (s.rating - 3.6) / 1.4)) * 0.12;
    if (s.rating >= 4.6) reasons.push(`outstanding visitor rating (${s.rating})`);
  }

  // 4. Photographic archetype and place type.
  score += archetypeWeight * 0.12;
  const typeScore = Math.max(0, ...s.types.map((t) => TYPE_BONUS[t] ?? 0));
  score += typeScore;
  if (typeScore >= 0.1) reasons.push("photography-grade landmark type");
  if (s.category === "viewpoint") reasons.push("panoramic viewpoint");
  if (s.category === "local") reasons.push("distinctive local photography location");

  // 5. Photographic evidence — how much real imagery the location generates.
  score += Math.min(0.1, s.photoRefs.length * 0.012);

  // 6. Travel convenience — influences the score, never dominates it.
  if (center) {
    const km = distanceM(center.lat, center.lng, s.lat, s.lng) / 1000;
    // Convenience matters, but a world-class location 20 km away must still
    // outrank an ordinary place around the corner.
    const walkSensitivity = prefs.walking === "low" ? 0.08 : prefs.walking === "high" ? 0.03 : 0.05;
    score -= Math.min(walkSensitivity, (km / 30) * walkSensitivity);
  }

  // 7. Personalization — reorders, never removes.
  const hay = `${s.name} ${s.summary ?? ""} ${s.types.join(" ")}`.toLowerCase();
  for (const interest of prefs.interests ?? []) {
    const sig = INTEREST_SIGNALS.find((i) => i.match.test(interest));
    const words = sig?.words ?? [interest.toLowerCase()];
    if (words.some((w) => hay.includes(w))) {
      score += 0.08;
      reasons.push(`matches your interest in ${interest}`);
      break;
    }
  }
  if (prefs.companions === "couple" && /sunset|garden|bridge|viewpoint|old/.test(hay)) score += 0.03;
  if (prefs.hasChildren && /park|garden|beach|aquarium|zoo/.test(hay)) score += 0.03;

  // 8. The planner already chose this location for the itinerary.
  if (s.fromPlan) {
    score += 0.12;
    reasons.push("already part of your itinerary");
  }

  return { score: Math.max(0, Math.min(1, score)), reasons };
}

/** Two entries are the same location when ids match, or names+coordinates do. */
function isDuplicate(a: DiscoveredSpot, b: DiscoveredSpot) {
  if (a.placeId && a.placeId === b.placeId) return true;
  const d = distanceM(a.lat, a.lng, b.lat, b.lng);
  const sim = Math.max(similarity(a.name, b.name), similarity(b.name, a.name));
  if (d < 60 && sim >= 0.4) return true;
  return d < 150 && sim >= 0.8;
}

/**
 * Stage A. Returns a ranked, de-duplicated, category-balanced list of real
 * photography locations for the destination — typically 30–60 candidates.
 */
export async function discoverPhotoSpots(
  city: string,
  country: string | undefined,
  prefs: SpotPreferences = {},
): Promise<{ spots: DiscoveredSpot[]; candidateCount: number }> {
  const creds = googleCredentials();
  if (!creds) return { spots: [], candidateCount: 0 };
  const destination = [city, country].filter(Boolean).join(", ");
  const center = await destinationCenter(destination, creds);

  const [archetypeResults, popular] = await Promise.all([
    Promise.all(ARCHETYPES.map(async (a) => ({ a, places: await textSearch(a.q(destination), creds, center) }))),
    center ? popularitySweep(creds, center) : Promise.resolve([] as GPlace[]),
  ]);
  const results = [
    ...archetypeResults,
    { a: { q: () => "", category: "iconic" as SpotCategory, weight: 0.95 }, places: popular },
  ];

  const pool = new Map<string, DiscoveredSpot & { archetypeWeight: number }>();
  let rawCount = 0;

  for (const { a, places } of results) {
    for (const p of places) {
      rawCount++;
      const id = p.id;
      const name = p.displayName?.text;
      const lat = p.location?.latitude;
      const lng = p.location?.longitude;
      if (!id || !name || typeof lat !== "number" || typeof lng !== "number") continue;
      if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
      const types = p.types ?? [];
      // Reject on the place's PRIMARY nature only: many genuine landmarks also
      // carry commercial types (Tokyo Tower is also a shopping_mall).
      const photogenic = types.some((t) => t in TYPE_BONUS);
      if (types[0] && TYPE_REJECT.has(types[0]) && !photogenic) continue;
      if (!photogenic && types.some((t) => TYPE_REJECT.has(t))) continue;
      if (center && distanceM(center.lat, center.lng, lat, lng) > 60000) continue;

      const existing = pool.get(id);
      if (existing) {
        existing.hits += 1;
        // Keep the strongest archetype the place surfaced under.
        if (a.weight > existing.archetypeWeight) {
          existing.archetypeWeight = a.weight;
          existing.category = a.category;
        }
        continue;
      }
      pool.set(id, {
        placeId: id,
        name,
        lat,
        lng,
        address: p.formattedAddress,
        mapsUrl: p.googleMapsUri,
        types,
        rating: p.rating,
        reviews: p.userRatingCount,
        summary: p.editorialSummary?.text,
        photoRefs: (p.photos ?? []).slice(0, 8).map((ph) => ({
          name: ph.name ?? "",
          widthPx: ph.widthPx,
          heightPx: ph.heightPx,
          author: ph.authorAttributions?.[0]?.displayName,
          authorUri: ph.authorAttributions?.[0]?.uri,
        })).filter((ph) => ph.name),
        category: a.category,
        hits: 1,
        score: 0,
        reasons: [],
        archetypeWeight: a.weight,
      });
    }
  }

  // Planner spots are always eligible, even when Google discovery missed them.
  for (const ps of prefs.planSpots ?? []) {
    if (!ps.name) continue;
    const match = [...pool.values()].find(
      (c) =>
        Math.max(similarity(ps.name, c.name), similarity(c.name, ps.name)) >= 0.6 ||
        (typeof ps.lat === "number" && typeof ps.lng === "number" && distanceM(ps.lat, ps.lng, c.lat, c.lng) < 150),
    );
    if (match) {
      match.fromPlan = true;
      match.planStyle = ps.style;
      match.planTip = ps.tip;
      match.bestTime = ps.best_time;
      continue;
    }
    if (typeof ps.lat !== "number" || typeof ps.lng !== "number") continue;
    pool.set(`plan:${ps.name}`, {
      placeId: "",
      name: ps.name,
      lat: ps.lat,
      lng: ps.lng,
      types: [],
      photoRefs: [],
      category: "local",
      hits: 1,
      score: 0,
      reasons: [],
      fromPlan: true,
      planStyle: ps.style,
      planTip: ps.tip,
      bestTime: ps.best_time,
      archetypeWeight: 0.7,
    });
  }

  const scored = [...pool.values()].map((c) => {
    const { archetypeWeight, ...spot } = c;
    const { score, reasons } = scoreSpot(spot, center, prefs, archetypeWeight);
    return { ...spot, score, reasons } as DiscoveredSpot;
  });

  // Near-duplicate collapse: keep the stronger of two entries for one location
  // (e.g. "Eiffel Tower" vs "Tour Eiffel"), but keep genuinely distinct
  // viewpoints of the same landmark (Trocadéro stays next to the Eiffel Tower).
  scored.sort((a, b) => b.score - a.score);
  const unique: DiscoveredSpot[] = [];
  for (const s of scored) {
    if (unique.some((u) => isDuplicate(u, s))) continue;
    unique.push(s);
  }

  return { spots: balance(unique), candidateCount: rawCount };
}

/**
 * Final mix. The head of the list mixes must-photograph icons, spectacular
 * viewpoints and distinctive local locations, without ever promoting a weak
 * candidate just to fill a category.
 */
function balance(spots: DiscoveredSpot[]): DiscoveredSpot[] {
  const strongest = [...spots].sort((a, b) => b.score - a.score);
  const head: DiscoveredSpot[] = [];
  const used = new Set<DiscoveredSpot>();
  const take = (s?: DiscoveredSpot) => {
    if (!s || used.has(s)) return;
    head.push(s);
    used.add(s);
  };

  // The very strongest photography locations of the destination are never
  // displaced by category balancing — an icon always outranks a nearby extra.
  strongest.slice(0, 4).forEach(take);

  // Then a deliberate mix, but only with genuinely strong candidates.
  const pick = (category: SpotCategory[], n: number) => {
    let taken = 0;
    for (const s of strongest) {
      if (taken >= n) break;
      if (used.has(s) || !category.includes(s.category) || s.score < 0.55) continue;
      take(s);
      taken++;
    }
  };
  pick(["iconic"], 2);
  pick(["viewpoint", "scenic"], 2);
  pick(["local"], 2);

  head.sort((a, b) => b.score - a.score);
  return [...head, ...strongest.filter((s) => !used.has(s))];
}
