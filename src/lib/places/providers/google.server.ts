import type { Place, PlaceQuery, PlacesProvider, PriceLevel } from "../types";

/**
 * Google Places (New) provider — routed through the Lovable connector gateway.
 *
 * Everything returned here is real Google data: real place id, real name, real
 * address, real coordinates, real rating / review count / price level when
 * Google publishes them, the real Google Maps place URL and real Google photos.
 * A field Google does not publish stays undefined — nothing is invented.
 *
 * Cost guardrails: a bounded number of text searches per destination+kind
 * (4 queries × 20 results), the result set is cached by the caller in
 * `trip_enrichment`, and photo URLs are resolved lazily only for the venues
 * that are actually shown.
 */

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.types",
  "places.primaryTypeDisplayName",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.photos",
  "places.editorialSummary",
  "places.businessStatus",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.accessibilityOptions",
  "places.outdoorSeating",
  "places.takeout",
  "places.servesVegetarianFood",
  "places.goodForChildren",
].join(",");

export function googleCredentials() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !connectionKey) return null;
  return { lovableKey, connectionKey };
}

type GPhoto = {
  name?: string;
  authorAttributions?: Array<{ displayName?: string; uri?: string }>;
};

type GPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types?: string[];
  primaryTypeDisplayName?: { text?: string };
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  photos?: GPhoto[];
  editorialSummary?: { text?: string };
  businessStatus?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  accessibilityOptions?: { wheelchairAccessibleEntrance?: boolean };
  outdoorSeating?: boolean;
  takeout?: boolean;
  servesVegetarianFood?: boolean;
  goodForChildren?: boolean;
};

const PRICE: Record<string, PriceLevel> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const LODGING_TYPES = new Set([
  "hotel",
  "lodging",
  "resort_hotel",
  "motel",
  "inn",
  "bed_and_breakfast",
  "guest_house",
  "hostel",
  "extended_stay_hotel",
  "budget_japanese_inn",
  "japanese_inn",
  "cottage",
  "farmstay",
]);

const NON_RESTAURANT = new Set([
  "gas_station",
  "supermarket",
  "grocery_store",
  "convenience_store",
  "lodging",
  "shopping_mall",
]);

function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function cuisinesFrom(types: string[]) {
  const out = types
    .filter((t) => t.endsWith("_restaurant") || t === "cafe" || t === "bakery" || t === "bar")
    .filter((t) => !["fine_dining_restaurant", "family_restaurant", "restaurant"].includes(t))
    .map((t) => titleCase(t.replace(/_restaurant$/, "")));
  return [...new Set(out)].slice(0, 4);
}

const QUERIES: Record<"restaurant" | "hotel", string[]> = {
  restaurant: [
    "best restaurants in",
    "traditional local restaurants in",
    "affordable well rated restaurants in",
    "fine dining restaurants in",
  ],
  hotel: [
    "best hotels in",
    "boutique or unique hotels in",
    "affordable well rated hotels in",
    "luxury hotels in",
  ],
};

