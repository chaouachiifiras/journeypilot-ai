import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import {
  Star, MapPin, Heart, ExternalLink, Loader2, RefreshCw, Navigation,
  Globe, Phone, Clock, Bed, UtensilsCrossed, Info, Map as MapIcon,
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
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          {t("trip.all_count", { count: recs.length })}
        </Chip>
        {available.map((b) => (
          <Chip key={b} active={filter === b} onClick={() => setFilter(b)}>
            {t(`recBadge.${b}`)}
          </Chip>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="rounded-full border border-border p-1.5 text-muted-foreground hover:text-foreground transition"
            aria-label={t("trip.refresh_recommendations")}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{kind === "hotel" ? t("trip.finding_stays") : t("trip.finding_tables")}</span>
        </div>
      )}

      {!isLoading && visible.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {data?.providerError ? t("trip.errors.places_unavailable") : t("trip.errors.no_venues")}
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
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
        <div className="flex justify-center pt-1">
          <button
            onClick={() => setLimit(nextStep!)}
            disabled={isFetching}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-xs font-medium shadow-soft transition hover:bg-secondary disabled:opacity-60"
          >
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {kind === "hotel" ? t("trip.view_more_stays") : t("trip.view_more_restaurants")}
          </button>
        </div>
      )}

      {data && (
        <p className="flex items-center gap-1.5 pt-2 text-[11px] text-muted-foreground">
          <Info className="h-3 w-3" />
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
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-transparent bg-gradient-emerald text-foreground shadow-soft"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
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
      className="group overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all hover:shadow-lift"
    >
      <div className="relative">
        <VenuePhoto photo={p.photo} name={p.name} className="rounded-t-2xl" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {rec.badges.slice(0, 2).map((b) => (
            <span
              key={b}
              className="rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground shadow-soft backdrop-blur"
            >
              {t(`recBadge.${b}`)}
            </span>
          ))}
        </div>
        <button
          onClick={onSave}
          aria-label={saved ? t("trip.remove_saved") : t("trip.save_place")}
          className="absolute right-3 top-3 rounded-full bg-background/90 p-2 shadow-soft backdrop-blur transition hover:scale-105"
        >
          <Heart className={cn("h-4 w-4", saved ? "fill-copper text-copper" : "text-muted-foreground")} />
        </button>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-copper">
          {kind === "hotel" ? <Bed className="h-4 w-4" /> : <UtensilsCrossed className="h-4 w-4" />}
          <span className="truncate">
            {kind === "hotel"
              ? p.flags.hostel ? t("trip.venue_types.hostel") : p.flags.guesthouse ? t("trip.venue_types.guesthouse") : p.flags.apartment ? t("trip.venue_types.apartment") : t("trip.venue_types.hotel")
              : p.cuisines?.slice(0, 2).join(" · ") || t("trip.venue_types.restaurant")}
          </span>
        </div>
        <h4 className="mt-1 font-display text-xl leading-tight">{p.name}</h4>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {(p.rating != null || p.stars != null) && (
            <span className="inline-flex items-center gap-1 text-foreground">
              <Star className="h-3.5 w-3.5 fill-copper text-copper" />
              {(p.rating ?? p.stars)!.toFixed(1)}
              {p.stars != null && p.rating == null && <span className="text-muted-foreground">{t("trip.stars")}</span>}
            </span>
          )}
          {price && <span className="font-medium text-foreground">{price}</span>}
          {(p.area || p.address) && (
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin className="h-3.5 w-3.5" />
              {p.area || p.address}
            </span>
          )}
          {rec.distanceKm != null && <span>{t("trip.km_from_plan", { km: rec.distanceKm.toFixed(1) })}</span>}
        </div>

        {rec.reasons.length > 0 && (
          <div className="mt-3 rounded-xl bg-secondary px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-copper">{t("trip.why_recommend")}</p>
            <ul className="mt-1 space-y-0.5 text-xs text-secondary-foreground">
              {rec.reasons.map((r) => (
                <li key={r}>· {r}</li>
              ))}
            </ul>
          </div>
        )}

        {expanded && (
          <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
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
                  <span key={a} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">{a}</span>
                ))}
              </div>
            )}
            <button
              onClick={() => openVenueOnGoogleMaps(maps)}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-emerald px-3 py-1.5 text-xs font-semibold text-foreground shadow-soft"
            >
              <MapIcon className="h-3.5 w-3.5" />{t("trip.view_on_maps")}
            </button>
            {p.source.url && (
              <a href={p.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 pt-1 hover:text-foreground">
                <ExternalLink className="h-3 w-3" />{t("trip.source")}: {p.source.attribution ?? p.source.provider}
              </a>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={onToggleDetails}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition"
          >
            {expanded ? t("trip.hide_details") : t("trip.view_details")}
          </button>
          <button
            onClick={() => openDirections(p.lat, p.lng)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition"
          >
            <Navigation className="h-3.5 w-3.5" />{t("trip.directions")}
          </button>
          <button
            onClick={() => openVenueOnGoogleMaps(maps)}
            title={mapsExact ? t("trip.maps_exact_tooltip") : t("trip.maps_closest_tooltip")}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition"
          >
            <MapIcon className="h-3.5 w-3.5" />{t("trip.view_on_maps")}
          </button>
        </div>
      </div>
    </motion.article>
  );
}
