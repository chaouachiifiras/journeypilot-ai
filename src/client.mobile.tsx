import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import { getRouter } from "./router";
import { startInstance } from "./start";

const mount = document.getElementById("root");

if (!mount) {
  throw new Error("JourneyPilot mobile root element was not found.");
}

const startOptions = await startInstance.getOptions();
Object.assign(window, { __TSS_START_OPTIONS__: startOptions });

const router = getRouter();

// In the Capacitor WebView the app is pure client-rendered inside #root.
// The default root shell renders <html>/<head>/<body>, which React treats as
// document singletons: every commit re-scans the document's comment-node
// hydration markers, which never resolve here and lock up the UI on any
// interaction. Render the app body only — the static index.html already
// provides the document, stylesheet and font links.
const rootRoute = router.routesById["__root__"] as
  | { options: { shellComponent?: (props: { children: ReactNode }) => ReactNode } }
  | undefined;
if (rootRoute) {
  rootRoute.options.shellComponent = ({ children }) => <>{children}</>;
}

createRoot(mount).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
