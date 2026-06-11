## Scope

Build only the onboarding wizard, the vehicle-creation persistence, and a real Dashboard that reads from the database. Do **not** create the expenses / fuel / projection / garage / settings pages — their nav items stay and continue to 404 for now (expected).

## 1. Database migration

Existing tables (`vehicles`, `past_repairs`, `recurring_costs`) already have RLS scoped to `auth.uid() = user_id`, so they're reused.

One small addition needed on `vehicles` to support the "current odometer" captured in step 1 of the wizard:

- Add column `vehicles.current_odometer_km integer not null default 0`.

No other schema changes; `past_repairs` already has the fuzzy-date columns (`precision`, `exact_date`, `season`, `month`, `year`, `representative_date`).

## 2. `/onboarding` route — 5-step wizard

File: `src/routes/_authenticated/onboarding.tsx` (replace current single-form version with a real 5-step wizard).

Local component state holds the in-progress draft; nothing is written to the DB until step 5 "Finish".

Steps (titles come from `t.onboarding.*`):

1. **Vehicle basics** — name, plate (optional), fuel type select (Diesel / Petrol / LPG / Hybrid / Electric), current odometer (km).
2. **When you got it** — purchase date (date picker), odometer at purchase, purchase price + currency (default CZK).
3. **Big repairs you remember** — repeatable list. Each entry: label, amount, and a fuzzy date with a precision selector:
   - `exact` → date picker
   - `month` → month + year
   - `season` → season (spring/summer/autumn/winter) + year
   - `year` → year only

   Compute a `representative_date` (e.g. midpoint of the chosen precision) for sorting. Skippable.
4. **Yearly costs** — repeatable list of `{type, amount/year}` using the existing `recurring_costs.type` enum (insurance / road_tax / inspection / parking / other). Skippable.
5. **You're set** — summary + Finish button.

Navigation: Back / Next on each step, Skip on 3 & 4, Finish on 5. Uses `useNavigate` to go to `/dashboard` after a successful save.

### Persistence on Finish

Single async submit in order:

1. `createVehicle` (extended to accept `current_odometer_km`) → returns `vehicle.id`.
2. For each remembered repair → `createPastRepair({ vehicle_id, ... })`.
3. For each yearly cost → `createRecurring({ vehicle_id, type, amount_minor_per_year, currency })`.
4. Invalidate `['vehicles']` query, navigate to `/dashboard`.

If any insert fails, show the error inline and keep the wizard open (vehicle row already created is fine — user lands on dashboard with partial data on retry).

## 3. Server functions

- `src/lib/vehicles.functions.ts` — extend `CreateVehicleSchema` and `UpdateVehicleSchema` with `current_odometer_km` (int ≥ 0).
- `src/lib/repairs.functions.ts` — add `createPastRepair` (if not present) matching the existing schema (label, amount_minor, currency, precision, exact_date / season / month / year, representative_date, vehicle_id).
- `src/lib/recurring.functions.ts` — already has `createRecurring`. Reuse.

All gated by `requireSupabaseAuth`; `user_id` set from `context.userId`. RLS already restricts reads to owner.

## 4. Dashboard — make it real

File: `src/routes/_authenticated/dashboard.tsx`.

- Already calls `listVehicles` via `useServerFn` + `useQuery`. Keep that.
- Empty state ("No vehicles yet" + Add vehicle CTA → `/onboarding`) only when `vehiclesQ.isSuccess && vehicles.length === 0`. While loading, show a skeleton/"Loading…" — never the empty state.
- When vehicles exist:
  - Vehicle switcher chips at the top (already scaffolded).
  - Selected vehicle's "basic stats" card: name, plate, fuel type, current odometer, purchase date, purchase odometer, purchase price (formatted).
  - Keep the existing KPI grid and charts; they'll naturally read zeros until expenses exist.
- "Add vehicle" buttons (dashboard empty state + "+ Add" chip) navigate to `/onboarding` via `<Link to="/onboarding">` / `navigate({ to: "/onboarding" })`. (Garage page already does this; leave it.)

## 5. Out of scope (explicit)

- No `/expenses`, `/fuel`, `/projection`, `/garage`, `/settings` page work. The existing placeholder files can stay; nav items continue to point at their paths and may 404 — expected for this step.

## Acceptance

Logged-in user → clicks "Add vehicle" → completes 5-step wizard → lands on `/dashboard` → sees the new vehicle's name + stats. Reload page → vehicle still there (because it's served from Supabase via `listVehicles`).

## Technical notes

- `past_repairs` row shape per precision:
  - `exact` → set `exact_date`, derive `month`/`year` from it, `representative_date = exact_date`.
  - `month` → set `month` + `year`, `representative_date = YYYY-MM-15`.
  - `season` → set `season` + `year`, `representative_date` = season midpoint (e.g. spring → Apr 15).
  - `year` → set `year`, `representative_date = YYYY-07-01`.
- Amounts entered in major units in the UI, persisted as `*_minor` (×100).
- All new server fns return plain DTOs; no `Response` objects.
- `attachSupabaseAuth` is already wired in `src/start.ts` (existing protected fns work).
