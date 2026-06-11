
-- ============= ENUMS =============
CREATE TYPE public.fuel_type AS ENUM ('diesel','petrol','lpg','hybrid','electric');
CREATE TYPE public.expense_category AS ENUM ('fuel','service','admin','other');
CREATE TYPE public.recurring_type AS ENUM ('insurance','road_tax','inspection','parking','other');
CREATE TYPE public.reminder_type AS ENUM ('service','insurance','inspection','tyre_change','other');
CREATE TYPE public.date_precision AS ENUM ('exact','month','season','year');
CREATE TYPE public.season AS ENUM ('spring','summer','autumn','winter');
CREATE TYPE public.distance_unit AS ENUM ('km','mi');
CREATE TYPE public.volume_unit AS ENUM ('l','gal');
CREATE TYPE public.consumption_style AS ENUM ('l_per_100km','km_per_l','mpg');

-- ============= PROFILES =============
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'CZK',
  distance_unit public.distance_unit NOT NULL DEFAULT 'km',
  volume_unit public.volume_unit NOT NULL DEFAULT 'l',
  consumption_style public.consumption_style NOT NULL DEFAULT 'l_per_100km',
  locale TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============= VEHICLES =============
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  plate TEXT,
  fuel_type public.fuel_type NOT NULL,
  purchase_date DATE NOT NULL,
  purchase_odometer_km INTEGER NOT NULL DEFAULT 0,
  purchase_price_minor BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CZK',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX vehicles_user_id_idx ON public.vehicles(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vehicles" ON public.vehicles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============= EXPENSES =============
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  odometer_km INTEGER NOT NULL,
  category public.expense_category NOT NULL,
  amount_minor BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CZK',
  liters NUMERIC(8,3),
  full_tank BOOLEAN,
  tags TEXT[] NOT NULL DEFAULT '{}',
  note TEXT,
  receipt_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX expenses_vehicle_idx ON public.expenses(vehicle_id, date);
CREATE INDEX expenses_user_idx ON public.expenses(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own expenses" ON public.expenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============= PAST REPAIRS =============
CREATE TABLE public.past_repairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount_minor BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CZK',
  precision public.date_precision NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER,
  season public.season,
  exact_date DATE,
  representative_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX past_repairs_vehicle_idx ON public.past_repairs(vehicle_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.past_repairs TO authenticated;
GRANT ALL ON public.past_repairs TO service_role;
ALTER TABLE public.past_repairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own past_repairs" ON public.past_repairs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============= RECURRING COSTS =============
CREATE TABLE public.recurring_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  type public.recurring_type NOT NULL,
  label TEXT,
  amount_minor_per_year BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CZK',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX recurring_vehicle_idx ON public.recurring_costs(vehicle_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_costs TO authenticated;
GRANT ALL ON public.recurring_costs TO service_role;
ALTER TABLE public.recurring_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recurring_costs" ON public.recurring_costs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============= REMINDERS =============
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  type public.reminder_type NOT NULL,
  due_date DATE,
  due_odometer_km INTEGER,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reminders_vehicle_idx ON public.reminders(vehicle_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reminders" ON public.reminders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============= UPDATED_AT TRIGGERS =============
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============= AUTO-CREATE PROFILE ON SIGNUP =============
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============= STORAGE POLICIES (receipts bucket already created via tool) =============
CREATE POLICY "Users read own receipts" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users upload own receipts" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own receipts" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own receipts" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