async function searchText(query: string, creds: { lovableKey: string; connectionKey: string }) {
  const res = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.lovableKey}`,
      "X-Connection-Api-Key": creds.connectionKey,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: query, pageSize: 20 }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Places request failed [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { places?: GPlace[] };
  return json.places ?? [];
}

/** Resolve a Google photo reference to a real, displayable photo URL. */
export async function resolveGooglePhotoUrl(photoName: string, maxWidthPx = 900) {
  const creds = googleCredentials();
  if (!creds) return null;
  try {
    const res = await fetch(
      `${GATEWAY}/places/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true`,
      {
        headers: {
          Authorization: `Bearer ${creds.lovableKey}`,
          "X-Connection-Api-Key": creds.connectionKey,
        },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { photoUri?: string };
    return json.photoUri ?? null;
  } catch {
    return null;
  }
}

function toPlace(g: GPlace, kind: "restaurant" | "hotel"): Place | null {
  const name = g.displayName?.text?.trim();
  const lat = g.location?.latitude;
  const lng = g.location?.longitude;
  const id = g.id;
  if (!name || !id || typeof lat !== "number" || typeof lng !== "number") return null;
  if (g.businessStatus && g.businessStatus !== "OPERATIONAL") return null;

  const types = g.types ?? [];
  if (kind === "hotel") {
    if (!types.some((t) => LODGING_TYPES.has(t))) return null;
  } else {
    const isFood = types.some((t) => t === "restaurant" || t.endsWith("_restaurant") || t === "cafe" || t === "bakery");
    if (!isFood) return null;
    if (types.some((t) => NON_RESTAURANT.has(t))) return null;
  }

  const amenities: string[] = [];
  if (g.outdoorSeating) amenities.push("Outdoor seating");
  if (g.takeout) amenities.push("Takeaway");
  if (g.accessibilityOptions?.wheelchairAccessibleEntrance) amenities.push("Step-free entrance");
  if (g.goodForChildren) amenities.push("Good for children");

  return {
    kind,
    name,
    lat,
    lng,
    address: g.formattedAddress ?? g.shortFormattedAddress,
    area: g.shortFormattedAddress,
    cuisines: kind === "restaurant" ? cuisinesFrom(types) : undefined,
    rating: typeof g.rating === "number" ? g.rating : undefined,
    ratingCount: typeof g.userRatingCount === "number" ? g.userRatingCount : undefined,
    priceLevel: g.priceLevel ? PRICE[g.priceLevel] : undefined,
    amenities,
    summary: g.editorialSummary?.text,
    category: g.primaryTypeDisplayName?.text,
    flags: {
      vegetarian: g.servesVegetarianFood || undefined,
      outdoorSeating: g.outdoorSeating || undefined,
      takeaway: g.takeout || undefined,
      fastFood: types.includes("fast_food_restaurant") || undefined,
      fineDining: types.includes("fine_dining_restaurant") || undefined,
      familyFriendly: g.goodForChildren || types.includes("family_restaurant") || undefined,
      wheelchair: g.accessibilityOptions?.wheelchairAccessibleEntrance || undefined,
      guesthouse: types.includes("guest_house") || types.includes("bed_and_breakfast") || undefined,
      hostel: types.includes("hostel") || undefined,
      apartment: types.includes("extended_stay_hotel") || undefined,
    },
    website: g.websiteUri,
    phone: g.nationalPhoneNumber,
    openingHours: g.regularOpeningHours?.weekdayDescriptions?.join(" · "),
    /** Google's own place page — the exact venue, not a name search. */
    mapsUrl: g.googleMapsUri,
    mapsUrlExact: !!g.googleMapsUri,
    photoRef: g.photos?.[0]?.name,
    photoCredit: g.photos?.[0]?.authorAttributions?.[0]?.displayName,
    source: {
      provider: "google",
      id,
      url: g.googleMapsUri,
      attribution: "Google",
    },
  };
}

export const googleProvider: PlacesProvider = {
  id: "google",
  attribution: "Google",
  async search(query: PlaceQuery): Promise<Place[]> {
    const creds = googleCredentials();
    if (!creds) throw new Error("Google Places is not connected");
    const where = [query.city, query.country].filter(Boolean).join(", ");
    const results = await Promise.allSettled(
      QUERIES[query.kind].map((q) => searchText(`${q} ${where}`, creds)),
    );
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length === results.length) {
      throw new Error((failures[0] as PromiseRejectedResult).reason?.message ?? "Google Places unavailable");
    }
    const seen = new Set<string>();
    const places: Place[] = [];
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const g of r.value) {
        const place = toPlace(g, query.kind);
        if (!place || seen.has(place.source.id)) continue;
        seen.add(place.source.id);
        places.push(place);
      }
    }
    return places;
  },
};
