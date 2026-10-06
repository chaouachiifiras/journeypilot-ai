import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2, Camera, UtensilsCrossed, ShoppingBag, Waves, Trees, Mountain,
  ScrollText, Music, Users, Check, Sparkles, MapPin, Wallet, Heart, Minus, Plus,
  ArrowRight, AlertCircle, Utensils, Accessibility, Backpack, Compass, Gem,
} from "lucide-react";
import mountains from "@/assets/scene-mountains.jpg";
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
const STYLE_ICONS = { budget: Backpack, standard: Compass, luxury: Gem } as const;
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
      <div className="min-h-screen pb-tabbar">
        <AppHeader />
        <AuthGate />
      </div>
    );
  }

  const canSubmit = !submitting && ready && countrySelected && citySelected;

  return (
    <div className="min-h-screen pb-tabbar">
      <AppHeader />

      {/* Editorial header */}
      <section className="relative isolate overflow-hidden bg-ink">
        <img src={mountains} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover object-[50%_35%] opacity-70" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[rgba(8,20,18,0.35)] via-[rgba(8,20,18,0.55)] to-[#f6f2ea]" />
        <div className="container-page max-w-3xl pb-16 pt-12 md:pb-24 md:pt-20">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
            <span className="glass-dark inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white">
              <Sparkles className="h-3.5 w-3.5 text-[#e9c27f]" /> {t("ui.planner.eyebrow")}
            </span>
            <h1 className="display-lg mt-5 text-white">{t("planner.title")}</h1>
            <p className="mt-3 max-w-lg text-[rgba(255,255,255,0.85)]">{t("planner.subtitle")}</p>
          </motion.div>
        </div>
      </section>

      <form onSubmit={onSubmit} className="container-page relative -mt-8 max-w-3xl space-y-5 md:-mt-12 md:space-y-6">
        <Section n={1} icon={MapPin} title={t("ui.planner.section_destination")}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        </Section>

        <Section n={2} icon={Wallet} title={t("ui.planner.section_budget")}>
          <Field label={t("planner.days")}>
            <div className="panel flex items-center gap-4 p-3">
              <button
                type="button"
                onClick={() => setDays((d) => Math.max(1, d - 1))}
                disabled={days <= 1}
                aria-label="−1"
                className="btn btn-secondary btn-icon shrink-0"
              >
                <Minus />
              </button>
              <div className="min-w-0 flex-1 text-center">
                <div className="font-display text-3xl leading-none tabular">{days}</div>
                <div className="mt-1 text-xs font-semibold text-muted-foreground">{t("planner.days")}</div>
              </div>
              <button
                type="button"
                onClick={() => setDays((d) => Math.min(21, d + 1))}
                disabled={days >= 21}
                aria-label="+1"
                className="btn btn-secondary btn-icon shrink-0"
              >
                <Plus />
              </button>
            </div>
            <input
              type="range"
              min={1}
              max={21}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="range mt-4"
              aria-label={t("planner.days")}
            />
          </Field>

          <div className="mt-5 grid grid-cols-[1fr_auto] gap-3">
            <Field label={t("planner.budget")}>
              <div className="relative">
                <Wallet className="field-icon" />
                <input
                  ref={budgetRef}
                  type="number"
                  inputMode="numeric"
                  min={100}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  onKeyDown={(e) => handleFieldEnter(e)}
                  className="input input-with-icon tabular font-semibold"
                />
              </div>
            </Field>
            <Field label={t("planner.currency")}>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input w-28 font-semibold">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          <div className="mt-5">
            <Field label={t("planner.style")}>
              <div className="grid grid-cols-3 gap-2.5">
                {STYLES.map((s) => {
                  const Icon = STYLE_ICONS[s];
                  const active = style === s;
                  return (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setStyle(s)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 text-sm font-semibold transition-all active:scale-[0.98]",
                        active
                          ? "border-primary bg-primary-soft text-primary shadow-[0_0_0_1px_var(--primary)]"
                          : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
                      )}
                    >
                      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", active ? "bg-gradient-brand" : "bg-secondary")}>
                        <Icon className="h-5 w-5" />
                      </span>
                      {t(`planner.styles.${s}`)}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        </Section>

        <Section n={3} icon={Heart} title={t("planner.interests")} hint={t("planner.interests_hint")}>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((k) => {
              const Icon = INTEREST_ICONS[k];
              const active = interests.includes(k);
              return (
                <button type="button" key={k} onClick={() => toggleInterest(k)} data-active={active} className="chip h-11 px-4 text-sm">
                  {active ? <Check /> : <Icon />}
                  {t(`interests.${k}`)}
                </button>
              );
            })}
          </div>
        </Section>

        <Section n={4} icon={Sparkles} title={t("planner.personal.title")} ai>
          <div className="space-y-6">
            <Field label={t("planner.personal.first_time")}>
              <YesNo value={firstTime} onChange={setFirstTime} />
            </Field>

            <Field label={t("planner.personal.companions")}>
              <SegGrid options={COMPANIONS} value={companions} onChange={setCompanions} tPrefix="planner.companions_options" />
            </Field>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                  className={cn("input max-w-32 tabular", childrenCountError && "input-invalid")}
                />
                {childrenCountError && (
                  <span className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" /> {childrenCountError}
                  </span>
                )}
              </Field>
            )}

            <Field label={t("planner.personal.food")} hint={t("planner.personal.food_hint")}>
              <div className="relative">
                <Utensils className="field-icon" />
                <input ref={foodRef} value={foodPref} onChange={(e) => setFoodPref(e.target.value)} onKeyDown={(e) => handleFieldEnter(e, accessRef)} placeholder={t("planner.personal.food_ph")} className="input input-with-icon" />
              </div>
            </Field>

            <Field label={t("planner.personal.accessibility")} hint={t("planner.personal.accessibility_hint")}>
              <div className="relative">
                <Accessibility className="field-icon" />
                <input ref={accessRef} value={accessibility} onChange={(e) => setAccessibility(e.target.value)} onKeyDown={(e) => handleFieldEnter(e)} placeholder={t("planner.personal.accessibility_ph")} className="input input-with-icon" />
              </div>
            </Field>
          </div>
        </Section>

        {/* Summary + generate */}
        <div className="card ai-surface p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <span className="ai-chip"><Sparkles /> {t("ui.ai_badge")}</span>
            <span className={cn("font-semibold", !citySelected && "text-muted-foreground")}>
              {citySelected ? city : t("ui.planner.summary_pick")}
            </span>
            <span className="text-muted-foreground">· {t("trip.days_count", { count: days })} · {budget} {currency}</span>
          </div>
          <button type="submit" disabled={!canSubmit} className="btn btn-primary btn-lg btn-block group mt-5">
            {submitting ? (
              <><Loader2 className="animate-spin" /> {t("planner.generating")}</>
            ) : (
              <>
                <Sparkles />
                {t("planner.generate")}
                <ArrowRight className="transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
              </>
            )}
          </button>
          {!countrySelected || !citySelected ? (
            <p className="mt-3 text-center text-xs text-muted-foreground">{t("planner.errors.select_destination")}</p>
          ) : null}
        </div>
      </form>

      <AnimatePresence>{submitting && <LoadingOverlay phase={phase} city={city} />}</AnimatePresence>

      <PaywallDialog
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        onSubscribed={() => {
          setPaywallOpen(false);
          if (pendingPayloadRef.current) submitTrip(pendingPayloadRef.current);
        }}
      />
    </div>
  );
}

