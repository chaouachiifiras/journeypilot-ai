import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight, ArrowDown, MapPin, Camera, UtensilsCrossed, ShieldCheck, Wallet, Bed, Sparkles,
  Sunrise, Utensils, Sunset, BadgeCheck, Languages, Images, Compass, SlidersHorizontal, Route as RouteIcon,
} from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import hero from "@/assets/hero-journey.jpg";
import mountains from "@/assets/scene-mountains.jpg";
import riad from "@/assets/scene-riad.jpg";
import kyoto from "@/assets/scene-kyoto.jpg";

export const Route = createFileRoute("/")({
  component: Welcome,
});

const EASE = [0.22, 1, 0.36, 1] as const;

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.7, ease: EASE },
};

function Welcome() {
  const { t } = useTranslation();

  const facts = [
    { icon: BadgeCheck, key: "real_places" },
    { icon: Wallet, key: "budget" },
    { icon: Images, key: "photos" },
    { icon: Languages, key: "languages" },
  ] as const;

  const steps = [
    { icon: Compass, key: "step1" },
    { icon: SlidersHorizontal, key: "step2" },
    { icon: RouteIcon, key: "step3" },
  ] as const;

  const smallFeatures = [
    { icon: UtensilsCrossed, key: "tastes" },
    { icon: Wallet, key: "budget" },
    { icon: ShieldCheck, key: "safe" },
  ] as const;

  return (
    <div className="min-h-screen pb-tabbar">
      <AppHeader overlay />

      {/* ---------------- Hero ---------------- */}
      <section className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-ink md:min-h-[92vh] md:items-center">
        <img
          src={hero}
          alt=""
          width={1920}
          height={1280}
          fetchPriority="high"
          className="animate-kenburns absolute inset-0 -z-20 h-full w-full object-cover object-[62%_center]"
        />
        <div className="scrim absolute inset-0 -z-10" />
        <div className="absolute inset-y-0 start-0 -z-10 hidden w-2/3 bg-gradient-to-r from-[rgba(8,20,18,0.7)] to-transparent md:block rtl:bg-gradient-to-l" />

        <div className="container-page grid w-full items-center gap-10 pb-[calc(var(--tabbar-h)+2.5rem)] pt-20 md:grid-cols-[1.15fr_0.85fr] md:pb-24 md:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE }}
            className="max-w-2xl text-white"
          >
            <span className="glass-dark inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-[#e9c27f]" />
              {t("welcome.eyebrow")}
            </span>
            <h1 className="display-xl mt-6 text-balance text-white">{t("welcome.title")}</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[rgba(255,255,255,0.82)] md:text-lg">
              {t("welcome.subtitle")}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/planner" className="btn btn-light btn-lg group">
                <Sparkles className="text-copper" />
                {t("welcome.cta_plan")}
                <ArrowRight className="transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
              </Link>
              <a href="#how" className="btn btn-glass btn-lg hidden sm:inline-flex">
                {t("ui.home.cta_how")}
                <ArrowDown />
              </a>
            </div>
          </motion.div>

          {/* Layered preview of what the AI produces */}
          <motion.div
            initial={{ opacity: 0, y: 40, rotate: 2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 1, delay: 0.35, ease: EASE }}
            className="relative hidden md:block"
          >
            <div className="animate-float">
              <ItineraryPreview />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------------- Facts strip ---------------- */}
      <section className="relative z-10 -mt-14">
        <div className="container-page">
          <motion.div
            {...reveal}
            className="card grid grid-cols-2 gap-px overflow-hidden bg-border p-0 md:grid-cols-4"
          >
            {facts.map((f) => (
              <div key={f.key} className="flex flex-col gap-3 bg-card p-5 md:flex-row md:items-start md:p-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold leading-snug">{t(`ui.home.facts.${f.key}.title`)}</div>
                  <div className="mt-0.5 text-xs leading-snug text-muted-foreground">{t(`ui.home.facts.${f.key}.desc`)}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section id="how" className="container-page scroll-mt-20 py-20 md:py-28">
        <motion.div {...reveal} className="max-w-2xl">
          <span className="eyebrow">{t("ui.home.how_eyebrow")}</span>
          <h2 className="display-lg mt-3 text-balance">{t("ui.home.how_title")}</h2>
        </motion.div>
        <div className="mt-12 grid gap-4 md:grid-cols-3 md:gap-6">
          {steps.map((s, i) => (
            <motion.div
              key={s.key}
              {...reveal}
              transition={{ duration: 0.7, delay: i * 0.1, ease: EASE }}
              className="card card-hover relative overflow-hidden p-6 md:p-7"
            >
              <span className="pointer-events-none absolute -top-4 end-3 font-display text-[6.5rem] leading-none text-secondary">
                {i + 1}
              </span>
              <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-brand shadow-soft">
                <s.icon className="h-5 w-5" />
              </span>
              <h3 className="relative mt-6 text-xl">{t(`ui.home.steps.${s.key}.title`)}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
                {t(`ui.home.steps.${s.key}.desc`)}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------------- Feature bento ---------------- */}
      <section className="bg-secondary py-20 md:py-28">
        <div className="container-page">
          <motion.div {...reveal} className="max-w-2xl">
            <span className="eyebrow">{t("ui.home.features_eyebrow")}</span>
            <h2 className="display-lg mt-3 text-balance">{t("ui.home.features_title")}</h2>
          </motion.div>

          <div className="mt-12 grid gap-4 md:grid-cols-6 md:grid-rows-[300px_300px] md:gap-5">
            <PhotoFeature
              img={kyoto}
              icon={MapPin}
              title={t("welcome.features.itinerary.title")}
              desc={t("welcome.features.itinerary.desc")}
              className="h-[340px] md:col-span-3 md:row-span-2 md:h-auto"
            />
            <PhotoFeature
              img={riad}
              icon={Bed}
              title={t("welcome.features.stays.title")}
              desc={t("welcome.features.stays.desc")}
              className="h-[260px] md:col-span-3 md:h-auto"
            />
            <PhotoFeature
              img={mountains}
              icon={Camera}
              title={t("welcome.features.photo.title")}
              desc={t("welcome.features.photo.desc")}
              className="h-[260px] md:col-span-3 md:h-auto"
              position="object-[50%_70%]"
            />
          </div>

          <div className="mt-4 grid gap-4 md:mt-5 md:grid-cols-3 md:gap-5">
            {smallFeatures.map((f, i) => (
              <motion.div
                key={f.key}
                {...reveal}
                transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
                className="card card-hover flex items-start gap-4 p-5 md:p-6"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-copper-soft text-copper">
                  <f.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg">{t(`welcome.features.${f.key}.title`)}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`welcome.features.${f.key}.desc`)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Inspiration ---------------- */}
      <section className="container-page py-20 md:py-28">
        <motion.div {...reveal} className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <span className="eyebrow">{t("ui.home.inspire_eyebrow")}</span>
            <h2 className="display-lg mt-3 text-balance">{t("ui.home.inspire_title")}</h2>
          </div>
          <Link to="/planner" className="btn btn-secondary">
            {t("nav.plan")}
            <ArrowRight className="rtl:rotate-180" />
          </Link>
        </motion.div>

        <div className="-mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 scrollbar-none md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0">
          {[
            { img: kyoto, key: "culture" },
            { img: riad, key: "stays" },
            { img: mountains, key: "nature" },
          ].map((d, i) => (
            <motion.div
              key={d.key}
              {...reveal}
              transition={{ duration: 0.7, delay: i * 0.1, ease: EASE }}
              className="group relative h-[420px] w-[78%] shrink-0 snap-start overflow-hidden rounded-[1.75rem] shadow-soft md:w-auto"
            >
              <img src={d.img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105" />
              <div className="scrim-card absolute inset-0" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                <span className="badge badge-dark">{t(`ui.home.scenes.${d.key}.tag`)}</span>
                <p className="mt-3 font-display text-[1.75rem] leading-tight">{t(`ui.home.scenes.${d.key}.title`)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------------- Final CTA ---------------- */}
      <section className="container-page pb-20 md:pb-28">
        <motion.div
          {...reveal}
          className="surface-ink relative overflow-hidden rounded-[2rem] px-6 py-14 text-center md:px-16 md:py-20"
        >
          <div className="glow-teal pointer-events-none absolute -top-40 start-1/2 h-[28rem] w-[28rem] -translate-x-1/2" />
          <div className="glow-gold pointer-events-none absolute -bottom-40 -end-20 h-[26rem] w-[26rem]" />
          <span className="relative inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.2)] px-3 py-1 text-xs font-semibold text-[#e9c27f]">
            <Sparkles className="h-3.5 w-3.5" /> {t("ui.ai_badge")}
          </span>
          <h2 className="display-lg relative mx-auto mt-5 max-w-2xl text-balance text-white">{t("ui.home.cta_title")}</h2>
          <p className="relative mx-auto mt-4 max-w-lg text-[rgba(255,255,255,0.72)]">{t("ui.home.cta_sub")}</p>
          <Link to="/planner" className="btn btn-light btn-lg group relative mt-9">
            {t("welcome.cta_plan")}
            <ArrowRight className="transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
          </Link>
        </motion.div>
      </section>

      <footer className="border-t border-border">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-8 text-xs text-muted-foreground md:flex-row">
          <span>© {new Date().getFullYear()} {t("brand")} · {t("ui.home.footer_tagline")}</span>
          <Link to="/privacy" className="font-semibold hover:text-foreground">
            {t("ui.home.privacy")}
          </Link>
        </div>
      </footer>
    </div>
  );
}

function PhotoFeature({
  img, icon: Icon, title, desc, className, position = "object-center",
}: {
  img: string;
  icon: typeof MapPin;
  title: string;
  desc: string;
  className?: string;
  position?: string;
}) {
  return (
    <motion.div
      {...reveal}
      className={`group relative overflow-hidden rounded-[1.75rem] shadow-soft ${className ?? ""}`}
    >
      <img src={img} alt="" loading="lazy" className={`absolute inset-0 h-full w-full object-cover ${position} transition-transform duration-[1.2s] ease-out group-hover:scale-105`} />
      <div className="scrim-card absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-7">
        <span className="glass-dark flex h-11 w-11 items-center justify-center rounded-2xl">
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="mt-4 text-2xl text-white">{title}</h3>
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[rgba(255,255,255,0.8)]">{desc}</p>
      </div>
    </motion.div>
  );
}

/** A stylised, content-free preview of a generated day (no invented places). */
function ItineraryPreview() {
  const { t } = useTranslation();
  const rows = [
    { icon: Sunrise, slot: "morning", w: "78%", cost: "€€" },
    { icon: Utensils, slot: "lunch", w: "62%", cost: "€" },
    { icon: Sunset, slot: "sunset", w: "70%", cost: "€" },
  ] as const;
  return (
    <div className="glass ms-auto w-full max-w-sm rounded-[1.75rem] p-5 text-foreground shadow-lift">
      <div className="flex items-center justify-between">
        <span className="ai-chip">
          <Sparkles /> {t("ui.ai_badge")}
        </span>
        <span className="text-xs font-semibold text-muted-foreground">{t("trip.day")} 1</span>
      </div>
      <p className="mt-4 font-display text-2xl leading-tight">{t("ui.home.preview_title")}</p>
      <div className="relative mt-5 space-y-3 before:absolute before:inset-y-3 before:start-[19px] before:w-px before:bg-border">
        {rows.map((r, i) => (
          <motion.div
            key={r.slot}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 + i * 0.18, duration: 0.6, ease: EASE }}
            className="relative flex items-center gap-3"
          >
            <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-brand shadow-xs">
              <r.icon className="h-4 w-4" />
            </span>
            <div className="flex-1 rounded-2xl border border-border bg-card px-3.5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-copper">{t(`trip.slots.${r.slot}`)}</span>
                <span className="text-[11px] font-semibold text-muted-foreground">{r.cost}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-secondary" style={{ width: r.w }} />
              <div className="mt-1.5 h-2 w-2/5 rounded-full bg-muted" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
