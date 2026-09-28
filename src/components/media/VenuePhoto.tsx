import { useState } from "react";
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
    <div className={cn("relative aspect-[16/9] overflow-hidden bg-secondary/60", className)}>
      {usable ? (
        <>
          {!loaded && <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-secondary via-muted to-secondary" />}
          <motion.img
            src={photo!.url}
            alt={isReal ? name : `Illustrative image representing the style of ${name}`}
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
            <span
              title="Illustrative image — actual venue photo unavailable"
              className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white/95 backdrop-blur-sm"
            >
              <Sparkles className="h-3 w-3" /> Illustrative image
            </span>
          )}
          {loaded && isReal && photo!.credit && (
            <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
              {photo!.credit}
            </span>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-secondary via-muted to-secondary">
          <span className="font-display text-3xl text-muted-foreground/70">{initials}</span>
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground/70">
            <ImageOff className="h-3 w-3" /> Photo unavailable
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent opacity-70" />
    </div>
  );
}

