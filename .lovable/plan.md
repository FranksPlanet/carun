# Depreciation-aware cost-per-km

## 1. Formulas (all derived from existing `lifetimeBreakdown`)

Let:
- `L = lifetime.total_minor` (existing lifetime total — unchanged)
- `P = vehicle.purchase_price_minor`
- `R = vehicle.estimated_resale_value_minor` (new, nullable)
- `K = vehicle.current_odometer_km − vehicle.purchase_odometer_km` (lifetime km — the car's full life, not tracked km)

Three views:

```text
Operating only      = (L − P) / K
Incl. depreciation  = ((L − P) + (P − R)) / K     // only when R is set
Incl. full purchase = L / K
```

Invariant (mentioned in acceptance): `(L / K) × K = L`, i.e. the full-purchase view reconciles exactly to the lifetime breakdown total.

If `R` is not set: `Operating only` and `Incl. full purchase` render; `Incl. depreciation` shows a "Add resale value" prompt (no silent zero depreciation).

These reuse `lifetimeBreakdown(...).total_minor` directly — no parallel calc, no new sums.

## 2. Worked example — current vehicle (ZZ TEST)

Known: `P = 280,000 Kč`, `purchase_odo = 95,000`, `current_odo = 120,000`, so `K = 25,000 km`. Using the accepted `L ≈ 513,000 Kč`:

| View | Calc | Result |
|---|---|---|
| Operating only | (513,000 − 280,000) / 25,000 | **9.32 Kč/km** |
| Incl. depreciation (example R = 180,000) | (233,000 + 100,000) / 25,000 | **13.32 Kč/km** |
| Incl. full purchase | 513,000 / 25,000 | **20.52 Kč/km** |

Ordering holds: `20.52 > 13.32 > 9.32`. Full-purchase × K = 20.52 × 25,000 = 513,000 = L. ✓

Until the user enters R, the depreciation view is unavailable (CTA prompt).

## 3. Unchanged values (guardrail)

No edits to `consumptionPoints`, `computeBackfill`, `defaultMaintenancePerKm`, `projection`, or `lifetimeBreakdown`. Fuel = `role==='fuel'`, maintenance seed = `repair + routine` — both untouched. Existing dashboard KPI `costPerKm(expenses) = totalLogged / trackedKm` is replaced by the new widget; no other call sites.

Accepted values stay: consumption clean 7.56 l/100km, backfilled running 36,901 Kč, projection maintenance 3.01 Kč/km, projection 5-yr 546,853 Kč, lifetime 513,000 Kč.

## 4. Data

Migration:
- `ALTER TABLE public.vehicles ADD COLUMN estimated_resale_value_minor bigint NULL CHECK (estimated_resale_value_minor >= 0);`
- `ALTER TABLE public.profiles ADD COLUMN default_cost_per_km_mode text NOT NULL DEFAULT 'with_depreciation' CHECK (default_cost_per_km_mode IN ('operating','with_depreciation','with_full_purchase'));`

No RLS changes (existing policies cover both tables). Types regenerate after approval.

## 5. Server functions

- `vehicles.functions.ts` — extend `CreateVehicleSchema` / `UpdateVehicleSchema` with `estimated_resale_value_minor: z.number().int().min(0).nullable().optional()`.
- `profile.functions.ts` — extend `UpdateProfileSchema` with `default_cost_per_km_mode: z.enum([...]).optional()`.

## 6. Calc layer (`src/lib/calc.ts`)

Add (pure, no formula changes elsewhere):

```ts
export type CostPerKmMode = 'operating' | 'with_depreciation' | 'with_full_purchase';
export type CostPerKmViews = {
  lifetime_km: number;
  operating_minor_per_km: number;
  with_depreciation_minor_per_km: number | null; // null when resale missing
  with_full_purchase_minor_per_km: number;
};
export function costPerKmViews(
  vehicle: VehicleRow & { current_odometer_km: number; estimated_resale_value_minor: number | null },
  lifetimeTotalMinor: number,
): CostPerKmViews
```

## 7. UI

**Vehicle edit form** (onboarding + garage edit): add "Estimated resale / current value" money input, optional, helper text "Used for honest depreciation-based cost/km. Edit anytime."

**Dashboard cost/km widget** (replaces current single KPI tile):
- Headline = view chosen by `profile.default_cost_per_km_mode`, big number.
- Two smaller alternates beneath, each labelled "Operating only", "Incl. depreciation", "Incl. full purchase price".
- Wrench icon (top-right of widget) → popover with 3 radio options; selecting one calls `updateProfile({ default_cost_per_km_mode })` and invalidates the profile query so the headline swaps.
- When resale missing: "Incl. depreciation" row shows "Add resale value" link → vehicle edit. If that mode is the user's default, fall back to `with_depreciation`'s prompt as headline placeholder with CTA.
- Warm theme, mobile-first; no hardcoded colors — use existing `kpi-card` tokens.

**Settings page**: new "Default cost-per-km view" segmented control mirroring the same 3 options, persisted via `updateProfile`.

## 8. Out of scope (noted for later)

Auto-suggesting resale by make/model/age/mileage — premium/later idea. Manual entry only now; a small "later: auto-estimate" note in the field's helper text.

## 9. Build order

1. Migration (vehicles + profiles columns) — wait for approval.
2. Update server-fn schemas.
3. Add `costPerKmViews` to `calc.ts` + unit-safe types.
4. Vehicle edit form field (onboarding + garage edit).
5. Dashboard widget with wrench popover.
6. Settings mirror control.
7. Verify accepted analytics numbers unchanged.
