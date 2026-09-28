import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import { Plus, Send, Trash2, MessageSquare, Sparkles, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { useAnonSession } from "@/lib/anon-session";
import { listThreads, createThread, deleteThread, listMessages, sendMessage } from "@/lib/chat.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/chat/$threadId")({
  component: ChatThread,
});

type Msg = { id: string; role: "user" | "assistant"; message: { content: string }; created_at: string };

function ChatThread() {
  const { threadId } = Route.useParams();
  const { ready } = useAnonSession();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const listT = useServerFn(listThreads);
  const createT = useServerFn(createThread);
  const delT = useServerFn(deleteThread);
  const listM = useServerFn(listMessages);
  const sendM = useServerFn(sendMessage);

  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: threads = [] } = useQuery({
    queryKey: ["threads"],
    enabled: ready,
    queryFn: () => listT(),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", threadId],
    enabled: ready && !!threadId,
    queryFn: () => listM({ data: { threadId } }) as Promise<Msg[]>,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId]);

  const onSend = async () => {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    setPending(true);

    // optimistic
    const optimistic: Msg = {
      id: "tmp-" + Date.now(),
      role: "user",
      message: { content: text },
      created_at: new Date().toISOString(),
    };
    qc.setQueryData<Msg[]>(["messages", threadId], (old = []) => [...old, optimistic]);

    try {
      await sendM({ data: { threadId, content: text } });
      await qc.invalidateQueries({ queryKey: ["messages", threadId] });
      await qc.invalidateQueries({ queryKey: ["threads"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  };

  const onNew = async () => {
    const t = await createT({ data: {} });
    await qc.invalidateQueries({ queryKey: ["threads"] });
    navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
  };

  const onDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    await delT({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["threads"] });
    if (id === threadId) {
      navigate({ to: "/chat" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <div className="mx-auto flex flex-1 w-full max-w-6xl gap-6 px-4 md:px-6 py-6">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 flex-col rounded-2xl border border-border bg-card p-3">
          <button
            onClick={onNew}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
          >
            <Plus className="h-4 w-4" /> {t("chat.new")}
          </button>
          <div className="mt-3 flex-1 overflow-y-auto space-y-1">
            {threads.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                {t("chat.no_threads")}
              </p>
            )}
            {threads.map((th) => {
              const active = th.id === threadId;
              return (
                <div
                  key={th.id}
                  onClick={() => navigate({ to: "/chat/$threadId", params: { threadId: th.id } })}
                  className={cn(
                    "group relative flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    active ? "bg-secondary text-foreground" : "hover:bg-secondary/60 text-muted-foreground",
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{th.title}</span>
                  <button
                    onClick={(e) => onDelete(th.id, e)}
                    className="opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Chat surface */}
        <main className="flex flex-1 flex-col rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-emerald">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">{t("chat.title")}</div>
                <div className="text-xs text-muted-foreground">JourneyPilot AI</div>
              </div>
            </div>
            <button
              onClick={onNew}
              className="md:hidden inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
            >
              <Plus className="h-3 w-3" /> {t("chat.new")}
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 min-h-[400px] max-h-[calc(100vh-260px)]">
            {messages.length === 0 && !pending && (
              <div className="mx-auto max-w-md text-center py-16">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-copper">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display text-2xl">{t("chat.empty_title")}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t("chat.empty_sub")}</p>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "mb-4 flex",
                    m.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground",
                    )}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none prose-p:my-2 prose-headings:font-display prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary prose-li:my-0.5">
                        <ReactMarkdown>{m.message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      m.message.content
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {pending && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("chat.thinking")}
              </motion.div>
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 focus-within:border-primary transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                placeholder={t("chat.placeholder")}
                rows={1}
                className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none max-h-32"
              />
              <button
                onClick={onSend}
                disabled={pending || !input.trim()}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40 transition-opacity hover:opacity-90"
                aria-label={t("chat.send")}
              >
                <Send className="h-4 w-4 rtl:rotate-180" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
