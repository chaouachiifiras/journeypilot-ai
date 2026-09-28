import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import {
  Loader2, Info, Heart, Share2, CalendarPlus, MapPin, Star, Clock,
  Navigation, Check, X, ExternalLink, Globe,
} from "lucide-react";
import { SpotPhotoImage } from "@/components/media/SpotPhotoImage";
import { type ActivityBadge, type ActivityCategory } from "@/lib/places/activity-ranking";
import {
  getActivities, toggleSavedActivity, suggestItinerarySlot, addActivityToItinerary,
  type ActivityItem,
} from "@/lib/activities.functions";
import { openDirections, openVenueOnGoogleMaps, venueMapsUrl } from "@/lib/maps";
import { cn } from "@/lib/utils";

/** Curated first, deeper on request. */
const STEPS = [8, 12, 20, 30, 40] as const;
const SLOT_OPTIONS = ["morning", "lunch", "afternoon", "sunset", "dinner", "night"] as const;

export function Activities({ tripId, currency }: { tripId: string; currency?: string }) {
  const { t } = useTranslation();
  const fetchActivities = useServerFn(getActivities);
  const toggleSave = useServerFn(toggleSavedActivity);
  const qc = useQueryClient();

  const [limit, setLimit] = useState<number>(STEPS[0]);
  const [filter, setFilter] = useState<ActivityCategory | "all">("all");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["activities", tripId, limit],
    queryFn: () => fetchActivities({ data: { trip_id: tripId, limit } }),
    staleTime: 30 * 60 * 1000,
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const savedIds = new Set(data?.savedIds ?? []);
  const addedIds = new Set(data?.addedIds ?? []);

  const categories = useMemo(() => {
    const counts = new Map<ActivityCategory, number>();
    for (const i of items) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [items]);

  const visible = filter === "all" ? items : items.filter((i) => i.category === filter);

  const save = useMutation({
    mutationFn: (a: ActivityItem) =>
      toggleSave({
        data: {
          trip_id: tripId,
          provider_place_id: a.placeId,
          name: a.name,
          place_data: { category: a.category, lat: a.lat, lng: a.lng, mapsUrl: a.mapsUrl ?? null },
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities", tripId] }),
  });

  const nextStep = STEPS.find((s) => s > limit);
  const canViewMore = !!nextStep && !!data && data.total > items.length;

  return (
    <div className="space-y-5">
      {/* Category filters — only categories that genuinely exist here */}
      {categories.length > 1 && (
        <div className="-mx-6 px-6 overflow-x-auto scrollbar-none">
          <div className="inline-flex gap-1.5 min-w-max pb-1">
            <Chip active={filter === "all"} onClick={() => setFilter("all")}>
              {t("trip.all_count", { count: items.length })}
            </Chip>
            {categories.map((c) => (
              <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>
                {t(`category.${c}`)}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{t("trip.discovering")}</span>
        </div>
      )}

      {!isLoading && visible.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {data?.providerError ? t("trip.errors.provider_unavailable") : t("trip.errors.no_experiences")}
          </p>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {visible.map((a, i) => (
          <ActivityCard
            key={a.placeId}
            a={a}
            index={i}
            tripId={tripId}
            currency={currency}
            saved={savedIds.has(a.placeId)}
            added={addedIds.has(a.placeId)}
            onSave={() => save.mutate(a)}
          />
        ))}
      </div>

      {canViewMore && (
        <div className="flex justify-center pt-1">
          <button
            onClick={() => setLimit(nextStep!)}
            disabled={isFetching}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-xs font-medium shadow-soft transition hover:bg-secondary disabled:opacity-60"
          >
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {t("trip.view_more_experiences", { count: nextStep })}
          </button>
        </div>
      )}

      {data && (
        <p className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
          <Info className="h-3 w-3" />
          {t("trip.attribution_activities", {
            candidateCount: data.candidateCount, total: data.total, realPhotoCount: data.realPhotoCount,
          })}{" "}
          {data.attribution}
        </p>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-transparent bg-gradient-emerald text-foreground shadow-soft"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function formatDuration(min?: number) {
  if (!min) return undefined;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function ActivityCard({
  a, index, tripId, currency, saved, added, onSave,
}: {
  a: ActivityItem;
  index: number;
  tripId: string;
  currency?: string;
  saved: boolean;
  added: boolean;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const suggest = useServerFn(suggestItinerarySlot);
  const addToPlan = useServerFn(addActivityToItinerary);
  const [planner, setPlanner] = useState<null | { day: number; timeSlot: string; dayTitle?: string; distanceKm?: number; days: number }>(null);
  const [shared, setShared] = useState(false);

  const maps = venueMapsUrl({
    name: a.name,
    mapsUrl: a.mapsUrl,
    mapsUrlExact: !!a.mapsUrl,
    provider: "google",
    placeId: a.placeId,
    address: a.address,
    lat: a.lat,
    lng: a.lng,
  });

  const suggestion = useMutation({
    mutationFn: () =>
      suggest({
        data: { trip_id: tripId, lat: a.lat, lng: a.lng, best_time: a.bestTime, typical_minutes: a.typicalMinutes },
      }),
    onSuccess: (s) => setPlanner({ day: s.day, timeSlot: s.timeSlot, dayTitle: s.dayTitle, distanceKm: s.distanceKm, days: s.days }),
  });

  const confirmAdd = useMutation({
    mutationFn: () =>
      addToPlan({
        data: {
          trip_id: tripId,
          provider_place_id: a.placeId,
          name: a.name,
          category: a.category,
          lat: a.lat,
          lng: a.lng,
          day: planner!.day,
          time_slot: planner!.timeSlot,
          duration_minutes: a.typicalMinutes,
          activity_data: { mapsUrl: a.mapsUrl ?? null, bestTime: a.bestTime ?? null },
        },
      }),
    onSuccess: () => {
      setPlanner(null);
      qc.invalidateQueries({ queryKey: ["activities", tripId] });
    },
  });

  const share = async () => {
    const url = maps.url;
    try {
      if (navigator.share) await navigator.share({ title: a.name, text: a.summary ?? a.name, url });
      else await navigator.clipboard.writeText(`${a.name} — ${url}`);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch {
      /* user cancelled */
    }
  };

  const duration = formatDuration(a.typicalMinutes);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(index, 6) * 0.03 }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all hover:shadow-lift"
    >
      {/* Image is the visual anchor of the card */}
      <div className="relative">
        <SpotPhotoImage
          photo={a.photo}
          name={a.name}
          className="rounded-none rounded-t-2xl transition-transform duration-700 group-hover:scale-[1.02]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
          <span className="inline-flex items-center rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-white/90 backdrop-blur-sm">
            {t(`category.${a.category}`)}
          </span>
        </div>
        {typeof a.rating === "number" && (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium shadow-soft backdrop-blur">
            <Star className="h-3.5 w-3.5 fill-copper text-copper" />
            {a.rating.toFixed(1)}
            {a.reviews ? <span className="text-muted-foreground">({a.reviews.toLocaleString()})</span> : null}
          </div>
        )}
        <button
          onClick={onSave}
          aria-label={saved ? t("trip.remove_saved") : t("trip.save_experience")}
          className="absolute left-3 top-3 rounded-full bg-background/85 p-2 shadow-soft backdrop-blur transition hover:bg-background"
        >
          <Heart className={cn("h-4 w-4", saved ? "fill-copper text-copper" : "text-muted-foreground")} />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h4 className="font-display text-xl leading-tight">{a.name}</h4>
        {(a.summary || a.typeLabel) && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.summary ?? a.typeLabel}</p>
        )}

        {a.why.length > 0 && (
          <p className="mt-3 rounded-lg bg-secondary/60 px-3 py-2 text-[12px] leading-relaxed text-secondary-foreground">
            <span className="font-medium text-copper">{t("trip.why_picked")}: </span>
            {a.why.join(" · ")}
          </p>
        )}

        {/* Metadata — only real, published data */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
          {duration && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {t("trip.typically", { duration })}
            </span>
          )}
          {a.bestTime && (
            <span className="inline-flex items-center gap-1">
              ✦ {t("trip.best_x", { time: a.bestTime.toLowerCase() })}
            </span>
          )}
          {a.distanceKm != null && (
            <span className="inline-flex items-center gap-1">
              <Navigation className="h-3 w-3" /> {t("trip.km_from_itinerary", { km: a.distanceKm })}
            </span>
          )}
          {typeof a.priceLevel === "number" && (
            <span>{a.priceLevel === 0 ? t("trip.free_entry") : "$".repeat(a.priceLevel)}</span>
          )}
        </div>

        {a.badges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {a.badges.slice(0, 4).map((b) => (
              <Badge key={b} badge={b} />
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-1">
          <a
            href={maps.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault();
              openVenueOnGoogleMaps({
                name: a.name, mapsUrl: a.mapsUrl, mapsUrlExact: !!a.mapsUrl,
                provider: "google", placeId: a.placeId, address: a.address, lat: a.lat, lng: a.lng,
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-emerald px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            <MapPin className="h-3.5 w-3.5" /> {t("trip.maps")} <ExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={(e) => {
              e.preventDefault();
              openDirections(a.lat, a.lng);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-secondary"
          >
            <Navigation className="h-3.5 w-3.5" /> {t("trip.directions")}
          </button>
          <button
            onClick={() => (added ? undefined : suggestion.mutate())}
            disabled={added || suggestion.isPending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
              added
                ? "border-transparent bg-secondary text-secondary-foreground"
                : "border-border hover:bg-secondary disabled:opacity-60",
            )}
          >
            {suggestion.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : added ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <CalendarPlus className="h-3.5 w-3.5" />
            )}
            {added ? t("trip.in_itinerary") : t("trip.add_to_itinerary")}
          </button>
          <button
            onClick={share}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-secondary"
          >
            <Share2 className="h-3.5 w-3.5" /> {shared ? t("trip.copied") : t("trip.share")}
          </button>
          {a.website && (
            <a
              href={a.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              <Globe className="h-3.5 w-3.5" /> {t("trip.website")}
            </a>
          )}
        </div>

        {/* Itinerary suggestion — nothing is rearranged without confirmation */}
        {planner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-4 rounded-xl border border-border bg-background/60 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("trip.suggested_for")} <span className="font-medium text-foreground">{t("trip.day")} {planner.day}</span>
                {planner.dayTitle ? ` · ${planner.dayTitle}` : ""}
                {planner.distanceKm != null ? ` — ${t("trip.km_from_day_plan", { km: planner.distanceKm })}` : ""}
                {duration ? `, ${t("trip.around_duration", { duration })}` : "."}
              </p>
              <button onClick={() => setPlanner(null)} aria-label={t("common.cancel")} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={planner.day}
                onChange={(e) => setPlanner({ ...planner, day: Number(e.target.value) })}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs"
              >
                {Array.from({ length: Math.max(planner.days, 1) }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {t("trip.day")} {d}
                  </option>
                ))}
              </select>
              <select
                value={planner.timeSlot}
                onChange={(e) => setPlanner({ ...planner, timeSlot: e.target.value })}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs capitalize"
              >
                {SLOT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {t(`trip.slots.${s}`)}
                  </option>
                ))}
              </select>
              <button
                onClick={() => confirmAdd.mutate()}
                disabled={confirmAdd.isPending}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-copper px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
              >
                {confirmAdd.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {t("trip.confirm")}
              </button>
            </div>
          </motion.div>
        )}

        {a.openingHours?.length ? (
          <details className="mt-3 text-[11px] text-muted-foreground">
            <summary className="cursor-pointer select-none hover:text-foreground">{t("trip.opening_hours")}</summary>
            <ul className="mt-1.5 space-y-0.5">
              {a.openingHours.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </motion.article>
  );
}

function Badge({ badge }: { badge: ActivityBadge }) {
  const { t } = useTranslation();
  const accent =
    badge === "iconic" || badge === "top_rated"
      ? "bg-copper/15 text-copper"
      : badge === "premium"
        ? "bg-gradient-emerald text-foreground"
        : "bg-secondary text-secondary-foreground";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", accent)}>
      {t(`activityBadge.${badge}`)}
    </span>
  );
}
