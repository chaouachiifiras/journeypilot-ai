import type { Place, PlaceKind, PriceLevel } from "./types";

/**
 * Deterministic, provider-agnostic ranking engine.
 *
 * Every score is derived from data the provider actually supplied — a missing
 * signal contributes a neutral value instead of an invented one.
 */

export type TripPreferences = {
  city: string;
  country: string;
  days: number;
  budget: number;
  currency: string;
  travelStyle: "budget" | "standard" | "luxury";
  interests: string[];
  companions?: "solo" | "couple" | "friends" | "family" | null;
  hasChildren?: boolean;
  foodPreferences?: string | null;
  accessibility?: string | null;
  walking?: "low" | "medium" | "high" | null;
  /** Centre of the itinerary (city centre or mean of planned stops). */
  center?: { lat: number; lng: number };
  /** Planned itinerary stops, used for "close to your plan" scoring. */
  itineraryPoints?: Array<{ lat: number; lng: number }>;
  /** Places the traveller saved before — nudges similar options up. */
  savedNames?: string[];
  savedCuisines?: string[];
};

export type RecommendationBadge =
  | "best_overall"
  | "best_value"
  | "budget"
  | "premium"
  | "local_favourite"
  | "romantic"
  | "family"
  | "quick_casual"
  | "best_location"
  | "unique_stay"
  | "highly_rated";

export type Recommendation = {
  place: Place;
  score: number;
  badges: RecommendationBadge[];
  /** Human readable "why we recommend it" bullet points. */
  reasons: string[];
  /** Distance in km from the itinerary centre, when known. */
  distanceKm?: number;
  breakdown: Record<string, number>;
};

const R = 6371;
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const STYLE_TARGET: Record<TripPreferences["travelStyle"], PriceLevel> = {
  budget: 1,
  standard: 2,
  luxury: 4,
};

function budgetScore(place: Place, prefs: TripPreferences) {
  if (place.priceLevel == null) return 0.5; // unknown → neutral, never penalised as fake data
  const target = STYLE_TARGET[prefs.travelStyle];
  const delta = Math.abs(place.priceLevel - target);
  return Math.max(0, 1 - delta * 0.3);
}

function qualityScore(place: Place) {
  let s = 0.4;
  if (place.rating != null) s = place.rating / 5;
  else if (place.stars != null) s = Math.min(1, place.stars / 5);
  // Review volume: a real confidence signal when the provider publishes it.
  const reviews = place.ratingCount ?? 0;
  const confidence = reviews > 0 ? Math.min(1, Math.log10(reviews + 1) / 3.5) : 0;
  // Completeness of the record is a real proxy for a well-known, active venue.
  // NOTE: photo availability is deliberately NOT part of this score — a great
  // venue without a photo must be able to outrank an average one with a photo.
  const richness =
    (place.website ? 1 : 0) +
    (place.phone ? 1 : 0) +
    (place.openingHours ? 1 : 0) +
    (place.summary ? 1 : 0) +
    (place.address ? 1 : 0) +
    Math.min(2, place.amenities.length * 0.5);
  return Math.min(1, s * 0.55 + confidence * 0.2 + Math.min(1, richness / 6) * 0.25);
}


function locationScore(place: Place, prefs: TripPreferences) {
  const points = prefs.itineraryPoints?.length ? prefs.itineraryPoints : prefs.center ? [prefs.center] : [];
  if (!points.length) return 0.5;
  const best = Math.min(...points.map((p) => distanceKm(p, place)));
  if (best <= 0.4) return 1;
  if (best >= 8) return 0.05;
  return Math.max(0.05, 1 - (best - 0.4) / 7.6);
}

function dietTokens(foodPreferences?: string | null) {
  const raw = (foodPreferences ?? "").toLowerCase();
  return {
    vegetarian: /vegetarian|végétarien|نباتي/.test(raw),
    vegan: /vegan|végan/.test(raw),
    halal: /halal|حلال/.test(raw),
    kosher: /kosher/.test(raw),
    glutenFree: /gluten/.test(raw),
    keywords: raw.split(/[,;/]| and | et /).map((s) => s.trim()).filter((s) => s.length > 2),
  };
}

