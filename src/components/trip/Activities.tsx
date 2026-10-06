import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import {
  Loader2, Info, Heart, Share2, CalendarPlus, MapPin, Star, Clock,
  Navigation, Check, X, ExternalLink, Globe, Sparkles, ChevronDown, SearchX, Sun,
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
        <div data-swipe-ignore className="-mx-5 overflow-x-auto px-5 scrollbar-none md:-mx-8 md:px-8">
          <div className="inline-flex min-w-max gap-2 pb-1">
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
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-ai">
            <Sparkles className="h-4 w-4 animate-pulse" />
            {t("trip.discovering")}
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 md:gap-5">
            {[0, 1].map((i) => (
              <div key={i} className="card overflow-hidden">
                <div className="skeleton aspect-[4/3] rounded-none" />
                <div className="space-y-3 p-5">
                  <div className="skeleton h-5 w-2/3" />
                  <div className="skeleton h-12 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && visible.length === 0 && (
        <div className="card mx-auto max-w-md px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
            <SearchX className="h-6 w-6" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
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
            className="btn btn-secondary"
          >
            {isFetching ? <Loader2 className="animate-spin" /> : <ChevronDown />}
            {t("trip.view_more_experiences", { count: nextStep })}
          </button>
        </div>
      )}

      {data && (
        <p className="flex items-start gap-1.5 pt-1 text-[11px] leading-relaxed text-subtle">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
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
      data-active={!!active}
      className="chip"
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
      className="card card-hover group flex flex-col overflow-hidden"
    >
      {/* Image is the visual anchor of the card */}
      <div className="relative">
        <SpotPhotoImage
          photo={a.photo}
          name={a.name}
          className="transition-transform duration-700 group-hover:scale-[1.02]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
          <span className="badge badge-overlay uppercase tracking-wider">
            {t(`category.${a.category}`)}
          </span>
        </div>
        {typeof a.rating === "number" && (
          <div className="badge badge-overlay absolute end-3 top-3 h-8 px-3 text-xs">
            <Star className="fill-[#c39443] text-[#c39443]" />
            {a.rating.toFixed(1)}
            {a.reviews ? <span className="text-muted-foreground">({a.reviews.toLocaleString()})</span> : null}
          </div>
        )}
        <button
          onClick={onSave}
          aria-label={saved ? t("trip.remove_saved") : t("trip.save_experience")}
          className="absolute start-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(255,253,249,0.92)] shadow-soft backdrop-blur transition-transform active:scale-90"
        >
          <Heart className={cn("h-[1.1rem] w-[1.1rem]", saved ? "fill-[#c0602e] text-copper" : "text-muted-foreground")} />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="title-md">{a.name}</h3>
        {(a.summary || a.typeLabel) && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.summary ?? a.typeLabel}</p>
        )}

        {a.why.length > 0 && (
          <div className="ai-surface mt-4 rounded-2xl p-3.5 shadow-none">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ai">
              <Sparkles className="h-3.5 w-3.5" /> {t("trip.why_picked")}
            </p>
            <p className="mt-1.5 text-[13px] leading-snug">{a.why.join(" · ")}</p>
          </div>
        )}

        {/* Metadata — only real, published data */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {duration && (
            <span className="badge">
              <Clock /> {t("trip.typically", { duration })}
            </span>
          )}
          {a.bestTime && (
            <span className="badge badge-copper">
              <Sun /> {t("trip.best_x", { time: a.bestTime.toLowerCase() })}
            </span>
          )}
          {a.distanceKm != null && (
            <span className="badge">
              <Navigation /> {t("trip.km_from_itinerary", { km: a.distanceKm })}
            </span>
          )}
          {typeof a.priceLevel === "number" && (
            <span className="badge badge-success">{a.priceLevel === 0 ? t("trip.free_entry") : "$".repeat(a.priceLevel)}</span>
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
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
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
            className="btn btn-primary btn-sm"
          >
            <MapPin /> {t("trip.maps")} <ExternalLink />
          </a>
          <button
            onClick={(e) => {
              e.preventDefault();
              openDirections(a.lat, a.lng);
            }}
            className="btn btn-secondary btn-sm"
          >
            <Navigation /> {t("trip.directions")}
          </button>
          <button
            onClick={() => (added ? undefined : suggestion.mutate())}
            disabled={added || suggestion.isPending}
            className={cn("btn btn-sm", added ? "btn-ghost bg-primary-soft" : "btn-secondary")}
          >
            {suggestion.isPending ? (
              <Loader2 className="animate-spin" />
            ) : added ? (
              <Check />
            ) : (
              <CalendarPlus />
            )}
            {added ? t("trip.in_itinerary") : t("trip.add_to_itinerary")}
          </button>
          <button onClick={share} className="btn btn-ghost btn-sm" aria-label={t("trip.share")}>
            {shared ? <Check /> : <Share2 />} {shared ? t("trip.copied") : t("trip.share")}
          </button>
          {a.website && (
            <a
              href={a.website}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm"
            >
              <Globe /> {t("trip.website")}
            </a>
          )}
        </div>

        {/* Itinerary suggestion — nothing is rearranged without confirmation */}
        {planner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="ai-surface mt-4 rounded-2xl p-4 shadow-none"
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
                className="input h-10 w-auto rounded-full py-0 text-sm"
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
                className="input h-10 w-auto rounded-full py-0 text-sm capitalize"
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
                className="btn btn-primary btn-sm"
              >
                {confirmAdd.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                {t("trip.confirm")}
              </button>
            </div>
          </motion.div>
        )}

        {a.openingHours?.length ? (
          <details className="panel mt-4 px-3.5 py-2.5 text-xs text-muted-foreground">
            <summary className="flex cursor-pointer select-none items-center gap-1.5 font-semibold text-foreground">
              <Clock className="h-3.5 w-3.5" /> {t("trip.opening_hours")}
            </summary>
            <ul className="mt-2 space-y-1">
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
      ? "badge-copper"
      : badge === "premium"
        ? "badge-primary"
        : "";
  return (
    <span className={cn("badge", accent)}>
      {t(`activityBadge.${badge}`)}
    </span>
  );
}
