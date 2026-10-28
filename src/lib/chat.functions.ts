import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { getGateway } from "./ai-gateway.server";
import { hasActivePremiumEntitlement } from "./revenuecat.server";
import { PAYWALL_ENABLED } from "./trips.functions";

/** Free accounts get this many assistant questions, ever; after that Premium is required. */
const FREE_CHAT_LIMIT = 3;

const SYSTEM_PROMPT = `You are JourneyPilot AI — a warm, knowledgeable travel concierge.
Give crisp, practical, delightful advice on destinations, itineraries, food, culture, safety, budgets, and hidden gems.
Prefer bullet points and short paragraphs. Reply in the same language the user writes in.`;

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("chat_threads")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ title: z.string().max(120).optional() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("chat_threads")
      .insert({ user_id: context.userId, title: data.title ?? "New chat" })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Failed");
    return { id: row.id as string };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("chat_threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ threadId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("chat_messages")
      .select("id, role, message, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        threadId: z.string().uuid(),
        content: z.string().min(1).max(4000),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Same reasoning as generateTripSkeleton: anonymous sessions are free to mint, so the
    // quota has to be enforced here rather than only behind the client-side AuthGate.
    const claims = context.claims as { is_anonymous?: boolean } | undefined;
    if (claims?.is_anonymous) {
      throw new Error("Unauthorized: sign in to use the assistant.");
    }

    if (PAYWALL_ENABLED) {
      // user_usage, not chat_messages: messages vanish when a thread is deleted.
      const { data: usage, error: usageErr } = await supabase
        .from("user_usage")
        .select("chat_questions")
        .eq("user_id", userId)
        .maybeSingle();
      if (usageErr) throw new Error(usageErr.message);
      if ((usage?.chat_questions ?? 0) >= FREE_CHAT_LIMIT && !(await hasActivePremiumEntitlement(userId))) {
        throw new Error("PAYWALL_REQUIRED: Subscribe to JourneyPilot Premium to keep chatting with the assistant.");
      }
    }

    // Save user message
    await supabase.from("chat_messages").insert({
      thread_id: data.threadId,
      user_id: userId,
      role: "user",
      message: { content: data.content },
    });

    // Load history
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, message")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      ...(history ?? []).map((r) => ({
        role: r.role as "user" | "assistant",
        content: (r.message as { content: string }).content,
      })),
    ];

    const gateway = getGateway();
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      messages,
    });

    // Counted only once the assistant actually answered, so a failed reply costs nothing.
    await supabase.rpc("increment_usage", { kind: "chat" });

    await supabase.from("chat_messages").insert({
      thread_id: data.threadId,
      user_id: userId,
      role: "assistant",
      message: { content: text },
    });

    // Update thread title from first user message if still default
    const { data: thread } = await supabase
      .from("chat_threads")
      .select("title")
      .eq("id", data.threadId)
      .maybeSingle();
    if (thread?.title === "New chat") {
      const title = data.content.slice(0, 60);
      await supabase
        .from("chat_threads")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", data.threadId);
    } else {
      await supabase
        .from("chat_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", data.threadId);
    }

    return { reply: text };
  });
