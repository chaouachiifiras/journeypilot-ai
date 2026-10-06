import { useTranslation } from "react-i18next";
import { Camera, Eye } from "lucide-react";
import { poseGuideFor, type Pose, type PoseSpotInput } from "@/lib/pose-guide";

/**
 * Original, hand-drawn schematic pose illustrations (inline SVG, no external
 * images, no real people). Every drawing shares one 120×100 canvas and one
 * visual grammar:
 *   - figure     → filled / thick strokes in the primary (deep emerald) token
 *   - scenery    → thin muted strokes
 *   - camera     → copper icon + dotted copper line towards the subject
 *   - gaze       → dashed primary line ending in an arrowhead
 * Colours come from design tokens so dark mode follows automatically.
 */

const SCENE = "stroke-subtle opacity-60";
const FIGURE = "stroke-primary";
const GAZE = "stroke-primary opacity-80";
const CAM = "stroke-copper";

/** Small camera glyph centred on (x, y), optionally rotated. */
function Cam({ x, y, rotate = 0 }: { x: number; y: number; rotate?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect x={-7} y={-5} width={14} height={10} rx={2} className="fill-copper" />
      <rect x={-3.5} y={-7} width={5} height={3} rx={1} className="fill-copper" />
      <circle r={2.8} className="fill-card" />
    </g>
  );
}

/** Straight line with an open arrowhead at (x2, y2). */
function Arrow({
  x1, y1, x2, y2, className, dash,
}: { x1: number; y1: number; x2: number; y2: number; className: string; dash: string }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h = 5;
  const p = (da: number) => `${x2 - h * Math.cos(a + da)},${y2 - h * Math.sin(a + da)}`;
  return (
    <g className={className} fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray={dash} />
      <polyline points={`${p(0.5)} ${x2},${y2} ${p(-0.5)}`} />
    </g>
  );
}

function ProfileView() {
  return (
    <>
      {/* terrace balustrade + distant landscape */}
      <g className={SCENE} fill="none" strokeWidth={1.4} strokeLinecap="round">
        <path d="M70 58 Q84 46 96 54 T118 50" />
        <line x1={68} y1={64} x2={118} y2={64} />
        <line x1={68} y1={64} x2={68} y2={82} />
        <line x1={84} y1={64} x2={84} y2={82} />
        <line x1={100} y1={64} x2={100} y2={82} />
        <line x1={116} y1={64} x2={116} y2={82} />
        <line x1={4} y1={82} x2={118} y2={82} />
      </g>
      {/* figure, side view, facing right */}
      <g className={FIGURE} strokeLinecap="round" fill="none">
        <line x1={52} y1={40} x2={51} y2={58} strokeWidth={8} />
        <line x1={51} y1={58} x2={48} y2={81} strokeWidth={5} />
        <line x1={51} y1={58} x2={55} y2={81} strokeWidth={5} />
        <polyline points="53,43 57,51 61,56" strokeWidth={4} strokeLinejoin="round" />
      </g>
      <circle cx={54} cy={31} r={6} className="fill-primary" />
      <Arrow x1={62} y1={30} x2={104} y2={36} className={GAZE} dash="3 3" />
      {/* camera at the side, chest height */}
      <Cam x={16} y={50} />
      <Arrow x1={25} y1={49} x2={42} y2={47} className={CAM} dash="1.5 3" />
    </>
  );
}

