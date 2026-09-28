import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { searchSettlements } from "./places/provider.server";

/** Real cities/towns matching a partial name inside a given country — backs the planner's city autocomplete. */
export const searchCities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        query: z.string().min(1).max(100),
        countryCode: z.string().length(2),
        language: z.string().min(2).max(5).default("en"),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => searchSettlements(data.query, data.countryCode, data.language));
