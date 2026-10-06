import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import { Loader2, Crown } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.journeypilot.ai";

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
  const [priceLabel, setPriceLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !isNative) return;
    let cancelled = false;
    import("@revenuecat/purchases-capacitor").then(({ Purchases }) =>
      Purchases.getOfferings()
        .then(({ current }) => {
          if (cancelled) return;
          const price = current?.availablePackages[0]?.product.priceString;
          if (price) setPriceLabel(price);
        })
        .catch(() => {}),
    );
    return () => {
      cancelled = true;
    };
  }, [open, isNative]);

  const onSubscribe = async () => {
    setLoading(true);
    try {
      const { Purchases } = await import("@revenuecat/purchases-capacitor");
      const { current } = await Purchases.getOfferings();
      const pkg = current?.availablePackages[0];
      if (!pkg) throw new Error("No subscription package available.");
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
      if (customerInfo.entitlements.active["premium"]) {
        onSubscribed();
      }
    } catch (err: unknown) {
      const userCancelled = typeof err === "object" && err !== null && "userCancelled" in err && (err as { userCancelled?: boolean }).userCancelled;
      if (!userCancelled) toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-sm">
        <div className="pointer-events-none absolute -top-20 start-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-[rgba(207,157,79,0.3)] blur-[60px]" />
        <DialogHeader className="relative">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-copper shadow-lift">
            <Crown className="h-7 w-7" />
          </div>
          <DialogTitle className="pt-2 text-center">{t("paywall.title")}</DialogTitle>
          <DialogDescription className="text-center">
            {isNative
              ? t("paywall.subtitle", { price: priceLabel ?? "5,00 €/month" })
              : t("paywall.subtitle_web")}
          </DialogDescription>
        </DialogHeader>

        {isNative ? (
          <Button variant="accent" size="lg" className="w-full" disabled={loading} onClick={onSubscribe}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("paywall.subscribe")}
          </Button>
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
