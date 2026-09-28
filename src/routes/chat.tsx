import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppHeader } from "@/components/layout/AppHeader";
import { useAnonSession } from "@/lib/anon-session";
import { createThread, listThreads } from "@/lib/chat.functions";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/chat")({
  component: ChatIndex,
});

function ChatIndex() {
  const { ready } = useAnonSession();
  const navigate = useNavigate();
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);

  const { data: threads } = useQuery({
    queryKey: ["threads"],
    enabled: ready,
    queryFn: () => list(),
  });

  useEffect(() => {
    if (!ready) return;
    if (threads === undefined) return;
    (async () => {
      if (threads.length > 0) {
        navigate({ to: "/chat/$threadId", params: { threadId: threads[0].id } });
      } else {
        const t = await create({ data: {} });
        navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
      }
    })();
  }, [ready, threads, create, navigate]);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <div className="mx-auto max-w-md px-6 py-32 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-copper" />
        <p className="mt-3 text-sm text-muted-foreground">Preparing your assistant…</p>
      </div>
    </div>
  );
}
