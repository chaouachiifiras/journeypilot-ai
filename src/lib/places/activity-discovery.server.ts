import { googleCredentials } from "./providers/google.server";
import type { ActivityCategory, RawActivity } from "./activity-ranking";

/**
 * ACTIVITY DISCOVERY (Stage A) — real experiences, anywhere in the world.
 *
 * Nothing about any specific destination is hardcoded. A broad set of
 * destination-agnostic experience archetypes ("boat trip in X", "theme park in
 * X", "sunset experience in X", …) is sent to Google Places (New) through the
 * Lovable connector gateway, together with a popularity sweep around the
 * destination, producing a pool of 40–80+ real, identifiable places.
 *
 * This stage NEVER looks at image availability, and it never invents an
 * activity: every candidate is a real Google place with a real place id.
 * Ranking, personalization and imagery happen in separate modules.
 */

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

const MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.types",
  "places.primaryTypeDisplayName",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.editorialSummary",
  "places.businessStatus",
  "places.photos",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.accessibilityOptions",
  "places.goodForChildren",
  "places.allowsDogs",
  "places.liveMusic",
].join(",");

type GPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
  websiteUri?: string;
  types?: string[];
  primaryTypeDisplayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  editorialSummary?: { text?: string };
  businessStatus?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  accessibilityOptions?: { wheelchairAccessibleEntrance?: boolean };
  goodForChildren?: boolean;
  allowsDogs?: boolean;
  liveMusic?: boolean;
  photos?: Array<{
    name?: string;
    widthPx?: number;
    heightPx?: number;
    authorAttributions?: Array<{ displayName?: string; uri?: string }>;
  }>;
};

const PRICE: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

/**
 * Experience archetypes. Each is a real intent a traveller has in ANY
 * destination. Irrelevant ones simply return nothing (there is no ski resort
 * in Dubai and no desert safari in Tokyo), so categories are never forced.
 */
const ARCHETYPES: Array<{ q: (d: string) => string; category: ActivityCategory; weight: number }> = [
  { q: (d) => `top things to do in ${d}`, category: "landmark", weight: 1 },
  { q: (d) => `iconic landmarks and attractions in ${d}`, category: "landmark", weight: 1 },
  { q: (d) => `best museums in ${d}`, category: "museum", weight: 0.9 },
  { q: (d) => `historical sites in ${d}`, category: "historical", weight: 0.9 },
  { q: (d) => `cultural experiences in ${d}`, category: "cultural", weight: 0.85 },
  { q: (d) => `art galleries in ${d}`, category: "art", weight: 0.75 },
  { q: (d) => `nature and outdoor activities in ${d}`, category: "nature", weight: 0.85 },
  { q: (d) => `best beaches in ${d}`, category: "beach", weight: 0.8 },
  { q: (d) => `boat tour or cruise in ${d}`, category: "boat", weight: 0.85 },
  { q: (d) => `yacht or sailing experience in ${d}`, category: "boat", weight: 0.75 },
  { q: (d) => `water sports and water activities in ${d}`, category: "water", weight: 0.8 },
  { q: (d) => `adventure activities in ${d}`, category: "adventure", weight: 0.85 },
  { q: (d) => `go karting in ${d}`, category: "sports", weight: 0.7 },
  { q: (d) => `theme park or amusement park in ${d}`, category: "themepark", weight: 0.85 },
  { q: (d) => `aquarium or zoo in ${d}`, category: "family", weight: 0.8 },
  { q: (d) => `hiking trails near ${d}`, category: "hiking", weight: 0.75 },
  { q: (d) => `cycling and bike tours in ${d}`, category: "cycling", weight: 0.7 },
  { q: (d) => `best viewpoints and observation decks in ${d}`, category: "viewpoint", weight: 0.9 },
  { q: (d) => `best sunset experience in ${d}`, category: "sunset", weight: 0.8 },
  { q: (d) => `things to do at night in ${d}`, category: "night", weight: 0.75 },
  { q: (d) => `food tour or cooking class in ${d}`, category: "food", weight: 0.8 },
  { q: (d) => `famous markets in ${d}`, category: "market", weight: 0.8 },
  { q: (d) => `best shopping destinations in ${d}`, category: "shopping", weight: 0.7 },
  { q: (d) => `shows concerts and live entertainment in ${d}`, category: "entertainment", weight: 0.75 },
  { q: (d) => `family activities with kids in ${d}`, category: "family", weight: 0.8 },
  { q: (d) => `romantic experiences for couples in ${d}`, category: "romantic", weight: 0.75 },
  { q: (d) => `luxury experiences in ${d}`, category: "luxury", weight: 0.75 },
  { q: (d) => `authentic local experiences in ${d}`, category: "local", weight: 0.8 },
  { q: (d) => `unusual and unique things to do in ${d}`, category: "unique", weight: 0.8 },
  { q: (d) => `guided tours and excursions in ${d}`, category: "cultural", weight: 0.7 },
  { q: (d) => `spa hammam or wellness experience in ${d}`, category: "luxury", weight: 0.6 },
  { q: (d) => `desert safari or nature excursion from ${d}`, category: "adventure", weight: 0.7 },
];

