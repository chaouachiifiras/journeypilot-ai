import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { getGateway } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  question: z.string().min(1).max(1000),
  context: z
    .object({
      city: z.string().optional(),
      country: z.string().optional(),
      currentTime: z.string().optional(),
      interests: z.array(z.string()).optional(),
    })
    .optional(),
});

/** Rolling-window rate limit: max requests per user per hour. */
const RATE_LIMIT = 25;
const WINDOW_MS = 60 * 60 * 1000;

export const askCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { count, error: countErr } = await supabase
      .from("copilot_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if (countErr) throw new Error(countErr.message);

    if ((count ?? 0) >= RATE_LIMIT) {
      throw new Error(
        `429 Too Many Requests: Copilot limit of ${RATE_LIMIT} questions per hour reached. Please try again later.`,
      );
    }

    const { error: logErr } = await supabase
      .from("copilot_requests")
      .insert({ user_id: userId });
    if (logErr) throw new Error(logErr.message);

    const gateway = getGateway();

    const ctx = data.context
      ? `Traveler context: ${data.context.city ?? "?"}, ${data.context.country ?? "?"}. Local time: ${data.context.currentTime ?? "unknown"}. Interests: ${(data.context.interests ?? []).join(", ") || "general"}.`
      : "";
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      messages: [
        {
          role: "system",
          content:
            "You are JourneyPilot Copilot — a concise, elegant travel companion. Answer in 3-6 short bullet points max. Give real-time, contextual, practical advice: what to do now, best next stop, photo timing, weather-aware suggestions, food and transport tips. Reply in the user's language.",
        },
        { role: "user", content: `${ctx}\n\n${data.question}` },
      ],
    });
    return { text };
  });