function BackHorizon() {
  return (
    <>
      {/* sea, setting sun, shoreline */}
      <g className={SCENE} fill="none" strokeWidth={1.4} strokeLinecap="round">
        <line x1={4} y1={56} x2={116} y2={56} />
        <path d="M84 56 A12 12 0 0 1 108 56" />
        <path d="M14 64 q4 -2 8 0 t8 0 M80 66 q4 -2 8 0 t8 0 M96 72 q4 -2 8 0" />
        <line x1={4} y1={80} x2={116} y2={80} />
      </g>
      {/* figure seen from behind, centred */}
      <g className={FIGURE} strokeLinecap="round" fill="none">
        <line x1={52} y1={38} x2={52} y2={58} strokeWidth={9} />
        <line x1={51} y1={58} x2={48} y2={79} strokeWidth={5} />
        <line x1={53} y1={58} x2={56} y2={79} strokeWidth={5} />
        <line x1={48} y1={41} x2={44} y2={56} strokeWidth={4} />
        <line x1={56} y1={41} x2={60} y2={56} strokeWidth={4} />
      </g>
      <circle cx={52} cy={29} r={6} className="fill-primary" />
      <Arrow x1={58} y1={26} x2={90} y2={40} className={GAZE} dash="3 3" />
      {/* camera behind the subject, low, aimed at their back */}
      <Cam x={18} y={90} />
      <Arrow x1={26} y1={85} x2={43} y2={68} className={CAM} dash="1.5 3" />
    </>
  );
}

function LowAngle() {
  return (
    <>
      {/* monument: stepped base, columns, pediment */}
      <g className={SCENE} fill="none" strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round">
        <path d="M66 22 L91 8 L116 22 Z" />
        <line x1={66} y1={26} x2={116} y2={26} />
        <line x1={71} y1={26} x2={71} y2={74} />
        <line x1={84} y1={26} x2={84} y2={74} />
        <line x1={98} y1={26} x2={98} y2={74} />
        <line x1={111} y1={26} x2={111} y2={74} />
        <path d="M64 74 H118 V78 H62 V82" />
        <line x1={4} y1={82} x2={118} y2={82} />
      </g>
      {/* figure, three-quarter, head tilted up toward the top */}
      <g className={FIGURE} strokeLinecap="round" fill="none">
        <line x1={44} y1={42} x2={44} y2={60} strokeWidth={8} />
        <line x1={44} y1={60} x2={40} y2={81} strokeWidth={5} />
        <line x1={44} y1={60} x2={48} y2={81} strokeWidth={5} />
        <polyline points="46,45 52,52 54,60" strokeWidth={4} strokeLinejoin="round" />
        <line x1={42} y1={45} x2={38} y2={58} strokeWidth={4} />
      </g>
      <circle cx={46} cy={33} r={6} className="fill-primary" />
      <Arrow x1={51} y1={27} x2={80} y2={11} className={GAZE} dash="3 3" />
      {/* camera close to the ground, tilted up */}
      <Cam x={14} y={76} rotate={-30} />
      <Arrow x1={21} y1={70} x2={36} y2={52} className={CAM} dash="1.5 3" />
    </>
  );
}

const DRAWINGS: Record<Pose, () => React.JSX.Element> = {
  profile_view: ProfileView,
  back_horizon: BackHorizon,
  low_angle: LowAngle,
};

export function PoseIllustration({ pose, className }: { pose: Pose; className?: string }) {
  const { t } = useTranslation();
  const Drawing = DRAWINGS[pose];
  const alt = t(`pose.alt.${pose}`);
  return (
    <svg viewBox="0 0 120 100" role="img" aria-label={alt} className={className}>
      <title>{alt}</title>
      <Drawing />
    </svg>
  );
}

/** Pose tip block shown under a photo spot. */
export function PoseGuide({ spot }: { spot: PoseSpotInput }) {
  const { t } = useTranslation();
  const { place, pose } = poseGuideFor(spot);
  return (
    <div className="panel mt-5 p-3.5">
      <div className="flex items-center gap-3">
        <PoseIllustration pose={pose} className="h-auto w-32 shrink-0 rounded-xl bg-card shadow-xs" />
        <div className="min-w-0 text-start">
          <p className="text-[11px] font-medium uppercase tracking-widest text-copper">
            {t("pose.title")}
          </p>
          <p className="mt-0.5 font-medium text-sm leading-snug">{t(`pose.name.${pose}`)}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground leading-relaxed text-start">{t(`pose.tips.${place}`)}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Camera className="h-3 w-3 text-copper" /> {t("pose.legend.camera")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Eye className="h-3 w-3 text-primary" /> {t("pose.legend.gaze")}
        </span>
      </div>
    </div>
  );
}
