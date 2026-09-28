import type { Place, PlacePhoto } from "./types";

/**
 * Illustrative imagery abstraction.
 *
 * When no REAL photo of a venue exists we may show an image that represents the
 * venue's *type / style* — never presented as a photograph of that venue.
 *
 * No image-generation service is wired up yet, so this returns `null` and the
 * UI falls back to a clean "Photo unavailable" state. A provider can be plugged
 * in later (env `ILLUSTRATIVE_IMAGE_PROVIDER`) without touching the UI: it only
 * has to return a `PlacePhoto` with `kind: "illustrative"`.
 */

export type IllustrativeImageProvider = {
  readonly id: string;
  generate(prompt: string, place: Place): Promise<PlacePhoto | null>;
};

const REGISTRY: Record<string, IllustrativeImageProvider> = {};

/** Factual style prompt derived only from data the provider actually published. */
export function illustrativePrompt(place: Place): string {
  const bits: string[] = [];
  bits.push(place.kind === "hotel" ? "hotel interior and facade" : "restaurant dining room");
  if (place.cuisines?.length) bits.push(`${place.cuisines.join(", ")} cuisine`);
  if (place.category) bits.push(place.category);
  if (place.priceLevel) bits.push(["casual", "mid-range", "upscale", "luxury"][place.priceLevel - 1]!);
  if (place.area || place.address) bits.push(String(place.area ?? place.address).split(",").slice(-2).join(","));
  return bits.join(", ");
}

export async function illustrativePhoto(place: Place): Promise<PlacePhoto | null> {
  const id = process.env["ILLUSTRATIVE_IMAGE_PROVIDER"];
  const provider = id ? REGISTRY[id] : undefined;
  if (!provider) return null;
  try {
    const photo = await provider.generate(illustrativePrompt(place), place);
    if (!photo) return null;
    // Hard guarantee: an illustration can never be labelled as a real photo.
    return { ...photo, kind: "illustrative", verified: false };
  } catch {
    return null;
  }
}