/** Google types that describe a real, doable experience, with their category. */
const TYPE_CATEGORY: Array<[string, ActivityCategory]> = [
  ["amusement_park", "themepark"],
  ["water_park", "water"],
  ["theme_park", "themepark"],
  ["aquarium", "family"],
  ["zoo", "family"],
  ["museum", "museum"],
  ["art_gallery", "art"],
  ["historical_landmark", "historical"],
  ["historical_place", "historical"],
  ["archaeological_site", "historical"],
  ["monument", "landmark"],
  ["cultural_landmark", "cultural"],
  ["tourist_attraction", "landmark"],
  ["observation_deck", "viewpoint"],
  ["scenic_point", "viewpoint"],
  ["national_park", "nature"],
  ["state_park", "nature"],
  ["hiking_area", "hiking"],
  ["botanical_garden", "nature"],
  ["garden", "nature"],
  ["park", "nature"],
  ["beach", "beach"],
  ["marina", "boat"],
  ["ferry_terminal", "boat"],
  ["boat_tour_agency", "boat"],
  ["sailing_club", "boat"],
  ["water_sports", "water"],
  ["scuba_diving_center", "water"],
  ["surfing_area", "water"],
  ["karaoke", "entertainment"],
  ["go_kart_track", "sports"],
  ["adventure_sports_center", "adventure"],
  ["sports_complex", "sports"],
  ["ski_resort", "sports"],
  ["stadium", "sports"],
  ["concert_hall", "entertainment"],
  ["performing_arts_theater", "entertainment"],
  ["opera_house", "entertainment"],
  ["movie_theater", "entertainment"],
  ["cultural_center", "cultural"],
  ["market", "market"],
  ["food_court", "food"],
  ["cooking_school", "food"],
  ["shopping_mall", "shopping"],
  ["department_store", "shopping"],
  ["spa", "luxury"],
  ["church", "cultural"],
  ["mosque", "cultural"],
  ["hindu_temple", "cultural"],
  ["buddhist_temple", "cultural"],
  ["synagogue", "cultural"],
  ["place_of_worship", "cultural"],
  ["planetarium", "family"],
  ["observatory", "viewpoint"],
  ["wildlife_park", "nature"],
  ["bridge", "landmark"],
  ["plaza", "landmark"],
  ["visitor_center", "cultural"],
  ["tour_agency", "cultural"],
  ["travel_agency", "cultural"],
];

/** Places that are services or logistics, not experiences. */
const TYPE_REJECT = new Set([
  "lodging", "hotel", "motel", "hostel", "restaurant", "cafe", "bar", "bakery",
  "supermarket", "grocery_store", "convenience_store", "gas_station", "parking",
  "bank", "atm", "hospital", "pharmacy", "doctor", "dentist", "car_rental",
  "car_repair", "airport", "train_station", "bus_station", "subway_station",
  "real_estate_agency", "insurance_agency", "school", "university", "post_office",
  "government_office", "storage", "moving_company", "electrician", "plumber",
  "night_club", "casino", "gym", "beauty_salon", "hair_salon", "barber_shop",
  "clothing_store", "shoe_store", "jewelry_store", "electronics_store", "corporate_office",
]);

async function textSearch(
  textQuery: string,
  creds: { lovableKey: string; connectionKey: string },
  center?: { lat: number; lng: number },
  radius = 35000,
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

/** Most popular real attractions around the destination — catches icons that
 *  text queries can miss in very dense cities. Destination-agnostic. */
async function popularitySweep(
  creds: { lovableKey: string; connectionKey: string },
  center: { lat: number; lng: number },
): Promise<GPlace[]> {
  const offsets: Array<[number, number]> = [
    [0, 0], [0.05, 0], [-0.05, 0], [0, 0.06], [0, -0.06], [0.045, 0.055], [-0.045, -0.055],
  ];
  const typeSets = [
    ["tourist_attraction", "historical_landmark", "observation_deck"],
    ["amusement_park", "aquarium", "zoo", "museum"],
  ];
  const rounds = await Promise.all(
    offsets.flatMap(([dLat, dLng]) =>
      typeSets.map(async (includedTypes) => {
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
              includedTypes,
              maxResultCount: 20,
              rankPreference: "POPULARITY",
              locationRestriction: {
                circle: { center: { latitude: center.lat + dLat, longitude: center.lng + dLng }, radius: 6000 },
              },
            }),
          });
          if (!res.ok) return [];
          return ((await res.json()) as { places?: GPlace[] }).places ?? [];
        } catch {
          return [];
        }
      }),
    ),
  );
  return rounds.flat();
}

