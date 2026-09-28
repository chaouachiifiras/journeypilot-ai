import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth-callback")({
  component: AuthCallbackBounce,
});

// Deliberately NOT a React effect: this page loads inside the device's
// system browser app (opened as a Custom Tab for native OAuth — see
// auth.ts), which on some devices is a meaningfully older/different JS
// engine than the packaged app's own WebView. It has choked on modern
// syntax (optional chaining etc.) elsewhere in the bundle, aborting the
// whole script before any React effect gets a chance to run. A raw inline
// script, written in plain ES5, is unaffected by that and executes as the
// browser parses this server-rendered HTML — independent of hydration.
const REDIRECT_SCRIPT =
  "window.location.replace('com.journeypilot.ai://auth-callback' + window.location.search);";

function AuthCallbackBounce() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <p className="text-muted-foreground">
        Reconnexion à JourneyPilot AI… Si rien ne se passe, retournez à l'application.
      </p>
      {/* eslint-disable-next-line react/no-danger */}
      <script dangerouslySetInnerHTML={{ __html: REDIRECT_SCRIPT }} />
    </div>
  );
}
