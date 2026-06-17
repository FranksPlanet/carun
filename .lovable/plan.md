# Plan: User-editable expense categories

## 1. Current data (confirmed)

Existing `expenses.category` distribution (enum `expense_category`):

| Old value | Count |
|---|---|
| fuel | 20 |
| service | 4 |
| admin | 2 |
| other | 0 |

## 2. Migration mapping (no data loss)

| Old enum | → New category | Role |
|---|---|---|
| `fuel` | **Nafta** | fuel |
| `service` | **Servis** | repair |
| `admin` | **Admin** | admin |
| `other` | **Provoz** (safe default) | routine |

Every expense ends up with a valid `category_id`. The old enum column is kept (renamed to `legacy_category`) until a later batch, so we can rollback without losing the original label.

## 3. Data model

New table `public.categories`:

- `id uuid pk`, `user_id uuid not null`
- `name text not null`, `color text not null`, `icon text not null`
- `role category_role not null` — enum `('fuel','routine','repair','admin','other')`
- `sort_order int not null default 0`, `description text`
- `created_at`, `updated_at`
- `unique (user_id, name)`
- RLS: `FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id)`, plus GRANTs to `authenticated` / `service_role`.

Seeded defaults (for every existing user + new users via `handle_new_user`):

| Name | Role | Icon | Color | Description |
|---|---|---|---|---|
| Nafta | fuel | Fuel | #EF9F27 | Diesel and other fuel fill-ups |
| Provoz | routine | Droplet | #4FB286 | Things that normally wear out (oil, tyres, brake pads) |
| Servis | repair | Wrench | #C0463A | Unexpected breakdowns and repairs |
| Admin | admin | Receipt | #888780 | Insurance, parking, vignette, paperwork |
| Tuning | other | Sparkles | #7F77DD | Optional extras you didn't have to buy |

Migration steps in one SQL migration:

```text
1. create enum category_role
2. create table categories + grants + RLS + updated_at trigger
3. insert 5 defaults for every existing user_id in profiles
4. add expenses.category_id uuid (nullable)
5. backfill category_id from old enum per mapping above (scoped per user)
6. alter expenses.category_id set not null + fk -> categories(id)
7. rename expenses.category -> expenses.legacy_category
8. update handle_new_user() to also seed 5 defaults for new users
9. trigger on categories: block DELETE or role-change away from fuel when it's the user's last role='fuel' row
```

## 4. Analytics integrity — `src/lib/calc.ts`

The `ExpenseRow` type gains a `role: CategoryRole` field, populated by the expenses loader via a join on `categories`. Then:

- **`totalsByCategory`** (line 51): aggregate by `e.role` into keys `fuel | routine | repair | admin | other`. Returns a `Record<CategoryRole, number>`.
- **`consumptionPoints`** (line 90) and **`pricePerLiterSeries`** (line 147): replace `e.category === "fuel"` with `e.role === "fuel"`.
- **`computeBackfill`** fuel rate (line 190): `by.fuel / km` — same semantics, now keyed by role.
- **`computeLifetimeCost`** per-km variable (line 287): `(by.fuel ?? 0) / km` — same semantics, keyed by role.
- **`defaultMaintenancePerKm`** (line 348): `(by.repair ?? 0) + (by.routine ?? 0)` over km. Excludes `fuel`, `admin`, and `other` (Tuning is discretionary and must not seed the projected maintenance rate). Pre-migration equivalence: old `service` rows → `repair`, old `other` rows (none currently) → `routine`, so the numeric result is unchanged.
- **`projectedFuelPrice`** (line 362): `e.role === "fuel"`.

No other formulas change.

## 5. Category management UI (Settings)

- New "Categories" section: list ordered by `sort_order` with drag-to-reorder, plus add / rename / recolour / pick-icon / edit-description / delete.
- Delete flow: if expenses reference the category, show a "Reassign to…" picker; never orphan.
- Block delete and role-change for the last `role='fuel'` row.
- Provoz vs Servis stay visually distinct (green Droplet "normal wear" vs red Wrench "unexpected breakdowns") with descriptions visible in the picker.

## 6. Dynamic categories everywhere

- **`src/lib/categories.tsx`** → rewrite as a hook/provider: `useCategories()` returns the user's list from a Query; `CategoryIcon` looks up by id; export an `iconName → lucide component` map for the picker.
- **Add/edit expense, expense list, donut, cumulative stacked chart** (`expenses.tsx`): read dynamic categories for colour/icon/label/grouping.
- **CSV/XLSX import** (`import-expenses-dialog.tsx`): match incoming strings to existing categories by case-insensitive name; unmatched → Provoz fallback. Never auto-create.
- **OCR** (`ocr.functions.ts`): prompt returns a free-text guess; server maps by name, then by role='fuel' if liters are present; fallback Provoz. Never auto-create.

## 7. Out of scope

Purchase price stays a vehicle field. Consumption / backfill / projection formulas otherwise untouched. Existing RLS pattern preserved.

## Files touched

**New**
- `supabase/migrations/<ts>_categories.sql`
- `src/lib/categories.functions.ts` (CRUD server fns + reassign)
- `src/components/categories-manager.tsx`
- `src/components/category-picker.tsx`

**Edited**
- `src/lib/categories.tsx` (hook + icon map; drop hardcoded enum)
- `src/lib/calc.ts` (role-based aggregation as detailed in §4)
- `src/lib/expenses.functions.ts` (select join with categories; expose role)
- `src/lib/ocr.functions.ts` (name-based mapping)
- `src/components/import-expenses-dialog.tsx` (dynamic mapping)
- `src/routes/_authenticated/expenses.tsx` (dynamic colours/icons, picker)
- `src/routes/_authenticated/settings.tsx` (mount manager)
- `src/routes/_authenticated/dashboard.tsx`, `insights.tsx` (only if they read `CATEGORY_META` directly — verified during build)
- `src/integrations/supabase/types.ts` (auto-regenerated)

## Acceptance checks after build

1. `SELECT count(*) FROM expenses WHERE category_id IS NULL` → 0.
2. **Numerical parity vs pre-migration snapshot**, all unchanged:
   - average consumption (l/100km) and per-segment averages
   - backfill `km_variable_minor` and total
   - lifetime `per_km_variable_minor` and `backfilled_running_minor`
   - **projection `maintenance_minor_per_km` default** (repair + routine only, excludes Tuning)
   - **projection 5-year `total_horizon_minor`**
   - **projection `fuel_minor_per_km` and `yearly_fuel_minor`**
3. Settings → Categories supports add/rename/recolour/reorder/delete-with-reassign; last fuel category cannot be deleted or have its role changed.
4. Donut, stacked chart, and expense rows render with the user's category colours/icons.
5. Provoz (green Droplet, "normal wear") and Servis (red Wrench, "unexpected breakdowns") are visually and textually distinct in the picker and manager.
