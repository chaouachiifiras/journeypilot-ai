import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { ArrowRight, MapPin, Camera, UtensilsCrossed, ShieldCheck, Wallet, Bed, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import hero from "@/assets/hero-journey.jpg";
import mountains from "@/assets/scene-mountains.jpg";
import riad from "@/assets/scene-riad.jpg";
import kyoto from "@/assets/scene-kyoto.jpg";

export const Route = createFileRoute("/")({
  component: Welcome,
});

function Welcome() {
  const { t } = useTranslation();

  const features = [
    { icon: MapPin, key: "itinerary" },
    { icon: Bed, key: "stays" },
    { icon: UtensilsCrossed, key: "tastes" },
    { icon: Camera, key: "photo" },
    { icon: ShieldCheck, key: "safe" },
    { icon: Wallet, key: "budget" },
  ] as const;

  return (
    <div className="min-h-screen">
      <AppHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={hero}
            alt=""
            width={1920}
            height={1280}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/40 to-background" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-32 md:pt-32 md:pb-48">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 backdrop-blur px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {t("welcome.eyebrow")}
            </div>
            <h1 className="mt-6 font-display text-5xl md:text-7xl leading-[0.98] tracking-tight text-foreground">
              {t("welcome.title")}
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
              {t("welcome.subtitle")}
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/planner"
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground shadow-lift hover:shadow-soft transition-all hover:-translate-y-0.5"
              >
                {t("welcome.cta_plan")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180" />
              </Link>
              {/* Assistant chat CTA hidden for free launch; re-enable for Premium later.
              <Link to="/chat" ...>{t("welcome.cta_chat")}</Link> */}
            </div>

            {/* Trust bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="mt-14 grid grid-cols-3 gap-6 max-w-lg"
            >
              {[
                { n: "180+", l: "Destinations" },
                { n: "12s", l: "To craft a trip" },
                { n: "4.9", l: "Traveler rating" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-display text-3xl text-foreground">{s.n}</div>
                  <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{s.l}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.key}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 hover:shadow-lift transition-all"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-xl">{t(`welcome.features.${f.key}.title`)}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                {t(`welcome.features.${f.key}.desc`)}
              </p>
              <div className="pointer-events-none absolute -bottom-16 -end-16 h-40 w-40 rounded-full bg-copper/5 blur-2xl transition-opacity group-hover:bg-copper/10" />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Editorial mosaic */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[520px]">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative rounded-2xl overflow-hidden md:row-span-2"
          >
            <img src={mountains} alt="" loading="lazy" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/60 to-transparent">
              <span className="text-xs font-medium text-white/80 uppercase tracking-widest">Nature</span>
              <p className="font-display text-2xl text-white">Alpine mornings</p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative rounded-2xl overflow-hidden md:col-span-2"
          >
            <img src={kyoto} alt="" loading="lazy" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/60 to-transparent">
              <span className="text-xs font-medium text-white/80 uppercase tracking-widest">Culture</span>
              <p className="font-display text-2xl text-white">Cherry seasons in Kyoto</p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative rounded-2xl overflow-hidden md:col-span-2"
          >
            <img src={riad} alt="" loading="lazy" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/60 to-transparent">
              <span className="text-xs font-medium text-white/80 uppercase tracking-widest">Stays</span>
              <p className="font-display text-2xl text-white">Lantern-lit riads</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Editorial quote */}
      <section className="mx-auto max-w-4xl px-6 pb-24 text-center">
        <motion.blockquote
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="font-display text-3xl md:text-5xl leading-tight tracking-tight text-foreground"
        >
          <span className="text-copper">"</span>
          Travel is the only thing you buy that makes you richer — and JourneyPilot makes every hour count.
          <span className="text-copper">"</span>
        </motion.blockquote>
        <p className="mt-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">Designed for the modern traveler</p>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {t("brand")}
      </footer>
    </div>
  );
}
