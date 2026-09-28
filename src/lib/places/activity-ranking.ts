/**
 * ACTIVITY RANKING + PERSONALIZATION (pure, provider-agnostic).
 *
 * This module never talks to a provider and never looks at whether an image
 * exists. It receives real, already-discovered activities and orders them by
 * how good the EXPERIENCE is for this specific traveller.
 *
 * Nothing here invents data: every badge, metric and "why" line is derived
 * from fields the provider actually published.
 */

export type ActivityCategory =
  | "landmark"
  | "museum"
  | "historical"
  | "cultural"
  | "nature"
  | "beach"
  | "water"
  | "boat"
  | "adventure"
  | "sports"
  | "themepark"
  | "hiking"
  | "cycling"
  | "viewpoint"
  | "sunset"
  | "night"
  | "food"
  | "market"
  | "shopping"
  | "art"
  | "entertainment"
  | "family"
  | "romantic"
  | "luxury"
  | "local"
  | "unique";

export type ActivityBadge =
  | "iconic"
  | "top_rated"
  | "family_friendly"
  | "romantic"
  | "adventurous"
  | "outdoor"
  | "indoor"
  | "free"
  | "premium"
  | "accessible"
  | "near_itinerary"
  | "hidden_gem";

/** A real activity as returned by a provider. Every field is optional except identity. */
export type RawActivity = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  mapsUrl?: string;
  website?: string;
  types: string[];
  typeLabel?: string;
  summary?: string;
  rating?: number;
  reviews?: number;
  /** Google price level 1..4, only when published. */
  priceLevel?: number;
  openingHours?: string[];
  wheelchair?: boolean;
  goodForChildren?: boolean;
  allowsDogs?: boolean;
  liveMusic?: boolean;
  photoRefs: Array<{ name: string; widthPx?: number; heightPx?: number; author?: string; authorUri?: string }>;
  /** Categories the discovery layer matched this place to. */
  categories: ActivityCategory[];
  /** How many independent discovery queries surfaced it. */
  hits: number;
  /** Best archetype weight this place surfaced under (0..1). */
  archetypeWeight: number;
};

export type ActivityPreferences = {
  interests: string[];
  travelStyle: "budget" | "standard" | "luxury";
  companions?: string | null;
  hasChildren?: boolean;
  walking?: string | null;
  accessibility?: string | null;
  budget?: number;
  currency?: string;
  days?: number;
  /** Centre of the traveller's own itinerary, when it has coordinates. */
  center?: { lat: number; lng: number };
  itineraryPoints?: Array<{ lat: number; lng: number }>;
  /** Names of places already in the generated plan. */
  planNames?: string[];
};

