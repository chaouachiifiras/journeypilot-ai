import { useSyncExternalStore } from "react";

/**
 * Image URLs that failed to load in this session (e.g. an expired Google photo
 * link answering 403). Shared app-wide so a card, its detail view and the trip
 * cover all fall back together instead of showing a broken-image icon.
 */
const broken = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

export function markImageBroken(url: string) {
  if (broken.has(url)) return;
  broken.add(url);
  version++;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-renders when any image breaks; returns a checker for the current state. */
export function useBrokenImages() {
  useSyncExternalStore(subscribe, () => version, () => version);
  return (url: string | null | undefined) => !!url && broken.has(url);
}
