import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { searchSettlements } from "./places/provider.server";
import { autocompleteCities } from "./places/providers/google.server";

// Photon (searchSettlements) only matches Latin-script names and only answers in
// en/de/fr, so Arabic/Chinese typing — or an Arabic/Chinese UI that should get
// localized names back — goes through Google's autocomplete first.
const NON_LATIN = /[^\u0000-ɏḀ-ỿ\s'’.-]/;
const PHOTON_LANGS = new Set(["en", "de", "fr", "nl"]);

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
  .handler(async ({ data }) => {
    if (NON_LATIN.test(data.query) || !PHOTON_LANGS.has(data.language)) {
      const google = await autocompleteCities(data.query, data.countryCode, data.language);
      if (google.length) return google;
    }
    return searchSettlements(data.query, data.countryCode, data.language);
  });
