/**
 * Server-only provider resolution for the AI layer.
 *
 * AI_PROVIDER=openai  -> direct OpenAI API using OPENAI_API_KEY
 * AI_PROVIDER=lovable -> Lovable AI Gateway (fallback, no key management)
 *
 * The API key is read from the environment inside the server process only and
 * is never returned, logged, or exposed to the client.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { DEFAULT_MODELS, type AiTask } from "./models";

type ProviderName = "lovable" | "openai";

/** Per-task OpenAI models (override globally with OPENAI_MODEL). */
const OPENAI_MODELS: Record<AiTask, string> = {
  fast: "gpt-4o-mini",
  reasoning: "gpt-4o",
  structured: "gpt-4o-mini",
};

export const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 60_000);

function resolveProviderName(): ProviderName {
  const raw = (process.env.AI_PROVIDER ?? "lovable").toLowerCase();
  return raw === "openai" ? "openai" : "lovable";
}

/** fetch wrapper that aborts a hung provider request instead of hanging the worker. */
function timeoutFetch(timeoutMs: number): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    // Respect an upstream signal if the SDK already provided one.
    init?.signal?.addEventListener?.("abort", () => controller.abort());
    try {
      return await fetch(input as RequestInfo, { ...init, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`AI request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
}

function lovableProvider() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: timeoutFetch(AI_REQUEST_TIMEOUT_MS),
  });
}

function openaiProvider() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "Missing OPENAI_API_KEY — set it in project secrets to use AI_PROVIDER=openai",
    );
  }
  return createOpenAICompatible({
    name: "openai",
    baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    headers: { Authorization: `Bearer ${key}` },
    // Sends strict json_schema so OpenAI enforces structured output server-side.
    supportsStructuredOutputs: true,
    fetch: timeoutFetch(AI_REQUEST_TIMEOUT_MS),
  });
}

/** Maps a logical task (or explicit model id) to a concrete model for the active provider. */
export function resolveModel(task: AiTask | string): {
  model: LanguageModel;
  modelId: string;
  provider: ProviderName;
} {
  const provider = resolveProviderName();
  const isTask = task in DEFAULT_MODELS;

  if (provider === "openai") {
    const modelId =
      process.env.OPENAI_MODEL ??
      (isTask
        ? OPENAI_MODELS[task as AiTask]
        : // Strip gateway vendor prefixes (e.g. "openai/gpt-4o-mini").
          String(task).replace(/^[^/]+\//, ""));
    return { model: openaiProvider()(modelId), modelId, provider };
  }

  const modelId = isTask ? DEFAULT_MODELS[task as AiTask] : String(task);
  return { model: lovableProvider()(modelId), modelId, provider };
}
