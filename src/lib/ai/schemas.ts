/**
 * Shared structured-output schemas for AI responses.
 *
 * Strict-mode friendly (OpenAI json_schema): object roots, every property
 * required, `.nullable()` instead of `.optional()`, no format/length bounds.
 * State limits (counts, lengths) in the prompt, then clamp in code.
 */
import { z } from "zod";

export const itineraryItemSchema = z.object({
  slot: z.string(),
  title: z.string(),
  description: z.string(),
  search_query: z.string(),
  category: z.string(),
  duration_minutes: z.number().nullable(),
  estimated_cost: z.number().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});

export const itineraryDaySchema = z.object({
  day_number: z.number(),
  title: z.string(),
  theme: z.string(),
  summary: z.string(),
  neighborhood: z.string().nullable(),
  items: z.array(itineraryItemSchema),
});

export const budgetBreakdownSchema = z.object({
  accommodation: z.number(),
  food: z.number(),
  activities: z.number(),
  transport: z.number(),
  misc: z.number(),
});

export const itinerarySchema = z.object({
  title: z.string(),
  tagline: z.string(),
  overview: z.string(),
  best_time_to_visit: z.string().nullable(),
  currency: z.string(),
  estimated_cost: z.number().nullable(),
  budget_breakdown: budgetBreakdownSchema,
  days: z.array(itineraryDaySchema),
});

export type ItineraryItem = z.infer<typeof itineraryItemSchema>;
export type ItineraryDay = z.infer<typeof itineraryDaySchema>;
export type Itinerary = z.infer<typeof itinerarySchema>;
