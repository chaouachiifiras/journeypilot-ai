import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LogIn, ShieldCheck } from "lucide-react";
import riad from "@/assets/scene-riad.jpg";
import { AuthDialog } from "./AuthDialog";

/** Full-page prompt shown instead of a trip-management screen when the user is only browsing anonymously. */
export function AuthGate() {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="container-page max-w-lg py-8 md:py-16">
      <div className="card overflow-hidden">
        <div className="relative h-52 overflow-hidden bg-ink">
          <img src={riad} alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_40%]" />
          <div className="scrim-card absolute inset-0" />
          <span className="glass-dark absolute bottom-4 start-4 flex h-12 w-12 items-center justify-center rounded-2xl">
            <LogIn className="h-5 w-5" />
          </span>
        </div>
        <div className="p-6 md:p-8">
          <h1 className="title-md">{t("auth.gate_title")}</h1>
          <p className="mt-2 leading-relaxed text-muted-foreground">{t("auth.gate_subtitle")}</p>
          <button onClick={() => setDialogOpen(true)} className="btn btn-primary btn-lg btn-block mt-7">
            <LogIn /> {t("auth.log_in")}
          </button>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-success" /> {t("auth.subtitle")}
          </p>
        </div>
      </div>
      <AuthDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
