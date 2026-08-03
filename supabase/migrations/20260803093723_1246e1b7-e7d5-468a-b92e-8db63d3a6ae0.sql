ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) NULL;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS purchase_vat_rate numeric(5,2) NULL;
ALTER TABLE public.recurring_costs ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) NULL;
ALTER TABLE public.past_repairs ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_prices_ex_vat boolean NOT NULL DEFAULT false;

UPDATE public.expenses SET vat_rate = 21.00;
UPDATE public.expenses SET vat_rate = 0.00 WHERE note = 'Administrative fee (Carvago)';
UPDATE public.vehicles SET purchase_vat_rate = 21.00 WHERE name ILIKE '%Zafira%';