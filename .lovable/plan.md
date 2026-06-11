# What you should be seeing

After signing in, the **Dashboard** at `/dashboard` — vehicle chips, four KPI cards (cost/km, tracked distance, avg consumption, total logged), and two charts (cost split pie, cumulative spend area). With no vehicles yet, an empty state pointing to onboarding.

Right now you're staring at a blank dark screen because of a runtime crash, not styling:

```
Invariant failed: Expected to find a match below the root match in SPA mode.
```

## Root cause

`src/routes/index.tsx` is a *match-less* route — it only has `beforeLoad` that throws `redirect({ to: "/dashboard" })`, no `component`. TanStack Start's SPA hydration walks the matched route tree and expects a leaf match under root; an index route that never renders trips the invariant during client hydration, so the whole tree fails and you get the bare background color.

## Plan

1. **Fix `src/routes/index.tsx`** so it always resolves to a real component:
   - Keep the auth check, but render a tiny `component` (e.g. a centered "Loading…") instead of relying solely on `beforeLoad` throwing.
   - Do the redirect inside the component via `useNavigate` / `Navigate`, or set `component: () => <Navigate to="/dashboard" />`. That gives hydration a match to mount.

2. **Verify the auth gate path.** `_authenticated/route.tsx` already redirects unauthenticated users to `/auth`, so `/` → `/dashboard` → `/auth` will work for signed-out users; signed-in users land on the dashboard.

3. **Sanity check after the fix:**
   - Reload `/` — should bounce to `/auth` (you're not signed in yet).
   - Sign up via email, then land on `/dashboard` with the "Welcome to RunningCost / Add vehicle" empty state.

No other routes need to change for this fix. Scaffolded screens (expenses, fuel, projection, garage, onboarding, settings) are referenced in the nav but were not generated yet — that's a separate follow-up once you can actually see the app.

## Follow-up after you can see the dashboard

Want me to also generate the remaining route files in the same pass (onboarding wizard, expenses list+form with OCR, fuel log, projection, garage, settings), or fix the blank screen first and you decide what to build next?
