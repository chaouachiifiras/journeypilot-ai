import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { ImageOff, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpotPhoto } from "@/lib/places/photospot.server";

/**
 * Editorial hero image for a Photo Spot.
 *
 * Only ever shows a verified real photograph of that exact location, with its
 * required attribution (Google or the Commons author/licence). When no good
 * enough real frame exists it falls back to the honest "Photo unavailable"
 * state — never stock, never generated, never another place.
 */
export function SpotPhotoImage({
  photo,
  name,
  loading,
  className,
}: {
  photo?: SpotPhoto | null;
  name: string;
  loading?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const usable = !!photo?.url && !failed;

  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden bg-secondary md:aspect-[3/2]", className)}>
      {loading || (usable && !loaded) ? <div className="skeleton absolute inset-0 rounded-none" /> : null}

      {usable ? (
        <>
          <motion.img
            src={photo!.url}
            alt={photo!.placeName || name}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 1.05 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="scrim-card pointer-events-none absolute inset-0" />
          {loaded && photo!.credit && (
            photo!.creditUrl ? (
              <a
                href={photo!.creditUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-2 end-2 max-w-[70%] truncate rounded-full bg-[rgba(8,20,18,0.5)] px-2 py-0.5 text-[10px] font-medium text-[rgba(255,255,255,0.9)] backdrop-blur-sm"
              >
                {photo!.credit}
              </a>
            ) : (
              <span className="absolute bottom-2 end-2 max-w-[70%] truncate rounded-full bg-[rgba(8,20,18,0.5)] px-2 py-0.5 text-[10px] font-medium text-[rgba(255,255,255,0.9)] backdrop-blur-sm">
                {photo!.credit}
              </span>
            )
          )}
        </>
      ) : !loading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-secondary to-muted">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-subtle shadow-xs">
            <Camera className="h-5 w-5" />
          </span>
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-subtle">
            <ImageOff className="h-3 w-3" /> {t("ui.media.unavailable")}
          </span>
        </div>
      ) : null}
    </div>
  );
}