export type RankedActivity = {
  activity: RawActivity;
  score: number;
  category: ActivityCategory;
  badges: ActivityBadge[];
  /** Concise, data-derived explanations of why this was chosen. */
  why: string[];
  /** Distance to the traveller's itinerary centre, in km. Only when known. */
  distanceKm?: number;
  /** Suggested moment of the day, derived from category + published hours. */
  bestTime?: string;
  /** Typical visit length in minutes, derived from category norms. Never a claim about the venue. */
  typicalMinutes?: number;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const STOP = new Set([
  "the", "a", "of", "de", "du", "la", "le", "les", "des", "and", "at", "in", "on",
  "el", "al", "tour", "visit", "experience", "museum", "park",
]);

export function tokens(v: string) {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function similarity(a: string, b: string) {
  const ta = tokens(a);
  const tb = new Set(tokens(b));
  if (!ta.length) return 0;
  return ta.filter((t) => tb.has(t)).length / ta.length;
}

/** Typical visit length by category — a planning norm, never presented as venue data. */
const TYPICAL_MINUTES: Partial<Record<ActivityCategory, number>> = {
  landmark: 90,
  museum: 120,
  historical: 90,
  cultural: 90,
  nature: 120,
  beach: 180,
  water: 120,
  boat: 90,
  adventure: 150,
  sports: 120,
  themepark: 300,
  hiking: 180,
  cycling: 150,
  viewpoint: 60,
  sunset: 60,
  night: 120,
  food: 120,
  market: 90,
  shopping: 120,
  art: 90,
  entertainment: 120,
  family: 150,
};

/** Moment of the day a category is naturally best experienced. */
const CATEGORY_TIME: Partial<Record<ActivityCategory, string>> = {
  sunset: "Sunset",
  viewpoint: "Late afternoon to sunset",
  night: "Evening",
  entertainment: "Evening",
  beach: "Morning to afternoon",
  hiking: "Early morning",
  market: "Morning",
  museum: "Morning (quieter)",
  themepark: "Full day",
  boat: "Late afternoon",
};

/* ------------------------------------------------------------------ */
/* Personalization signals                                             */
/* ------------------------------------------------------------------ */

const INTEREST_CATEGORIES: Array<{ match: RegExp; categories: ActivityCategory[]; label: string }> = [
  { match: /photo/i, categories: ["viewpoint", "sunset", "landmark", "nature"], label: "photography" },
  { match: /food|culinar|gastro/i, categories: ["food", "market"], label: "food" },
  { match: /shop/i, categories: ["shopping", "market"], label: "shopping" },
  { match: /beach|sea|coast/i, categories: ["beach", "water", "boat"], label: "beaches" },
  { match: /nature|outdoor|garden/i, categories: ["nature", "hiking", "cycling"], label: "nature" },
  { match: /adventure|thrill|sport/i, categories: ["adventure", "sports", "water", "hiking"], label: "adventure" },
  { match: /history|herit|ancient/i, categories: ["historical", "landmark", "museum"], label: "history" },
  { match: /nightlife|night/i, categories: ["night", "entertainment"], label: "nightlife" },
  { match: /family|kids|child/i, categories: ["family", "themepark", "nature"], label: "family time" },
  { match: /art|museum|galler|culture/i, categories: ["art", "museum", "cultural"], label: "art & culture" },
  { match: /architect|design/i, categories: ["landmark", "historical", "viewpoint"], label: "architecture" },
  { match: /luxur|premium/i, categories: ["luxury", "boat"], label: "premium experiences" },
];

const COMPANION_CATEGORIES: Record<string, ActivityCategory[]> = {
  couple: ["romantic", "sunset", "viewpoint", "boat"],
  family: ["family", "themepark", "nature", "beach"],
  friends: ["adventure", "night", "entertainment", "water"],
  solo: ["cultural", "museum", "local", "viewpoint"],
};

const STYLE_CATEGORIES: Record<string, ActivityCategory[]> = {
  luxury: ["luxury", "boat", "romantic"],
  budget: ["local", "market", "nature", "viewpoint"],
  standard: [],
};

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

/** Broad buckets only used when nothing more descriptive is known. */
const GENERIC: ActivityCategory[] = ["landmark", "local", "cultural"];

function primaryCategory(a: RawActivity): ActivityCategory {
  // A jet-ski operator matched by a "top attractions" sweep is a water sport,
  // not a landmark: prefer the most descriptive category the provider supports.
  const specific = a.categories.find((c) => !GENERIC.includes(c));
  const first = a.categories[0];
  if (first && GENERIC.includes(first) && specific) return specific;
  return first ?? "local";
}

function badgesFor(a: RawActivity, prefs: ActivityPreferences, dist?: number): ActivityBadge[] {
  const b: ActivityBadge[] = [];
  const reviews = a.reviews ?? 0;
  if (reviews >= 20000) b.push("iconic");
  if ((a.rating ?? 0) >= 4.5 && reviews >= 400) b.push("top_rated");
  if (a.goodForChildren || a.categories.includes("family") || a.categories.includes("themepark")) {
    b.push("family_friendly");
  }
  if (a.categories.some((c) => ["romantic", "sunset"].includes(c))) b.push("romantic");
  if (a.categories.some((c) => ["adventure", "water", "sports", "hiking", "cycling"].includes(c))) {
    b.push("adventurous");
  }
  if (a.categories.some((c) => ["nature", "beach", "viewpoint", "hiking", "cycling", "water"].includes(c))) {
    b.push("outdoor");
  } else if (a.categories.some((c) => ["museum", "art", "entertainment"].includes(c))) {
    b.push("indoor");
  }
  if (a.priceLevel === 0) b.push("free");
  if ((a.priceLevel ?? 0) >= 3 || a.categories.includes("luxury")) b.push("premium");
  if (a.wheelchair) b.push("accessible");
  if (dist != null && dist <= 2.5) b.push("near_itinerary");
  if (reviews > 0 && reviews < 1200 && (a.rating ?? 0) >= 4.4) b.push("hidden_gem");
  return b;
}

export function rankActivities(
  raw: RawActivity[],
  prefs: ActivityPreferences,
): RankedActivity[] {
  const interestCats = new Set<ActivityCategory>();
  const interestLabels = new Map<ActivityCategory, string>();
  for (const interest of prefs.interests ?? []) {
    const sig = INTEREST_CATEGORIES.find((s) => s.match.test(interest));
    for (const c of sig?.categories ?? []) {
      interestCats.add(c);
      interestLabels.set(c, sig!.label);
    }
  }
  const companionCats = new Set(COMPANION_CATEGORIES[prefs.companions ?? ""] ?? []);
  const styleCats = new Set(STYLE_CATEGORIES[prefs.travelStyle] ?? []);

  const ranked = raw.map((a): RankedActivity => {
    const why: string[] = [];
    let score = 0;

    /* 1. How significant the experience really is (real review volume). */
    const reviews = a.reviews ?? 0;
    const fame = Math.min(1, Math.log10(reviews + 1) / 5);
    score += fame * 0.3;
    if (reviews >= 50000) why.push(`One of the destination's defining experiences (${reviews.toLocaleString()} reviews)`);
    else if (reviews >= 8000) why.push(`A major attraction here (${reviews.toLocaleString()} reviews)`);

    /* 2. Independent confirmation across different discovery intents. */
    score += Math.min(0.12, (a.hits - 1) * 0.045);

    /* 3. Quality of the experience itself. */
    if (typeof a.rating === "number") {
      score += Math.max(0, Math.min(1, (a.rating - 3.6) / 1.4)) * 0.13;
      if (a.rating >= 4.6 && reviews >= 300) why.push(`Rated ${a.rating} by visitors`);
    }

    /* 4. Strength of the experience archetype it matched. */
    score += a.archetypeWeight * 0.1;

    /* 5. Personalization — reorders, never removes. */
    let personalized = false;
    for (const c of a.categories) {
      if (interestCats.has(c)) {
        score += 0.12;
        why.push(`Matches your interest in ${interestLabels.get(c)}`);
        personalized = true;
        break;
      }
    }
    for (const c of a.categories) {
      if (companionCats.has(c)) {
        score += 0.06;
        if (!personalized) {
          why.push(
            prefs.companions === "family"
              ? "Well suited to travelling with family"
              : prefs.companions === "couple"
                ? "A memorable experience for two"
                : `A good fit for your ${prefs.companions} trip`,
          );
        }
        break;
      }
    }
    for (const c of a.categories) {
      if (styleCats.has(c)) {
        score += 0.05;
        why.push(prefs.travelStyle === "luxury" ? "Fits your premium travel style" : "Great value for your budget style");
        break;
      }
    }
    if (prefs.hasChildren) {
      if (a.goodForChildren || a.categories.some((c) => ["family", "themepark", "nature", "beach"].includes(c))) {
        score += 0.06;
        why.push("Works well with children");
      }
    }

    /* 6. Budget fit — only when the provider published a price level. */
    if (typeof a.priceLevel === "number") {
      const target = prefs.travelStyle === "budget" ? 1 : prefs.travelStyle === "luxury" ? 4 : 2;
      score += Math.max(-0.05, 0.05 - Math.abs(a.priceLevel - target) * 0.03);
    }

    /* 7. Accessibility & walking tolerance. */
    if (prefs.accessibility && a.wheelchair) {
      score += 0.06;
      why.push("Has step-free access");
    }

    /* 8. Distance — influences, never dominates. A world-class experience
          30 km away still outranks an ordinary one around the corner. */
    let dist: number | undefined;
    if (prefs.center) {
      dist = distanceKm(prefs.center.lat, prefs.center.lng, a.lat, a.lng);
      const sensitivity = prefs.walking === "low" ? 0.09 : prefs.walking === "high" ? 0.03 : 0.055;
      score -= Math.min(sensitivity, (Math.min(dist, 40) / 40) * sensitivity);
      if (dist <= 2) why.push("Right next to your itinerary");
    }

    /* 9. Uniqueness — a distinctive experience beats another generic stop. */
    if (a.categories.some((c) => ["unique", "adventure", "boat", "themepark", "water"].includes(c))) {
      score += 0.04;
    }

    /* 10. Already part of the traveller's plan. */
    if ((prefs.planNames ?? []).some((n) => similarity(n, a.name) >= 0.6)) {
      score += 0.05;
      why.push("Already featured in your itinerary");
    }

    const category = primaryCategory(a);
    const badges = badgesFor(a, prefs, dist);

    return {
      activity: a,
      score: Math.max(0, Math.min(1, score)),
      category,
      badges,
      why: why.slice(0, 3),
      distanceKm: dist != null ? Math.round(dist * 10) / 10 : undefined,
      bestTime: CATEGORY_TIME[category],
      typicalMinutes: TYPICAL_MINUTES[category],
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  return balance(dedupe(ranked));
}

/**
 * Two entries describe the same experience when the ids match, or the names
 * essentially match at nearly the same coordinates. Genuinely different
 * experiences at one landmark (a tower visit vs. its summit deck) survive,
 * because their names differ enough or Google gives them separate places.
 */
function dedupe(list: RankedActivity[]): RankedActivity[] {
  const out: RankedActivity[] = [];
  for (const r of list) {
    const dup = out.some((u) => {
      if (u.activity.placeId && u.activity.placeId === r.activity.placeId) return true;
      const d = distanceKm(u.activity.lat, u.activity.lng, r.activity.lat, r.activity.lng) * 1000;
      const sim = Math.max(similarity(u.activity.name, r.activity.name), similarity(r.activity.name, u.activity.name));
      if (d < 80 && sim >= 0.55) return true;
      return d < 400 && sim >= 0.85;
    });
    if (!dup) out.push(r);
  }
  return out;
}

/**
 * A premium guide mixes experience types instead of listing eight museums.
 * The very strongest experiences are never displaced, and no weak candidate is
 * ever promoted just to fill a category.
 */
function balance(list: RankedActivity[]): RankedActivity[] {
  const strongest = [...list];
  const head: RankedActivity[] = [];
  const used = new Set<RankedActivity>();
  const take = (r?: RankedActivity) => {
    if (!r || used.has(r)) return;
    head.push(r);
    used.add(r);
  };

  strongest.slice(0, 4).forEach(take);

  const groups: ActivityCategory[][] = [
    ["landmark", "historical"],
    ["museum", "art", "cultural"],
    ["nature", "beach", "hiking", "cycling"],
    ["boat", "water", "adventure", "sports", "themepark"],
    ["viewpoint", "sunset", "night"],
    ["food", "market", "shopping", "local", "unique"],
  ];
  for (const g of groups) {
    const pick = strongest.find((r) => !used.has(r) && g.includes(r.category) && r.score >= 0.5);
    take(pick);
  }

  head.sort((a, b) => b.score - a.score);
  return [...head, ...strongest.filter((r) => !used.has(r))];
}
