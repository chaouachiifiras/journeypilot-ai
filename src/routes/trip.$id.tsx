import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, Loader2, MapPin, Star, Bed, UtensilsCrossed, Camera,
  Compass, Wallet, Bus, CloudSun, ShieldCheck, Clock, Gem, ExternalLink,
  Sunrise, Sunset, Moon, Sun, Utensils, X,
} from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { AuthGate } from "@/components/auth/AuthGate";
import { TripMap, MapLegend, type MapMarker } from "@/components/trip/TripMap";
import { PlaceImage } from "@/components/media/PlaceImage";
import { SpotPhotoImage } from "@/components/media/SpotPhotoImage";
import { Recommendations } from "@/components/trip/Recommendations";
import { Activities } from "@/components/trip/Activities";
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
  { key: "overview", icon: Compass },
  { key: "map", icon: MapPin },
  { key: "hotels", icon: Bed },
  { key: "restaurants", icon: UtensilsCrossed },
  { key: "activities", icon: Compass },
  { key: "photo", icon: Camera },
  { key: "gems", icon: Gem },
  { key: "budget", icon: Wallet },
  { key: "transport", icon: Bus },
  { key: "weather", icon: CloudSun },
  { key: "safety", icon: ShieldCheck },
] as const;

const PHOTO_MODES = ["all", "instagram", "cinematic", "luxury", "romantic", "night", "drone", "nature", "architecture", "hidden"] as const;

const TAB_KEYS = TABS.map((tb) => tb.key);
const SWIPE_MIN_DISTANCE = 60;
const SWIPE_MAX_VERTICAL_RATIO = 0.6; // swipe must be mostly horizontal, not a scroll

