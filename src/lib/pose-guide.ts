/**
 * Pose guide — deterministic spot → pose mapping (no AI call, no network).
 *
 * A spot is first classified into a coarse "place kind" from its discovery
 * category, its photo style and keywords in its name. Each place kind maps to
 * one illustrated pose and one generic, always-true tip (see `pose.*` in the
 * locale files). Unknown places fall back to DEFAULT_PLACE.
 */

export const POSES = ["profile_view", "back_horizon", "low_angle"] as const;
export type Pose = (typeof POSES)[number];

export const PLACE_KINDS = ["viewpoint", "waterfront", "monument", "default"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

const DEFAULT_PLACE: PlaceKind = "default";

const POSE_BY_PLACE: Record<PlaceKind, Pose> = {
  viewpoint: "profile_view",
  waterfront: "back_horizon",
  monument: "low_angle",
  default: "profile_view",
};

// Keywords are matched against the lower-cased spot name. Names often come in
// the local language, so the common FR/EN/ES/IT/PT/AR forms are listed.
const WATERFRONT_RE =
  /beach|plage|playa|praia|spiaggia|strand|شاطئ|corniche|كورنيش|\bbay\b|baie|lagoon|lagune|\blake\b|\blac\b|coast|côte|marina|harbou?r|\bport\b|waterfront|seafront|bord de mer|promenade|quai|pier|jetée|ميناء|بحيرة/;
const VIEWPOINT_RE =
  /viewpoint|view point|\bview\b|\bvue\b|belv[eé]d[eè]re|mirador|miradouro|panoram|rooftop|roof top|terrace|terrasse|lookout|observation|observatory|skyline|hilltop|colline|\bhill\b|summit|sommet|إطلالة|سطح|مطل/;
const MONUMENT_RE =
  /mosque|mosqu[eé]e|cathedral|cath[eé]drale|basilica|basilique|church|[eé]glise|chapel|chapelle|palace|palais|castle|ch[aâ]teau|fortress|forteresse|\bfort\b|kasbah|casbah|citadel|citadelle|temple|museum|mus[eé]e|monument|memorial|m[eé]morial|\barch\b|\barc\b|tower|\btour\b|minaret|bridge|\bpont\b|\bgate\b|\bporte\b|\bbab\b|amphith|colosse|ruins|ruines|مسجد|جامع|قصر|برج|قلعة|متحف|باب|كاتدرائية|كنيسة/;

export type PoseSpotInput = {
  name?: string;
  category?: string;
  style?: string;
};

export function placeKindFor(spot: PoseSpotInput): PlaceKind {
  const name = (spot.name ?? "").toLowerCase();
  const category = (spot.category ?? "").toLowerCase();
  const style = (spot.style ?? "").toLowerCase();

  if (WATERFRONT_RE.test(name)) return "waterfront";
  if (VIEWPOINT_RE.test(name) || category === "viewpoint" || style === "drone") return "viewpoint";
  if (MONUMENT_RE.test(name) || category === "iconic" || style === "architecture") return "monument";
  return DEFAULT_PLACE;
}

export function poseGuideFor(spot: PoseSpotInput): { place: PlaceKind; pose: Pose } {
  const place = placeKindFor(spot);
  return { place, pose: POSE_BY_PLACE[place] };
}
