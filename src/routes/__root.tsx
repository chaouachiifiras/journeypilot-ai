import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import "@/lib/i18n";
import i18n, { applyLangDir } from "@/lib/i18n";
import { completeNativeOAuth } from "@/lib/auth";
import { useAnonSession } from "@/lib/anon-session";
import { ensureRevenueCatIdentity } from "@/lib/revenuecat-identity";
// Travel Copilot entry point hidden for free launch; re-enable by mounting <FloatingCopilot /> (premium gate later).
// import { FloatingCopilot } from "@/components/copilot/FloatingCopilot";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display text-foreground">404</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          This journey took a wrong turn.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
        >
          Return home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-display">Something drifted off course</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "JourneyPilot AI — Craft your perfect trip with AI" },
      {
        name: "description",
        content:
          "AI-powered travel planning: personalized itineraries, hotels, restaurants, activities and photography spots — tailored to your budget and style.",
      },
      { property: "og:title", content: "JourneyPilot AI — Craft your perfect trip with AI" },
      {
        property: "og:description",
        content: "AI-powered travel planning: personalized itineraries, hotels, restaurants, activities and photography spots — tailored to your budget and style.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "JourneyPilot AI — Craft your perfect trip with AI" },
      { name: "twitter:description", content: "AI-powered travel planning: personalized itineraries, hotels, restaurants, activities and photography spots — tailored to your budget and style." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/86c52e33-984f-459c-a037-d871b271d244/id-preview-1c0d7d19--8bf2378e-ff6a-4ad8-ba8f-a0d9855c2faf.lovable.app-1784368461539.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/86c52e33-984f-459c-a037-d871b271d244/id-preview-1c0d7d19--8bf2378e-ff6a-4ad8-ba8f-a0d9855c2faf.lovable.app-1784368461539.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { ready, userId, isAnonymous } = useAnonSession();
  useEffect(() => {
    applyLangDir(i18n.language ?? "en");
  }, []);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = CapacitorApp.addListener("appUrlOpen", ({ url }) => {
      if (url.includes("auth-callback")) completeNativeOAuth(url);
    });
    return () => {
      sub.then((s) => s.remove());
    };
  }, []);
  // Only real (signed-in) accounts can ever create a trip or hold an entitlement — no need
  // to link an anonymous session's uid to RevenueCat.
  useEffect(() => {
    if (!ready || !userId || isAnonymous) return;
    ensureRevenueCatIdentity(userId);
  }, [ready, userId, isAnonymous]);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      {/* <FloatingCopilot /> — intentionally hidden; preserved for future Premium reactivation */}
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
