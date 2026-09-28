import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { Globe } from "lucide-react";
import { useEffect, useState } from "react";
import i18n, { applyLangDir } from "@/lib/i18n";
import logo from "@/assets/logo-mark.png";
import { cn } from "@/lib/utils";
import { AccountMenu } from "@/components/auth/AccountMenu";

const LANGS = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "ar", label: "ع" },
  { code: "de", label: "DE" },
  { code: "nl", label: "NL" },
  { code: "zh", label: "中" },
] as const;

const LANG_NAMES: Record<(typeof LANGS)[number]["code"], string> = {
  en: "English", fr: "Français", ar: "العربية",
  de: "Deutsch", nl: "Nederlands", zh: "中文",
};

export function AppHeader() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [lang, setLang] = useState(i18n.language ?? "en");
  const [open, setOpen] = useState(false);
  // A trip's AI-authored content (summary, activity descriptions, etc.) is generated once,
  // in whichever language was selected at creation time, and never retranslated — so
  // offering a language switch here would imply it changes content that in fact never does.
  const hideLanguageSwitcher = pathname.startsWith("/trip/");

  useEffect(() => {
    applyLangDir(lang);
  }, [lang]);

  const links = [
    { to: "/", label: t("nav.home") },
    { to: "/planner", label: t("nav.plan") },
    // Assistant chat nav link hidden for free launch; route /chat still exists (future Premium).
    // { to: "/chat", label: t("nav.chat") },
    { to: "/profile", label: t("nav.profile") },
  ];

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5 group">
          <img src={logo} alt="" className="h-8 w-8 transition-transform group-hover:rotate-12" />
          <span className="font-display text-lg tracking-tight">{t("brand")}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => {
            const active =
              l.to === "/" ? pathname === "/" : pathname === l.to || pathname.startsWith(l.to + "/");
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "relative px-4 py-2 text-sm font-medium rounded-full transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l.label}
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-secondary"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {!hideLanguageSwitcher && (
            <div className="relative">
              <button
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>{LANGS.find((l) => l.code === lang)?.label ?? "EN"}</span>
              </button>
              {open && (
                <div className="absolute end-0 mt-2 min-w-24 rounded-lg border border-border bg-popover shadow-lift overflow-hidden">
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => {
                        setLang(l.code);
                        i18n.changeLanguage(l.code);
                        setOpen(false);
                      }}
                      className={cn(
                        "block w-full px-3 py-2 text-start text-sm hover:bg-secondary",
                        lang === l.code && "text-primary font-medium",
                      )}
                    >
                      {LANG_NAMES[l.code]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <AccountMenu />
        </div>
      </div>
    </motion.header>
  );
}
