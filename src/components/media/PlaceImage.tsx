import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type Props = {
  query: string;
  city?: string;
  alt?: string;
  className?: string;
  aspect?: "video" | "square" | "photo" | "wide";
  priority?: boolean;
  showCredit?: boolean;
  seed?: string | number;
};

const ASPECT: Record<NonNullable<Props["aspect"]>, string> = {
  video: "aspect-video",
  square: "aspect-square",
  photo: "aspect-[4/3]",
  wide: "aspect-[16/9]",
};

/**
 * Premium travel image with skeleton shimmer, graceful fallback and Unsplash credit.
 * Uses Unsplash's public source endpoint (no API key) with a Picsum fallback.
 */
export function PlaceImage({
  query,
  city,
  alt,
  className,
  aspect = "photo",
  priority = false,
  showCredit = true,
  seed,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const q = useMemo(() => {
    const parts = [query, city].filter(Boolean).join(" ").trim();
    return parts || "travel destination";
  }, [query, city]);

  // Deterministic-ish sig prevents identical images across cards
  const sig = useMemo(() => {
    const raw = `${q}-${seed ?? ""}`;
    let h = 0;
    for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) | 0;
    return Math.abs(h);
  }, [q, seed]);

  const kw = encodeURIComponent(q.replace(/\s+/g, ","));
  const primary = `https://loremflickr.com/800/600/${kw}?lock=${sig}`;
  const fallback = `https://picsum.photos/seed/${encodeURIComponent(q)}-${sig}/800/600`;
  const src = failed ? fallback : primary;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-secondary/60",
        ASPECT[aspect],
        className,
      )}
    >
      {/* Shimmer skeleton */}
      {!loaded && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary via-muted to-secondary" />
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-background/60 to-transparent"
          />
        </div>
      )}

      <motion.img
        key={src}
        src={src}
        alt={alt || q}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!failed) {
            setFailed(true);
            setLoaded(false);
          } else {
            setLoaded(true);
          }
        }}
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 1.04 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Subtle gradient overlay for legibility when overlaid content is added */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent opacity-70" />

      {showCredit && loaded && (
        <a
          href={`https://www.flickr.com/search/?text=${encodeURIComponent(q)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-1.5 right-1.5 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm hover:bg-black/60 transition"
        >
          {failed ? "Picsum" : "Flickr"}
        </a>
      )}
    </div>
  );
}
