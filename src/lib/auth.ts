import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { setAuthRemember } from "@/integrations/supabase/rememberableStorage";

// GoTrue's redirect allow-list only accepts HTTPS URLs on this app's own
// domain, not a custom scheme — /auth-callback is a bounce page that hands
// the result off to com.journeypilot.ai://auth-callback (see routes/auth-callback.tsx).
const NATIVE_REDIRECT = "https://personal-trip-creator.lovable.app/auth-callback";

/** Signs up (or upgrades the current anonymous session) with email + password. */
export async function signUpWithPassword(email: string, password: string) {
  setAuthRemember(true);
  const { data: sessionData } = await supabase.auth.getSession();
  const anon = sessionData.session?.user.is_anonymous ?? false;

  const { data, error } = anon
    ? await supabase.auth.updateUser({ email, password })
    : await supabase.auth.signUp({ email, password });

  if (error) throw error;
  const needsEmailConfirmation = anon ? !data.user?.email_confirmed_at : !("session" in data && data.session);
  return { needsEmailConfirmation };
}

/** Logs into an existing account. Replaces the current (guest or other) session. */
export async function signInWithPassword(email: string, password: string, remember = true) {
  setAuthRemember(remember);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  window.location.assign("/profile");
}

/** Starts the Google OAuth flow, upgrading the anonymous session in place when possible. */
export async function signInWithGoogle() {
  setAuthRemember(true);
  const native = Capacitor.isNativePlatform();
  const { data: sessionData } = await supabase.auth.getSession();
  const anon = sessionData.session?.user.is_anonymous ?? false;
  const redirectTo = native ? NATIVE_REDIRECT : `${window.location.origin}/profile`;
  const options = { redirectTo, skipBrowserRedirect: native };

  let result = anon
    ? await supabase.auth.linkIdentity({ provider: "google", options })
    : await supabase.auth.signInWithOAuth({ provider: "google", options });

  // linkIdentity() upgrades the guest session in place, keeping its trips —
  // but it requires "Allow manual linking" enabled on the Supabase project,
  // which isn't always on. Both failure modes (identity already tied to a
  // real account, or manual linking disabled outright) fall back to a plain
  // sign-in; guest trips just won't carry over in that case.
  const shouldFallBack =
    anon &&
    (result.error?.code === "identity_already_exists" ||
      result.error?.code === "manual_linking_disabled" ||
      /manual linking/i.test(result.error?.message ?? ""));

  if (shouldFallBack) {
    toast.warning("Signing you into your Google account — guest trips won't transfer.");
    result = await supabase.auth.signInWithOAuth({ provider: "google", options });
  }

  if (result.error) throw result.error;
  if (native && result.data.url) await Browser.open({ url: result.data.url });
  // On web, Supabase already navigated the page to the provider — nothing else to do.
}

/** Completes the native OAuth round trip once the app is reopened via the auth-callback deep link. */
export async function completeNativeOAuth(url: string) {
  const code = new URL(url).searchParams.get("code");
  if (!code) return;
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  await Browser.close().catch(() => {});
  if (error) {
    toast.error(error.message);
    return;
  }
  window.location.assign("/profile");
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.assign("/");
}
