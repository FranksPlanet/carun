
# RunningCost — Build Plan

A mobile-first, installable PWA car expense tracker. Multi-user from day one with strict row-level isolation. Czech defaults (CZK, km, l) on an i18n-ready foundation. Dark "instrument cluster" theme.

## 1. Foundations

- Enable **Lovable Cloud** (auth + Postgres + storage + edge AI).
- Enable auth providers: **Email/password, Google, Apple**.
- Provision `LOVABLE_API_KEY` for the AI Gateway (receipt OCR).
- TanStack Start routing under `src/routes/` (already scaffolded).
- Add Recharts for all charts; framer-motion for subtle transitions.
- Fonts: Oswald (display), Inter (body), IBM Plex Mono (numbers, tabular-nums).

## 2. Design system (`src/styles.css`)

Semantic tokens in oklch — never hardcoded hex in components:

- `--background` #0E1419, `--card/panel` #18222B, `--border` #2C3B47
- `--foreground` #E6EDF2, `--muted-foreground` #8499A8
- `--primary` (amber) #F2A33C, `--secondary` (teal) #4FD1C5
- `--accent` (violet) #9D8DF1, `--destructive/warning` #E5654B
- Utility classes: `.kpi-card`, `.kpi-hero` (amber left edge), `.est` (dashed border + hatched SVG bg), `.num` (mono tabular).

## 3. Data model (Postgres, RLS-isolated per `auth.uid()`)

All money stored as integer minor units + ISO currency; km and liters stored canonically.

- `profiles` (user_id PK, currency default 'CZK', distance_unit 'km', volume_unit 'l', consumption_style 'l_per_100km', locale 'en').
- `vehicles` (id, user_id, name, plate, fuel_type enum, purchase_date, purchase_odometer_km, purchase_price_minor, currency).
- `expenses` (id, user_id, vehicle_id, date, odometer_km, category enum [fuel|service|admin|other], amount_minor, liters numeric, full_tank bool, tags text[], note, receipt_url).
- `past_repairs` (id, user_id, vehicle_id, label, amount_minor, date_precision enum [exact|month|season|year], year, month, season, representative_date).
- `recurring_costs` (id, user_id, vehicle_id, type enum, amount_minor_per_year).
- `reminders` (id, user_id, vehicle_id, type, due_date, due_odometer_km, note).

RLS on every table: `user_id = auth.uid()` for select/insert/update/delete. `GRANT` blocks for `authenticated` + `service_role`. Storage bucket `receipts` (private), policy scoped to `auth.uid()` folder prefix.

A trigger on `auth.users` insert creates an empty `profiles` row.

## 4. Units & i18n layer (`src/lib/format.ts`, `src/lib/strings.ts`)

- `format.ts`: `formatMoney`, `formatDistance`, `formatVolume`, `formatConsumption`, `parseMoney`, etc. Reads user profile settings; converts canonical → display and input → canonical. Czech defaults: space thousands sep, "Kč" suffix.
- `strings.ts`: all UI copy keyed in one English dictionary. No hardcoded sentences in components. Ready for a second language to plug in later.

## 5. Server functions (`src/lib/*.functions.ts`)

All gated by `requireSupabaseAuth`. Pure CRUD + a few computed endpoints:
- `vehicles.functions.ts`: list, create, update, delete.
- `expenses.functions.ts`: list (by vehicle), create, update, delete, exportCsv.
- `repairs.functions.ts`, `recurring.functions.ts`, `reminders.functions.ts`.
- `profile.functions.ts`: get/update settings.
- `ocr.functions.ts`: accept image (base64 / signed storage URL) → Lovable AI Gateway (`google/gemini-3-flash-preview` with vision) with a Czech-receipt prompt → returns `{date, total, liters, category, station}` JSON. Never auto-saves; never exposes the key client-side.

## 6. Calculation engine (`src/lib/calc.ts`, pure & unit-tested in head)

Runs client-side on loaded expenses (canonical units):
- `trackedKm`, `costPerKm`, per-category `Kč/km`.
- `consumptionPoints`: between consecutive full-tank fills, ignoring partials.
- `spikeDetect`: baseline = avg of up to prior 5; flag > +15%.
- `segmentedAverages`: clean vs loaded (tag-aware).
- `pricePerLiter` series.
- `backfill`: gap-km × variable per-km rate + recurring × gap-years + remembered repairs. Returns `{ value, isEstimate: true }` so UI can hatch it.
- `lifetimeCostSoFar`.
- `projection(annualKm, fuelPrice, horizonYears)`: cumulative TCO + fuel-only series + crossover year vs purchase price.