function preferenceScore(place: Place, prefs: TripPreferences) {
  let s = 0.45;
  const diet = dietTokens(prefs.foodPreferences);

  if (place.kind === "restaurant") {
    const cuisines = (place.cuisines ?? []).map((c) => c.toLowerCase());
    if (diet.vegetarian && place.flags.vegetarian) s += 0.2;
    if (diet.vegan && place.flags.vegan) s += 0.2;
    if (diet.halal && place.flags.halal) s += 0.2;
    if (diet.kosher && place.flags.kosher) s += 0.2;
    if (diet.glutenFree && place.flags.glutenFree) s += 0.1;
    for (const kw of diet.keywords) {
      if (cuisines.some((c) => c.includes(kw) || kw.includes(c))) s += 0.12;
    }
    for (const interest of prefs.interests.map((i) => i.toLowerCase())) {
      if (cuisines.some((c) => c.includes(interest))) s += 0.06;
      if (/food|gastronom|cuisine/.test(interest) && cuisines.length) s += 0.04;
    }
    for (const cuisine of prefs.savedCuisines ?? []) {
      if (cuisines.includes(cuisine.toLowerCase())) s += 0.08;
    }
    if (prefs.hasChildren && place.flags.familyFriendly) s += 0.12;
    if (prefs.hasChildren && place.flags.fineDining) s -= 0.08;
    if (prefs.companions === "couple" && place.flags.outdoorSeating) s += 0.04;
  } else {
    if (prefs.travelStyle === "luxury" && (place.stars ?? 0) >= 4) s += 0.2;
    if (prefs.travelStyle === "budget" && (place.flags.hostel || place.flags.guesthouse)) s += 0.18;
    if (prefs.companions === "family" || prefs.hasChildren) {
      if (place.flags.apartment) s += 0.12;
      if (place.amenities.includes("Pool")) s += 0.06;
      if (place.flags.hostel) s -= 0.12;
    }
    if (prefs.companions === "solo" && place.flags.hostel) s += 0.08;
    if (place.amenities.includes("Breakfast")) s += 0.04;
    if (place.amenities.includes("Wi-Fi")) s += 0.03;
  }

  if (prefs.accessibility && place.flags.wheelchair) s += 0.12;
  if (prefs.walking === "low") s += 0.0; // handled by location weight below
  if ((prefs.savedNames ?? []).some((n) => n.toLowerCase() === place.name.toLowerCase())) s += 0.15;

  return Math.max(0, Math.min(1, s));
}

function authenticityScore(place: Place) {
  let s = 0.6;
  if (place.flags.localChain) s -= 0.35;
  if (place.flags.fastFood) s -= 0.2;
  if (place.flags.guesthouse) s += 0.15;
  return Math.max(0, Math.min(1, s));
}

/**
 * Photo availability is intentionally absent from every weight below: imagery
 * never influences the ranking, only the presentation.
 */
const WEIGHTS = {
  preference: 0.32,
  quality: 0.22,
  location: 0.18,
  budget: 0.18,
  authenticity: 0.1,
};

function reasonsFor(place: Place, prefs: TripPreferences, dist?: number): string[] {
  const out: string[] = [];
  if (dist != null && dist <= 1.2) out.push(`Only ${dist.toFixed(1)} km from your planned stops`);
  else if (dist != null && dist <= 3) out.push(`A short ride from your itinerary (${dist.toFixed(1)} km)`);
  if (place.kind === "restaurant" && place.cuisines?.length)
    out.push(`Serves ${place.cuisines.slice(0, 3).join(", ")}`);
  if (place.stars) out.push(`${place.stars}-star property`);
  if (place.rating != null)
    out.push(
      place.ratingCount
        ? `Rated ${place.rating.toFixed(1)}/5 by ${place.ratingCount.toLocaleString()} reviewers`
        : `Rated ${place.rating.toFixed(1)}/5`,
    );
  if (place.summary) out.push(place.summary);
  const diet = dietTokens(prefs.foodPreferences);
  if (diet.vegetarian && place.flags.vegetarian) out.push("Confirmed vegetarian options");
  if (diet.vegan && place.flags.vegan) out.push("Confirmed vegan options");
  if (diet.halal && place.flags.halal) out.push("Halal friendly");
  if (prefs.accessibility && place.flags.wheelchair) out.push("Step-free access");
  if (prefs.hasChildren && place.flags.familyFriendly) out.push("Family friendly facilities");
  if (place.amenities.length) out.push(place.amenities.slice(0, 3).join(" · "));
  if (!place.flags.localChain && place.kind === "restaurant") out.push("Independent, local character");
  return out.slice(0, 4);
}

