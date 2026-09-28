# Fix Capacitor static bootstrap

## Finding
The generated mobile `index.html` contains only an empty `#root` element and TanStack Start's normal client entry. That entry always calls `hydrateRoot(document, <StartClient />)`. `StartClient` then runs router SSR hydration, which requires server-injected `window.$_TSR` bootstrap data. A static Capacitor page has no server-rendered document or bootstrap payload, so `@tanstack/router-core/src/ssr/ssr-client.ts` reaches its production-only bare `invariant()` at the missing `window.$_TSR` check.

## Implementation
- Add a dedicated Capacitor client entry that creates the existing router and mounts it with React `createRoot` and `RouterProvider`, bypassing SSR hydration only for the mobile bundle.
- Keep the standard TanStack Start client entry and SSR hydration unchanged for normal web preview and publishing.
- Add a mobile-specific Vite configuration that reuses the project configuration but selects the Capacitor client entry and supplies the deployed web origin for server-function requests.
- Update `build:mobile` to invoke the mobile build mode/config, then generate the static shell and sync Android as before.
- Update the static index generator to use the selected client entry assets while retaining cross-platform `.output`/`dist` discovery.

## Validation
- Build the normal web app and confirm SSR remains healthy.
- Run `bun run build:mobile` and confirm Android sync succeeds.
- Load the generated static mobile page in Chromium at a localhost-equivalent origin and confirm JourneyPilot renders without `window.$_TSR` or hydration invariant errors.
- Verify mobile server-function URLs target the published JourneyPilot origin rather than the WebView's local origin.
