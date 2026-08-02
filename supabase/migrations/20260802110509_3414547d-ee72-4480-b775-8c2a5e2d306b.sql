ALTER TABLE public.categories ADD COLUMN unit text;
UPDATE public.categories SET unit = 'l' WHERE role = 'fuel' AND unit IS NULL;
ALTER TABLE public.expenses RENAME COLUMN liters TO quantity;