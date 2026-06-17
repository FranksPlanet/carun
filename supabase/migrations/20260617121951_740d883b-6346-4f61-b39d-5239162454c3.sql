
-- 1. Create category role enum
CREATE TYPE public.category_role AS ENUM ('fuel','routine','repair','admin','other');

-- 2. Create categories table
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL,
  icon text NOT NULL,
  role public.category_role NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own categories" ON public.categories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Seed function (also reused by handle_new_user)
CREATE OR REPLACE FUNCTION public.seed_default_categories(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, color, icon, role, sort_order, description) VALUES
    (_user_id, 'Nafta',  '#EF9F27', 'Fuel',     'fuel',    10, 'Diesel and other fuel fill-ups'),
    (_user_id, 'Provoz', '#4FB286', 'Droplet',  'routine', 20, 'Things that normally wear out (oil, tyres, brake pads)'),
    (_user_id, 'Servis', '#C0463A', 'Wrench',   'repair',  30, 'Unexpected breakdowns and repairs'),
    (_user_id, 'Admin',  '#888780', 'Receipt',  'admin',   40, 'Insurance, parking, vignette, paperwork'),
    (_user_id, 'Tuning', '#7F77DD', 'Sparkles', 'other',   50, 'Optional extras you did not have to buy')
  ON CONFLICT (user_id, name) DO NOTHING;
END;
$$;

-- 3b. Seed for every existing user
DO $$
DECLARE u RECORD;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM public.profiles LOOP
    PERFORM public.seed_default_categories(u.user_id);
  END LOOP;
END $$;

-- 4. Add expenses.category_id
ALTER TABLE public.expenses ADD COLUMN category_id uuid;

-- 5. Backfill from old enum, scoped per user.
-- Mapping: fuel→Nafta, service→Servis, admin→Admin, other→Provoz (safe default).
UPDATE public.expenses e
SET category_id = c.id
FROM public.categories c
WHERE c.user_id = e.user_id
  AND c.name = CASE e.category
    WHEN 'fuel'    THEN 'Nafta'
    WHEN 'service' THEN 'Servis'
    WHEN 'admin'   THEN 'Admin'
    WHEN 'other'   THEN 'Provoz'
  END;

-- 6. Enforce NOT NULL + FK
ALTER TABLE public.expenses
  ALTER COLUMN category_id SET NOT NULL,
  ADD CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id)
    REFERENCES public.categories(id) ON DELETE RESTRICT;

CREATE INDEX expenses_category_id_idx ON public.expenses(category_id);

-- 7. Rename old enum column for rollback safety
ALTER TABLE public.expenses RENAME COLUMN category TO legacy_category;
ALTER TABLE public.expenses ALTER COLUMN legacy_category DROP NOT NULL;

-- 8. Update handle_new_user to seed categories too
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  PERFORM public.seed_default_categories(NEW.id);
  RETURN NEW;
END;
$$;

-- 9. Guard: never lose the last fuel category for a user
CREATE OR REPLACE FUNCTION public.tg_protect_last_fuel_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE remaining int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'fuel' THEN
      SELECT count(*) INTO remaining FROM public.categories
        WHERE user_id = OLD.user_id AND role = 'fuel' AND id <> OLD.id;
      IF remaining = 0 THEN
        RAISE EXCEPTION 'Cannot delete the last fuel category';
      END IF;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role = 'fuel' AND NEW.role <> 'fuel' THEN
      SELECT count(*) INTO remaining FROM public.categories
        WHERE user_id = OLD.user_id AND role = 'fuel' AND id <> OLD.id;
      IF remaining = 0 THEN
        RAISE EXCEPTION 'At least one fuel category is required';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER protect_last_fuel_category
  BEFORE UPDATE OR DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_protect_last_fuel_category();
