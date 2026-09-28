import { Capacitor } from "@capacitor/core";

let configured = false;

/**
 * Native-only: links the RevenueCat identity to this Supabase user so server-side entitlement
 * checks can key off auth.uid(). The SDK is imported lazily (only reached on an actual Android
 * device) so neither the SSR runtime nor the web build ever resolves `@revenuecat/purchases-capacitor`.
 */
export async function ensureRevenueCatIdentity(appUserId: string) {
  if (!Capacitor.isNativePlatform()) return;
  const apiKey = import.meta.env.VITE_REVENUECAT_ANDROID_SDK_KEY;
  if (!apiKey) {
    console.error("[RevenueCat] Missing VITE_REVENUECAT_ANDROID_SDK_KEY");
    return;
  }
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  if (!configured) {
    await Purchases.configure({ apiKey, appUserID: appUserId });
    configured = true;
  } else {
    await Purchases.logIn({ appUserID: appUserId });
  }
}
