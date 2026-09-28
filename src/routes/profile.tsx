import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { AppHeader } from "@/components/layout/AppHeader";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAnonSession } from "@/lib/anon-session";
import { listTrips } from "@/lib/trips.functions";
import { Compass, Plus } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: Profile,
});

function Profile() {
  const { ready, isAnonymous } = useAnonSession();
  const { t } = useTranslation();
  const list = useServerFn(listTrips);

  const { data: trips = [] } = useQuery({
    queryKey: ["trips"],
    enabled: ready && !isAnonymous,
    queryFn: () => list(),
  });

  if (ready && isAnonymous) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <AuthGate />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-4xl md:text-5xl">{t("profile.title")}</h1>
            <p className="mt-2 text-muted-foreground">{t("profile.subtitle")}</p>
          </div>
          <Link
            to="/planner"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> {t("nav.plan")}
          </Link>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {trips.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-border p-16 text-center">
              <Compass className="mx-auto h-8 w-8 text-copper" />
              <p className="mt-3 text-muted-foreground">{t("profile.empty")}</p>
            </div>
          )}
          {trips.map((tr, i) => (
            <motion.div
              key={tr.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                to="/trip/$id"
                params={{ id: tr.id }}
                className="group block rounded-2xl border border-border bg-card p-6 shadow-soft hover:shadow-lift transition-all"
              >
                <div className="text-xs uppercase tracking-widest text-copper font-medium">
                  {tr.travel_style} · {tr.days} days
                </div>
                <h3 className="mt-2 font-display text-2xl leading-tight">{tr.city}</h3>
                <p className="text-sm text-muted-foreground">{tr.country}</p>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {new Date(tr.created_at).toLocaleDateString()}
                  </span>
                  <span className="font-medium">{tr.budget} {tr.currency}</span>
                </div>
                {tr.status !== "ready" && (
                  <div className="mt-3 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs">
                    {tr.status}
                  </div>
                )}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
