-- verify-account-deletion.sql
--
-- WHAT THIS IS
-- The only check that genuinely exercises the account-teardown path, including
-- the last-fuel-category trigger bypass. It creates a throwaway user with rows
-- in all seven owned tables (including a fuel category, which is what used to
-- make the teardown fail), calls public.delete_own_account_data() as that user,
-- asserts every table is empty for them, and then ROLLS BACK.
--
-- SAFE TO RUN: everything happens inside one transaction that always ends in
-- ROLLBACK, so no rows -- throwaway or real -- persist. It does not touch
-- storage objects or the auth user deletion, which happen in application code.
--
-- HOW TO RUN (needs a privileged connection, e.g. the service/owner role):
--   psql -f scripts/verify-account-deletion.sql
--
-- Deliberately NOT wired into `bun run test`: it requires a privileged
-- database connection, and a check that silently no-ops in CI is worse than
-- no check at all. Run it by hand when the teardown SQL changes.
--
-- OUTPUT: prints "ACCOUNT TEARDOWN VERIFIED" on success. On failure it raises
-- an exception naming the exact table(s) that still held rows.

\set ON_ERROR_STOP on

BEGIN;

DO $verify$
DECLARE
  uid        uuid := gen_random_uuid();
  veh_id     uuid := gen_random_uuid();
  cat_id     uuid := gen_random_uuid();
  leftovers  text[] := '{}';
  n          bigint;
BEGIN
  -- A throwaway auth user. The on_auth_user_created trigger will also seed a
  -- profile and the five default categories; the explicit inserts below are
  -- conflict-tolerant so this works either way.
  INSERT INTO auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
          'teardown-check+' || uid || '@example.invalid', now(), now());

  -- Act as that user, exactly as PostgREST would, so auth.uid() resolves.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('role', 'none', true);  -- keep owner privileges; only the claim matters

  -- 1. profiles
  INSERT INTO public.profiles (user_id) VALUES (uid) ON CONFLICT DO NOTHING;

  -- 2. vehicles
  INSERT INTO public.vehicles (id, user_id, name, fuel_type, purchase_date,
                               purchase_odometer_km, purchase_price_minor, current_odometer_km)
  VALUES (veh_id, uid, 'Teardown Test Car', 'diesel', current_date - 365, 100000, 20000000, 120000);

  -- 3. categories -- at least one with role = 'fuel', which is the row the
  --    protect_last_fuel_category trigger refuses to delete outside a teardown.
  INSERT INTO public.categories (id, user_id, name, color, icon, role, sort_order)
  VALUES (cat_id, uid, 'Teardown Fuel', '#C8F031', 'Fuel', 'fuel', 10)
  ON CONFLICT (user_id, name) DO NOTHING;
  SELECT id INTO cat_id FROM public.categories WHERE user_id = uid AND role = 'fuel' LIMIT 1;

  -- 4. expenses
  INSERT INTO public.expenses (user_id, vehicle_id, category_id, date, odometer_km,
                               amount_minor, currency, quantity, full_tank)
  VALUES (uid, veh_id, cat_id, current_date, 120000, 150000, 'CZK', 45.5, true);

  -- 5. recurring_costs
  INSERT INTO public.recurring_costs (user_id, vehicle_id, type, label, amount_minor_per_year)
  VALUES (uid, veh_id, 'insurance', 'Teardown insurance', 1200000);

  -- 6. past_repairs
  INSERT INTO public.past_repairs (user_id, vehicle_id, label, amount_minor, precision,
                                   year, representative_date)
  VALUES (uid, veh_id, 'Teardown repair', 500000, 'year',
          extract(year from current_date)::int, current_date);

  -- 7. reminders
  INSERT INTO public.reminders (user_id, vehicle_id, type, due_date, note)
  VALUES (uid, veh_id, 'service', current_date + 30, 'Teardown reminder');

  RAISE NOTICE 'Seeded throwaway user % across 7 tables.', uid;

  -- The thing under test.
  PERFORM public.delete_own_account_data();

  -- Assert emptiness, collecting every offender rather than stopping at the first.
  SELECT count(*) INTO n FROM public.expenses        WHERE user_id = uid;
  IF n > 0 THEN leftovers := leftovers || format('expenses (%s rows)', n); END IF;
  SELECT count(*) INTO n FROM public.past_repairs    WHERE user_id = uid;
  IF n > 0 THEN leftovers := leftovers || format('past_repairs (%s rows)', n); END IF;
  SELECT count(*) INTO n FROM public.recurring_costs WHERE user_id = uid;
  IF n > 0 THEN leftovers := leftovers || format('recurring_costs (%s rows)', n); END IF;
  SELECT count(*) INTO n FROM public.reminders       WHERE user_id = uid;
  IF n > 0 THEN leftovers := leftovers || format('reminders (%s rows)', n); END IF;
  SELECT count(*) INTO n FROM public.categories      WHERE user_id = uid;
  IF n > 0 THEN leftovers := leftovers || format('categories (%s rows)', n); END IF;
  SELECT count(*) INTO n FROM public.vehicles        WHERE user_id = uid;
  IF n > 0 THEN leftovers := leftovers || format('vehicles (%s rows)', n); END IF;
  SELECT count(*) INTO n FROM public.profiles        WHERE user_id = uid;
  IF n > 0 THEN leftovers := leftovers || format('profiles (%s rows)', n); END IF;

  IF array_length(leftovers, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'ACCOUNT TEARDOWN FAILED -- rows survived in: %', array_to_string(leftovers, ', ');
  END IF;

  RAISE NOTICE 'ACCOUNT TEARDOWN VERIFIED -- all 7 tables empty for the throwaway user.';
END
$verify$;

-- Nothing above is kept.
ROLLBACK;
