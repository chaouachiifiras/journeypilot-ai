import { Capacitor, registerPlugin } from "@capacitor/core";

// Local Android plugin (android/app/src/main/java/com/journeypilot/ai/MetaEventsPlugin.java)
// forwarding funnel events to Meta App Events for the Meta app-install campaign.
const MetaEvents = registerPlugin<{
  logEvent(options: { name: string; params?: Record<string, string | number> }): Promise<void>;
}>("MetaEvents");

// Firebase Analytics + Meta App Events, native app only (the website has no Firebase config).
// Feeds the Google Ads and Meta app campaigns: installs/first_open are logged automatically
// by the SDKs, the key in-app events below are imported as conversions.
// Fire-and-forget: a failed log must never break the flow it measures.
export function logEvent(name: string, params?: Record<string, string | number>) {
  if (!Capacitor.isNativePlatform()) return;
  import("@capacitor-firebase/analytics")
    .then(({ FirebaseAnalytics }) => FirebaseAnalytics.logEvent({ name, params }))
    .catch(() => {});
  if (Capacitor.getPlatform() === "android") {
    MetaEvents.logEvent({ name, params }).catch(() => {});
  }
}
