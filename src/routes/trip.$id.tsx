import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, MapPin, Bed, UtensilsCrossed, Camera,
  Compass, Wallet, Bus, CloudSun, ShieldCheck, Clock, Gem, ExternalLink,
  Sunrise, Sunset, Moon, Sun, Utensils, X, CalendarDays, Footprints, Lightbulb,
  Navigation, Sparkles, Star, PiggyBank, LifeBuoy, TrendingUp, CircleDollarSign, Map as MapIcon,
  Heart, Timer, Route as RouteIcon, AlertCircle,
} from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { AuthGate } from "@/components/auth/AuthGate";
import { TripMap, MapLegend, type MapMarker } from "@/components/trip/TripMap";
import { SpotPhotoImage } from "@/components/media/SpotPhotoImage";
import { Recommendations } from "@/components/trip/Recommendations";
import { Activities } from "@/components/trip/Activities";
import { PoseGuide } from "@/components/trip/PoseGuide";
import { getTrip, getTripSkeleton } from "@/lib/trips.functions";
import { getPhotoSpots } from "@/lib/photospots.functions";
import { getPlacePhotos, type PlacePhotoLite } from "@/lib/place-photos.functions";
import { useAnonSession } from "@/lib/anon-session";
import { cn } from "@/lib/utils";
import { openDirections, openMapSearch, googleSearchUrl, googleDirectionsUrl } from "@/lib/maps";

export const Route = createFileRoute("/trip/$id")({
  component: TripView,
});

type Crowd = "quiet" | "moderate" | "busy";
type Geo = { lat?: number; lng?: number };
type Slot = { desc?: string; duration?: string; cost?: number; travel_time?: string; difficulty?: string; name?: string } & Geo;
type Activity = { name: string; category?: string; duration?: string; why?: string; walking_time?: string; transport_time?: string; waiting_time?: string; difficulty?: string; best_hour?: string; avg_duration?: string; cost?: number; crowd?: Crowd } & Geo;
type PhotoSpot = { name: string; best_time?: string; tip?: string; style?: string; angle?: string; crowd?: Crowd; walking_distance?: string; golden_hour?: boolean; night_ok?: boolean; duration?: string } & Geo;
type HiddenGem = { name: string; story?: string; duration?: string; difficulty?: string; crowd?: Crowd; price?: string; map_query?: string; why_locals_love?: string } & Geo;
type Hotel = { name: string; area?: string; price_range?: string; why?: string; rating?: number } & Geo;
type Restaurant = { name: string; cuisine?: string; price?: string; why?: string; must_try?: string; crowd?: Crowd } & Geo;
type Plan = {
  summary?: string;
  best_time?: string;
  itinerary?: Array<{
    day: number; title: string; tip?: string;
    morning?: Slot | string; lunch?: Slot | string; afternoon?: Slot | string;
    sunset?: Slot | string; dinner?: Slot | string; night?: Slot | string; evening?: Slot | string;
  }>;
  hotels?: Hotel[];
  restaurants?: Restaurant[];
  activities?: Activity[];
  photo_spots?: PhotoSpot[];
  hidden_gems?: HiddenGem[];
  transport?: string[];
  weather?: string[];
  safety?: string[];
  budget_breakdown?: {
    stay?: number; food?: number; transport?: number; activities?: number; other?: number;
    total?: number; currency?: string; emergency_reserve?: number; daily?: number; savings_tips?: string[];
  };
};

const TABS = [
  { key: "itinerary", icon: Clock },
  { key: "photo", icon: Camera },
  { key: "map", icon: MapPin },
  { key: "hotels", icon: Bed },
  { key: "restaurants", icon: UtensilsCrossed },
  { key: "activities", icon: Compass },
  { key: "gems", icon: Gem },
  { key: "budget", icon: Wallet },
  { key: "transport", icon: Bus },
  { key: "weather", icon: CloudSun },
  { key: "safety", icon: ShieldCheck },
  { key: "overview", icon: Sparkles },
] as const;

const PHOTO_MODES = ["all", "instagram", "cinematic", "luxury", "romantic", "night", "drone", "nature", "architecture", "hidden"] as const;

const TAB_KEYS = TABS.map((tb) => tb.key);
const SWIPE_MIN_DISTANCE = 60;
const SWIPE_MAX_VERTICAL_RATIO = 0.6; // swipe must be mostly horizontal, not a scroll
const EASE = [0.22, 1, 0.36, 1] as const;

const ITINERARY_SLOTS = ["morning", "lunch", "afternoon", "sunset", "dinner", "night"] as const;

const SLOT_ICON: Record<(typeof ITINERARY_SLOTS)[number], typeof Sunrise> = {
  morning: Sunrise,
  lunch: Utensils,
  afternoon: Sun,
  sunset: Sunset,
  dinner: UtensilsCrossed,
  night: Moon,
};

/** Unique named itinerary stops, in visiting order — shared by the hero and the itinerary. */
function itineraryPlaces(plan: Plan | null | undefined) {
  const seen = new Set<string>();
  const out: Array<{ name: string; lat?: number; lng?: number }> = [];
  for (const d of plan?.itinerary ?? []) {
    for (const slot of ITINERARY_SLOTS) {
      const raw = d[slot] ?? (slot === "afternoon" ? d.evening : undefined);
      if (!raw || typeof raw === "string") continue;
      if (raw.name && !seen.has(raw.name)) {
        seen.add(raw.name);
        out.push({ name: raw.name, lat: raw.lat, lng: raw.lng });
      }
    }
  }
  return out;
}

