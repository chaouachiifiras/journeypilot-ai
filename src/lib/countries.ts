/**
 * ISO 3166-1 alpha-2 country/territory codes. Display names are resolved at
 * render time via Intl.DisplayNames so every supported UI language (and any
 * future one) gets correct, localized names for free — no translation upkeep.
 */
export const COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BW", "BY", "BZ",
  "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ",
  "DE", "DJ", "DK", "DM", "DO", "DZ",
  "EC", "EE", "EG", "EH", "ER", "ES", "ET",
  "FI", "FJ", "FK", "FM", "FO", "FR",
  "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY",
  "HK", "HN", "HR", "HT", "HU",
  "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT",
  "JE", "JM", "JO", "JP",
  "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ",
  "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY",
  "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ",
  "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ",
  "OM",
  "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY",
  "QA",
  "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ",
  "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ",
  "UA", "UG", "US", "UY", "UZ",
  "VA", "VC", "VE", "VG", "VI", "VN", "VU",
  "WF", "WS",
  "YE", "YT",
  "ZA", "ZM", "ZW",
] as const;

export type CountryOption = { code: string; name: string };

const displayNamesCache = new Map<string, Intl.DisplayNames>();

function getDisplayNames(lang: string): Intl.DisplayNames | null {
  const cached = displayNamesCache.get(lang);
  if (cached) return cached;
  try {
    const dn = new Intl.DisplayNames([lang], { type: "region" });
    displayNamesCache.set(lang, dn);
    return dn;
  } catch {
    return null;
  }
}

const optionsCache = new Map<string, CountryOption[]>();

/** Localized {code, name} for every country, sorted by name in that language. */
export function getCountryOptions(lang: string): CountryOption[] {
  const cached = optionsCache.get(lang);
  if (cached) return cached;
  const dn = getDisplayNames(lang) ?? getDisplayNames("en");
  const options = COUNTRY_CODES.map((code) => ({ code, name: dn?.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, lang));
  optionsCache.set(lang, options);
  return options;
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Small edit-distance so a typo like "Marok" still finds "Maroc". */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

/** Ranks exact/prefix/substring matches first, then falls back to fuzzy matches within a small edit-distance budget. */
export function filterCountries(options: CountryOption[], query: string, limit = 8): CountryOption[] {
  const q = normalize(query);
  if (!q) return [];
  const scored: Array<{ option: CountryOption; score: number }> = [];
  for (const option of options) {
    const name = normalize(option.name);
    let score: number;
    if (name === q) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (name.includes(q)) score = 2;
    else {
      const dist = levenshtein(name, q);
      const threshold = Math.max(1, Math.floor(q.length * 0.4));
      if (dist > threshold) continue;
      score = 3 + dist;
    }
    scored.push({ option, score });
  }
  scored.sort((a, b) => a.score - b.score || a.option.name.localeCompare(b.option.name));
  return scored.slice(0, limit).map((s) => s.option);
}
