import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Check, Compass, Globe, Luggage, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import i18n, { applyLangDir } from "@/lib/i18n";
import logo from "@/assets/logo-mark.png";
import { cn } from "@/lib/utils";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { toast } from "sonner";
import { registerSecretTap } from "@/lib/debug-console";

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

/**
 * App chrome: a quiet top bar (logo, desktop nav, language, account) and, on
 * phones, a native-style bottom tab bar. `overlay` makes the top bar sit
 * transparently on top of a full-bleed hero until the page is scrolled.
 */
export function AppHeader({ overlay = false }: { overlay?: boolean }) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [lang, setLang] = useState(i18n.language ?? "en");
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // A trip's AI-authored content (summary, activity descriptions, etc.) is generated once,
  // in whichever language was selected at creation time, and never retranslated — so
  // offering a language switch here would imply it changes content that in fact never does.
  const hideLanguageSwitcher = pathname.startsWith("/trip/");

  useEffect(() => {
    applyLangDir(lang);
  }, [lang]);

  useEffect(() => {
    if (!overlay) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overlay]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const links = [
    { to: "/", label: t("nav.home"), icon: Compass },
    { to: "/planner", label: t("nav.plan"), icon: Plus },
    // Assistant chat nav link hidden for free launch; route /chat still exists (future Premium).
    // { to: "/chat", label: t("nav.chat") },
    { to: "/profile", label: t("auth.my_trips"), icon: Luggage },
  ] as const;

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/"));
  const onImage = overlay && !scrolled;

  return (
    <>
      <header
        className={cn(
          "z-40 w-full pt-[env(safe-area-inset-top)] transition-[background-color,border-color,box-shadow] duration-300",
          overlay ? "fixed inset-x-0 top-0" : "sticky top-0",
          onImage
            ? "border-b border-transparent bg-transparent"
            : "border-b border-border bg-background shadow-xs",
        )}
      >
        <div className="container-page flex h-16 items-center justify-between gap-3">
          <Link
            to="/"
            className="group flex min-w-0 items-center gap-2.5"
            onClick={() => {
              // Hidden switch for the iOS error console (no-op on Android / web).
              const on = registerSecretTap();
              if (on !== undefined) toast(on ? "Console de débogage activée" : "Console de débogage désactivée");
            }}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:rotate-6",
                onImage ? "bg-[rgba(255,255,255,0.92)]" : "bg-card shadow-xs ring-1 ring-border",
              )}
            >
              <img src={logo} alt="" className="h-6 w-6" />
            </span>
            <span className={cn("truncate font-display text-[1.15rem] tracking-tight", onImage ? "text-white" : "text-foreground")}>
              {t("brand")}
            </span>
          </Link>

          <nav
            className={cn(
              "hidden items-center gap-1 rounded-full p-1 md:flex",
              onImage ? "glass-dark" : "bg-secondary",
            )}
          >
            {links.map((l) => {
              const active = isActive(l.to);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-all",
                    active
                      ? onImage
                        ? "bg-white text-foreground shadow-xs"
                        : "bg-card text-primary shadow-soft"
                      : onImage
                        ? "text-[rgba(255,255,255,0.85)] hover:text-white"
                        : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <l.icon className="h-4 w-4" />
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {!hideLanguageSwitcher && (
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setOpen((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={open}
                  aria-label={t("profile.language")}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors",
                    onImage ? "glass-dark hover:bg-[rgba(255,255,255,0.2)]" : "border border-border bg-card hover:bg-secondary",
                  )}
                >
                  <Globe className="h-4 w-4" />
                  <span>{LANGS.find((l) => l.code === lang)?.label ?? "EN"}</span>
                </button>
                {open && (
                  <div
                    role="listbox"
                    className="absolute end-0 z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 text-foreground shadow-lift animate-in fade-in-0 zoom-in-95"
                  >
                    {LANGS.map((l) => (
                      <button
                        key={l.code}
                        role="option"
                        aria-selected={lang === l.code}
                        onClick={() => {
                          setLang(l.code);
                          i18n.changeLanguage(l.code);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-start text-sm font-medium transition-colors hover:bg-secondary",
                          lang === l.code && "text-primary",
                        )}
                      >
                        {LANG_NAMES[l.code]}
                        {lang === l.code && <Check className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <AccountMenu onImage={onImage} />
          </div>
        </div>
      </header>

      {/* Mobile tab bar — the primary navigation on phones. */}
      <nav
        aria-label={t("brand")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto grid h-[var(--tabbar-h)] max-w-md grid-cols-3 items-center px-4">
          {links.map((l) => {
            const active = isActive(l.to);
            if (l.to === "/planner") {
              return (
                <Link key={l.to} to={l.to} className="flex flex-col items-center gap-1" aria-current={active ? "page" : undefined}>
                  <span
                    className={cn(
                      "-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand text-primary-foreground ring-4 ring-background transition-transform active:scale-95",
                      active ? "shadow-lift" : "shadow-soft",
                    )}
                  >
                    <Plus className="h-6 w-6" />
                  </span>
                  <span className={cn("text-[11px] font-semibold", active ? "text-primary" : "text-muted-foreground")}>
                    {l.label}
                  </span>
                </Link>
              );
            }
            return (
              <Link
                key={l.to}
                to={l.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition-colors", active && "bg-primary-soft")}>
                  <l.icon className="h-[1.35rem] w-[1.35rem]" />
                </span>
                <span className="text-[11px] font-semibold">{l.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
