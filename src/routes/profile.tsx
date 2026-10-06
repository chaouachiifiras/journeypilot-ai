import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { AppHeader } from "@/components/layout/AppHeader";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAnonSession } from "@/lib/anon-session";
import { listTrips } from "@/lib/trips.functions";
import { ArrowUpRight, CalendarDays, Compass, Loader2, Plane, Plus, Sparkles, Wallet } from "lucide-react";
import mountains from "@/assets/scene-mountains.jpg";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  component: Profile,
});

function Profile() {
  const { ready, isAnonymous } = useAnonSession();
  const { t, i18n } = useTranslation();
  const list = useServerFn(listTrips);

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["trips"],
    enabled: ready && !isAnonymous,
    queryFn: () => list(),
  });

  if (ready && isAnonymous) {
    return (
      <div className="min-h-screen pb-tabbar">
        <AppHeader />
        <AuthGate />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-tabbar">
      <AppHeader />
      <div className="container-page max-w-5xl py-10 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">{t("auth.my_trips")}</span>
            <h1 className="display-lg mt-2">{t("profile.title")}</h1>
            <p className="mt-2 text-muted-foreground">{t("profile.subtitle")}</p>
          </div>
          {trips.length > 0 && (
            <Link to="/planner" className="btn btn-primary">
              <Plus /> {t("nav.plan")}
            </Link>
          )}
        </div>

        {isLoading && (
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card overflow-hidden">
                <div className="skeleton h-36 rounded-none" />
                <div className="space-y-3 p-5">
                  <div className="skeleton h-3 w-1/2" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && trips.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mt-10 overflow-hidden rounded-[2rem] bg-ink text-white shadow-lift"
          >
            <img src={mountains} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
            <div className="scrim absolute inset-0" />
            <div className="relative flex min-h-[380px] flex-col items-center justify-end px-6 pb-10 pt-24 text-center">
              <span className="glass-dark flex h-14 w-14 items-center justify-center rounded-2xl">
                <Compass className="h-6 w-6" />
              </span>
              <h2 className="title-md mt-5 max-w-sm text-white">{t("profile.empty")}</h2>
              <Link to="/planner" className="btn btn-light btn-lg mt-7">
                <Sparkles className="text-copper" /> {t("welcome.cta_plan")}
              </Link>
            </div>
          </motion.div>
        )}

        {trips.length > 0 && (
          <div className="mt-10 grid gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
            {trips.map((tr, i) => (
              <motion.div
                key={tr.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 6) * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link to="/trip/$id" params={{ id: tr.id }} className="card card-hover group block overflow-hidden">
                  {/* Boarding-pass style cover */}
                  <div className={cn("relative h-36 overflow-hidden px-5 pt-5 text-white", COVERS[i % COVERS.length])}>
                    <svg className="absolute inset-0 h-full w-full opacity-[0.16]" viewBox="0 0 300 140" preserveAspectRatio="none" aria-hidden>
                      <g fill="none" stroke="#fff" strokeWidth="1">
                        {[0, 1, 2, 3, 4, 5].map((k) => (
                          <path key={k} d={`M-10 ${30 + k * 20} C 70 ${10 + k * 20}, 140 ${60 + k * 20}, 210 ${28 + k * 20} S 290 ${12 + k * 20}, 320 ${40 + k * 20}`} />
                        ))}
                      </g>
                    </svg>
                    <div className="relative flex items-start justify-between gap-3">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[rgba(255,255,255,0.75)]">{tr.country}</span>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(255,255,255,0.16)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100">
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </div>
                    <h3 className="relative mt-3 truncate font-display text-[2rem] leading-none text-white">{tr.city}</h3>
                    <Plane className="absolute bottom-3 end-4 h-5 w-5 text-[rgba(255,255,255,0.5)] rtl:-scale-x-100" />
                  </div>
                  {/* Perforation */}
                  <div className="relative h-0 border-t border-dashed border-border-strong">
                    <span className="absolute -start-3 -top-3 h-6 w-6 rounded-full bg-background" />
                    <span className="absolute -end-3 -top-3 h-6 w-6 rounded-full bg-background" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 px-5 py-4">
                    <TicketField icon={CalendarDays} label={t("planner.days")} value={String(tr.days)} />
                    <TicketField icon={Compass} label={t("planner.style")} value={t(`planner.styles.${tr.travel_style}`, { defaultValue: tr.travel_style })} />
                    <TicketField icon={Wallet} label={t("planner.budget")} value={`${tr.budget} ${tr.currency}`} />
                  </div>
                  <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
                    <span>{new Date(tr.created_at).toLocaleDateString(i18n.language)}</span>
                    {tr.status !== "ready" ? (
                      <span className="badge badge-warning">
                        {tr.status === "pending" && <Loader2 className="animate-spin" />}
                        {tr.status}
                      </span>
                    ) : (
                      <span className="font-semibold text-primary">{t("ui.profile.open")}</span>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const COVERS = ["bg-gradient-brand", "bg-gradient-copper", "bg-[linear-gradient(135deg,#1f5f74,#0f3442)]", "bg-[linear-gradient(135deg,#7a5a2a,#3f2c12)]"];

function TicketField({ icon: Icon, label, value }: { icon: typeof Compass; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-subtle">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate text-sm font-bold capitalize tabular">{value}</div>
    </div>
  );
}
