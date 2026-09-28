const REMEMBER_KEY = "jp_auth_remember";

type Storage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

/** Sets the user's "stay signed in" choice, read the next time a session is written. Defaults to true. */
export function setAuthRemember(remember: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  } catch {
    // ignore
  }
}

function getAuthRemember(): boolean {
  try {
    const v = localStorage.getItem(REMEMBER_KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

/**
 * Wraps the Supabase auth storage so a session is written to localStorage (survives
 * app/browser restarts) when "stay signed in" is on, or sessionStorage (cleared once
 * the app/tab is closed) when it's off. Falls back to the base storage untouched when
 * there's no window (SSR) or no base storage (e.g. outside a Lovable preview iframe).
 */
export function rememberableStorage(base: Storage | undefined): Storage | undefined {
  if (typeof window === "undefined" || !base) return base;

  return {
    getItem: async (key: string) => {
      const fromSession = sessionStorage.getItem(key);
      if (fromSession !== null) return fromSession;
      return base.getItem(key);
    },
    setItem: async (key: string, value: string) => {
      if (getAuthRemember()) {
        sessionStorage.removeItem(key);
        await base.setItem(key, value);
        return;
      }
      await base.removeItem(key);
      sessionStorage.setItem(key, value);
    },
    removeItem: async (key: string) => {
      sessionStorage.removeItem(key);
      await base.removeItem(key);
    },
  };
}
