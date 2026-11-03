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
    const photon = await searchSettlements(data.query, data.countryCode, data.language);
    // Photon types some major cities as provinces/states (Tokyo is a "province"), which the
    // settlement filter drops, leaving only small namesakes (e.g. 東洋町 for "Tokyo"). When no
    // result starts with what was typed, ask Google and put its matches first.
    const typed = normalizeName(data.query);
    if (typed.length >= 3 && !photon.some((r) => normalizeName(r.name).startsWith(typed))) {
      const google = await autocompleteCities(data.query, data.countryCode, data.language);
      if (google.length) {
        const seen = new Set(google.map((r) => normalizeName(r.name)));
        return [...google, ...photon.filter((r) => !seen.has(normalizeName(r.name)))].slice(0, 8);
      }
    }
    return photon;
  });

function normalizeName(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}
