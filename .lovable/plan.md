## Plan

1. **Replace the root client redirect**
   - Change `src/routes/index.tsx` from rendering `<Navigate to="/dashboard" />` to rendering the actual start screen content.
   - Because the app is auth-first, the safest root screen will be the same sign-in page used by `/auth`, so `/` always has a real child match during hydration instead of a redirect-only shell.

2. **Remove the stale generated route edit risk**
   - Do not hand-edit `src/routeTree.gen.ts` again; let the router generator rebuild it from route files.
   - If needed, restart the dev server after changing route files so the generated tree and browser cache line up.

3. **Keep `/dashboard` protected**
   - Leave `_authenticated/route.tsx` as the auth gate for dashboard.
   - Signed-out users opening `/dashboard` should redirect to `/auth`; signed-in users should see the dashboard or empty vehicle state.

4. **Verify the actual preview signal**
   - Reload `/` and `/dashboard` in the preview.
   - Confirm the console no longer shows `Expected to find a match below the root match in SPA mode` and that the visible UI is the sign-in screen or dashboard, not the plain blue/green background.

## Why this should fix it

The current crash is not CSS anymore. The browser is still throwing TanStack Router’s SPA hydration invariant because it hydrates a route state with only the root match. A root route whose only job is an immediate client redirect can leave hydration without a concrete child match. Rendering a real root page avoids that root-only hydration state.