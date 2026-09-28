/**
 * Client-safe model registry.
 *
 * Feature code references a *logical* model name (e.g. `reasoning`), never a
 * vendor id. Swapping the underlying provider/model later (OpenAI, etc.)
 * only touches this file + `provider.server.ts` — no UI or feature changes.
 */

export type AiTask = "fast" | "reasoning" | "structured";

export const AI_FEATURES = {
  tripSkeleton: "trip_skeleton",
  tripEnrichment: "trip_enrichment",
  chat: "chat",
  copilot: "copilot",
} as const;

export type AiFeature = (typeof AI_FEATURES)[keyof typeof AI_FEATURES];

/** Provider-agnostic default per task, resolved by the server provider layer. */
export const DEFAULT_MODELS: Record<AiTask, string> = {
  fast: "google/gemini-3-flash-preview",
  reasoning: "google/gemini-3-flash-preview",
  structured: "google/gemini-3-flash-preview",
};

