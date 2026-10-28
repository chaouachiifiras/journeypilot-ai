import { Capacitor } from "@capacitor/core";

/**
 * In-app JavaScript error log for testing on iPhone without a Mac (no Safari
 * Web Inspector). Captures uncaught errors, unhandled promise rejections and
 * console.error calls into a small ring buffer that DebugConsole displays.
 *
 * Availability:
 *  - iOS app: capture always runs (cheap, in memory); the panel is hidden until
 *    enabled by tapping the header logo 7 times within 3 seconds.
 *  - Any platform: a build with VITE_DEBUG_CONSOLE=1 (e.g. a TestFlight test
 *    build) captures and shows the panel from launch.
 *  - Android / web production builds: nothing is installed.
 */

export type DebugEntry = {
  id: number;
  at: string;
  kind: "error" | "rejection" | "console";
  message: string;
  stack?: string;
};

const MAX_ENTRIES = 100;
const FLAG = "jp_debug_console";
const FORCED = import.meta.env.VITE_DEBUG_CONSOLE === "1";

let entries: DebugEntry[] = [];
let version = 0;
let seq = 0;
let installed = false;
let taps: number[] = [];
const listeners = new Set<() => void>();

export function debugAvailable(): boolean {
  return typeof window !== "undefined" && (FORCED || Capacitor.getPlatform() === "ios");
}

export function isDebugEnabled(): boolean {
  if (FORCED) return true;
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

export function setDebugEnabled(on: boolean) {
  try {
    if (on) localStorage.setItem(FLAG, "1");
    else localStorage.removeItem(FLAG);
  } catch {
    /* storage unavailable: stays in memory only */
  }
  emit();
}

/** Counts taps on the logo; returns the new state when 7 quick taps toggle it. */
export function registerSecretTap(): boolean | undefined {
  if (!debugAvailable() || FORCED) return undefined;
  const now = Date.now();
  taps = taps.filter((t) => now - t < 3000);
  taps.push(now);
  if (taps.length < 7) return undefined;
  taps = [];
  const next = !isDebugEnabled();
  setDebugEnabled(next);
  return next;
}

function emit() {
  version++;
  // Deferred: console.error can fire during a React render.
  setTimeout(() => listeners.forEach((l) => l()), 0);
}

function describe(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function push(kind: DebugEntry["kind"], message: string, stack?: string) {
  entries = [...entries, { id: ++seq, at: new Date().toISOString().slice(11, 23), kind, message, stack }].slice(-MAX_ENTRIES);
  emit();
}

export function installDebugCapture() {
  if (installed || !debugAvailable()) return;
  installed = true;

  window.addEventListener("error", (e) => {
    const err = e.error as Error | undefined;
    push("error", e.message || describe(err), err?.stack ?? (e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined));
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason as unknown;
    push("rejection", describe(reason), reason instanceof Error ? reason.stack : undefined);
  });
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const err = args.find((a): a is Error => a instanceof Error);
    push("console", args.map(describe).join(" "), err?.stack);
    original(...args);
  };
}

export function subscribeDebug(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const debugVersion = () => version;
export const debugEntries = () => entries;

export function clearDebug() {
  entries = [];
  emit();
}

/** Plain-text report to paste into a bug report or a message. */
export function debugReport(): string {
  const head = [
    `JourneyPilot debug report — ${new Date().toISOString()}`,
    `Platform: ${Capacitor.getPlatform()}`,
    `URL: ${window.location.href}`,
    `User agent: ${navigator.userAgent}`,
    `Screen: ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x`,
    "",
  ];
  const body = entries.map((e) => `[${e.at}] ${e.kind.toUpperCase()} ${e.message}${e.stack ? `\n${e.stack}` : ""}`);
  return [...head, ...(body.length ? body : ["(no errors captured)"])].join("\n");
}
