import type { PlacesProvider } from "./types";
import { osmProvider, searchSettlements } from "./providers/osm.server";
import { googleCredentials, googleProvider } from "./providers/google.server";

export { searchSettlements };

/**
 * Provider registry. Google Places (New) is the primary source when the Google
 * Maps connection is available (real place ids, ratings, review counts, price
 * levels, photos and exact Google Maps place URLs); OpenStreetMap remains the
 * fallback. Override with the PLACES_PROVIDER env var.
 * The ranking layer and the UI never import a concrete provider.
 */
const REGISTRY: Record<string, PlacesProvider> = {
  osm: osmProvider,
  google: googleProvider,
};

export function getPlacesProvider(): PlacesProvider {
  const id = process.env["PLACES_PROVIDER"];
  if (id && REGISTRY[id]) return REGISTRY[id]!;
  return googleCredentials() ? googleProvider : osmProvider;
}