function badgesFor(place: Place, prefs: TripPreferences, dist?: number): RecommendationBadge[] {
  const b: RecommendationBadge[] = [];
  if (place.kind === "restaurant") {
    if (place.flags.fastFood || place.flags.takeaway) b.push("quick_casual");
    if (place.flags.fineDining || place.priceLevel === 4) b.push("premium");
    if (place.priceLevel === 1) b.push("budget");
    if (!place.flags.localChain) b.push("local_favourite");
    if (place.flags.outdoorSeating && prefs.companions === "couple") b.push("romantic");
    if (place.flags.familyFriendly) b.push("family");
  } else {
    if ((place.stars ?? 0) >= 4 || place.priceLevel === 4) b.push("premium");
    if (place.flags.hostel || place.priceLevel === 1) b.push("budget");
    if (place.flags.guesthouse || place.flags.apartment) b.push("unique_stay");
    if (place.amenities.includes("Pool") || place.flags.apartment) b.push("family");
  }
  if (dist != null && dist <= 1) b.push("best_location");
  if ((place.rating ?? 0) >= 4.5 && (place.ratingCount ?? 0) >= 200) b.push("highly_rated");
  if (place.priceLevel != null && place.priceLevel <= 2 && (place.stars ?? place.rating ?? 0) >= 3.5)
    b.push("best_value");
  return [...new Set(b)];
}

export function rankPlaces(places: Place[], prefs: TripPreferences, limit: number): Recommendation[] {
  const scored: Recommendation[] = places.map((place) => {
    const breakdown = {
      preference: preferenceScore(place, prefs),
      quality: qualityScore(place),
      location: locationScore(place, prefs),
      budget: budgetScore(place, prefs),
      authenticity: authenticityScore(place),
    };
    const walkWeight = prefs.walking === "low" ? 1.4 : prefs.walking === "high" ? 0.75 : 1;
    const weights = { ...WEIGHTS, location: WEIGHTS.location * walkWeight };
    const total = Object.entries(weights).reduce(
      (acc, [k, w]) => acc + w * (breakdown[k as keyof typeof breakdown] ?? 0),
      0,
    );
    const norm = Object.values(weights).reduce((a, b) => a + b, 0);
    const points = prefs.itineraryPoints?.length ? prefs.itineraryPoints : prefs.center ? [prefs.center] : [];
    const dist = points.length ? Math.min(...points.map((p) => distanceKm(p, place))) : undefined;
    return {
      place,
      score: Math.round((total / norm) * 1000) / 1000,
      breakdown,
      distanceKm: dist,
      badges: badgesFor(place, prefs, dist),
      reasons: reasonsFor(place, prefs, dist),
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // Variety pass: avoid returning ten near-identical options.
  const picked: Recommendation[] = [];
  const cuisineCount = new Map<string, number>();
  const badgeCount = new Map<string, number>();
  const maxPerCuisine = Math.max(2, Math.ceil(limit / 4));
  for (const rec of scored) {
    if (picked.length >= limit) break;
    const cuisine = rec.place.cuisines?.[0]?.toLowerCase() ?? rec.place.kind;
    const used = cuisineCount.get(cuisine) ?? 0;
    if (used >= maxPerCuisine) continue;
    cuisineCount.set(cuisine, used + 1);
    rec.badges.forEach((bd) => badgeCount.set(bd, (badgeCount.get(bd) ?? 0) + 1));
    picked.push(rec);
  }
  // Top up if the variety filter was too strict.
  for (const rec of scored) {
    if (picked.length >= limit) break;
    if (!picked.includes(rec)) picked.push(rec);
  }

  if (picked[0] && !picked[0].badges.includes("best_overall")) picked[0].badges.unshift("best_overall");
  return picked;
}

export const KIND_FILTERS: Record<PlaceKind, RecommendationBadge[]> = {
  restaurant: [
    "best_overall",
    "local_favourite",
    "budget",
    "best_value",
    "premium",
    "romantic",
    "family",
    "quick_casual",
    "highly_rated",
  ],
  hotel: [
    "best_overall",
    "best_value",
    "budget",
    "premium",
    "best_location",
    "romantic",
    "family",
    "unique_stay",
  ],
};
