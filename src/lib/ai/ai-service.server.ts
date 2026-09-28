/**
 * Central AI service layer (server-only).
 *
 * Every AI feature goes through `runText` / `runObject` so we get, for free:
 *  - provider/model swapping (see provider.server.ts)
 *  - timeout protection + retries with backoff on transient failures
 *  - consistent error handling
 *  - observability: each call is recorded in `public.ai_runs`
 *
 * Feature code should never import an SDK provider directly, and the API key
 * never leaves this server boundary.
 */
import { generateText, generateObject, NoObjectGeneratedError } from "ai";
import type { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { resolveModel } from "./provider.server";
import type { AiFeature, AiTask } from "./models";

type Db = SupabaseClient<Database>;

export type AiMessage = { role: "system" | "user" | "assistant"; content: string };

export interface AiRunOptions {
  feature: AiFeature;
  task?: AiTask | string;
  messages: AiMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  /** Max attempts including the first one. Defaults to 3. */
  maxAttempts?: number;
  /** Optional audit context — when provided the call is logged to `ai_runs`. */
  audit?: { supabase: Db; userId: string; tripId?: string | null };
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function statusOf(error: unknown): number | undefined {
  const anyErr = error as { statusCode?: number; status?: number; responseBody?: unknown };
  return anyErr?.statusCode ?? anyErr?.status;
}

function isQuotaExhausted(error: unknown): boolean {
  const raw = `${(error as { responseBody?: string })?.responseBody ?? ""} ${
    error instanceof Error ? error.message : ""
  }`.toLowerCase();
  return raw.includes("insufficient_quota") || raw.includes("exceeded your current quota");
}

function isRetryable(error: unknown): boolean {
  if (isQuotaExhausted(error)) return false; // terminal billing error, retrying never helps
  const status = statusOf(error);
  if (status !== undefined) return RETRYABLE_STATUS.has(status);
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("aborted")
  );
}

/** Message safe to surface in the UI — never contains keys or raw provider payloads. */
function userFacingMessage(error: unknown): string {
  const status = statusOf(error);
  if (isQuotaExhausted(error)) return "AI usage quota exhausted. Please check your AI billing.";
  if (status === 401 || status === 403) return "The AI service is not configured correctly.";
  if (status === 429) return "The AI service is busy right now. Please try again in a moment.";

  if (status === 402) return "AI usage limit reached. Please check your billing settings.";
  const message = error instanceof Error ? error.message : "";
  if (message.toLowerCase().includes("timed out")) {
    return "The AI request took too long. Please try again.";
  }
  return "The AI service is temporarily unavailable. Please try again.";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetries<T>(attempts: number, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !isRetryable(error)) break;
      await sleep(400 * 2 ** (attempt - 1) + Math.floor(Math.random() * 200));
    }
  }
  throw lastError;
}

async function logRun(
  options: AiRunOptions,
  payload: {
    modelId: string;
    provider: string;
    status: "success" | "error";
    durationMs: number;
    attempts: number;
    usage?: { inputTokens?: number; outputTokens?: number };
    error?: string;
  },
) {
  if (!options.audit) return;
  try {
    await options.audit.supabase.from("ai_runs").insert({
      user_id: options.audit.userId,
      trip_id: options.audit.tripId ?? null,
      feature: options.feature,
      model: payload.modelId,
      status: payload.status,
      duration_ms: payload.durationMs,
      prompt_tokens: payload.usage?.inputTokens ?? null,
      completion_tokens: payload.usage?.outputTokens ?? null,
      error: payload.error ? payload.error.slice(0, 1000) : null,
      metadata: {
        provider: payload.provider,
        attempts: payload.attempts,
        task: options.task ?? null,
      },
    });
  } catch (e) {
    console.error("[ai-service] failed to log run", e);
  }
}

export async function runText(
  options: AiRunOptions,
): Promise<{ text: string; modelId: string }> {
  const { model, modelId, provider } = resolveModel(options.task ?? "fast");
  const startedAt = Date.now();
  const attemptsAllowed = options.maxAttempts ?? 3;
  let attempts = 0;

  try {
    const result = await withRetries(attemptsAllowed, async () => {
      attempts += 1;
      return generateText({
        model,
        messages: options.messages,
        temperature: options.temperature,
        maxOutputTokens: options.maxOutputTokens,
        maxRetries: 0, // retries are handled here so every attempt is auditable
      });
    });

    await logRun(options, {
      modelId,
      provider,
      status: "success",
      durationMs: Date.now() - startedAt,
      attempts,
      usage: result.usage,
    });
    return { text: result.text, modelId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logRun(options, {
      modelId,
      provider,
      status: "error",
      durationMs: Date.now() - startedAt,
      attempts,
      error: message,
    });
    console.error(`[ai-service] ${options.feature} failed:`, message);
    throw new Error(userFacingMessage(error));
  }
}

export async function runObject<T>(
  options: AiRunOptions & { schema: z.ZodType<T> },
): Promise<{ object: T; modelId: string }> {
  const { model, modelId, provider } = resolveModel(options.task ?? "structured");
  const startedAt = Date.now();
  const attemptsAllowed = options.maxAttempts ?? 3;
  let attempts = 0;

  try {
    const result = await withRetries(attemptsAllowed, async () => {
      attempts += 1;
      return generateObject({
        model,
        schema: options.schema,
        messages: options.messages,
        temperature: options.temperature,
        maxRetries: 0,
      } as Parameters<typeof generateObject>[0]);
    });

    await logRun(options, {
      modelId,
      provider,
      status: "success",
      durationMs: Date.now() - startedAt,
      attempts,
      usage: result.usage,
    });
    return { object: result.object as T, modelId };
  } catch (error) {
    const message =
      NoObjectGeneratedError.isInstance(error)
        ? `Model returned invalid structured output: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);

    await logRun(options, {
      modelId,
      provider,
      status: "error",
      durationMs: Date.now() - startedAt,
      attempts,
      error: message,
    });
    console.error(`[ai-service] ${options.feature} failed:`, message);
    throw new Error(
      NoObjectGeneratedError.isInstance(error)
        ? "The AI returned an unexpected response. Please try again."
        : userFacingMessage(error),
    );
  }
}
