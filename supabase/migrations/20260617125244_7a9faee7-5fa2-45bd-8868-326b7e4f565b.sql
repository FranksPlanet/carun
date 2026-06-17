ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS estimated_resale_value_minor bigint NULL
  CHECK (estimated_resale_value_minor IS NULL OR estimated_resale_value_minor >= 0);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_cost_per_km_mode text NOT NULL
  DEFAULT 'with_depreciation'
  CHECK (default_cost_per_km_mode IN ('operating','with_depreciation','with_full_purchase'));