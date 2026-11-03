import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import { Loader2, Crown, Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.journeypilot.ai";
// App Store guideline 3.1.2 asks subscription screens to link the Terms of Use (EULA) and
// the privacy policy; Apple's standard EULA applies since the app has no custom one.
const TERMS_URL =
  Capacitor.getPlatform() === "ios"
    ? "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
    : "https://play.google.com/about/play-terms/";
// Must match the entitlement identifier in RevenueCat (and PREMIUM_ENTITLEMENT_ID server-side).
const ENTITLEMENT_ID = "journeypilot_ai_premium";

type Plan = "annual" | "monthly";
type PlanInfo = { price: string; perMonth: string | null; amount: number };

export function PaywallDialog({
  open,
  onOpenChange,
  onSubscribed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubscribed: () => void;
}) {
  const { t } = useTranslation();
  const isNative = Capacitor.isNativePlatform();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // Annual is preselected: it's the better deal for travellers who plan a few trips a year.
  const [plan, setPlan] = useState<Plan>("annual");
  const [plans, setPlans] = useState<Partial<Record<Plan, PlanInfo>>>({});

  useEffect(() => {
    if (!open || !isNative) return;
    let cancelled = false;
    import("@revenuecat/purchases-capacitor").then(({ Purchases }) =>
      Purchases.getOfferings()
        .then(({ current }) => {
          if (cancelled || !current) return;
          const info = (pkg: typeof current.annual): PlanInfo | undefined =>
            pkg
              ? { price: pkg.product.priceString, perMonth: pkg.product.pricePerMonthString, amount: pkg.product.price }
              : undefined;
          const next = { annual: info(current.annual), monthly: info(current.monthly) };
          setPlans(next);
          // Older offerings without an annual package: fall back to monthly.
          if (!next.annual && next.monthly) setPlan("monthly");
        })
        .catch(() => {}),
    );
    return () => {
      cancelled = true;
    };
  }, [open, isNative]);

  const annual = plans.annual;
  const monthly = plans.monthly;
  const savings =
    annual && monthly && monthly.amount > 0
      ? Math.round((1 - annual.amount / (monthly.amount * 12)) * 100)
      : 42;

  const onSubscribe = async () => {
    setLoading(true);
    try {
      const { Purchases } = await import("@revenuecat/purchases-capacitor");
      const { current } = await Purchases.getOfferings();
      const pkg = (plan === "annual" ? current?.annual : current?.monthly) ?? current?.availablePackages[0];
      if (!pkg) throw new Error("No subscription package available.");
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
      if (customerInfo.entitlements.active[ENTITLEMENT_ID]) {
        onSubscribed();
      }
    } catch (err: unknown) {
      const userCancelled = typeof err === "object" && err !== null && "userCancelled" in err && (err as { userCancelled?: boolean }).userCancelled;
      if (!userCancelled) toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // Required by App Store guideline 3.1.1 (restore mechanism); also useful after a reinstall on Android.
  const onRestore = async () => {
    setRestoring(true);
    try {
      const { Purchases } = await import("@revenuecat/purchases-capacitor");
      const { customerInfo } = await Purchases.restorePurchases();
      if (customerInfo.entitlements.active[ENTITLEMENT_ID]) {
        onSubscribed();
      } else {
        toast(t("paywall.restore_none"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-sm">
        <div className="glow-gold pointer-events-none absolute -top-28 start-1/2 h-64 w-64 -translate-x-1/2" />
        <DialogHeader className="relative">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-copper shadow-lift">
            <Crown className="h-7 w-7" />
          </div>
          <DialogTitle className="pt-2 text-center">{t("paywall.title")}</DialogTitle>
          <DialogDescription className="text-center">
            {isNative ? t("paywall.subtitle") : t("paywall.subtitle_web")}
          </DialogDescription>
        </DialogHeader>

        {isNative ? (
          <>
            <div role="radiogroup" aria-label={t("paywall.title")} className="relative space-y-2">
              <PlanOption
                selected={plan === "annual"}
                onSelect={() => setPlan("annual")}
                title={t("paywall.plan_annual")}
                price={t("paywall.per_year", { price: annual?.price ?? "34,99 €" })}
                detail={annual?.perMonth ? t("paywall.annual_equiv", { price: annual.perMonth }) : undefined}
                badge={savings > 0 ? t("paywall.save", { percent: savings }) : undefined}
              />
              <PlanOption
                selected={plan === "monthly"}
                onSelect={() => setPlan("monthly")}
                title={t("paywall.plan_monthly")}
                price={t("paywall.per_month", { price: monthly?.price ?? "4,99 €" })}
              />
            </div>
            <Button variant="accent" size="lg" className="w-full" disabled={loading || restoring} onClick={onSubscribe}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("paywall.subscribe")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">{t("paywall.auto_renew")}</p>
            <Button variant="ghost" size="sm" className="w-full" disabled={loading || restoring} onClick={onRestore}>
              {restoring && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("paywall.restore")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              <a href={TERMS_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {t("paywall.terms")}
              </a>
              {" · "}
              <a href="/privacy" className="underline underline-offset-2">
                {t("paywall.privacy")}
              </a>
            </p>
          </>
        ) : (
          <Button asChild variant="accent" size="lg" className="w-full">
            <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer">
              {t("paywall.get_android_app")}
            </a>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PlanOption({
  selected,
  onSelect,
  title,
  price,
  detail,
  badge,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  price: string;
  detail?: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-2xl border p-3.5 text-start transition-colors",
        selected ? "border-primary bg-primary-soft" : "border-border bg-card hover:bg-secondary",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
        )}
      >
        {selected && <Check className="h-3 w-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
      </span>
      <span className="text-sm font-semibold tabular">{price}</span>
      {badge && (
        <span className="absolute -top-2.5 end-3 rounded-full bg-gradient-copper px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
