import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import {
  Star, MapPin, Heart, ExternalLink, Loader2, RefreshCw, Navigation,
  Globe, Phone, Clock, Bed, UtensilsCrossed, Info, Map as MapIcon, Sparkles, ChevronDown, SearchX,
} from "lucide-react";
import { VenuePhoto } from "@/components/media/VenuePhoto";
import { KIND_FILTERS, type Recommendation, type RecommendationBadge } from "@/lib/places/ranking";
import type { PlaceKind } from "@/lib/places/types";
import { getRecommendations, toggleSavedPlace } from "@/lib/recommendations.functions";
import { openDirections, openVenueOnGoogleMaps, venueMapsUrl } from "@/lib/maps";
import { cn } from "@/lib/utils";

/** Curated by default: 6 top matches, expandable on demand. */
const STEPS = [6, 12, 20, 32] as const;

export function Recommendations({ tripId, kind }: { tripId: string; kind: PlaceKind }) {
  const { t } = useTranslation();
  const fetchRecs = useServerFn(getRecommendations);
  const toggleSave = useServerFn(toggleSavedPlace);
  const qc = useQueryClient();

  const [limit, setLimit] = useState<number>(6);
  const [filter, setFilter] = useState<RecommendationBadge | "all">("all");
  const [open, setOpen] = useState<string | null>(null);

  const queryKey = ["recommendations", tripId, kind, limit];
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchRecs({ data: { trip_id: tripId, kind, limit } }),
    staleTime: 10 * 60 * 1000,
  });

  const save = useMutation({
    mutationFn: (rec: Recommendation) =>
      toggleSave({
        data: {
          trip_id: tripId,
          kind,
          provider: rec.place.source.provider,
          provider_place_id: rec.place.source.id,
          name: rec.place.name,
          place_data: { cuisines: rec.place.cuisines ?? [], area: rec.place.area ?? null },
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recommendations", tripId, kind] }),
  });

  const recs = useMemo(() => data?.recommendations ?? [], [data]);
  const savedIds = new Set(data?.savedIds ?? []);
  const available = useMemo(() => {
    const present = new Set(recs.flatMap((r) => r.badges));
    return KIND_FILTERS[kind].filter((b) => present.has(b));
  }, [recs, kind]);
  const visible = filter === "all" ? recs : recs.filter((r) => r.badges.includes(filter));

  // "View more" only appears when more real qualifying venues genuinely exist.
  const nextStep = STEPS.find((s) => s > limit);
  const canViewMore = !!data && !!nextStep && recs.length >= limit && data.totalCandidates > recs.length;

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <div data-swipe-ignore className="-ms-5 flex min-w-0 flex-1 gap-2 overflow-x-auto ps-5 scrollbar-none md:ms-0 md:flex-wrap md:ps-0">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          {t("trip.all_count", { count: recs.length })}
        </Chip>
        {available.map((b) => (
          <Chip key={b} active={filter === b} onClick={() => setFilter(b)}>
            {t(`recBadge.${b}`)}
          </Chip>
        ))}
        </div>
        <button
          onClick={() => refetch()}
          className="btn btn-secondary btn-icon btn-sm shrink-0"
          aria-label={t("trip.refresh_recommendations")}
        >
          <RefreshCw className={cn(isFetching && "animate-spin")} />
        </button>
      </div>

      {isLoading && (
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-ai">
            <Sparkles className="h-4 w-4 animate-pulse" />
            {kind === "hotel" ? t("trip.finding_stays") : t("trip.finding_tables")}
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 md:gap-5">
            {[0, 1].map((i) => (
              <div key={i} className="card overflow-hidden">
                <div className="skeleton aspect-[16/9] rounded-none" />
                <div className="space-y-3 p-5">
                  <div className="skeleton h-3 w-1/4" />
                  <div className="skeleton h-5 w-2/3" />
                  <div className="skeleton h-16 w-full" />
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
            {data?.providerError ? t("trip.errors.places_unavailable") : t("trip.errors.no_venues")}
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 md:gap-5">
        {visible.map((rec, i) => (
          <RecCard
            key={rec.place.source.id}
            rec={rec}
            index={i}
            kind={kind}
            saved={savedIds.has(rec.place.source.id)}
            onSave={() => save.mutate(rec)}
            expanded={open === rec.place.source.id}
            onToggleDetails={() =>
              setOpen(open === rec.place.source.id ? null : rec.place.source.id)
            }
          />
        ))}
      </div>

      {canViewMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setLimit(nextStep!)}
            disabled={isFetching}
            className="btn btn-secondary"
          >
            {isFetching ? <Loader2 className="animate-spin" /> : <ChevronDown />}
            {kind === "hotel" ? t("trip.view_more_stays") : t("trip.view_more_restaurants")}
          </button>
        </div>
      )}

      {data && (
        <p className="flex items-start gap-1.5 pt-2 text-[11px] leading-relaxed text-subtle">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          {t("trip.attribution_venues", { totalCandidates: data.totalCandidates, realPhotoCount: data.realPhotoCount })}{" "}
          {data.attribution}
        </p>
      )}
    </div>
  );
}

function Chip({
  active, onClick, children,
}: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
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

function RecCard({
  rec, index, kind, saved, onSave, expanded, onToggleDetails,
}: {
  rec: Recommendation;
  index: number;
  kind: PlaceKind;
  saved: boolean;
  onSave: () => void;
  expanded: boolean;
  onToggleDetails: () => void;
}) {
  const { t } = useTranslation();
  const p = rec.place;
  const price = p.priceLevel ? "$".repeat(p.priceLevel) : p.priceNote;
  const maps = {
    name: p.name,
    mapsUrl: p.mapsUrl,
    mapsUrlExact: p.mapsUrlExact,
    provider: p.source.provider,
    placeId: p.source.id,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
  };
  const mapsExact = venueMapsUrl(maps).exact;

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="card card-hover group flex flex-col overflow-hidden"
    >
      <div className="relative">
        <VenuePhoto photo={p.photo} name={p.name} />
        <div className="absolute start-3 top-3 flex max-w-[75%] flex-wrap gap-1.5">
          {rec.badges.slice(0, 2).map((b) => (
            <span key={b} className="badge badge-overlay uppercase tracking-wider">
              {t(`recBadge.${b}`)}
            </span>
          ))}
        </div>
        <button
          onClick={onSave}
          aria-label={saved ? t("trip.remove_saved") : t("trip.save_place")}
          className="absolute end-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(255,253,249,0.92)] shadow-soft backdrop-blur transition-transform active:scale-90"
        >
          <Heart className={cn("h-[1.1rem] w-[1.1rem]", saved ? "fill-[#c0602e] text-copper" : "text-muted-foreground")} />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="eyebrow flex items-center gap-2">
          {kind === "hotel" ? <Bed className="h-4 w-4" /> : <UtensilsCrossed className="h-4 w-4" />}
          <span className="truncate">
            {kind === "hotel"
              ? p.flags.hostel ? t("trip.venue_types.hostel") : p.flags.guesthouse ? t("trip.venue_types.guesthouse") : p.flags.apartment ? t("trip.venue_types.apartment") : t("trip.venue_types.hotel")
              : p.cuisines?.slice(0, 2).join(" · ") || t("trip.venue_types.restaurant")}
          </span>
        </div>
        <h3 className="title-md mt-1.5">{p.name}</h3>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          {(p.rating != null || p.stars != null) && (
            <span className="inline-flex items-center gap-1 font-bold text-foreground">
              <Star className="h-3.5 w-3.5 fill-[#c39443] text-[#c39443]" />
              {(p.rating ?? p.stars)!.toFixed(1)}
              {p.stars != null && p.rating == null && <span className="text-muted-foreground">{t("trip.stars")}</span>}
            </span>
          )}
          {price && <span className="font-medium text-foreground">{price}</span>}
          {(p.area || p.address) && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {p.area || p.address}
            </span>
          )}
          {rec.distanceKm != null && <span>{t("trip.km_from_plan", { km: rec.distanceKm.toFixed(1) })}</span>}
        </div>

        {rec.reasons.length > 0 && (
          <div className="ai-surface mt-4 rounded-2xl p-3.5 shadow-none">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ai">
              <Sparkles className="h-3.5 w-3.5" /> {t("trip.why_recommend")}
            </p>
            <ul className="mt-2 space-y-1.5 text-[13px] leading-snug">
              {rec.reasons.map((r) => (
                <li key={r} className="flex gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ai" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {expanded && (
          <div className="panel mt-3 space-y-2 p-3.5 text-xs text-muted-foreground">
            {p.address && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{p.address}</p>}
            {p.openingHours && <p className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{p.openingHours}</p>}
            {p.phone && <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{p.phone}</p>}
            {p.website && (
              <a href={p.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-foreground">
                <Globe className="h-3.5 w-3.5" />{t("trip.official_website")}
              </a>
            )}
            {p.amenities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {p.amenities.map((a) => (
                  <span key={a} className="badge bg-card">{a}</span>
                ))}
              </div>
            )}
            {p.source.url && (
              <a href={p.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 pt-1 hover:text-foreground">
                <ExternalLink className="h-3 w-3" />{t("trip.source")}: {p.source.attribution ?? p.source.provider}
              </a>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          <button
            onClick={() => openVenueOnGoogleMaps(maps)}
            title={mapsExact ? t("trip.maps_exact_tooltip") : t("trip.maps_closest_tooltip")}
            className="btn btn-primary btn-sm"
          >
            <MapIcon />{t("trip.view_on_maps")}
          </button>
          <button onClick={() => openDirections(p.lat, p.lng)} className="btn btn-secondary btn-sm">
            <Navigation />{t("trip.directions")}
          </button>
          <button onClick={onToggleDetails} className="btn btn-ghost btn-sm">
            {expanded ? t("trip.hide_details") : t("trip.view_details")}
            <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
