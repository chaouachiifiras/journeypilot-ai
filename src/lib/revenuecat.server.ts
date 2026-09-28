const REVENUECAT_API_BASE = "https://api.revenuecat.com/v1";
const PREMIUM_ENTITLEMENT_ID = "premium";

/** Live check against RevenueCat — no local caching, so cancellations/expirations take effect immediately. */
export async function hasActivePremiumEntitlement(appUserId: string): Promise<boolean> {
  const secretKey = process.env.REVENUECAT_SECRET_API_KEY;
  if (!secretKey) throw new Error("Missing REVENUECAT_SECRET_API_KEY");

  const res = await fetch(`${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`RevenueCat API error: ${res.status}`);

  const body = (await res.json()) as {
    subscriber?: { entitlements?: Record<string, { expires_date: string | null }> };
  };
  const entitlement = body.subscriber?.entitlements?.[PREMIUM_ENTITLEMENT_ID];
  if (!entitlement) return false;
  return !entitlement.expires_date || new Date(entitlement.expires_date).getTime() > Date.now();
}