## 7. Routes

```
src/routes/
  __root.tsx              — shell, providers, onAuthStateChange wiring, PWA registration
  index.tsx               — landing/redirect (→ /auth or /dashboard)
  auth.tsx                — email + Google + Apple
  _authenticated/
    route.tsx             — managed gate (ssr:false)
    dashboard.tsx         — KPIs, donut, cumulative area, estimated-history panel, reminders
    expenses.tsx          — list + add + scan receipt
    fuel.tsx              — consumption + price charts, spikes, segmented avgs
    projection.tsx        — sliders + TCO chart
    garage.tsx            — vehicle/recurring/repairs/reminders mgmt
    onboarding.tsx        — 5-step wizard (first run + "Add vehicle")
    settings.tsx          — currency/units/consumption style
```

Top tab nav (mobile bottom bar on small screens, top tabs on desktop) inside `_authenticated/route.tsx`, with a vehicle switcher chip row in the header.

## 8. Onboarding wizard

5 steps with framing line "Rough answers are fine — estimates sharpen as you log real data." Steps: basics → purchase → past repairs (repeatable, with fuzzy-date input component: exact / month+year / season+year / year) → recurring yearly costs → done. Triggered automatically when the user has zero vehicles, and from a "+ Add vehicle" button.

## 9. Receipt scanning

`Scan receipt` button → camera/file input → upload to `receipts` storage → call `ocr.functions.ts` → prefill the expense form in a dialog. User reviews + confirms (or edits / discards). On failure: friendly toast + open blank form.

## 10. PWA & offline

- `public/manifest.webmanifest`: name "RunningCost", short_name "RunningCost", display standalone, theme_color #0E1419, background_color #0E1419, 192/512 icons (generate amber-on-dark gauge mark).
- Apple touch icon + meta tags in `__root.tsx` head.
- `vite-plugin-pwa` (generateSW, autoUpdate) with guarded registration wrapper that refuses to register in Lovable preview/dev/iframe (per PWA skill).
- Workbox: NetworkFirst for navigations; CacheFirst for hashed assets.
- **Offline write queue**: a small IndexedDB outbox (`idb-keyval`); when offline, `createExpense` writes to the outbox and shows a "Queued" badge. On reconnect, a sync hook drains the outbox via the server fn. Reads use TanStack Query cache so previously seen vehicles/expenses remain viewable offline.

## 11. Estimates UX rule

Every estimated number (backfill cells, default 7.5 l/100km until measured, projection outputs) renders with the `.est` class (dashed border + hatched SVG background) and an `"≈ est"` chip. Real logged data never gets that treatment.

## 12. Polish

- Empty states with the exact one-line guidance from the brief.
- Destructive deletes use AlertDialog confirmations.
- All copy real and concise; no lorem ipsum.
- Reminder alerts surface on Dashboard when within ~2 months or ~1,000 km.

## 13. Order of implementation

1. Cloud + auth providers + profile/settings tables + RLS.
2. Design tokens, fonts, layout shell, tab nav, vehicle switcher.
3. Vehicles + expenses CRUD + onboarding wizard.
4. Calc engine + Dashboard + Fuel screen with Recharts.
5. Projection screen with sliders.
6. Garage screen (recurring, repairs with fuzzy date, reminders).
7. Receipt scanning (storage bucket + AI server fn + prefill dialog).
8. PWA manifest + service worker + offline outbox.
9. Settings screen (currency/units/consumption style, live re-format).
10. CSV export, final polish, empty states, copy pass.

## Technical notes

- All AI calls go through a server fn using the `ai-sdk-lovable-gateway` helper; key stays server-side.
- Money stored as integer minor units to avoid float drift; `formatMoney` handles display.
- `Route.useLoaderData()` avoided; default read shape is `ensureQueryData` + `useSuspenseQuery`.
- Apple sign-in requires `supabase--configure_social_auth` call alongside Google.
- Storage bucket `receipts` is private; signed URLs only.
- Sign-out hygiene: cancel queries, clear cache, signOut, navigate replace to `/auth`.
