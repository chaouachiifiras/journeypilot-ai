import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  serverFns: {
    fetch: (url, init) => {
      // Packaged app: Android serves the bundle from https://localhost,
      // iOS from capacitor://localhost (WKWebView cannot use https:// there).
      const isCapacitor =
        typeof window !== "undefined" &&
        window.location.hostname === "localhost" &&
        (window.location.protocol === "https:" || window.location.protocol === "capacitor:");
      let target = url;
      if (isCapacitor) {
        const origin = "https://personal-trip-creator.lovable.app";
        target =
          typeof Request !== "undefined" && url instanceof Request
            ? new Request(new URL(url.url, origin), url)
            : new URL(url.toString(), origin);
      }
      return fetch(target, init);
    },
  },
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
