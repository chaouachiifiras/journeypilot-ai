import { Capacitor } from "@capacitor/core";

// Firebase Analytics, native app only (the website has no Firebase config). Feeds the
// Google Ads app campaigns: first_open is logged automatically by the SDK, the key
// in-app events below are imported as conversions.
// Fire-and-forget: a failed log must never break the flow it measures.
export function logEvent(name: string, params?: Record<string, string | number>) {
  if (!Capacitor.isNativePlatform()) return;
  import("@capacitor-firebase/analytics")
    .then(({ FirebaseAnalytics }) => FirebaseAnalytics.logEvent({ name, params }))
    .catch(() => {});
}
