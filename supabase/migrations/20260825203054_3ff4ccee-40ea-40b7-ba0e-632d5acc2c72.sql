-- Why these live in the database and not only in Zod:
-- the publishable/anon key ships in the browser bundle, so anyone can call
-- PostgREST directly and bypass every form and every Zod schema. RLS stops a
-- user touching OTHER users' rows, but not writing nonsense into their own.
-- These CHECKs are the only non-bypassable layer. They intentionally mirror
-- CreateExpenseSchema / CreateVehicleSchema (src/lib/*.functions.ts) — keep the
-- two in sync; they are NOT redundant with the app schemas.

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_amount_minor_range CHECK (amount_minor >= 0 AND amount_minor <= 1000000000),
  ADD CONSTRAINT expenses_odometer_km_range   CHECK (odometer_km >= 0 AND odometer_km <= 2000000),
  ADD CONSTRAINT expenses_quantity_range      CHECK (quantity IS NULL OR (quantity > 0 AND quantity <= 1000)),
  ADD CONSTRAINT expenses_vat_rate_range      CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100));

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_purchase_price_range   CHECK (purchase_price_minor >= 0 AND purchase_price_minor <= 1000000000000),
  ADD CONSTRAINT vehicles_purchase_odometer_range CHECK (purchase_odometer_km >= 0 AND purchase_odometer_km <= 2000000),
  ADD CONSTRAINT vehicles_current_odometer_range  CHECK (current_odometer_km >= 0 AND current_odometer_km <= 2000000),
  ADD CONSTRAINT vehicles_resale_value_range      CHECK (estimated_resale_value_minor IS NULL OR (estimated_resale_value_minor >= 0 AND estimated_resale_value_minor <= 1000000000000)),
  ADD CONSTRAINT vehicles_purchase_vat_rate_range CHECK (purchase_vat_rate IS NULL OR (purchase_vat_rate >= 0 AND purchase_vat_rate <= 100));

ALTER TABLE public.recurring_costs
  ADD CONSTRAINT recurring_costs_amount_range   CHECK (amount_minor_per_year >= 0 AND amount_minor_per_year <= 1000000000),
  ADD CONSTRAINT recurring_costs_vat_rate_range CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100));

ALTER TABLE public.past_repairs
  ADD CONSTRAINT past_repairs_amount_range   CHECK (amount_minor >= 0 AND amount_minor <= 1000000000),
  ADD CONSTRAINT past_repairs_vat_rate_range CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100));