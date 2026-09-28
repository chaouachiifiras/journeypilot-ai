import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2, Camera, UtensilsCrossed, ShoppingBag, Waves, Trees, Mountain,
  ScrollText, Music, Users, Check, Sparkles,
} from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { AuthGate } from "@/components/auth/AuthGate";
import { PaywallDialog } from "@/components/paywall/PaywallDialog";
import { PlaceAutocomplete, type AutocompleteOption } from "@/components/planner/PlaceAutocomplete";
import { useAnonSession } from "@/lib/anon-session";
import { generateTripSkeleton, generateTripPlan } from "@/lib/trips.functions";
import { searchCities } from "@/lib/geocoding.functions";
import { getCountryOptions, filterCountries } from "@/lib/countries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planner")({
  component: Planner,
});

const INTEREST_ICONS = {
  photography: Camera, food: UtensilsCrossed, shopping: ShoppingBag,
  beaches: Waves, nature: Trees, adventure: Mountain,
  history: ScrollText, nightlife: Music, family: Users,
} as const;
const INTERESTS = Object.keys(INTEREST_ICONS) as (keyof typeof INTEREST_ICONS)[];
const STYLES = ["budget", "standard", "luxury"] as const;
const CURRENCIES = ["USD", "EUR", "GBP", "MAD", "AED", "JPY"];
const COMPANIONS = ["solo", "couple", "friends", "family"] as const;
const WALKING = ["low", "medium", "high"] as const;
const INTENSITY = ["relaxed", "balanced", "packed"] as const;
const MAX_CHILDREN = 12;

function parseChildrenCount(raw: string): number {
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_CHILDREN);
}

type TripPayload = {
  country: string;
  city: string;
  days: number;
  budget: number;
  currency: string;
  travel_style: (typeof STYLES)[number];
  interests: string[];
  language: "en" | "fr" | "ar";
  first_time: boolean | undefined;
  companions: (typeof COMPANIONS)[number];
  walking: (typeof WALKING)[number];
  intensity: (typeof INTENSITY)[number];
  has_children: boolean;
  children_count: number | undefined;
  food_preferences: string | undefined;
  accessibility: string | undefined;
};

const LOADING_STEPS = [
  "understanding_style",
  "searching_gems",
  "finding_hotels",
  "finding_restaurants",
  "optimizing_budget",
  "checking_weather",
  "building_itinerary",
] as const;

