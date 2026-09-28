import { useState } from "react";
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
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const usable = !!photo?.url && !failed;

  return (
    <div className={cn("relative aspect-[4/3] md:aspect-[3/2] overflow-hidden bg-secondary/60", className)}>
      {loading || (usable && !loaded) ? (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary via-muted to-secondary" />
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-background/50 to-transparent"
          />
        </div>
      ) : null}

      {usable ? (
        <>
          <motion.img
            src={photo!.url}
            alt={`Real photograph of ${photo!.placeName || name}`}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 1.05 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
          {loaded && photo!.credit && (
            photo!.creditUrl ? (
              <a
                href={photo!.creditUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-2 right-2 max-w-[70%] truncate rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm hover:bg-black/70 transition"
              >
                {photo!.credit}
              </a>
            ) : (
              <span className="absolute bottom-2 right-2 max-w-[70%] truncate rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
                {photo!.credit}
              </span>
            )
          )}
        </>
      ) : !loading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-secondary via-muted to-secondary">
          <Camera className="h-6 w-6 text-muted-foreground/60" />
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground/70">
            <ImageOff className="h-3 w-3" /> Photo unavailable
          </span>
        </div>
      ) : null}
    </div>
  );
}
