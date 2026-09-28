import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { getGateway } from "./ai-gateway.server";
import { hasActivePremiumEntitlement } from "./revenuecat.server";

/** Every account gets exactly 1 free trip, ever; after that an active subscription is required. */
const FREE_TRIP_LIMIT = 1;
// Temporarily off while RevenueCat isn't configured yet (no REVENUECAT_SECRET_API_KEY),
// so other features can be tested without hitting the paywall. Flip back to true once set up.
const PAYWALL_ENABLED = false;

const TripInput = z.object({
  country: z.string().min(1),
  city: z.string().min(1),
  days: z.number().int().min(1).max(30),
  budget: z.number().positive(),
  currency: z.string().min(1).max(6),
  travel_style: z.enum(["budget", "standard", "luxury"]),
  interests: z.array(z.string()).default([]),
  language: z.enum(["en", "fr", "ar"]).default("en"),
  first_time: z.boolean().optional(),
  companions: z.enum(["solo", "couple", "friends", "family"]).optional(),
  walking: z.enum(["low", "medium", "high"]).optional(),
  intensity: z.enum(["relaxed", "balanced", "packed"]).optional(),
  has_children: z.boolean().optional(),
  children_count: z.number().int().min(1).max(12).optional(),
  food_preferences: z.string().optional(),
  accessibility: z.string().optional(),
});

const LANG_NAME = { en: "English", fr: "French", ar: "Arabic" } as const;

function childrenPhrase(input: z.infer<typeof TripInput>) {
  if (!input.has_children) return "";
  return input.children_count ? ` (with ${input.children_count} children)` : " (with children)";
}

function buildPrompt(input: z.infer<typeof TripInput>) {
  return `You are a world-class travel planner. Generate a complete, opinionated, deeply personalized trip plan.

Destination: ${input.city}, ${input.country}
Duration: ${input.days} days
Budget: ${input.budget} ${input.currency} total (${input.travel_style} style)
Interests: ${input.interests.join(", ") || "general"}
First time visiting: ${input.first_time ? "yes" : "no"}
Traveling with: ${input.companions ?? "unspecified"}${childrenPhrase(input)}
Walking preference: ${input.walking ?? "medium"}
Activity intensity: ${input.intensity ?? "balanced"}
Food preferences: ${input.food_preferences || "no restrictions"}
Accessibility needs: ${input.accessibility || "none"}
Language: respond entirely in ${LANG_NAME[input.language]}.

Return ONLY valid minified JSON, no markdown, no commentary, matching EXACTLY this shape:
{
 "summary":"2-3 sentence poetic overview",
 "best_time":"seasonal note",
 "itinerary":[{"day":1,"title":"","morning":{"desc":"","duration":"","cost":0,"travel_time":"","difficulty":"easy","name":"","lat":0,"lng":0},"lunch":{"desc":"","duration":"","cost":0,"travel_time":"","difficulty":"easy","name":"","lat":0,"lng":0},"afternoon":{"desc":"","duration":"","cost":0,"travel_time":"","difficulty":"easy","name":"","lat":0,"lng":0},"sunset":{"desc":"","duration":"","cost":0,"travel_time":"","difficulty":"easy","name":"","lat":0,"lng":0},"dinner":{"desc":"","duration":"","cost":0,"travel_time":"","difficulty":"easy","name":"","lat":0,"lng":0},"night":{"desc":"","duration":"","cost":0,"travel_time":"","difficulty":"easy","name":"","lat":0,"lng":0},"tip":""}],
 "hotels":[{"name":"","area":"","price_range":"","why":"","rating":4.5,"lat":0,"lng":0}],
 "restaurants":[{"name":"","cuisine":"","price":"$$","why":"","must_try":"","crowd":"moderate","lat":0,"lng":0}],
 "activities":[{"name":"","category":"","duration":"","why":"","walking_time":"","transport_time":"","waiting_time":"","difficulty":"easy","best_hour":"","avg_duration":"","cost":0,"crowd":"moderate","lat":0,"lng":0}],
 "photo_spots":[{"name":"","best_time":"","tip":"","style":"cinematic","angle":"","crowd":"quiet","walking_distance":"","golden_hour":true,"night_ok":false,"duration":"","lat":0,"lng":0}],
 "hidden_gems":[{"name":"","story":"","duration":"","difficulty":"easy","crowd":"quiet","price":"","map_query":"","why_locals_love":"","lat":0,"lng":0}],
 "transport":["tip1"],
 "weather":["tip1"],
 "safety":["tip1"],
 "budget_breakdown":{"stay":0,"food":0,"transport":0,"activities":0,"other":0,"emergency_reserve":0,"daily":0,"total":0,"currency":"${input.currency}","savings_tips":["tip1","tip2","tip3"]}
}

Rules:
- Include exactly ${input.days} itinerary days. Every day must include ALL six slots: morning, lunch, afternoon, sunset, dinner, night.
- For each slot: desc is a vivid one-sentence recommendation; duration like "1h30"; cost is a number in ${input.currency}; travel_time like "10 min walk" or "20 min metro"; difficulty is one of "easy","moderate","challenging".
- Respect walking preference (${input.walking ?? "medium"}) and intensity (${input.intensity ?? "balanced"}) when picking difficulty and travel_time.
${input.has_children ? `- All picks must be family and child friendly. Account for ${input.children_count ?? "the"} children explicitly in budget_breakdown (family-sized or extra hotel rooms/beds, child meal/ticket pricing, kid-friendly activity fees).\n` : ""}${input.accessibility ? "- Respect accessibility needs strictly.\n" : ""}- 4-6 hotels aligned to ${input.travel_style}, 6-8 restaurants, 6-10 activities, 5-8 photo spots, 4-6 hidden_gems loved by locals.
- crowd is one of "quiet","moderate","busy". For photo_spots, style is one of "instagram","cinematic","luxury","romantic","night","drone","nature","architecture","hidden".
- For every activity include walking_time, transport_time, waiting_time (e.g. "5 min"), best_hour ("08:00" or "sunrise"), avg_duration, and estimated cost in ${input.currency}.
- For hidden_gems, map_query is a short Google Maps search string like "Cafe Clock, Fez".
- Every hotel, restaurant, activity, photo_spot, hidden_gem AND every itinerary slot MUST include accurate real-world lat and lng coordinates as numbers (WGS84 decimal degrees) for the actual venue in ${input.city}. Each itinerary slot's "name" is the specific venue/place used for that slot. Never invent coordinates outside the city area; if unsure, pick a well-known nearby real venue.
- budget_breakdown: stay+food+transport+activities+other = total; total <= ${input.budget}; daily = round(total/${input.days}); emergency_reserve = ~10% of total; provide 3-5 concrete savings_tips.`;
}

