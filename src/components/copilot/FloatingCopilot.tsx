import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { askCopilot } from "@/lib/copilot.functions";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What should I do right now?",
  "Best spot for sunset photos?",
  "Nearby hidden gems?",
  "Weather-friendly plan?",
];

export function FloatingCopilot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const ask = useServerFn(askCopilot);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" });
  }, [msgs, busy]);

  async function send(q?: string) {
    const text = (q ?? input).trim();
    if (!text || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const res = await ask({
        data: {
          question: text,
          context: { currentTime: new Date().toLocaleString() },
        },
      });
      setMsgs((m) => [...m, { role: "assistant", content: res.text }]);
    } catch (e) {
      setMsgs((m) => [
        ...m,
        { role: "assistant", content: "I couldn't reach the skies right now. Try again in a moment." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.6, type: "spring", stiffness: 260, damping: 20 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Open AI Copilot"
        className={cn(
          "fixed bottom-5 end-5 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lift transition-all",
          "bg-gradient-copper text-primary-foreground",
          open && "rotate-90",
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
        {!open && (
          <span className="absolute inset-0 -z-10 rounded-full bg-copper animate-ping opacity-20" />
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed bottom-24 end-5 z-50 w-[calc(100vw-2.5rem)] max-w-sm rounded-3xl border border-border bg-background/95 backdrop-blur-2xl shadow-lift overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-border/60 bg-gradient-emerald/10 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-copper">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-sm leading-tight">Travel Copilot</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Live · AI</div>
              </div>
            </div>

            <div ref={scrollRef} className="max-h-80 overflow-y-auto px-4 py-3 space-y-3">
              {msgs.length === 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Ask me anything about your trip.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-secondary transition"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {msgs.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "ms-6 bg-primary text-primary-foreground"
                      : "me-6 bg-secondary text-secondary-foreground",
                  )}
                >
                  {m.content}
                </motion.div>
              ))}
              {busy && (
                <div className="me-6 inline-flex items-center gap-2 rounded-2xl bg-secondary px-3.5 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2 border-t border-border/60 p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your copilot…"
                className="flex-1 rounded-full border border-border bg-card px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-copper text-primary-foreground disabled:opacity-40"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
