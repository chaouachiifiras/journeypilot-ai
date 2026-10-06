import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { CreditCard, LogOut, Luggage, User } from "lucide-react";
import { Browser } from "@capacitor/browser";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAnonSession } from "@/lib/anon-session";
import { signOut } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AuthDialog } from "./AuthDialog";

export function AccountMenu({ onImage = false }: { onImage?: boolean }) {
  const { t } = useTranslation();
  const { isAnonymous, email } = useAnonSession();
  const [dialogOpen, setDialogOpen] = useState(false);

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

  return (
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
        <DropdownMenuItem onClick={() => Browser.open({ url: "https://play.google.com/store/account/subscriptions" })}>
          <CreditCard />
          {t("auth.manage_subscription")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
          <LogOut />
          {t("auth.log_out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
