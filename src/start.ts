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
      const isCapacitor =
        typeof window !== "undefined" &&
        window.location.protocol === "https:" &&
        window.location.hostname === "localhost";
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