function buildSkeletonPrompt(input: z.infer<typeof TripInput>) {
  return `You are a world-class travel narrative designer. Produce ONLY the STRUCTURE and NARRATIVE of a trip. You must NOT invent any specific venue.

Destination: ${input.city}, ${input.country}
Duration: ${input.days} days
Budget: ${input.budget} ${input.currency} total (${input.travel_style} style)
Interests: ${input.interests.join(", ") || "general"}
Traveling with: ${input.companions ?? "unspecified"}${childrenPhrase(input)}
Walking preference: ${input.walking ?? "medium"}
Activity intensity: ${input.intensity ?? "balanced"}
Food preferences: ${input.food_preferences || "no restrictions"}
Accessibility needs: ${input.accessibility || "none"}
Language: respond entirely in ${LANG_NAME[input.language]}.

Return ONLY valid minified JSON, no markdown, matching EXACTLY:
{
 "title":"",
 "tagline":"",
 "overview":"",
 "best_time_to_visit":"",
 "budget_breakdown":{"stay":{"amount":0,"percentage":0},"food":{"amount":0,"percentage":0},"transport":{"amount":0,"percentage":0},"activities":{"amount":0,"percentage":0},"other":{"amount":0,"percentage":0}},
 "days":[{"day_number":1,"theme_title":"","morning_query":"","lunch_query":"","afternoon_query":"","sunset_query":"","dinner_query":"","night_query":"","tip":""}]
}

Rules:
- title is short and evocative (usually the city name or a poetic variant). tagline is one poetic line. overview is 2-3 sentences.
- Exactly ${input.days} entries in "days", numbered 1..${input.days}, each with all six *_query fields.
- CRITICAL: every *_query is a SEARCH INTENT string describing the kind of place/experience (e.g. "traditional temple morning visit historic district", "cosy family-friendly local bistro lunch"). NEVER a real or invented hotel name, restaurant name, venue name, brand, address or price.
- Do not mention exact prices anywhere except inside budget_breakdown amounts.
- budget_breakdown amounts are in ${input.currency}, sum to at most ${input.budget}, percentages sum to 100.${input.has_children ? ` Account for ${input.children_count ?? "the"} children in the stay and food amounts (family-sized rooms, child pricing).` : ""}
- Respect walking preference, intensity, children, food preferences and accessibility needs in the themes and queries.`;
}

function parseJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first >= 0 && last > first) return JSON.parse(cleaned.slice(first, last + 1));
    throw new Error("Could not parse AI response as JSON");
  }
}

/** Step 1 — creates the trip row and its narrative skeleton (no real venues). */
export const generateTripSkeleton = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => TripInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Anonymous JWTs are free and unlimited to mint (signInAnonymously()) and this endpoint
    // is reachable directly over HTTP, so the free-trip quota must be enforced here, not just
    // behind the client-side AuthGate that normally keeps anonymous users off this screen.
    const claims = context.claims as { is_anonymous?: boolean } | undefined;
    if (claims?.is_anonymous) {
      throw new Error("Unauthorized: sign in to create a trip.");
    }

    const { count, error: countErr } = await supabase
      .from("trips")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "error"); // a failed generation must never burn the user's one free trip
    if (countErr) throw new Error(countErr.message);

    if (PAYWALL_ENABLED && (count ?? 0) >= FREE_TRIP_LIMIT) {
      const entitled = await hasActivePremiumEntitlement(userId);
      if (!entitled) {
        throw new Error("PAYWALL_REQUIRED: Subscribe to JourneyPilot Premium to create more trips.");
      }
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("trips")
      .insert({
        user_id: userId,
        country: data.country,
        city: data.city,
        days: data.days,
        budget: data.budget,
        currency: data.currency,
        travel_style: data.travel_style,
        interests: data.interests,
        language: data.language,
        traveling_with: data.companions ?? null,
        walking_preference: data.walking ?? null,
        activity_intensity: data.intensity ?? null,
        has_children: data.has_children ?? false,
        children_count: data.has_children ? (data.children_count ?? null) : null,
        food_preferences: data.food_preferences ?? null,
        accessibility_needs: data.accessibility ?? null,
        status: "pending",
      })
      .select("id")
      .single();
    if (insertErr || !inserted) throw new Error(insertErr?.message ?? "Failed to create trip");
    const tripId = inserted.id as string;

    try {
      const gateway = getGateway();
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        prompt: buildSkeletonPrompt(data),
      });
      const skeleton = parseJson(text) as {
        title?: string;
        tagline?: string;
        overview?: string;
        best_time_to_visit?: string;
        budget_breakdown?: unknown;
        days?: unknown;
      };

      const { error: skErr } = await supabase.from("trip_skeleton").insert({
        trip_id: tripId,
        title: skeleton.title ?? data.city,
        tagline: skeleton.tagline ?? "",
        overview: skeleton.overview ?? "",
        best_time_to_visit: skeleton.best_time_to_visit ?? null,
        budget_breakdown: (skeleton.budget_breakdown ?? {}) as never,
        days: (skeleton.days ?? []) as never,
      });
      if (skErr) throw new Error(skErr.message);

      return { id: tripId };
    } catch (err) {
      await supabase.from("trips").update({ status: "error" }).eq("id", tripId);
      throw err;
    }
  });

/** Step 2 — fills the detailed plan used by the hotels/restaurants/activities/photo/gems tabs. */
export const generateTripPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => TripInput.extend({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tripId = data.id;
    try {
      const gateway = getGateway();
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        prompt: buildPrompt(data),
      });
      const plan = parseJson(text);
      await supabase.from("trips").update({ plan: plan as never, status: "ready" }).eq("id", tripId);
      return { id: tripId };
    } catch (err) {
      await supabase.from("trips").update({ status: "error" }).eq("id", tripId);
      throw err;
    }
  });

export const getTripSkeleton = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ trip_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("trip_skeleton")
      .select("*")
      .eq("trip_id", data.trip_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });


export const listTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("trips")
      .select("id, city, country, days, budget, currency, travel_style, status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("trips")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });
