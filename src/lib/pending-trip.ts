// A trip the user filled in before signing in. Login reloads the page (OAuth round trip,
// password sign-in), so the form is kept here and the planner generates it on return.
const KEY = "jp_pending_trip";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function savePendingTrip(payload: unknown) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ payload, savedAt: Date.now() }));
  } catch {
    // Storage unavailable: the user will simply have to fill the form again.
  }
}

/** Returns the pending trip if one was saved in the last 24 hours. */
export function readPendingTrip<T>(): T | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { payload, savedAt } = JSON.parse(raw) as { payload: T; savedAt: number };
    if (Date.now() - savedAt > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function clearPendingTrip() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Where to land after a sign-in: back to the planner when a trip is waiting to be generated. */
export function postLoginPath() {
  return readPendingTrip() ? "/planner" : "/profile";
}