function TripView() {
  const { id } = Route.useParams();
  const { ready, isAnonymous } = useAnonSession();
  const { t, i18n } = useTranslation();
  const fetchTrip = useServerFn(getTrip);
  const fetchSkeleton = useServerFn(getTripSkeleton);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("itinerary");

  // Swipe left/right to move between tabs. Ignored when the gesture starts inside a
  // nested horizontally-scrollable strip (e.g. the photo-mode filter chips) — see
  // data-swipe-ignore below — and naturally doesn't fire when it starts on the Leaflet
  // map, since Leaflet stops propagation on its own pan/drag touch handling.
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isRtl = i18n.dir() === "rtl";

  const goToRelativeTab = (delta: 1 | -1) => {
    const idx = TAB_KEYS.indexOf(tab);
    const next = idx + delta;
    if (next >= 0 && next < TAB_KEYS.length) setTab(TAB_KEYS[next]!);
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



  if (ready && isAnonymous) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <AuthGate />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <Loading label={t("trip.loading")} />
      </div>
    );
  }

  const trip = data as {
    id: string; city: string; country: string; days: number; budget: number;
    currency: string; travel_style: string; status: string; plan: Plan | null;
  };

  if (trip.status === "pending") {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <Loading label={t("trip.loading")} />
      </div>
    );
  }
  if (trip.status === "error" || !trip.plan) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h1 className="font-display text-3xl">{t("trip.not_found")}</h1>
          <Link to="/planner" className="mt-6 inline-block underline text-primary">
            {t("nav.plan")}
          </Link>
        </div>
      </div>
    );
  }

  const plan = trip.plan;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link
          to="/planner"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t("trip.back")}
        </Link>

        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-6"
        >
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-display text-4xl md:text-6xl tracking-tight">
              {trip.city}
            </h1>
            <span className="text-muted-foreground text-lg">· {trip.country}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Chip>{t("trip.days_count", { count: trip.days })}</Chip>
            <Chip>{trip.travel_style}</Chip>
            <Chip>{trip.budget} {trip.currency}</Chip>
          </div>
          {(skeleton?.tagline || plan.summary) && (
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground italic">
              "{skeleton?.tagline || plan.summary}"
            </p>
          )}
        </motion.header>

        {/* Tabs */}
        <div className="mt-10 -mx-6 px-6 overflow-x-auto scrollbar-none">
          <div className="inline-flex gap-1 border-b border-border min-w-max">
            {TABS.map((tb) => {
              const active = tab === tb.key;
              return (
                <button
                  key={tb.key}
                  onClick={() => setTab(tb.key)}
                  className={cn(
                    "relative inline-flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <tb.icon className="h-4 w-4" />
                  {t(`trip.${tb.key}`)}
                  {active && (
                    <motion.span
                      layoutId="trip-tab"
                      className="absolute inset-x-2 -bottom-px h-0.5 bg-primary rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-8"
          onTouchStart={onContentTouchStart}
          onTouchEnd={onContentTouchEnd}
        >
          {tab === "overview" && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <h3 className="font-display text-xl">{t("trip.overview")}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {skeleton?.overview || plan.summary}
                </p>
                {(skeleton?.best_time_to_visit || plan.best_time) && (
                  <p className="mt-3 text-sm">
                    <span className="font-medium">{t("trip.best_time")}:</span>{" "}
                    <span className="text-muted-foreground">{skeleton?.best_time_to_visit || plan.best_time}</span>
                  </p>
                )}
              </Card>
              <Card>
                <h3 className="font-display text-xl">{t("trip.budget")}</h3>
                <BudgetBreakdown b={plan.budget_breakdown} tripBudget={trip.budget} tripDays={trip.days} />
              </Card>
            </div>
          )}

          {tab === "map" && <MapTab plan={plan} />}



          {tab === "itinerary" && (
            <ItineraryTab
              plan={plan}
              tripId={trip.id}
              city={trip.city}
              country={trip.country}
              currency={trip.currency}
              dayMeta={dayMeta}
            />
          )}

          {tab === "hotels" && <Recommendations tripId={trip.id} kind="hotel" />}
          {tab === "restaurants" && <Recommendations tripId={trip.id} kind="restaurant" />}
          {tab === "activities" && <Activities tripId={trip.id} currency={trip.currency} />}
          {tab === "photo" && (
            <PhotoTab spots={plan.photo_spots ?? []} tripId={trip.id} />
          )}
          {tab === "gems" && (
            <div className="space-y-4">
              {(plan.hidden_gems ?? []).map((g, i) => (
                <GemCard key={i} g={g} city={trip.city} seed={`gem-${i}`} />
              ))}
              {(plan.hidden_gems ?? []).length === 0 && (
                <p className="text-muted-foreground text-sm">{t("trip.no_gems_yet")}</p>
              )}
            </div>
          )}
          {tab === "budget" && (
            <Card>
              <BudgetBreakdown b={plan.budget_breakdown} full tripBudget={trip.budget} tripDays={trip.days} />
            </Card>
          )}
          {tab === "transport" && <TipList items={plan.transport} icon={<Bus className="h-4 w-4" />} />}
          {tab === "weather" && <TipList items={plan.weather} icon={<CloudSun className="h-4 w-4" />} />}
          {tab === "safety" && <TipList items={plan.safety} icon={<ShieldCheck className="h-4 w-4" />} />}
        </motion.div>
      </div>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-lg px-6 py-32 text-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        className="mx-auto h-16 w-16 rounded-full border-2 border-copper border-t-transparent"
      />
      <p className="mt-6 font-display text-2xl">{label}</p>
      <p className="mt-2 text-sm text-muted-foreground">{t("trip.weaving")}</p>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium capitalize">
      {children}
    </span>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">{children}</div>;
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}
function ItemCard({
  title, subtitle, meta, desc, extra, rating, crowd, icon, lat, lng,
  imageQuery, city, seed,
}: {
  title: string; subtitle?: string; meta?: string; desc?: string;
  extra?: string; rating?: number; crowd?: Crowd; icon?: React.ReactNode;
  lat?: number; lng?: number;
  imageQuery?: string; city?: string; seed?: string | number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group overflow-hidden rounded-2xl border border-border bg-card shadow-soft hover:shadow-lift transition-all"
    >
      {imageQuery && (
        <div className="relative">
          <PlaceImage
            query={imageQuery}
            city={city}
            aspect="wide"
            className="rounded-none rounded-t-2xl transition-transform duration-700 group-hover:scale-[1.03]"
            seed={seed}
          />
          {rating != null && (
            <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-background/90 backdrop-blur px-2.5 py-1 text-xs font-medium shadow-soft">
              <Star className="h-3.5 w-3.5 fill-copper text-copper" />
              {rating.toFixed(1)}
            </div>
          )}
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-copper font-medium uppercase tracking-widest">
              {icon}
              <span>{subtitle}</span>
            </div>
            <h4 className="mt-1 font-display text-xl leading-tight">{title}</h4>
          </div>
          {rating != null && !imageQuery && (
            <div className="flex items-center gap-1 text-xs font-medium text-foreground shrink-0">
              <Star className="h-3.5 w-3.5 fill-copper text-copper" />
              {rating.toFixed(1)}
            </div>
          )}
        </div>
        {meta && <div className="mt-2 text-xs text-muted-foreground">{meta}</div>}
        {desc && <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {crowd && <CrowdChip crowd={crowd} />}
          <DirectionsBtn lat={lat} lng={lng} />
        </div>
        {extra && (
          <p className="mt-3 rounded-lg bg-secondary px-3 py-1.5 text-xs text-secondary-foreground">
            {extra}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function CrowdChip({ crowd }: { crowd: Crowd }) {
  const { t } = useTranslation();
  const map: Record<Crowd, { dot: string; cls: string }> = {
    quiet: { dot: "🟢", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
    moderate: { dot: "🟡", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    busy: { dot: "🔴", cls: "bg-red-500/10 text-red-700 dark:text-red-400" },
  };
  const c = map[crowd];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", c.cls)}>
      <span>{c.dot}</span> {t(`trip.crowd.${crowd}`)}
    </span>
  );
}

function ActivityCard({ a, currency, city, seed }: { a: Activity; currency: string; city?: string; seed?: string | number }) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group overflow-hidden rounded-2xl border border-border bg-card shadow-soft hover:shadow-lift transition-all"
    >
      <PlaceImage
        query={`${a.name} ${a.category ?? "attraction"}`}
        city={city}
        aspect="wide"
        className="rounded-none rounded-t-2xl transition-transform duration-700 group-hover:scale-[1.03]"
        seed={seed}
      />
      <div className="p-5">
        <div className="flex items-center gap-2 text-xs text-copper uppercase tracking-widest">
          <Compass className="h-4 w-4" />
          <span>{a.category}</span>
        </div>
        <h4 className="mt-1 font-display text-xl leading-tight">{a.name}</h4>
        {a.why && <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{a.why}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          {a.best_hour && <Metric label={t("trip.metrics.best_hour")} value={a.best_hour} />}
          {a.avg_duration && <Metric label={t("trip.metrics.avg_visit")} value={a.avg_duration} />}
          {a.walking_time && <Metric label={t("trip.metrics.walk")} value={a.walking_time} />}
          {a.transport_time && <Metric label={t("trip.transport")} value={a.transport_time} />}
          {a.waiting_time && <Metric label={t("trip.metrics.wait")} value={a.waiting_time} />}
          {a.cost != null && <Metric label={t("trip.metrics.cost")} value={`${a.cost} ${currency}`} />}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {a.crowd && <CrowdChip crowd={a.crowd} />}
          {a.difficulty && (
            <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[11px] capitalize">
              {a.difficulty}
            </span>
          )}
          <DirectionsBtn lat={a.lat} lng={a.lng} />
        </div>
      </div>
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-xs font-medium">{value}</div>
    </div>
  );
}

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
      <div data-swipe-ignore className="-mx-6 px-6 overflow-x-auto scrollbar-none">
        <div className="inline-flex gap-1.5 min-w-max pb-2">
          {PHOTO_MODES.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition",
                mode === m
                  ? "bg-gradient-copper text-primary-foreground border-transparent"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`trip.photo_modes.${m}`)}
            </button>
          ))}
        </div>
      </div>
      <Grid>
        {(isLoading ? Array.from({ length: 4 }) : filtered).map((raw, i) => {
          const p = raw as (typeof items)[number] | undefined;
          const plan = p ? planByName.get(p.name.toLowerCase()) : undefined;
          return (
            <motion.div
              key={p?.name ?? i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="group overflow-hidden rounded-2xl border border-border bg-card shadow-soft hover:shadow-lift transition-all"
            >
              <SpotPhotoImage
                photo={p?.photo}
                name={p?.name ?? ""}
                loading={isLoading}
                className="rounded-none rounded-t-2xl transition-transform duration-700 group-hover:scale-[1.02]"
              />
              <div className="p-5">
                <div className="flex items-center gap-2 text-xs text-copper uppercase tracking-widest">
                  <Camera className="h-4 w-4" />
                  <span>{p?.style ?? plan?.style ?? p?.category ?? "photo"}</span>
                </div>
                <h4 className="mt-1 font-display text-xl leading-tight">{p?.name ?? "…"}</h4>
                {(p?.tip || plan?.tip || p?.summary) && (
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {p?.tip || plan?.tip || p?.summary}
                  </p>
                )}
                {p?.reasons?.length ? (
                  <p className="mt-2 text-[11px] text-muted-foreground/80 leading-relaxed">
                    {t("trip.why_here")}: {p.reasons.slice(0, 2).join(" · ")}
                  </p>
                ) : null}
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  {(p?.bestTime || plan?.best_time) && (
                    <Metric label={t("trip.best_time")} value={(p?.bestTime || plan?.best_time)!} />
                  )}
                  {plan?.angle && <Metric label={t("trip.metrics.angle")} value={plan.angle} />}
                  {typeof p?.rating === "number" && <Metric label={t("trip.metrics.rating")} value={`${p.rating} ★`} />}
                  {plan?.duration && <Metric label={t("trip.metrics.duration")} value={plan.duration} />}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {plan?.crowd && <CrowdChip crowd={plan.crowd} />}
                  {p?.fromPlan && (
                    <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[11px]">{t("trip.in_your_plan")}</span>
                  )}
                  {plan?.golden_hour && (
                    <span className="inline-flex rounded-full bg-copper/15 text-copper px-2 py-0.5 text-[11px]">
                      ✨ {t("trip.golden_hour")}
                    </span>
                  )}
                  <DirectionsBtn lat={p?.lat} lng={p?.lng} />
                </div>
              </div>
            </motion.div>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full">{t("trip.no_spots_match")}</p>
        )}
      </Grid>
      {canLoadMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setLimit(nextStep!)}
            disabled={isFetching}
            className="rounded-full border border-border bg-card px-5 py-2 text-sm font-medium hover:text-copper disabled:opacity-60 transition"
          >
            {isFetching ? t("common.loading") : t("trip.view_more", { count: nextStep })}
          </button>
        </div>
      )}
    </div>
  );
}


function GemCard({ g, city, seed }: { g: HiddenGem; city: string; seed?: string | number }) {
  const { t } = useTranslation();
  const query = g.map_query ?? `${g.name} ${city}`;
  const mapUrl = googleSearchUrl(query);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group overflow-hidden rounded-2xl border border-border bg-card shadow-soft hover:shadow-lift transition-all"
    >
      <div className="relative">
        <PlaceImage
          query={`${g.name} hidden`}
          city={city}
          aspect="wide"
          className="rounded-none rounded-t-2xl transition-transform duration-700 group-hover:scale-[1.03]"
          seed={seed}
        />
        <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur px-2.5 py-1 text-[11px] font-medium text-copper shadow-soft">
          <Gem className="h-3.5 w-3.5" /> {t("trip.hidden_gem_badge")}
        </div>
      </div>
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-display text-2xl leading-tight">{g.name}</h4>
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.preventDefault(); openMapSearch(query); }}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-gradient-emerald px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            <MapPin className="h-3.5 w-3.5" /> {t("trip.maps")} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {g.story && <p className="mt-3 text-sm text-muted-foreground leading-relaxed italic">"{g.story}"</p>}
        {g.why_locals_love && (
          <p className="mt-2 text-sm leading-relaxed">
            <span className="text-copper font-medium">{t("trip.locals_love")}: </span>
            {g.why_locals_love}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {g.crowd && <CrowdChip crowd={g.crowd} />}
          {g.duration && <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">⏱ {g.duration}</span>}
          {g.difficulty && <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] capitalize">{g.difficulty}</span>}
          {g.price && <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">💰 {g.price}</span>}
          <DirectionsBtn lat={g.lat} lng={g.lng} />
        </div>
      </div>
    </motion.div>
  );
}

function TipList({ items, icon }: { items?: string[]; icon: React.ReactNode }) {
  if (!items?.length) return <p className="text-muted-foreground">—</p>;
  return (
    <div className="space-y-2">
      {items.map((tip, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex gap-3 rounded-xl border border-border bg-card p-4"
        >
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
            {icon}
          </span>
          <p className="text-sm leading-relaxed">{tip}</p>
        </motion.div>
      ))}
    </div>
  );
}

const ITINERARY_SLOTS = ["morning", "lunch", "afternoon", "sunset", "dinner", "night"] as const;

const SLOT_ICON: Record<(typeof ITINERARY_SLOTS)[number], typeof Sunrise> = {
  morning: Sunrise,
  lunch: Utensils,
  afternoon: Sun,
  sunset: Sunset,
  dinner: UtensilsCrossed,
  night: Moon,
};

/**
 * Single vertical timeline (was a 2-column text grid): a border-s line runs
 * through every day, each activity card gets a photo header (real place
 * photo when resolved, otherwise the slot icon over the app's own skeleton
 * gradient — never a broken image), and a circular slot icon marks its
 * point on the line.
 */
function ItineraryTab({
  plan,
  tripId,
  city,
  country,
  currency,
  dayMeta,
}: {
  plan: Plan;
  tripId: string;
  city: string;
  country: string;
  currency: string;
  dayMeta: (n: number) => { day_number?: number; theme_title?: string; tip?: string } | undefined;
}) {
  const places = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ name: string; lat?: number; lng?: number }> = [];
    for (const d of plan.itinerary ?? []) {
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
  }, [plan]);

  const fetchPhotos = useServerFn(getPlacePhotos);
  const { data: photos } = useQuery({
    queryKey: ["itinerary-photos", tripId, places.map((p) => p.name).join("|")],
    enabled: places.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: () => fetchPhotos({ data: { city, country, places } }),
  });

  return (
    <div className="space-y-10">
      {plan.itinerary?.map((d, i) => (
        <motion.div
          key={d.day}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-emerald font-display text-lg">
              {d.day}
            </div>
            <h3 className="font-display text-xl">{dayMeta(d.day)?.theme_title || d.title}</h3>
          </div>
          <div className="relative mt-6 ms-5 space-y-6 border-s-2 border-border ps-9">
            {ITINERARY_SLOTS.map((slot) => {
              const raw = d[slot] ?? (slot === "afternoon" ? d.evening : undefined);
              if (!raw) return null;
              const s: Slot = typeof raw === "string" ? { desc: raw } : raw;
              const photo = s.name ? (photos?.[s.name] ?? null) : null;
              return <TimelineSlotCard key={slot} label={slot} slot={s} currency={currency} photo={photo} />;
            })}
          </div>
          {(dayMeta(d.day)?.tip || d.tip) && (
            <p className="mt-4 ms-5 rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground">
              💡 {dayMeta(d.day)?.tip || d.tip}
            </p>
          )}
        </motion.div>
      ))}
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
  const diffColor =
    slot.difficulty === "challenging" ? "bg-copper/15 text-copper"
    : slot.difficulty === "moderate" ? "bg-secondary text-secondary-foreground"
    : "bg-emerald-50/10 text-emerald-600 dark:text-emerald-400";

  return (
    <div className="relative">
      <span className="absolute -start-[2.85rem] top-4 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-background shadow-soft">
        <Icon className="h-4 w-4" />
      </span>
      <div className="overflow-hidden rounded-xl border border-border bg-background/40">
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="relative block h-36 w-full overflow-hidden bg-gradient-to-br from-secondary via-muted to-secondary text-start"
        >
          {photo?.url ? (
            <img
              src={photo.url}
              alt={slot.name || t(`trip.slots.${label}`)}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Icon className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <span className="absolute bottom-2 start-3 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-medium uppercase tracking-widest text-white backdrop-blur-sm">
            {t(`trip.slots.${label}`)}
          </span>
          {photo?.credit && (
            <span className="absolute bottom-2 end-2 max-w-[45%] truncate rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur-sm">
              {photo.credit}
            </span>
          )}
        </button>
        <div className="p-4">
          {slot.name && <div className="font-medium text-sm">{slot.name}</div>}
          <p className={cn("text-sm leading-relaxed text-muted-foreground", slot.name && "mt-1")}>{slot.desc}</p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
            {slot.duration && <span className="rounded-full bg-secondary px-2 py-0.5">⏱ {slot.duration}</span>}
            {slot.cost != null && <span className="rounded-full bg-secondary px-2 py-0.5">💰 {slot.cost} {currency}</span>}
            {slot.travel_time && <span className="rounded-full bg-secondary px-2 py-0.5">🚶 {slot.travel_time}</span>}
            {slot.difficulty && <span className={cn("rounded-full px-2 py-0.5 capitalize", diffColor)}>{slot.difficulty}</span>}
            <DirectionsBtn lat={slot.lat} lng={slot.lng} />
          </div>
        </div>
      </div>
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
  const diffColor =
    slot.difficulty === "challenging" ? "bg-copper/15 text-copper"
    : slot.difficulty === "moderate" ? "bg-secondary text-secondary-foreground"
    : "bg-emerald-50/10 text-emerald-600 dark:text-emerald-400";

  const close = () => {
    setZoomed(false);
    onOpenChange(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 overflow-y-auto bg-background"
        >
          <button
            type="button"
            onClick={close}
            aria-label={t("common.close")}
            className="fixed top-4 end-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 shadow-soft backdrop-blur"
          >
            <X className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => photo?.url && setZoomed(true)}
            className="relative block h-72 w-full overflow-hidden bg-gradient-to-br from-secondary via-muted to-secondary text-start sm:h-96"
          >
            {photo?.url ? (
              <img
                src={photo.url}
                alt={slot.name || t(`trip.slots.${label}`)}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Icon className="h-12 w-12 text-muted-foreground/50" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <span className="absolute bottom-3 start-4 rounded-full bg-black/40 px-3 py-1 text-xs font-medium uppercase tracking-widest text-white backdrop-blur-sm">
              {t(`trip.slots.${label}`)}
            </span>
            {photo?.credit && (
              <span className="absolute bottom-3 end-4 max-w-[50%] truncate rounded-full bg-black/40 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur-sm">
                {photo.credit}
              </span>
            )}
          </button>

          <div className="mx-auto max-w-2xl px-6 py-6">
            {slot.name && <h2 className="font-display text-2xl">{slot.name}</h2>}
            <p className={cn("text-base leading-relaxed text-muted-foreground", slot.name && "mt-2")}>
              {slot.desc}
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              {slot.duration && <span className="rounded-full bg-secondary px-3 py-1">⏱ {slot.duration}</span>}
              {slot.cost != null && <span className="rounded-full bg-secondary px-3 py-1">💰 {slot.cost} {currency}</span>}
              {slot.travel_time && <span className="rounded-full bg-secondary px-3 py-1">🚶 {slot.travel_time}</span>}
              {slot.difficulty && (
                <span className={cn("rounded-full px-3 py-1 capitalize", diffColor)}>{slot.difficulty}</span>
              )}
            </div>
            <div className="mt-5">
              <DirectionsBtn lat={slot.lat} lng={slot.lng} label={t("trip.directions")} />
            </div>
          </div>

          <AnimatePresence>
            {zoomed && photo?.url && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setZoomed(false)}
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4"
              >
                <img
                  src={photo.url}
                  alt={slot.name || t(`trip.slots.${label}`)}
                  className="max-h-full max-w-full object-contain"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoomed(false);
                  }}
                  aria-label={t("common.close")}
                  className="absolute top-4 end-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BudgetBreakdown({ b, full, tripBudget, tripDays }: { b: Plan["budget_breakdown"]; full?: boolean; tripBudget?: number; tripDays?: number }) {
  const { t } = useTranslation();
  if (!b) return <p className="text-muted-foreground text-sm mt-2">—</p>;
  const rows: [string, number | undefined][] = [
    ["stay", b.stay], ["food", b.food], ["transport", b.transport],
    ["activities", b.activities], ["other", b.other],
  ];
  const total = b.total ?? 0;
  const remaining = tripBudget != null ? Math.max(0, tripBudget - total) : undefined;
  const daily = b.daily ?? (tripDays ? Math.round(total / tripDays) : undefined);
  const reserve = b.emergency_reserve ?? Math.round(total * 0.1);
  return (
    <div className={cn("mt-2", full && "space-y-6")}>
      <div>
        <div className="font-display text-4xl">
          {total} <span className="text-base text-muted-foreground">{b.currency}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{t("trip.estimated_total")}</p>
      </div>
      {full && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label={t("trip.remaining")} value={remaining != null ? `${remaining} ${b.currency}` : "—"} accent />
          <Stat label={t("trip.daily_budget")} value={daily != null ? `${daily} ${b.currency}` : "—"} />
          <Stat label={t("trip.emergency_reserve")} value={`${reserve} ${b.currency}`} />
        </div>
      )}
      <div className="space-y-2">
        {rows.map(([label, val]) => {
          const pct = total ? Math.round(((val ?? 0) / total) * 100) : 0;
          return (
            <div key={label}>
              <div className="flex items-center justify-between text-sm">
                <span>{t(`trip.budget_categories.${label}`)}</span>
                <span className="text-muted-foreground">{val ?? 0} · {pct}%</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full bg-gradient-copper"
                />
              </div>
            </div>
          );
        })}
      </div>
      {full && b.savings_tips && b.savings_tips.length > 0 && (
        <div>
          <h4 className="font-display text-lg">{t("trip.savings_tips")}</h4>
          <ul className="mt-2 space-y-2">
            {b.savings_tips.map((tip, i) => (
              <li key={i} className="flex gap-2 rounded-xl border border-border bg-card p-3 text-sm">
                <span className="text-copper">✦</span>
                <span className="text-muted-foreground leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-border p-3", accent ? "bg-gradient-copper text-primary-foreground" : "bg-card")}>
      <div className="text-[11px] uppercase tracking-widest opacity-80">{label}</div>
      <div className="mt-1 font-display text-lg">{value}</div>
    </div>
  );
}

function hasCoord<T extends { lat?: number; lng?: number }>(g: T | undefined | null): g is T & { lat: number; lng: number } {
  if (!g) return false;
  const { lat, lng } = g;
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
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
      className="inline-flex items-center gap-1 rounded-full border border-border bg-background/50 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-secondary transition"
    >
      <MapPin className="h-3 w-3" /> {label ?? t("trip.directions")}
    </a>
  );
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
        if (hasCoord(p)) all.push({ lat: p.lat, lng: p.lng, title: p.name, subtitle: p.style, category: "photo" });
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
  }, [plan, layers, dayFilter]);

  const catToggles: Array<{ key: MapMarker["category"] }> = [
    { key: "hotel" }, { key: "restaurant" }, { key: "activity" },
    { key: "photo" }, { key: "gem" }, { key: "itinerary" },
  ];

  const days = plan.itinerary?.map((d) => d.day) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {catToggles.map((c) => (
          <button
            key={c.key}
            onClick={() => setLayers((s) => ({ ...s, [c.key]: !s[c.key] }))}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
              layers[c.key]
                ? "bg-gradient-emerald text-primary-foreground border-transparent"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`trip.map_layers.${c.key}`)}
          </button>
        ))}
      </div>

      {days.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setDayFilter("all")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              dayFilter === "all"
                ? "bg-gradient-copper text-primary-foreground border-transparent"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {t("trip.all_days")}
          </button>
          {days.map((d, i) => (
            <button
              key={d}
              onClick={() => setDayFilter(d)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                dayFilter === d
                  ? "text-primary-foreground border-transparent"
                  : "border-border bg-card text-muted-foreground",
              )}
              style={dayFilter === d ? { background: DAY_COLORS[i % DAY_COLORS.length] } : undefined}
            >
              {t("trip.day")} {d}
            </button>
          ))}
        </div>
      )}

      <TripMap markers={markers} route={route} height={520} />

      <div className="rounded-xl border border-border bg-card p-4">
        <MapLegend />
        {markers.length === 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("trip.no_coordinates")}
          </p>
        )}
      </div>
    </div>
  );
}