function TripView() {
  const { id } = Route.useParams();
  const { ready, isAnonymous } = useAnonSession();
  const { t, i18n } = useTranslation();
  const fetchTrip = useServerFn(getTrip);
  const fetchSkeleton = useServerFn(getTripSkeleton);
  const fetchPhotos = useServerFn(getPlacePhotos);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("itinerary");

  // Swipe left/right to move between tabs. Ignored when the gesture starts inside a
  // nested horizontally-scrollable strip (e.g. the photo-mode filter chips) — see
  // data-swipe-ignore below — and naturally doesn't fire when it starts on the Leaflet
  // map, since Leaflet stops propagation on its own pan/drag touch handling.
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isRtl = i18n.dir() === "rtl";

  const selectTab = (key: (typeof TABS)[number]["key"]) => {
    setTab(key);
    const strip = tabsRef.current;
    const pill = strip?.querySelector<HTMLElement>(`[data-tab="${key}"]`);
    if (strip && pill) {
      const target = pill.offsetLeft - (strip.clientWidth - pill.offsetWidth) / 2;
      strip.scrollTo({ left: target, behavior: "smooth" });
    }
    // If the reader is already below the tab bar, start the new tab from its top.
    const content = contentRef.current;
    if (content) {
      const header = document.querySelector("header")?.getBoundingClientRect().height ?? 64;
      const stickyOffset = header + 66; // app header (incl. safe area) + tab bar
      const top = content.getBoundingClientRect().top + window.scrollY - stickyOffset;
      if (window.scrollY > top) window.scrollTo({ top, behavior: "smooth" });
    }
  };

  const goToRelativeTab = (delta: 1 | -1) => {
    const idx = TAB_KEYS.indexOf(tab);
    const next = idx + delta;
    if (next >= 0 && next < TAB_KEYS.length) selectTab(TAB_KEYS[next]!);
  };

  const onContentTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest?.("[data-swipe-ignore]")) {
      touchStartRef.current = null;
      return;
    }
    const touch = e.touches[0];
    if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onContentTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dy) > Math.abs(dx) * SWIPE_MAX_VERTICAL_RATIO) return;
    const swipedLeft = dx < 0;
    const forward = isRtl ? !swipedLeft : swipedLeft;
    goToRelativeTab(forward ? 1 : -1);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["trip", id],
    enabled: ready,
    refetchInterval: (q) => {
      const s = (q.state.data as { status?: string } | undefined)?.status;
      return s === "pending" ? 2500 : false;
    },
    queryFn: () => fetchTrip({ data: { id } }),
  });

  // Narrative structure (Overview / Map / Itinerary) comes from trip_skeleton in Supabase.
  const { data: skeletonRow } = useQuery({
    queryKey: ["trip-skeleton", id],
    enabled: ready,
    queryFn: () => fetchSkeleton({ data: { trip_id: id } }),
  });
  const skeleton = skeletonRow as {
    title?: string; tagline?: string; overview?: string; best_time_to_visit?: string | null;
    days?: Array<{ day_number?: number; theme_title?: string; tip?: string }>;
  } | null | undefined;
  const skeletonDays = Array.isArray(skeleton?.days) ? skeleton!.days! : [];
  const dayMeta = (n: number) => skeletonDays.find((d) => Number(d?.day_number) === n);

  // Real photos of the itinerary stops — the same cached query the itinerary uses,
  // so the cover image costs nothing extra.
  const tripData = data as { city?: string; country?: string; plan?: Plan | null; status?: string } | undefined;
  const places = useMemo(() => itineraryPlaces(tripData?.plan), [tripData?.plan]);
  const { data: photos } = useQuery({
    queryKey: ["itinerary-photos", id, places.map((p) => p.name).join("|")],
    enabled: places.length > 0 && tripData?.status === "ready",
    staleTime: 30 * 60 * 1000,
    queryFn: () => fetchPhotos({ data: { city: tripData!.city!, country: tripData!.country!, places } }),
  });
  const cover = places.map((p) => photos?.[p.name]).find((p) => p?.url) ?? null;

  if (ready && isAnonymous) {
    return (
      <div className="min-h-screen pb-tabbar">
        <AppHeader />
        <AuthGate />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen pb-tabbar">
        <AppHeader />
        <TripSkeleton />
      </div>
    );
  }

  const trip = data as {
    id: string; city: string; country: string; days: number; budget: number;
    currency: string; travel_style: string; status: string; plan: Plan | null;
  };

  if (trip.status === "pending") {
    return (
      <div className="min-h-screen pb-tabbar">
        <AppHeader />
        <Composing label={t("trip.loading")} />
      </div>
    );
  }
  if (trip.status === "error" || !trip.plan) {
    return (
      <div className="min-h-screen pb-tabbar">
        <AppHeader />
        <EmptyState
          icon={AlertCircle}
          title={t("trip.not_found")}
          action={
            <Link to="/planner" className="btn btn-primary">
              <Sparkles /> {t("nav.plan")}
            </Link>
          }
        />
      </div>
    );
  }

  const plan = trip.plan;
  const tagline = skeleton?.tagline || plan.summary;

  return (
    <div className="min-h-screen pb-tabbar">
      <AppHeader />

      {/* ---------------- Cinematic destination header ---------------- */}
      <section className="relative isolate overflow-hidden bg-ink text-white">
        {cover?.url ? (
          <img src={cover.url} alt="" className="animate-kenburns absolute inset-0 -z-20 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 -z-20 bg-gradient-brand">
            <TopoPattern />
          </div>
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[rgba(8,20,18,0.94)] via-[rgba(8,20,18,0.55)] to-[rgba(8,20,18,0.2)]" />
        <div className="container-page flex min-h-[360px] max-w-5xl flex-col pb-8 pt-5 md:min-h-[460px] md:pb-12 md:pt-8">
          <Link to="/planner" className="btn btn-glass btn-sm self-start">
            <ArrowLeft className="rtl:rotate-180" /> {t("trip.back")}
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="mt-auto pt-20"
          >
            <span className="eyebrow !text-[#e9c27f]">{trip.country}</span>
            <h1 className="display-xl mt-2 text-white">{trip.city}</h1>
            {tagline && (
              <p className="mt-4 max-w-2xl font-display text-lg italic leading-snug text-[rgba(255,255,255,0.86)] md:text-xl">
                “{tagline}”
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <HeroChip icon={CalendarDays}>{t("trip.days_count", { count: trip.days })}</HeroChip>
              <HeroChip icon={Compass}>{t(`planner.styles.${trip.travel_style}`, { defaultValue: trip.travel_style })}</HeroChip>
              <HeroChip icon={Wallet}>
                <span className="tabular">{trip.budget}</span> {trip.currency}
              </HeroChip>
            </div>
          </motion.div>
        </div>
        {cover?.credit && (
          <span className="absolute bottom-2 end-3 max-w-[45%] truncate text-[10px] text-[rgba(255,255,255,0.6)]">{cover.credit}</span>
        )}
      </section>

      {/* ---------------- Sticky section tabs ---------------- */}
      <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-30 border-b border-border bg-background">
        <div ref={tabsRef} data-swipe-ignore className="container-page max-w-5xl overflow-x-auto scrollbar-none">
          <div className="inline-flex min-w-max gap-2 py-3">
            {TABS.map((tb) => {
              const active = tab === tb.key;
              return (
                <button
                  key={tb.key}
                  data-tab={tb.key}
                  onClick={() => selectTab(tb.key)}
                  className={cn(
                    "relative inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold whitespace-nowrap transition-colors active:scale-95",
                    active
                      ? "border-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="trip-tab"
                      className="absolute inset-0 rounded-full bg-gradient-brand shadow-cta"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <tb.icon className="relative h-4 w-4" />
                  <span className="relative">{t(`trip.${tb.key}`)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div ref={contentRef} className="container-page max-w-5xl py-7 md:py-10">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          onTouchStart={onContentTouchStart}
          onTouchEnd={onContentTouchEnd}
        >
          {tab === "overview" && (
            <div className="grid gap-4 md:grid-cols-5 md:gap-5">
              <div className="card p-6 md:col-span-3 md:p-8">
                <SectionTitle icon={Sparkles} title={t("trip.overview")} ai />
                <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
                  {skeleton?.overview || plan.summary}
                </p>
                {(skeleton?.best_time_to_visit || plan.best_time) && (
                  <div className="panel mt-6 flex items-start gap-3 p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-copper-soft text-copper">
                      <CalendarDays className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-copper">{t("trip.best_time")}</div>
                      <p className="mt-1 text-sm leading-relaxed">{skeleton?.best_time_to_visit || plan.best_time}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="card p-6 md:col-span-2 md:p-8">
                <SectionTitle icon={Wallet} title={t("trip.budget")} />
                <BudgetBreakdown b={plan.budget_breakdown} tripBudget={trip.budget} tripDays={trip.days} />
              </div>
            </div>
          )}

          {tab === "map" && <MapTab plan={plan} />}

          {tab === "itinerary" && (
            <ItineraryTab
              plan={plan}
              currency={trip.currency}
              dayMeta={dayMeta}
              photos={photos}
            />
          )}

          {tab === "hotels" && <Recommendations tripId={trip.id} kind="hotel" />}
          {tab === "restaurants" && <Recommendations tripId={trip.id} kind="restaurant" />}
          {tab === "activities" && <Activities tripId={trip.id} currency={trip.currency} />}
          {tab === "photo" && (
            <PhotoTab spots={plan.photo_spots ?? []} tripId={trip.id} />
          )}
          {tab === "gems" && (
            <div className="grid gap-4 md:grid-cols-2 md:gap-5">
              {(plan.hidden_gems ?? []).map((g, i) => (
                <GemCard key={i} g={g} city={trip.city} index={i} />
              ))}
              {(plan.hidden_gems ?? []).length === 0 && (
                <EmptyState icon={Gem} title={t("trip.no_gems_yet")} className="md:col-span-2" />
              )}
            </div>
          )}
          {tab === "budget" && (
            <BudgetBreakdown b={plan.budget_breakdown} full tripBudget={trip.budget} tripDays={trip.days} />
          )}
          {tab === "transport" && <TipList items={plan.transport} icon={Bus} title={t("trip.transport")} />}
          {tab === "weather" && <TipList items={plan.weather} icon={CloudSun} title={t("trip.weather")} />}
          {tab === "safety" && <TipList items={plan.safety} icon={ShieldCheck} title={t("trip.safety")} />}
        </motion.div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared building blocks                                              */
/* ------------------------------------------------------------------ */

function HeroChip({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <span className="glass-dark inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold capitalize">
      <Icon className="h-4 w-4 text-[#e9c27f]" />
      {children}
    </span>
  );
}

function SectionTitle({ icon: Icon, title, ai }: { icon: typeof Clock; title: string; ai?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", ai ? "bg-gradient-ai" : "bg-primary-soft text-primary")}>
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="text-2xl">{title}</h2>
    </div>
  );
}

function EmptyState({
  icon: Icon, title, desc, action, className,
}: {
  icon: typeof Clock;
  title: string;
  desc?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card mx-auto my-10 max-w-md px-6 py-12 text-center", className)}>
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-2xl">{title}</h2>
      {desc && <p className="mt-2 text-sm text-muted-foreground">{desc}</p>}
      {action && <div className="mt-7">{action}</div>}
    </div>
  );
}

/** Decorative topographic lines for headers without a photo. */
function TopoPattern() {
  return (
    <svg className="absolute inset-0 h-full w-full opacity-[0.14]" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g fill="none" stroke="#fff" strokeWidth="1">
        {Array.from({ length: 9 }).map((_, i) => (
          <path key={i} d={`M-20 ${60 + i * 26} C 80 ${20 + i * 26}, 160 ${110 + i * 26}, 240 ${60 + i * 26} S 380 ${30 + i * 26}, 430 ${80 + i * 26}`} />
        ))}
      </g>
    </svg>
  );
}

function TripSkeleton() {
  return (
    <div aria-busy="true">
      <div className="relative h-[360px] overflow-hidden bg-ink md:h-[460px]">
        <div className="container-page flex h-full max-w-5xl flex-col justify-end gap-3 pb-10">
          <div className="h-3 w-24 rounded-full bg-[rgba(255,255,255,0.12)]" />
          <div className="h-12 w-64 rounded-2xl bg-[rgba(255,255,255,0.12)]" />
          <div className="h-4 w-80 max-w-full rounded-full bg-[rgba(255,255,255,0.1)]" />
        </div>
      </div>
      <div className="container-page max-w-5xl space-y-4 py-6">
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-10 w-28 rounded-full" />)}
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="card space-y-3 p-5">
            <div className="skeleton h-40 rounded-2xl" />
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Composing({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 py-20 text-center">
      <div className="relative h-20 w-20">
        <span className="animate-pulse-ring absolute inset-0 rounded-full bg-[rgba(52,160,136,0.35)]" />
        <span className="bg-gradient-ai relative flex h-full w-full items-center justify-center rounded-full shadow-glow">
          <Sparkles className="h-8 w-8" />
        </span>
      </div>
      <p className="title-md mt-7">{label}</p>
      <p className="mt-2 text-sm text-muted-foreground">{t("trip.weaving")}</p>
    </div>
  );
}

function CrowdChip({ crowd }: { crowd: Crowd }) {
  const { t } = useTranslation();
  const cls: Record<Crowd, string> = { quiet: "badge-success", moderate: "badge-warning", busy: "badge-danger" };
  return (
    <span className={cn("badge", cls[crowd])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" /> {t(`trip.crowd.${crowd}`)}
    </span>
  );
}

function DifficultyBadge({ value }: { value: string }) {
  const { t } = useTranslation();
  const cls = value === "challenging" ? "badge-copper" : value === "moderate" ? "badge-warning" : "badge-success";
  return <span className={cn("badge capitalize", cls)}>{t(`ui.difficulty.${value}`, { defaultValue: value })}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel px-3 py-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[13px] font-semibold">{value}</div>
    </div>
  );
}

function DirectionsBtn({ lat, lng, label }: { lat?: number; lng?: number; label?: string }) {
  const { t } = useTranslation();
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  const href = googleDirectionsUrl(lat as number, lng as number);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => { e.preventDefault(); openDirections(lat as number, lng as number); }}
      className="chip chip-sm text-primary"
    >
      <Navigation /> {label ?? t("trip.directions")}
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Photo spots                                                         */
/* ------------------------------------------------------------------ */

const SPOT_STEPS = [8, 12, 20, 30, 40];

function PhotoTab({ spots, tripId }: { spots: PhotoSpot[]; tripId: string }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<(typeof PHOTO_MODES)[number]>("all");
  const [limit, setLimit] = useState(SPOT_STEPS[0]!);

  // Stage A: the strongest photography locations for this destination.
  const fetchSpots = useServerFn(getPhotoSpots);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["photo-spots", tripId, limit],
    queryFn: () => fetchSpots({ data: { trip_id: tripId, limit } }),
    staleTime: 30 * 60 * 1000,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const planByName = useMemo(() => {
    const m = new Map<string, PhotoSpot>();
    for (const s of spots) m.set(s.name.toLowerCase(), s);
    return m;
  }, [spots]);

  const filtered = useMemo(
    () =>
      mode === "all"
        ? items
        : items.filter((s) => (s.style ?? planByName.get(s.name.toLowerCase())?.style ?? "").toLowerCase() === mode),
    [items, mode, planByName],
  );

  const nextStep = SPOT_STEPS.find((s) => s > limit && s <= Math.max(total, SPOT_STEPS[0]!));
  const canLoadMore = !!nextStep && total > items.length;

  return (
    <div>
      <div data-swipe-ignore className="-mx-5 overflow-x-auto px-5 scrollbar-none md:-mx-8 md:px-8">
        <div className="inline-flex min-w-max gap-2 pb-1">
          {PHOTO_MODES.map((m) => (
            <button key={m} onClick={() => setMode(m)} data-active={mode === m} className="chip">
              {t(`trip.photo_modes.${m}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 md:gap-5">
        {(isLoading ? Array.from({ length: 4 }) : filtered).map((raw, i) => {
          const p = raw as (typeof items)[number] | undefined;
          const plan = p ? planByName.get(p.name.toLowerCase()) : undefined;
          const style = p?.style ?? plan?.style;
          const label = style
            ? t(`trip.photo_modes.${style}`, { defaultValue: style })
            : p?.category
              ? t(`ui.spot_category.${p.category}`, { defaultValue: p.category })
              : "";
          return (
            <motion.article
              key={p?.name ?? i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: EASE }}
              className="card card-hover group overflow-hidden"
            >
              <div className="relative">
                <SpotPhotoImage
                  photo={p?.photo}
                  name={p?.name ?? ""}
                  loading={isLoading}
                  className="transition-transform duration-700 group-hover:scale-[1.02]"
                />
                {label && (
                  <span className="badge badge-overlay absolute start-3 top-3 uppercase tracking-wider">
                    <Camera /> {label}
                  </span>
                )}
                {typeof p?.rating === "number" && (
                  <span className="badge badge-overlay absolute end-3 top-3">
                    <Star className="fill-[#c39443] text-[#c39443]" /> {p.rating}
                  </span>
                )}
              </div>
              <div className="p-5">
                {p ? (
                  <h3 className="title-md">{p.name}</h3>
                ) : (
                  <div className="skeleton h-6 w-2/3" />
                )}
                {(p?.tip || plan?.tip || p?.summary) && (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {p?.tip || plan?.tip || p?.summary}
                  </p>
                )}
                {p?.reasons?.length ? (
                  <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ai" />
                    <span>
                      <span className="font-semibold text-foreground">{t("trip.why_here")} · </span>
                      {p.reasons.slice(0, 2).join(" · ")}
                    </span>
                  </p>
                ) : null}
                {(p?.bestTime || plan?.best_time || plan?.angle || plan?.duration) && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {(p?.bestTime || plan?.best_time) && (
                      <Metric label={t("trip.best_time")} value={(p?.bestTime || plan?.best_time)!} />
                    )}
                    {plan?.angle && <Metric label={t("trip.metrics.angle")} value={plan.angle} />}
                    {plan?.duration && <Metric label={t("trip.metrics.duration")} value={plan.duration} />}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  {plan?.crowd && <CrowdChip crowd={plan.crowd} />}
                  {p?.fromPlan && (
                    <span className="badge badge-primary"><Heart /> {t("trip.in_your_plan")}</span>
                  )}
                  {plan?.golden_hour && (
                    <span className="badge badge-copper"><Sunset /> {t("trip.golden_hour")}</span>
                  )}
                  <DirectionsBtn lat={p?.lat} lng={p?.lng} />
                </div>
                {p && <PoseGuide spot={{ name: p.name, category: p.category, style: p.style ?? plan?.style }} />}
              </div>
            </motion.article>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <EmptyState icon={Camera} title={t("trip.no_spots_match")} className="md:col-span-2" />
        )}
      </div>
      {canLoadMore && (
        <div className="mt-8 flex justify-center">
          <button onClick={() => setLimit(nextStep!)} disabled={isFetching} className="btn btn-secondary">
            {isFetching ? t("common.loading") : t("trip.view_more", { count: nextStep })}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hidden gems & practical tips                                        */
/* ------------------------------------------------------------------ */

function GemCard({ g, city, index }: { g: HiddenGem; city: string; index: number }) {
  const { t } = useTranslation();
  const query = g.map_query ?? `${g.name} ${city}`;
  const mapUrl = googleSearchUrl(query);
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: Math.min(index, 4) * 0.05, ease: EASE }}
      className="card card-hover relative flex flex-col overflow-hidden p-6"
    >
      <div className="glow-copper pointer-events-none absolute -end-16 -top-16 h-56 w-56" />
      <div className="relative flex items-start justify-between gap-3">
        <span className="badge badge-copper uppercase tracking-wider">
          <Gem /> {t("trip.hidden_gem_badge")}
        </span>
        <span className="font-display text-3xl leading-none text-sand">{String(index + 1).padStart(2, "0")}</span>
      </div>
      <h3 className="title-md relative mt-4">{g.name}</h3>
      {g.story && <p className="relative mt-3 font-display text-[1.05rem] italic leading-relaxed text-muted-foreground">“{g.story}”</p>}
      {g.why_locals_love && (
        <div className="panel relative mt-4 p-3.5 text-sm leading-relaxed">
          <span className="font-semibold text-copper">{t("trip.locals_love")} · </span>
          {g.why_locals_love}
        </div>
      )}
      <div className="relative mt-auto flex flex-wrap items-center gap-1.5 pt-5">
        {g.crowd && <CrowdChip crowd={g.crowd} />}
        {g.duration && <span className="badge"><Timer /> {g.duration}</span>}
        {g.difficulty && <DifficultyBadge value={g.difficulty} />}
        {g.price && <span className="badge"><CircleDollarSign /> {g.price}</span>}
      </div>
      <div className="relative mt-4 flex flex-wrap gap-2">
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => { e.preventDefault(); openMapSearch(query); }}
          className="btn btn-primary btn-sm"
        >
          <MapPin /> {t("trip.maps")} <ExternalLink />
        </a>
        <DirectionsBtn lat={g.lat} lng={g.lng} />
      </div>
    </motion.article>
  );
}

function TipList({ items, icon: Icon, title }: { items?: string[]; icon: typeof Clock; title: string }) {
  if (!items?.length) return <EmptyState icon={Icon} title={title} desc="—" />;
  return (
    <div>
      <SectionTitle icon={Icon} title={title} />
      <div className="mt-6 space-y-3">
        {items.map((tip, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: EASE }}
            className="card flex gap-4 p-4 md:p-5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-sm text-primary tabular">
              {i + 1}
            </span>
            <p className="pt-1 text-[15px] leading-relaxed">{tip}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Itinerary                                                           */
/* ------------------------------------------------------------------ */

/**
 * One vertical timeline per day, scannable at a glance:
 * DAY → TIME → ACTIVITY → PLACE → COST. Each stop gets the real photo of the
 * place when resolved (otherwise the slot icon on the app's own gradient —
 * never a broken image) and opens a full-screen detail on tap.
 */
function ItineraryTab({
  plan,
  currency,
  dayMeta,
  photos,
}: {
  plan: Plan;
  currency: string;
  dayMeta: (n: number) => { day_number?: number; theme_title?: string; tip?: string } | undefined;
  photos?: Record<string, PlacePhotoLite>;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-12">
      {plan.itinerary?.map((d, i) => {
        const slots = ITINERARY_SLOTS.map((slot) => {
          const raw = d[slot] ?? (slot === "afternoon" ? d.evening : undefined);
          if (!raw) return null;
          return { slot, s: (typeof raw === "string" ? { desc: raw } : raw) as Slot };
        }).filter(Boolean) as Array<{ slot: (typeof ITINERARY_SLOTS)[number]; s: Slot }>;
        const dayCost = slots.reduce((sum, x) => sum + (typeof x.s.cost === "number" ? x.s.cost : 0), 0);
        const tip = dayMeta(d.day)?.tip || d.tip;
        return (
          <motion.section
            key={d.day}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: Math.min(i, 2) * 0.05, ease: EASE }}
          >
            {/* Day header */}
            <div className="flex items-end gap-4">
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-brand shadow-cta">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[rgba(251,248,242,0.75)]">{t("trip.day")}</span>
                <span className="font-display text-2xl leading-none tabular">{d.day}</span>
              </div>
              <div className="min-w-0 pb-0.5">
                <h2 className="text-[1.45rem] leading-tight md:text-3xl">{dayMeta(d.day)?.theme_title || d.title}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><RouteIcon className="h-3.5 w-3.5" /> {t("ui.trip.stops", { count: slots.length })}</span>
                  {dayCost > 0 && (
                    <span className="inline-flex items-center gap-1 text-copper">
                      <Wallet className="h-3.5 w-3.5" /> ≈ <span className="tabular">{dayCost}</span> {currency}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="relative mt-6 space-y-4 ps-12 md:ps-14">
              <span className="absolute bottom-6 start-[19px] top-4 w-0.5 rounded-full bg-border md:start-[23px]" aria-hidden />
              {slots.map(({ slot, s }) => {
                const photo = s.name ? (photos?.[s.name] ?? null) : null;
                return <TimelineSlotCard key={slot} label={slot} slot={s} currency={currency} photo={photo} />;
              })}
            </div>

            {tip && (
              <div className="ms-12 mt-4 flex items-start gap-3 rounded-2xl border border-[rgba(195,148,67,0.35)] bg-[rgba(195,148,67,0.1)] p-4 md:ms-14">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-gold">{t("ui.trip.day_tip")}</div>
                  <p className="mt-1 text-sm leading-relaxed">{tip}</p>
                </div>
              </div>
            )}
          </motion.section>
        );
      })}
    </div>
  );
}

function TimelineSlotCard({
  label,
  slot,
  currency,
  photo,
}: {
  label: (typeof ITINERARY_SLOTS)[number];
  slot: Slot;
  currency: string;
  photo: PlacePhotoLite;
}) {
  const { t } = useTranslation();
  const Icon = SLOT_ICON[label];
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <div className="relative">
      {/* Time marker on the line */}
      <span className="absolute -start-12 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-card text-primary shadow-soft ring-1 ring-border md:-start-14 md:h-12 md:w-12">
        <Icon className="h-[1.1rem] w-[1.1rem]" />
      </span>

      <article className="card card-hover overflow-hidden">
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="relative block h-40 w-full overflow-hidden bg-secondary text-start md:h-48"
        >
          {photo?.url ? (
            <img
              src={photo.url}
              alt={slot.name || t(`trip.slots.${label}`)}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 hover:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary to-muted">
              <Icon className="h-9 w-9 text-subtle" />
            </div>
          )}
          <div className="scrim-card pointer-events-none absolute inset-0" />
          <span className="badge badge-overlay absolute start-3 top-3 uppercase tracking-wider">
            <Icon /> {t(`trip.slots.${label}`)}
          </span>
          {slot.duration && (
            <span className="badge badge-dark absolute end-3 top-3">
              <Clock /> {slot.duration}
            </span>
          )}
          {photo?.credit && (
            <span className="absolute bottom-2 end-2 max-w-[55%] truncate rounded-full bg-[rgba(8,20,18,0.45)] px-2 py-0.5 text-[10px] text-[rgba(255,255,255,0.85)]">
              {photo.credit}
            </span>
          )}
        </button>

        <div className="p-4 md:p-5">
          {slot.name && (
            <h3 className="flex items-start gap-1.5 font-body text-base font-bold leading-snug tracking-normal">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-copper" />
              {slot.name}
            </h3>
          )}
          {slot.desc && (
            <p className={cn("text-sm leading-relaxed text-muted-foreground", slot.name && "mt-1.5")}>{slot.desc}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {slot.cost != null && (
              <span className="badge badge-copper text-xs">
                <Wallet /> <span className="tabular">{slot.cost}</span> {currency}
              </span>
            )}
            {slot.travel_time && <span className="badge"><Footprints /> {slot.travel_time}</span>}
            {slot.difficulty && <DifficultyBadge value={slot.difficulty} />}
            <DirectionsBtn lat={slot.lat} lng={slot.lng} />
          </div>
        </div>
      </article>

      <SlotDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        label={label}
        slot={slot}
        currency={currency}
        photo={photo}
      />
    </div>
  );
}

/**
 * Full-screen place detail opened by tapping an itinerary photo — reuses the same
 * generated data as the compact card (desc/duration/cost/etc.), just with room to
 * breathe, plus a second full-bleed zoom step for the photo itself.
 */
function SlotDetailSheet({
  open,
  onOpenChange,
  label,
  slot,
  currency,
  photo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  label: (typeof ITINERARY_SLOTS)[number];
  slot: Slot;
  currency: string;
  photo: PlacePhotoLite;
}) {
  const { t } = useTranslation();
  const Icon = SLOT_ICON[label];
  const [zoomed, setZoomed] = useState(false);

  const close = () => {
    setZoomed(false);
    onOpenChange(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="fixed inset-0 z-50 overflow-y-auto bg-background"
        >
          <button type="button" onClick={close} aria-label={t("common.close")} className="btn btn-glass btn-icon fixed end-4 top-[calc(1rem+env(safe-area-inset-top))] z-10 bg-[rgba(8,20,18,0.4)]">
            <X />
          </button>

          <button
            type="button"
            onClick={() => photo?.url && setZoomed(true)}
            className="relative block h-80 w-full overflow-hidden bg-secondary text-start sm:h-[28rem]"
          >
            {photo?.url ? (
              <img src={photo.url} alt={slot.name || t(`trip.slots.${label}`)} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-brand">
                <TopoPattern />
                <Icon className="relative h-14 w-14 text-[rgba(255,255,255,0.6)]" />
              </div>
            )}
            <div className="scrim pointer-events-none absolute inset-0" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-white">
              <span className="badge badge-overlay uppercase tracking-wider"><Icon /> {t(`trip.slots.${label}`)}</span>
              {slot.name && <h2 className="display-lg mt-3 text-white">{slot.name}</h2>}
            </div>
            {photo?.credit && (
              <span className="absolute end-4 top-[calc(4rem+env(safe-area-inset-top))] max-w-[50%] truncate rounded-full bg-[rgba(8,20,18,0.45)] px-2.5 py-1 text-[11px] text-[rgba(255,255,255,0.85)]">
                {photo.credit}
              </span>
            )}
          </button>

          <div className="container-page max-w-2xl py-7">
            <p className="text-[1.05rem] leading-relaxed text-muted-foreground">{slot.desc}</p>
            <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {slot.duration && <Metric label={t("trip.metrics.duration")} value={slot.duration} />}
              {slot.cost != null && <Metric label={t("trip.metrics.cost")} value={`${slot.cost} ${currency}`} />}
              {slot.travel_time && <Metric label={t("trip.transport")} value={slot.travel_time} />}
              {slot.difficulty && <Metric label={t("ui.trip.difficulty")} value={t(`ui.difficulty.${slot.difficulty}`, { defaultValue: slot.difficulty })} />}
            </div>
            {Number.isFinite(slot.lat) && Number.isFinite(slot.lng) && !(slot.lat === 0 && slot.lng === 0) && (
              <button
                type="button"
                onClick={() => openDirections(slot.lat as number, slot.lng as number)}
                className="btn btn-primary btn-block mt-7"
              >
                <Navigation /> {t("trip.directions")}
              </button>
            )}
          </div>

          <AnimatePresence>
            {zoomed && photo?.url && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setZoomed(false)}
                className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(0,0,0,0.95)] p-4"
              >
                <img src={photo.url} alt={slot.name || t(`trip.slots.${label}`)} className="max-h-full max-w-full object-contain" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoomed(false);
                  }}
                  aria-label={t("common.close")}
                  className="btn btn-glass btn-icon absolute end-4 top-[calc(1rem+env(safe-area-inset-top))]"
                >
                  <X />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Budget                                                              */
/* ------------------------------------------------------------------ */

const BUDGET_ROWS = [
  { key: "stay", color: "var(--chart-1)", icon: Bed },
  { key: "food", color: "var(--chart-2)", icon: Utensils },
  { key: "transport", color: "var(--chart-3)", icon: Bus },
  { key: "activities", color: "var(--chart-4)", icon: Compass },
  { key: "other", color: "var(--chart-5)", icon: CircleDollarSign },
] as const;

function BudgetBreakdown({ b, full, tripBudget, tripDays }: { b: Plan["budget_breakdown"]; full?: boolean; tripBudget?: number; tripDays?: number }) {
  const { t } = useTranslation();
  if (!b) return <p className="mt-4 text-sm text-muted-foreground">—</p>;
  const total = b.total ?? 0;
  const remaining = tripBudget != null ? Math.max(0, tripBudget - total) : undefined;
  const daily = b.daily ?? (tripDays ? Math.round(total / tripDays) : undefined);
  const reserve = b.emergency_reserve ?? Math.round(total * 0.1);
  const usedPct = tripBudget ? Math.min(100, Math.round((total / tripBudget) * 100)) : undefined;
  const rows = BUDGET_ROWS.map((r) => {
    const val = (b[r.key] as number | undefined) ?? 0;
    return { ...r, val, pct: total ? Math.round((val / total) * 100) : 0 };
  });

  const stacked = (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary">
      {rows.map((r, i) => (
        <motion.div
          key={r.key}
          initial={{ width: 0 }}
          animate={{ width: `${r.pct}%` }}
          transition={{ duration: 0.9, delay: i * 0.08, ease: EASE }}
          style={{ background: r.color }}
          className="h-full"
        />
      ))}
    </div>
  );

  const legend = (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-3 rounded-xl px-1 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--secondary)", color: r.color }}>
            <r.icon className="h-4 w-4" />
          </span>
          <span className="flex-1 text-sm font-semibold">{t(`trip.budget_categories.${r.key}`)}</span>
          <span className="text-sm font-bold tabular">{r.val}</span>
          <span className="w-11 text-end text-xs font-semibold text-muted-foreground tabular">{r.pct}%</span>
        </li>
      ))}
    </ul>
  );

  if (!full) {
    return (
      <div className="mt-5">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-4xl tabular">{total}</span>
          <span className="text-sm font-semibold text-muted-foreground">{b.currency}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("trip.estimated_total")}</p>
        <div className="mt-5">{stacked}</div>
        <div className="mt-4">{legend}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Total vs. trip budget */}
      <div className="surface-ink relative overflow-hidden rounded-[1.75rem] p-6 md:p-8">
        <div className="glow-teal pointer-events-none absolute -end-28 -top-28 h-80 w-80" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-[rgba(246,242,234,0.6)]">{t("trip.estimated_total")}</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-5xl text-white tabular md:text-6xl">{total}</span>
              <span className="text-base font-semibold text-[rgba(246,242,234,0.7)]">{b.currency}</span>
            </div>
          </div>
          {usedPct != null && (
            <div className="min-w-[10rem] flex-1 md:max-w-xs">
              <div className="flex justify-between text-xs font-semibold text-[rgba(246,242,234,0.7)]">
                <span>{t("ui.trip.budget_used", { pct: usedPct })}</span>
                <span className="tabular">{tripBudget} {b.currency}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.12)]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${usedPct}%` }}
                  transition={{ duration: 1, ease: EASE }}
                  className="bg-gradient-ai h-full rounded-full"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat icon={PiggyBank} label={t("trip.remaining")} value={remaining != null ? `${remaining} ${b.currency}` : "—"} accent />
        <Stat icon={TrendingUp} label={t("trip.daily_budget")} value={daily != null ? `${daily} ${b.currency}` : "—"} />
        <Stat icon={LifeBuoy} label={t("trip.emergency_reserve")} value={`${reserve} ${b.currency}`} />
      </div>

      <div className="card p-6 md:p-7">
        <h3 className="text-xl">{t("ui.trip.breakdown")}</h3>
        <div className="mt-5">{stacked}</div>
        <div className="mt-4">{legend}</div>
      </div>

      {b.savings_tips && b.savings_tips.length > 0 && (
        <div className="card ai-surface p-6 md:p-7">
          <div className="flex items-center gap-2">
            <span className="ai-chip"><Sparkles /> {t("ui.ai_badge")}</span>
          </div>
          <h3 className="mt-3 text-xl">{t("trip.savings_tips")}</h3>
          <ul className="mt-4 space-y-2.5">
            {b.savings_tips.map((tip, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ai-soft text-ai">
                  <PiggyBank className="h-3.5 w-3.5" />
                </span>
                <span className="text-muted-foreground">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: typeof Clock; label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("card flex items-center gap-4 p-4 md:flex-col md:items-start md:p-5", accent && "border-transparent bg-gradient-copper")}>
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", accent ? "bg-[rgba(255,255,255,0.2)]" : "bg-secondary text-primary")}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <div className={cn("text-[11px] font-bold uppercase tracking-wider", accent ? "text-[rgba(255,248,240,0.85)]" : "text-muted-foreground")}>{label}</div>
        <div className="mt-0.5 font-display text-xl tabular">{value}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Map                                                                 */
/* ------------------------------------------------------------------ */

function hasCoord<T extends { lat?: number; lng?: number }>(g: T | undefined | null): g is T & { lat: number; lng: number } {
  if (!g) return false;
  const { lat, lng } = g;
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
}

const DAY_COLORS = ["#0f766e", "#0369a1", "#c2410c", "#7c3aed", "#be123c", "#166534", "#a16207"];

function MapTab({ plan }: { plan: Plan }) {
  const { t } = useTranslation();
  const [dayFilter, setDayFilter] = useState<"all" | number>("all");
  const [layers, setLayers] = useState<Record<MapMarker["category"], boolean>>({
    hotel: true, restaurant: true, activity: true, photo: true, gem: true, itinerary: true,
  });

  const SLOTS = ["morning", "lunch", "afternoon", "sunset", "dinner", "night"] as const;

  const { markers, route } = useMemo(() => {
    const all: MapMarker[] = [];
    if (layers.hotel) {
      plan.hotels?.forEach((h) => {
        if (hasCoord(h)) all.push({ lat: h.lat, lng: h.lng, title: h.name, subtitle: h.area, category: "hotel" });
      });
    }
    if (layers.restaurant) {
      plan.restaurants?.forEach((r) => {
        if (hasCoord(r)) all.push({ lat: r.lat, lng: r.lng, title: r.name, subtitle: r.cuisine, category: "restaurant" });
      });
    }
    if (layers.activity) {
      plan.activities?.forEach((a) => {
        if (hasCoord(a)) all.push({ lat: a.lat, lng: a.lng, title: a.name, subtitle: a.category, category: "activity" });
      });
    }
    if (layers.photo) {
      plan.photo_spots?.forEach((p) => {
        if (hasCoord(p)) all.push({ lat: p.lat, lng: p.lng, title: p.name, subtitle: p.style ? t(`trip.photo_modes.${p.style}`, { defaultValue: p.style }) : undefined, category: "photo" });
      });
    }
    if (layers.gem) {
      plan.hidden_gems?.forEach((g) => {
        if (hasCoord(g)) all.push({ lat: g.lat, lng: g.lng, title: g.name, subtitle: t("trip.hidden_gem_badge"), category: "gem" });
      });
    }

    const routePoints: Array<{ lat: number; lng: number }> = [];
    if (layers.itinerary) {
      const days = plan.itinerary ?? [];
      days.forEach((d) => {
        if (dayFilter !== "all" && d.day !== dayFilter) return;
        SLOTS.forEach((slot) => {
          const raw = d[slot] ?? (slot === "afternoon" ? d.evening : undefined);
          if (!raw || typeof raw === "string") return;
          if (hasCoord(raw)) {
            all.push({
              lat: raw.lat,
              lng: raw.lng,
              title: raw.name || `${t("trip.day")} ${d.day} · ${t(`trip.slots.${slot}`)}`,
              subtitle: `${t(`trip.slots.${slot}`)} — ${raw.desc ?? ""}`.slice(0, 120),
              category: "itinerary",
              day: d.day,
            });
            routePoints.push({ lat: raw.lat, lng: raw.lng });
          }
        });
      });
    }

    return { markers: all, route: routePoints };
  }, [plan, layers, dayFilter, t]);

  const catToggles: Array<{ key: MapMarker["category"] }> = [
    { key: "itinerary" }, { key: "hotel" }, { key: "restaurant" },
    { key: "activity" }, { key: "photo" }, { key: "gem" },
  ];

  const days = plan.itinerary?.map((d) => d.day) ?? [];

  return (
    <div className="space-y-4">
      <div data-swipe-ignore className="-mx-5 overflow-x-auto px-5 scrollbar-none md:mx-0 md:px-0">
        <div className="inline-flex min-w-max gap-2 md:flex md:flex-wrap">
          {catToggles.map((c) => (
            <button
              key={c.key}
              onClick={() => setLayers((s) => ({ ...s, [c.key]: !s[c.key] }))}
              data-active={layers[c.key]}
              className="chip"
            >
              {t(`trip.map_layers.${c.key}`)}
            </button>
          ))}
        </div>
      </div>

      {days.length > 0 && (
        <div data-swipe-ignore className="-mx-5 overflow-x-auto px-5 scrollbar-none md:mx-0 md:px-0">
          <div className="inline-flex min-w-max gap-1.5">
            <button onClick={() => setDayFilter("all")} data-active={dayFilter === "all"} className="chip chip-sm">
              {t("trip.all_days")}
            </button>
            {days.map((d, i) => (
              <button
                key={d}
                onClick={() => setDayFilter(d)}
                className={cn("chip chip-sm", dayFilter === d && "border-transparent text-white")}
                style={dayFilter === d ? { background: DAY_COLORS[i % DAY_COLORS.length] } : undefined}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: dayFilter === d ? "#fff" : DAY_COLORS[i % DAY_COLORS.length] }} />
                {t("trip.day")} {d}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden p-1.5">
        <div className="overflow-hidden rounded-[1.1rem]">
          <TripMap markers={markers} route={route} height={520} />
        </div>
      </div>

      <div className="card p-4 md:p-5">
        <MapLegend />
        {markers.length === 0 && (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <MapIcon className="h-4 w-4" /> {t("trip.no_coordinates")}
          </p>
        )}
      </div>
    </div>
  );
}
