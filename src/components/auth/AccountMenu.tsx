import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { User } from "lucide-react";
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
import { AuthDialog } from "./AuthDialog";

export function AccountMenu() {
  const { t } = useTranslation();
  const { isAnonymous, email } = useAnonSession();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isAnonymous) {
    return (
      <>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors"
        >
          <User className="h-3.5 w-3.5" />
          {t("auth.log_in")}
        </button>
        <AuthDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    );
  }

  const initial = email?.[0]?.toUpperCase() ?? "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="outline-none">
        <Avatar className="h-8 w-8 border border-border">
          <AvatarFallback className="text-xs font-medium">{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">{t("auth.my_trips")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => Browser.open({ url: "https://play.google.com/store/account/subscriptions" })}>
          {t("auth.manage_subscription")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => signOut()}>{t("auth.log_out")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
