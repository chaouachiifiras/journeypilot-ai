import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Itinerary drafts = resumable planning sessions.
 * Generated itineraries = versioned AI output for a trip.
 * Both are plain persistence; AI generation lands in the next milestone.
 */

const DraftInput = z.object({
  id: z.string().uuid().optional(),
  trip_id: z.string().uuid().nullable().optional(),
  title: z.string().max(120).optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  current_step: z.number().int().min(0).max(50).optional(),
  status: z.enum(["draft", "submitted", "generating", "complete", "failed"]).optional(),
});

export const listDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("itinerary_drafts")
      .select("id, title, status, current_step, trip_id, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => DraftInput.parse(raw))
  .handler(async ({ data, context }) => {
    const row = {
      ...data,
      input: (data.input ?? {}) as never,
      user_id: context.userId,
    };
    const { data: saved, error } = await context.supabase
      .from("itinerary_drafts")
      .upsert(row, { onConflict: "id" })
      .select("id")
      .single();
    if (error || !saved) throw new Error(error?.message ?? "Failed to save draft");
    return { id: saved.id as string };
  });

export const deleteDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("itinerary_drafts")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listGeneratedItineraries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ tripId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("generated_itineraries")
      .select("id, version, title, summary, content, estimated_cost, currency, model, status, created_at")
      .eq("trip_id", data.tripId)
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getLatestItinerary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ tripId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("generated_itineraries")
      .select("id, version, title, summary, content, estimated_cost, currency, model, status, created_at")
      .eq("trip_id", data.tripId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });
