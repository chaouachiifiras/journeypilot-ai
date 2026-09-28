import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type SessionUser = { id: string; is_anonymous?: boolean; email?: string } | null | undefined;

/** Ensures the user has a Supabase session (anonymous if not signed in) so RLS-scoped data works. */
export function useAnonSession() {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const applyUser = (u: SessionUser) => {
      if (!mounted) return;
      setUserId(u?.id ?? null);
      setIsAnonymous(u?.is_anonymous ?? true);
      setEmail(u?.email ?? null);
    };
    (async () => {
      const { data } = await supabase.auth.getSession();
      let user = data.session?.user;
      if (!user) {
        const { data: signIn, error } = await supabase.auth.signInAnonymously();
        if (error) console.error("anon sign-in failed", error);
        user = signIn.user ?? undefined;
      }
      applyUser(user);
      if (mounted) setReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") {
        // Keep the app usable after a sign-out: re-establish a fresh anonymous session.
        supabase.auth.signInAnonymously().then(({ data, error }) => {
          if (error) console.error("re-anon sign-in failed", error);
          applyUser(data.user);
        });
        return;
      }
      applyUser(s?.user);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { ready, userId, isAnonymous, email };
}