async function destinationCenter(destination: string, creds: { lovableKey: string; connectionKey: string }) {
  const p = (await textSearch(destination, creds))[0];
  const lat = p?.location?.latitude;
  const lng = p?.location?.longitude;
  return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : undefined;
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function categoriesFor(p: GPlace, archetype: ActivityCategory): ActivityCategory[] {
  const types = p.types ?? [];
  const fromTypes = TYPE_CATEGORY.filter(([t]) => types.includes(t)).map(([, c]) => c);
  return [...new Set([archetype, ...fromTypes])];
}

/**
 * Stage A. Returns a broad pool of real, de-duplicated activity candidates for
 * the destination — typically 60–200 depending on how much the destination has.
 * Never padded, never fabricated: a small destination simply returns fewer.
 */
export async function discoverActivities(
  city: string,
  country?: string,
): Promise<{ activities: RawActivity[]; candidateCount: number }> {
  const creds = googleCredentials();
  if (!creds) return { activities: [], candidateCount: 0 };

  const destination = [city, country].filter(Boolean).join(", ");
  const center = await destinationCenter(destination, creds);

  const [archetypeResults, popular] = await Promise.all([
    Promise.all(ARCHETYPES.map(async (a) => ({ a, places: await textSearch(a.q(destination), creds, center) }))),
    center ? popularitySweep(creds, center) : Promise.resolve([] as GPlace[]),
  ]);

  const rounds = [
    ...archetypeResults,
    { a: { q: () => "", category: "landmark" as ActivityCategory, weight: 0.95 }, places: popular },
  ];

  const pool = new Map<string, RawActivity>();
  let rawCount = 0;

  for (const { a, places } of rounds) {
    for (const p of places) {
      rawCount++;
      const id = p.id;
      const name = p.displayName?.text;
      const lat = p.location?.latitude;
      const lng = p.location?.longitude;
      if (!id || !name || typeof lat !== "number" || typeof lng !== "number") continue;
      if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;

      const types = p.types ?? [];
      const experiential = TYPE_CATEGORY.some(([t]) => types.includes(t));
      // Reject on the place's primary nature only — many genuine attractions
      // also carry a commercial type (an observation tower with a mall inside).
      if (types[0] && TYPE_REJECT.has(types[0]) && !experiential) continue;
      if (!experiential && types.some((t) => TYPE_REJECT.has(t))) continue;
      if (!experiential && (p.userRatingCount ?? 0) < 200) continue;
      if (center && distanceKm(center.lat, center.lng, lat, lng) > 70) continue;

      const existing = pool.get(id);
      if (existing) {
        existing.hits += 1;
        existing.categories = [...new Set([...existing.categories, ...categoriesFor(p, a.category)])];
        if (a.weight > existing.archetypeWeight) {
          existing.archetypeWeight = a.weight;
          existing.categories = [a.category, ...existing.categories.filter((c) => c !== a.category)];
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
        website: p.websiteUri,
        types,
        typeLabel: p.primaryTypeDisplayName?.text,
        summary: p.editorialSummary?.text,
        rating: p.rating,
        reviews: p.userRatingCount,
        priceLevel: p.priceLevel ? PRICE[p.priceLevel] : undefined,
        openingHours: p.regularOpeningHours?.weekdayDescriptions,
        wheelchair: p.accessibilityOptions?.wheelchairAccessibleEntrance,
        goodForChildren: p.goodForChildren,
        allowsDogs: p.allowsDogs,
        liveMusic: p.liveMusic,
        photoRefs: (p.photos ?? [])
          .slice(0, 8)
          .map((ph) => ({
            name: ph.name ?? "",
            widthPx: ph.widthPx,
            heightPx: ph.heightPx,
            author: ph.authorAttributions?.[0]?.displayName,
            authorUri: ph.authorAttributions?.[0]?.uri,
          }))
          .filter((ph) => ph.name),
        categories: categoriesFor(p, a.category),
        hits: 1,
        archetypeWeight: a.weight,
      });
    }
  }

  return { activities: [...pool.values()], candidateCount: rawCount };
}
