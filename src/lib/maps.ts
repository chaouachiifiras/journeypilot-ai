// Helpers for opening external map links safely from inside embedded previews.
// Always opens in a new browser tab; falls back to OpenStreetMap if Google Maps
// cannot be opened (e.g. popup blocked / frame restrictions).
//
// Uses @capacitor/browser rather than window.open(): the Android WebView has
// no window.open support by default (it always returns null), so the old
// window.open-based implementation silently fell through to a top-frame
// navigation of the *fallback* URL on every call — Google Maps never opened,
// and the OSM fallback's empty `from=` param left the map on its generic
// world view instead of the destination. Browser.open() opens links via
// Chrome Custom Tabs on Android (Safari View Controller on iOS, a normal new
// tab on web), which reliably works from inside the WebView.
import { Browser } from "@capacitor/browser";

export function googleDirectionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
export function osmDirectionsUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/directions?from=&to=${lat}%2C${lng}`;
}
export function googleSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
export function osmSearchUrl(query: string) {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

async function openExternal(primary: string, fallback: string) {
  try {
    await Browser.open({ url: primary });
    return;
  } catch {
    /* ignore, try fallback */
  }
  try {
    await Browser.open({ url: fallback });
    return;
  } catch {
    /* ignore, last resort below */
  }
  // Last resort: navigate top-level frame so the user still gets somewhere.
  try {
    window.top!.location.href = fallback;
  } catch {
    window.location.href = fallback;
  }
}

export function openDirections(lat: number, lng: number) {
  openExternal(googleDirectionsUrl(lat, lng), osmDirectionsUrl(lat, lng));
}

export function openMapSearch(query: string) {
  openExternal(googleSearchUrl(query), osmSearchUrl(query));
}

/**
 * Exact Google Maps place page for a venue.
 * Prefers the provider's own place URL / place id so the user always lands on
 * the exact venue; only falls back to a name+address search when no place
 * identifier exists (never a bare name, which could match another venue).
 */
export function venueMapsUrl(venue: {
  name: string;
  mapsUrl?: string;
  mapsUrlExact?: boolean;
  provider?: string;
  placeId?: string;
  address?: string;
  lat: number;
  lng: number;
}) {
  if (venue.provider === "google" && venue.placeId) {
    return {
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        venue.name,
      )}&query_place_id=${encodeURIComponent(venue.placeId)}`,
      exact: true,
    };
  }
  if (venue.mapsUrl && venue.mapsUrlExact) return { url: venue.mapsUrl, exact: true };
  const q = [venue.name, venue.address].filter(Boolean).join(", ");
  return {
    url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
    exact: false,
  };
}

/** Opens the venue's Google Maps place page (app on mobile, new tab on desktop). */
export function openVenueOnGoogleMaps(venue: Parameters<typeof venueMapsUrl>[0]) {
  const { url } = venueMapsUrl(venue);
  openExternal(url, osmSearchUrl([venue.name, venue.address].filter(Boolean).join(", ")));
}
