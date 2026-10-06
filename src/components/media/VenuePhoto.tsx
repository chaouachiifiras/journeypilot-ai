import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { ImageOff, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlacePhoto } from "@/lib/places/types";

/**
 * Photo for a NAMED venue.
 *
 * Three honest states, never mixed up:
 *  1. REAL — a photograph known to depict this exact venue (Google, Wikimedia,
 *     or the venue itself). Shown with its attribution.
 *  2. ILLUSTRATIVE — an image representing the venue's style only. Always
 *     labelled "Illustrative image", never described as a venue photo.
 *  3. UNAVAILABLE — a clean typographic placeholder. Never a stock photo and
 *     never a photo of a different venue.
 */
export function VenuePhoto({
  photo,
  name,
  className,
}: {
  photo?: PlacePhoto | null;
  name: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const usable = !!photo?.url && !failed;
  const isReal = usable && photo!.kind === "real" && photo!.verified;

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className={cn("relative aspect-[16/9] overflow-hidden bg-secondary", className)}>
      {usable ? (
        <>
          {!loaded && <div className="skeleton absolute inset-0 rounded-none" />}
          <motion.img
            src={photo!.url}
            alt={isReal ? name : `${t("ui.media.illustrative")} — ${name}`}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 1.04 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {loaded && !isReal && (
            <span className="badge badge-dark absolute bottom-2 start-2">
              <Sparkles /> {t("ui.media.illustrative")}
            </span>
          )}
          {loaded && isReal && photo!.credit && (
            <span className="absolute bottom-2 end-2 max-w-[60%] truncate rounded-full bg-[rgba(8,20,18,0.5)] px-2 py-0.5 text-[10px] font-medium text-[rgba(255,255,255,0.9)] backdrop-blur-sm">
              {photo!.credit}
            </span>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-secondary to-muted">
          <span className="font-display text-4xl text-subtle">{initials}</span>
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-subtle">
            <ImageOff className="h-3 w-3" /> {t("ui.media.unavailable")}
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[rgba(8,20,18,0.35)] to-transparent" />
    </div>
  );
}

