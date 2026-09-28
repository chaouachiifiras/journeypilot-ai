import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LogIn } from "lucide-react";
import { AuthDialog } from "./AuthDialog";

/** Full-page prompt shown instead of a trip-management screen when the user is only browsing anonymously. */
export function AuthGate() {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary">
        <LogIn className="h-6 w-6" />
      </div>
      <h1 className="mt-6 font-display text-2xl">{t("auth.gate_title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("auth.gate_subtitle")}</p>
      <button
        onClick={() => setDialogOpen(true)}
        className="mt-8 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lift hover:opacity-90 transition"
      >
        {t("auth.log_in")}
      </button>
      <AuthDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
