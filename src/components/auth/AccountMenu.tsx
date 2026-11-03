import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { CreditCard, Crown, Loader2, LogOut, Luggage, Trash2, User } from "lucide-react";
import { Browser } from "@capacitor/browser";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAnonSession } from "@/lib/anon-session";
import { deleteAccount, signOut } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AuthDialog } from "./AuthDialog";
import { PaywallDialog } from "@/components/paywall/PaywallDialog";
import { Capacitor } from "@capacitor/core";

const SUBSCRIPTIONS_URL =
  Capacitor.getPlatform() === "ios"
    ? "https://apps.apple.com/account/subscriptions"
    : "https://play.google.com/store/account/subscriptions";
// Must match the entitlement identifier in RevenueCat (see PaywallDialog).
const ENTITLEMENT_ID = "journeypilot_ai_premium";

export function AccountMenu({ onImage = false }: { onImage?: boolean }) {
  const { t } = useTranslation();
  const { isAnonymous, email } = useAnonSession();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  // Lets users (and App Review) reach the subscription screen directly instead of only
  // after the free trip is used up; subscribers see their active status instead.
  useEffect(() => {
    if (!isNative || isAnonymous) return;
    let cancelled = false;
    import("@revenuecat/purchases-capacitor")
      .then(({ Purchases }) => Purchases.getCustomerInfo())
      .then(({ customerInfo }) => {
        if (!cancelled) setIsPremium(!!customerInfo.entitlements.active[ENTITLEMENT_ID]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isNative, isAnonymous, paywallOpen]);

  if (isAnonymous) {
    return (
      <>
        <button
          onClick={() => setDialogOpen(true)}
          aria-label={t("auth.log_in")}
          className={cn("btn btn-sm h-10 w-10 px-0 sm:w-auto sm:px-[0.95rem]", onImage ? "btn-light" : "btn-primary")}
        >
          <User />
          <span className="hidden sm:inline">{t("auth.log_in")}</span>
        </button>
        <AuthDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    );
  }

  const initial = email?.[0]?.toUpperCase() ?? "?";

  const onDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={email ?? t("nav.profile")}>
          <Avatar className={cn("h-10 w-10", onImage ? "ring-2 ring-[rgba(255,255,255,0.7)]" : "ring-1 ring-border")}>
            <AvatarFallback className="bg-gradient-brand text-sm font-bold">{initial}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="truncate px-3 py-2 text-xs font-medium text-muted-foreground">{email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/profile">
              <Luggage />
              {t("auth.my_trips")}
            </Link>
          </DropdownMenuItem>
          {isNative &&
            (isPremium ? (
              <DropdownMenuItem disabled className="text-primary opacity-100">
                <Crown />
                {t("auth.premium_active")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setPaywallOpen(true)} className="font-semibold text-primary focus:text-primary">
                <Crown />
                {t("auth.go_premium")}
              </DropdownMenuItem>
            ))}
          <DropdownMenuItem onClick={() => Browser.open({ url: SUBSCRIPTIONS_URL })}>
            <CreditCard />
            {t("auth.manage_subscription")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
            <LogOut />
            {t("auth.log_out")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
            <Trash2 />
            {t("auth.delete_account")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PaywallDialog
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        onSubscribed={() => {
          setPaywallOpen(false);
          setIsPremium(true);
        }}
      />
      <AlertDialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("auth.delete_account_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("auth.delete_account_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
            <button type="button" onClick={onDelete} disabled={deleting} className="btn btn-sm bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("auth.delete_account_confirm")}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
