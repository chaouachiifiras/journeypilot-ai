/**
 * A few well-known cities per country (ISO 3166-1 alpha-2), shown as the
 * planner's city placeholder once a country is picked, so the hint matches
 * the chosen destination instead of a fixed "Kyoto, Marrakech, Rome…".
 * Countries not listed fall back to a generic "type a city" hint.
 */
const CITY_EXAMPLES: Record<string, readonly string[]> = {
  AE: ["Dubai", "Abu Dhabi", "Sharjah"],
  AR: ["Buenos Aires", "Mendoza", "Bariloche"],
  AT: ["Vienna", "Salzburg", "Innsbruck"],
  AU: ["Sydney", "Melbourne", "Brisbane"],
  BE: ["Brussels", "Bruges", "Ghent"],
  BR: ["Rio de Janeiro", "São Paulo", "Salvador"],
  CA: ["Montreal", "Vancouver", "Toronto"],
  CH: ["Zurich", "Geneva", "Lucerne"],
  CL: ["Santiago", "Valparaíso", "San Pedro de Atacama"],
  CN: ["Beijing", "Shanghai", "Xi'an"],
  CO: ["Bogotá", "Cartagena", "Medellín"],
  CR: ["San José", "La Fortuna", "Tamarindo"],
  CU: ["Havana", "Trinidad", "Viñales"],
  CZ: ["Prague", "Český Krumlov", "Brno"],
  DE: ["Berlin", "Munich", "Hamburg"],
  DK: ["Copenhagen", "Aarhus", "Odense"],
  DZ: ["Algiers", "Oran", "Constantine"],
  EG: ["Cairo", "Luxor", "Alexandria"],
  ES: ["Barcelona", "Madrid", "Seville"],
  FI: ["Helsinki", "Rovaniemi", "Turku"],
  FR: ["Paris", "Lyon", "Nice"],
  GB: ["London", "Edinburgh", "Manchester"],
  GR: ["Athens", "Santorini", "Thessaloniki"],
  HR: ["Dubrovnik", "Split", "Zagreb"],
  HU: ["Budapest", "Eger", "Pécs"],
  ID: ["Bali", "Jakarta", "Yogyakarta"],
  IE: ["Dublin", "Galway", "Cork"],
  IN: ["Delhi", "Jaipur", "Mumbai"],
  IS: ["Reykjavik", "Akureyri", "Vík"],
  IT: ["Rome", "Florence", "Venice"],
  JO: ["Amman", "Petra", "Aqaba"],
  JP: ["Tokyo", "Kyoto", "Osaka"],
  KR: ["Seoul", "Busan", "Jeju"],
  LB: ["Beirut", "Byblos", "Batroun"],
  MA: ["Marrakech", "Fes", "Chefchaouen"],
  MT: ["Valletta", "Sliema", "Mdina"],
  MV: ["Malé", "Maafushi", "Hulhumalé"],
  MX: ["Mexico City", "Cancún", "Oaxaca"],
  MY: ["Kuala Lumpur", "Penang", "Langkawi"],
  NL: ["Amsterdam", "Rotterdam", "Utrecht"],
  NO: ["Oslo", "Bergen", "Tromsø"],
  NZ: ["Auckland", "Queenstown", "Wellington"],
  OM: ["Muscat", "Nizwa", "Salalah"],
  PE: ["Cusco", "Lima", "Arequipa"],
  PH: ["Manila", "Cebu", "El Nido"],
  PL: ["Kraków", "Warsaw", "Gdańsk"],
  PT: ["Lisbon", "Porto", "Lagos"],
  QA: ["Doha", "Al Wakrah", "Al Khor"],
  RO: ["Bucharest", "Brașov", "Cluj-Napoca"],
  SA: ["Riyadh", "Jeddah", "AlUla"],
  SE: ["Stockholm", "Gothenburg", "Malmö"],
  SG: ["Singapore"],
  SN: ["Dakar", "Saint-Louis", "Saly"],
  TH: ["Bangkok", "Chiang Mai", "Phuket"],
  TN: ["Tunis", "Sousse", "Djerba"],
  TR: ["Istanbul", "Cappadocia", "Antalya"],
  US: ["New York", "San Francisco", "Miami"],
  VN: ["Hanoi", "Ho Chi Minh City", "Hoi An"],
  ZA: ["Cape Town", "Johannesburg", "Durban"],
};

/** "Rome, Florence, Venice…" for a country code, or null when none are known. */
export function cityExamplesFor(countryCode: string | null): string | null {
  const cities = countryCode ? CITY_EXAMPLES[countryCode.toUpperCase()] : undefined;
  return cities?.length ? `${cities.join(", ")}…` : null;
}