function Section({
  n, icon: Icon, title, hint, ai, children,
}: {
  n: number;
  icon: typeof MapPin;
  title: string;
  hint?: string;
  ai?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: n * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="card p-5 md:p-7"
    >
      <div className="mb-5 flex items-start gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", ai ? "bg-gradient-ai" : "bg-primary-soft text-primary")}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">{String(n).padStart(2, "0")}</div>
          <h2 className="text-xl leading-tight">{title}</h2>
          {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {children}
    </motion.section>
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
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <div className="seg w-full max-w-xs grid-cols-2">
      {[{ v: true, l: t("planner.yes") }, { v: false, l: t("planner.no") }].map((o) => (
        <button type="button" key={String(o.v)} onClick={() => onChange(o.v)} data-active={value === o.v}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

function SegGrid<T extends string>({ options, value, onChange, tPrefix }: { options: readonly T[]; value: T; onChange: (v: T) => void; tPrefix: string }) {
  const { t } = useTranslation();
  return (
    <div className={cn("seg", options.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
      {options.map((o) => (
        <button type="button" key={o} onClick={() => onChange(o)} data-active={value === o}>
          {t(`${tPrefix}.${o}`)}
        </button>
      ))}
    </div>
  );
}

function LoadingOverlay({ phase, city }: { phase: 0 | 1 | 2; city: string }) {
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
  const pct = Math.round((Math.min(step, LOADING_STEPS.length) / LOADING_STEPS.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="surface-ink fixed inset-0 z-50 overflow-y-auto"
    >
      <img src={mountains} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-b from-[rgba(11,26,24,0.6)] to-[#0b1a18]" />
      <div className="relative mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-16">
        <div className="relative mx-auto h-24 w-24">
          <span className="animate-pulse-ring absolute inset-0 rounded-full bg-[rgba(52,160,136,0.45)]" />
          <span className="animate-pulse-ring absolute inset-0 rounded-full bg-[rgba(207,157,79,0.35)] [animation-delay:1.2s]" />
          <span className="bg-gradient-ai relative flex h-full w-full items-center justify-center rounded-full shadow-glow">
            <Sparkles className="h-9 w-9" />
          </span>
        </div>

        <h2 className="display-lg mt-8 text-center text-white">{t("planner.loading_title")}</h2>
        <p className="mt-2 text-center text-sm text-[rgba(255,255,255,0.7)]">
          {city ? `${city} · ` : ""}{t("planner.loading_subtitle")}
        </p>

        <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.12)]">
          <motion.div className="bg-gradient-ai h-full rounded-full" animate={{ width: `${Math.max(pct, 6)}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
        </div>

        <ul className="mt-8 space-y-2">
          {LOADING_STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <motion.li
                key={label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: done || active ? 1 : 0.4, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={cn("flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm transition-colors", active && "glass-dark")}
              >
                <span className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all",
                  done ? "border-transparent bg-gradient-ai"
                    : active ? "border-[rgba(255,255,255,0.4)] text-white" : "border-[rgba(255,255,255,0.18)] text-[rgba(255,255,255,0.5)]",
                )}>
                  {done ? <Check className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </span>
                <span className={cn("text-[rgba(255,255,255,0.7)]", (done || active) && "text-white", active && "font-semibold")}>
                  {t(`planner.loading_steps.${label}`)}
                </span>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </motion.div>
  );
}
