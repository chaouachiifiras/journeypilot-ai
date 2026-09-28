/**
 * Shared place data model for the recommendation engine.
 *
 * This model is provider-agnostic on purpose: today it is filled by the
 * OpenStreetMap/Overpass provider (real, verifiable data, no API key), and it
 * can later be filled by Google Places, Foursquare, Booking, TripAdvisor, etc.
 * without touching the ranking layer or the UI.
 */

export type PlaceKind = "restaurant" | "hotel";

/** Price level normalized to 1..4 ($ .. $$$$). Undefined when unknown. */
export type PriceLevel = 1 | 2 | 3 | 4;

export type PlaceSource = {
  /** Provider id, e.g. "osm", "google", "foursquare". */
  provider: string;
  /** Stable id inside that provider. */
  id: string;
  /** Public page for the place, when the provider exposes one. */
  url?: string;
  /** Attribution string that must be displayed with the data. */
  attribution?: string;
};

export type PlacePhoto = {
  url: string;
  /** Where the photo comes from, e.g. "google", "wikimedia", "venue". */
  source: string;
  /**
   * `real` = a photograph known to depict THIS venue.
   * `illustrative` = a stylistic image that represents the venue TYPE only and
   * must be labelled as such in the UI. Never presented as a venue photograph.
   */
  kind: "real" | "illustrative";
  /** True only when the photo is known to depict THIS venue. */
  verified: boolean;
  credit?: string;
  creditUrl?: string;
};


export type Place = {
  kind: PlaceKind;
  name: string;
  lat: number;
  lng: number;
  /** Human readable location: street / neighbourhood / area. */
  address?: string;
  area?: string;
  /** Restaurants: cuisine list. Hotels: unused. */
  cuisines?: string[];
  /** Hotels: official star rating (1..5) when published by the venue. */
  stars?: number;
  /** Aggregated rating on a 0..5 scale when a provider supplies one. */
  rating?: number;
  ratingCount?: number;
  priceLevel?: PriceLevel;
  /** Free-form price info published by the venue, e.g. "€€" or "20-35 EUR". */
  priceNote?: string;
  amenities: string[];
  /** Signals used by the ranking engine. */
  flags: {
    vegetarian?: boolean;
    vegan?: boolean;
    halal?: boolean;
    kosher?: boolean;
    glutenFree?: boolean;
    outdoorSeating?: boolean;
    takeaway?: boolean;
    fastFood?: boolean;
    fineDining?: boolean;
    familyFriendly?: boolean;
    wheelchair?: boolean;
    localChain?: boolean;
    guesthouse?: boolean;
    hostel?: boolean;
    apartment?: boolean;
  };
  website?: string;
  phone?: string;
  openingHours?: string;
  /** Short factual description published by the provider. */
  summary?: string;
  /** Provider's own category label, e.g. "Italian restaurant". */
  category?: string;
  /** Exact place page on Google Maps, when the provider supplies one. */
  mapsUrl?: string;
  /** True when `mapsUrl` points at this exact venue (not a name search). */
  mapsUrlExact?: boolean;
  /** Provider photo reference resolved lazily into a real photo URL. */
  photoRef?: string;
  photoCredit?: string;
  /** Image shown for this venue: real photo or clearly-labelled illustration. */
  photo?: PlacePhoto;
  source: PlaceSource;
};


export type PlaceQuery = {
  kind: PlaceKind;
  city: string;
  country: string;
  /** Optional pre-resolved centre; providers geocode the city when absent. */
  lat?: number;
  lng?: number;
  /** Search radius in metres. */
  radius?: number;
  /** Upper bound of raw candidates to fetch before ranking. */
  limit?: number;
};

export interface PlacesProvider {
  readonly id: string;
  readonly attribution: string;
  search(query: PlaceQuery): Promise<Place[]>;
}