function Planner() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { ready, isAnonymous } = useAnonSession();
  const createSkeleton = useServerFn(generateTripSkeleton);
  const createPlan = useServerFn(generateTripPlan);
  const fetchCities = useServerFn(searchCities);

  const [country, setCountry] = useState("");
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [countrySelected, setCountrySelected] = useState(false);
  const [city, setCity] = useState("");
  const [citySelected, setCitySelected] = useState(false);
  const [days, setDays] = useState(5);
  const [budget, setBudget] = useState(1500);
  const [currency, setCurrency] = useState("USD");
  const [style, setStyle] = useState<(typeof STYLES)[number]>("standard");
  const [interests, setInterests] = useState<string[]>(["food", "photography"]);

  // Personalization
  const [firstTime, setFirstTime] = useState<boolean | null>(null);
  const [companions, setCompanions] = useState<(typeof COMPANIONS)[number]>("couple");
  const [walking, setWalking] = useState<(typeof WALKING)[number]>("medium");
  const [intensity, setIntensity] = useState<(typeof INTENSITY)[number]>("balanced");
  const [hasChildren, setHasChildren] = useState(false);
  const [childrenCount, setChildrenCount] = useState("1");
  const [childrenCountError, setChildrenCountError] = useState<string | null>(null);
  const [foodPref, setFoodPref] = useState("");
  const [accessibility, setAccessibility] = useState("");

  const countryRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const budgetRef = useRef<HTMLInputElement>(null);
  const foodRef = useRef<HTMLInputElement>(null);
  const accessRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const pendingPayloadRef = useRef<TripPayload | null>(null);

  const toggleInterest = (k: string) =>
    setInterests((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const countryOptions = useMemo(() => getCountryOptions(i18n.language), [i18n.language]);

  const handleCountryChange = (text: string) => {
    setCountry(text);
    if (countrySelected) {
      setCountrySelected(false);
      setCountryCode(null);
      setCity("");
      setCitySelected(false);
    }
  };

  const handleCountrySelect = (option: AutocompleteOption) => {
    setCountry(option.label);
    setCountryCode(option.id);
    setCountrySelected(true);
    setCity("");
    setCitySelected(false);
    cityRef.current?.focus();
  };

  const handleCityChange = (text: string) => {
    setCity(text);
    if (citySelected) setCitySelected(false);
  };

  const handleCitySelect = (option: AutocompleteOption) => {
    setCity(option.label);
    setCitySelected(true);
  };

  const handleFieldEnter = (
    e: React.KeyboardEvent<HTMLInputElement>,
    nextRef?: React.RefObject<HTMLInputElement | null>,
  ) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (nextRef?.current) nextRef.current.focus();
    else e.currentTarget.blur();
  };

  const submitTrip = async (payload: TripPayload) => {
    setSubmitting(true);
    setPhase(0);
    try {
      const skeleton = await createSkeleton({ data: payload });
      setPhase(1);
      await createPlan({ data: { ...payload, id: skeleton.id } });
      setPhase(2);
      navigate({ to: "/trip/$id", params: { id: skeleton.id } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith("PAYWALL_REQUIRED")) {
        pendingPayloadRef.current = payload;
        setPaywallOpen(true);
      } else {
        toast.error(message || t("planner.errors.generate_failed"));
      }
      setSubmitting(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    if (!countrySelected || !citySelected) {
      toast.error(t("planner.errors.select_destination"));
      return;
    }
    submitTrip({
      country, city, days,
      budget: Number(budget),
      currency,
      travel_style: style,
      interests,
      language: (i18n.language?.split("-")[0] as "en" | "fr" | "ar") ?? "en",
      first_time: firstTime ?? undefined,
      companions,
      walking,
      intensity,
      has_children: hasChildren,
      children_count: hasChildren ? parseChildrenCount(childrenCount) : undefined,
      food_preferences: foodPref || undefined,
      accessibility: accessibility || undefined,
    });
  };


  if (ready && isAnonymous) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <AuthGate />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-display text-4xl md:text-5xl tracking-tight">
            {t("planner.title")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("planner.subtitle")}</p>
        </motion.div>

        <form onSubmit={onSubmit} className="mt-10 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t("planner.country")}>
              <PlaceAutocomplete
                inputRef={countryRef}
                value={country}
                selected={countrySelected}
                placeholder={t("planner.country_ph")}
                autoComplete="country-name"
                minChars={1}
                debounceMs={0}
                invalidHint={t("planner.autocomplete.select_hint")}
                noResultsText={t("planner.autocomplete.no_results")}
                search={(q) => filterCountries(countryOptions, q).map((o) => ({ id: o.code, label: o.name }))}
                onChangeText={handleCountryChange}
                onSelectOption={handleCountrySelect}
                onEnterFallback={() => cityRef.current?.focus()}
              />
            </Field>
            <Field label={t("planner.city")}>
              <PlaceAutocomplete
                inputRef={cityRef}
                value={city}
                selected={citySelected}
                disabled={!countrySelected}
                disabledHint={t("planner.autocomplete.city_locked")}
                placeholder={t("planner.city_ph")}
                autoComplete="address-level2"
                minChars={1}
                debounceMs={350}
                invalidHint={t("planner.autocomplete.select_hint")}
                noResultsText={t("planner.autocomplete.no_results")}
                search={(q) =>
                  countryCode
                    ? fetchCities({ data: { query: q, countryCode, language: i18n.language.split("-")[0] ?? "en" } }).then((rows) =>
                        rows.map((r) => ({ id: `${r.lat},${r.lng}`, label: r.name, sublabel: r.admin })),
                      )
                    : Promise.resolve([])
                }
                onChangeText={handleCityChange}
                onSelectOption={handleCitySelect}
                onEnterFallback={() => cityRef.current?.blur()}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={`${t("planner.days")}: ${days}`}>
              <input type="range" min={1} max={21} value={days} onChange={(e) => setDays(Number(e.target.value))} className="accent-primary w-full" />
            </Field>
            <Field label={t("planner.budget")}>
              <input ref={budgetRef} type="number" min={100} value={budget} onChange={(e) => setBudget(Number(e.target.value))} onKeyDown={(e) => handleFieldEnter(e)} className="input" />
            </Field>
            <Field label={t("planner.currency")}>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          <Field label={t("planner.style")}>
            <div className="grid grid-cols-3 gap-2">
              {STYLES.map((s) => (
                <button type="button" key={s} onClick={() => setStyle(s)}
                  className={cn("rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                    style === s ? "border-primary bg-primary text-primary-foreground shadow-soft" : "border-border bg-card hover:bg-secondary")}>
                  {t(`planner.styles.${s}`)}
                </button>
              ))}
            </div>
          </Field>

          <Field label={t("planner.interests")} hint={t("planner.interests_hint")}>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((k) => {
                const Icon = INTEREST_ICONS[k];
                const active = interests.includes(k);
                return (
                  <button type="button" key={k} onClick={() => toggleInterest(k)}
                    className={cn("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-all",
                      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary")}>
                    <Icon className="h-3.5 w-3.5" />
                    {t(`interests.${k}`)}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Personalization */}
          <div className="rounded-2xl border border-border bg-card/40 p-6 space-y-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-copper" />
              <h2 className="font-display text-xl">{t("planner.personal.title")}</h2>
            </div>

            <Field label={t("planner.personal.first_time")}>
              <YesNo value={firstTime} onChange={setFirstTime} />
            </Field>

            <Field label={t("planner.personal.companions")}>
              <SegGrid options={COMPANIONS} value={companions} onChange={setCompanions} tPrefix="planner.companions_options" />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t("planner.personal.walking")}>
                <SegGrid options={WALKING} value={walking} onChange={setWalking} tPrefix="planner.walking_options" />
              </Field>
              <Field label={t("planner.personal.intensity")}>
                <SegGrid options={INTENSITY} value={intensity} onChange={setIntensity} tPrefix="planner.intensity_options" />
              </Field>
            </div>

            <Field label={t("planner.personal.children")}>
              <YesNo value={hasChildren} onChange={(v) => setHasChildren(!!v)} />
            </Field>

            {hasChildren && (
              <Field label={t("planner.personal.children_count")}>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_CHILDREN}
                  value={childrenCount}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setChildrenCount(raw);
                    const n = Number(raw);
                    const valid = raw.trim() === "" || (Number.isInteger(n) && n >= 1 && n <= MAX_CHILDREN);
                    setChildrenCountError(valid ? null : t("planner.personal.children_count_error", { max: MAX_CHILDREN }));
                  }}
                  onBlur={() => {
                    if (childrenCount.trim() === "") {
                      setChildrenCount("1");
                      setChildrenCountError(null);
                    }
                  }}
                  className={cn("input max-w-32", childrenCountError && "input-invalid")}
                />
                {childrenCountError && (
                  <span className="mt-1.5 block text-xs text-destructive">{childrenCountError}</span>
                )}
              </Field>
            )}

            <Field label={t("planner.personal.food")} hint={t("planner.personal.food_hint")}>
              <input ref={foodRef} value={foodPref} onChange={(e) => setFoodPref(e.target.value)} onKeyDown={(e) => handleFieldEnter(e, accessRef)} placeholder={t("planner.personal.food_ph")} className="input" />
            </Field>

            <Field label={t("planner.personal.accessibility")} hint={t("planner.personal.accessibility_hint")}>
              <input ref={accessRef} value={accessibility} onChange={(e) => setAccessibility(e.target.value)} onKeyDown={(e) => handleFieldEnter(e)} placeholder={t("planner.personal.accessibility_ph")} className="input" />
            </Field>
          </div>

          <div className="pt-4">
            <button type="submit" disabled={submitting || !ready || !countrySelected || !citySelected}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-copper px-8 py-4 text-base font-medium shadow-lift transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed">
              {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> {t("planner.generating")}</>) : t("planner.generate")}
            </button>
          </div>
        </form>
      </div>

      <AnimatePresence>{submitting && <LoadingOverlay phase={phase} />}</AnimatePresence>

      <PaywallDialog
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        onSubscribed={() => {
          setPaywallOpen(false);
          if (pendingPayloadRef.current) submitTrip(pendingPayloadRef.current);
        }}
      />

      <style>{`
        .input { width: 100%; border-radius: 0.75rem; border: 1px solid var(--color-border); background: var(--color-card); padding: 0.75rem 1rem; font-size: 0.9375rem; transition: border-color .15s, box-shadow .15s; }
        .input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-primary) 15%, transparent); }
        .input:disabled { opacity: 0.6; cursor: not-allowed; }
        .input-invalid { border-color: var(--color-destructive); }
      `}</style>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; hint?: string; children: React.ReactNode }) {
  // A <label> here would work for the plain text/number inputs, but SegGrid,
  // YesNo, and the style/interest buttons all render <button> elements,
  // which are HTML5 "labelable" — a tap anywhere in the label (including
  // the label text) forwards a click to the *first* button in the group,
  // silently overwriting whatever was previously selected. Plain <div>
  // avoids that implicit forwarding for every Field usage.
  return (
    <div className="block">
      <span className="mb-2 block text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <div className="inline-flex gap-2">
      {[{ v: true, l: t("planner.yes") }, { v: false, l: t("planner.no") }].map((o) => (
        <button type="button" key={String(o.v)} onClick={() => onChange(o.v)}
          className={cn("rounded-full border px-5 py-2 text-sm transition-all",
            value === o.v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary")}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

function SegGrid<T extends string>({ options, value, onChange, tPrefix }: { options: readonly T[]; value: T; onChange: (v: T) => void; tPrefix: string }) {
  const { t } = useTranslation();
  return (
    <div className={cn("grid gap-2", options.length === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3")}>
      {options.map((o) => (
        <button type="button" key={o} onClick={() => onChange(o)}
          className={cn("rounded-xl border px-3 py-2.5 text-sm font-medium capitalize transition-all",
            value === o ? "border-primary bg-primary text-primary-foreground shadow-soft" : "border-border bg-card hover:bg-secondary")}>
          {t(`${tPrefix}.${o}`)}
        </button>
      ))}
    </div>
  );
}

function LoadingOverlay({ phase }: { phase: 0 | 1 | 2 }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  // Real progress: phase 0 = skeleton request in flight, 1 = skeleton received (detail pass),
  // 2 = everything ready. The animation never runs ahead of the actual backend phase.
  const cap = phase === 0 ? 2 : phase === 1 ? LOADING_STEPS.length - 1 : LOADING_STEPS.length;
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, cap)), 1400);
    return () => clearInterval(id);
  }, [cap]);
  useEffect(() => {
    setStep((s) => Math.max(s, phase === 1 ? 3 : phase === 2 ? LOADING_STEPS.length : s));
  }, [phase]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-background/85 backdrop-blur-xl"
    >
      <div className="relative w-full max-w-lg px-8 text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="mx-auto mb-8 h-20 w-20 rounded-full border-2 border-copper border-t-transparent"
        />
        <h2 className="font-display text-3xl md:text-4xl tracking-tight">{t("planner.loading_title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("planner.loading_subtitle")}</p>
        <ul className="mt-10 space-y-3 text-left">
          {LOADING_STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <motion.li
                key={label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: done || active ? 1 : 0.35, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-3 text-sm"
              >
                <span className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all",
                  done ? "border-copper bg-copper text-primary-foreground"
                    : active ? "border-copper text-copper" : "border-border text-muted-foreground",
                )}>
                  {done ? <Check className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </span>
                <span className={cn(done && "text-foreground", active && "text-foreground font-medium")}>{t(`planner.loading_steps.${label}`)}</span>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </motion.div>
  );
}
