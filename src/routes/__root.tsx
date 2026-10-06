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
import { Compass, CloudOff } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import "@/lib/i18n";
import i18n, { applyLangDir } from "@/lib/i18n";
import { completeNativeOAuth } from "@/lib/auth";
import { useAnonSession } from "@/lib/anon-session";
import { ensureRevenueCatIdentity } from "@/lib/revenuecat-identity";
import { installDebugCapture } from "@/lib/debug-console";
import { DebugConsole } from "@/components/dev/DebugConsole";

// iOS / test builds only (no-op elsewhere): start recording JS errors as early as possible.
if (typeof window !== "undefined") installDebugCapture();
// Travel Copilot entry point hidden for free launch; re-enable by mounting <FloatingCopilot /> (premium gate later).
// import { FloatingCopilot } from "@/components/copilot/FloatingCopilot";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Compass className="h-7 w-7" />
        </div>
        <h1 className="mt-6 display-lg">404</h1>
        <p className="mt-3 text-muted-foreground">This journey took a wrong turn.</p>
        <Link to="/" className="btn btn-primary mt-8">
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
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive-soft text-destructive">
          <CloudOff className="h-7 w-7" />
        </div>
        <h1 className="mt-6 title-md">Something drifted off course</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="btn btn-primary mt-8"
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
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#f6f2ea" },
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
        href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@500;600;700&display=swap",
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
      <DebugConsole />
      <Toaster position="top-center" richColors toastOptions={{ style: { borderRadius: 16, fontFamily: "var(--font-body)" } }} />
    </QueryClientProvider>
  );
}
