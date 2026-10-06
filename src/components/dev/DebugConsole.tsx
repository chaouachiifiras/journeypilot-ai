import { useState, useSyncExternalStore } from "react";
import { Bug, Copy, Share2, Trash2, X, Power } from "lucide-react";
import {
  clearDebug,
  debugAvailable,
  debugEntries,
  debugReport,
  debugVersion,
  isDebugEnabled,
  setDebugEnabled,
  subscribeDebug,
} from "@/lib/debug-console";
import { cn } from "@/lib/utils";

/**
 * Floating error log for test builds (see lib/debug-console.ts). Renders
 * nothing unless the console has been enabled, so regular users never see it.
 * Texts are French on purpose: this is an internal tool, not product UI.
 */
export function DebugConsole() {
  useSyncExternalStore(subscribeDebug, debugVersion, () => 0);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!debugAvailable() || !isDebugEnabled()) return null;
  const entries = debugEntries();
  const report = open ? debugReport() : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(debugReport());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard refused: the text area below can still be selected manually */
    }
  };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "JourneyPilot debug", text: debugReport() });
      else await copy();
    } catch {
      /* cancelled */
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Console de débogage"
        className={cn(
          "fixed start-3 z-[70] flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-white shadow-lift",
          entries.length ? "bg-destructive" : "bg-ink",
        )}
        style={{ bottom: "calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        <Bug className="h-4 w-4" /> {entries.length}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-ink text-white" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.12)] px-4 py-3">
            <Bug className="h-5 w-5" />
            <span className="flex-1 text-sm font-bold">Erreurs JavaScript ({entries.length})</span>
            <button onClick={() => setOpen(false)} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(255,255,255,0.1)]">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 px-4 py-3">
            <button onClick={share} className="btn btn-light btn-sm"><Share2 /> Partager</button>
            <button onClick={copy} className="btn btn-glass btn-sm"><Copy /> {copied ? "Copié" : "Copier"}</button>
            <button onClick={clearDebug} className="btn btn-glass btn-sm"><Trash2 /> Effacer</button>
            <button
              onClick={() => {
                setOpen(false);
                setDebugEnabled(false);
              }}
              className="btn btn-glass btn-sm"
            >
              <Power /> Désactiver
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
            {entries.length === 0 && <p className="py-8 text-center text-sm text-[rgba(255,255,255,0.6)]">Aucune erreur capturée.</p>}
            {[...entries].reverse().map((e) => (
              <div key={e.id} className="rounded-xl bg-[rgba(255,255,255,0.06)] p-3 font-mono text-[11px] leading-relaxed">
                <div className="flex gap-2 text-[rgba(255,255,255,0.55)]">
                  <span>{e.at}</span>
                  <span className={e.kind === "console" ? "text-[#e9c27f]" : "text-[#ff8a7a]"}>{e.kind}</span>
                </div>
                <div className="mt-1 break-words text-white">{e.message}</div>
                {e.stack && <pre className="mt-1 whitespace-pre-wrap break-words text-[rgba(255,255,255,0.55)]">{e.stack}</pre>}
              </div>
            ))}
            <textarea
              readOnly
              value={report}
              aria-label="Rapport complet"
              className="mt-2 h-40 w-full rounded-xl bg-[rgba(255,255,255,0.06)] p-3 font-mono text-[11px] text-[rgba(255,255,255,0.8)]"
            />
          </div>
        </div>
      )}
    </>
  );
}
