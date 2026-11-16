// Native (Capacitor) trip features: share sheet, add the trip to the device
// calendar, and an on-device copy of the user's trips for offline viewing.
// Everything here is a no-op or falls back gracefully on the web.
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { CapacitorCalendar } from "@ebarooni/capacitor-calendar";
import type { TFunction } from "i18next";

export const isNative = () => Capacitor.isNativePlatform();
export const isIOS = () => Capacitor.getPlatform() === "ios";

const SLOTS = ["morning", "lunch", "afternoon", "sunset", "dinner", "night"] as const;

type SlotLike = { name?: string; desc?: string } | string | undefined;
export type ShareableDay = {
  day: number;
  title: string;
  evening?: SlotLike;
} & Partial<Record<(typeof SLOTS)[number], SlotLike>>;

export type ShareableTrip = {
  city: string;
  country: string;
  days: number;
  itinerary?: ShareableDay[];
};

function slotLine(raw: SlotLike): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return raw.trim() || null;
  return (raw.name || raw.desc || "").trim() || null;
}

/** The stops of one day as "Morning: X" lines, in visiting order. */
function dayLines(d: ShareableDay, t: TFunction): string[] {
  const out: string[] = [];
  for (const slot of SLOTS) {
    const raw = d[slot] ?? (slot === "afternoon" ? d.evening : undefined);
    const line = slotLine(raw);
    if (line) out.push(`${t(`trip.slots.${slot}`)}: ${line}`);
  }
  return out;
}

/** Plain-text version of the trip, readable in Messages, Mail, Notes or WhatsApp. */
export function tripAsText(
  trip: ShareableTrip,
  t: TFunction,
  dayTitle: (d: ShareableDay) => string,
): string {
  const parts = [`${trip.city}, ${trip.country} · ${t("trip.days_count", { count: trip.days })}`];
  for (const d of trip.itinerary ?? []) {
    parts.push(
      "",
      `${t("trip.day")} ${d.day} — ${dayTitle(d)}`,
      ...dayLines(d, t).map((l) => `• ${l}`),
    );
  }
  parts.push("", t("native.shared_with"));
  return parts.join("\n");
}

/** Opens the system share sheet (UIActivityViewController on iOS). */
export async function shareTrip(
  trip: ShareableTrip,
  t: TFunction,
  dayTitle: (d: ShareableDay) => string,
) {
  const text = tripAsText(trip, t, dayTitle);
  const title = `${trip.city} — JourneyPilot AI`;
  if (isNative()) {
    await Share.share({ title, text, dialogTitle: t("native.share_trip") });
    return;
  }
  if (typeof navigator !== "undefined" && navigator.share) {
    await navigator.share({ title, text });
    return;
  }
  await navigator.clipboard?.writeText(text);
}

export class CalendarPermissionError extends Error {}

/**
 * Adds one all-day event per itinerary day to the default calendar, starting
 * on `start` (local date). Asks for write-only calendar access first (iOS 17+:
 * the app can add events but never reads the user's calendar).
 */
export async function addTripToCalendar(
  trip: ShareableTrip,
  start: Date,
  t: TFunction,
  dayTitle: (d: ShareableDay) => string,
): Promise<number> {
  const { result } = await CapacitorCalendar.requestWriteOnlyCalendarAccess();
  if (result !== "granted") throw new CalendarPermissionError("calendar access denied");

  let added = 0;
  for (const d of trip.itinerary ?? []) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (d.day - 1));
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    await CapacitorCalendar.createEvent({
      title: `${trip.city} · ${t("trip.day")} ${d.day} — ${dayTitle(d)}`,
      location: `${trip.city}, ${trip.country}`,
      description: [...dayLines(d, t), "", "JourneyPilot AI"].join("\n"),
      startDate: day.getTime(),
      endDate: next.getTime(),
      isAllDay: true,
    });
    added++;
  }
  return added;
}

/* ------------------------------------------------------------------ */
/* Offline copy                                                        */
/* ------------------------------------------------------------------ */
// The packaged app ships its own UI, so with these copies a trip the user has
// already opened stays readable without a connection (itinerary, budget, tips).
// Only kept on the device, cleared on sign-out (see clearOfflineTrips).

const PREFIX = "jp:offline:";

function read<T>(key: string): T | undefined {
  if (!isNative()) return undefined;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown) {
  if (!isNative()) return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable: offline copy is best effort */
  }
}

export const offlineTrips = {
  getTrip: <T>(id: string) => read<T>(`trip:${id}`),
  saveTrip: (id: string, value: unknown) => write(`trip:${id}`, value),
  getSkeleton: <T>(id: string) => read<T>(`skeleton:${id}`),
  saveSkeleton: (id: string, value: unknown) => write(`skeleton:${id}`, value),
  getList: <T>() => read<T>("list"),
  saveList: (value: unknown) => write("list", value),
};

export function clearOfflineTrips() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

/** True while the device reports no network connection. */
export function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}
