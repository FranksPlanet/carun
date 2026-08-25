-- Account teardown: atomic deletion of all rows owned by the signed-in user.
--
-- Why a database function instead of a loop of PostgREST deletes:
-- each PostgREST call is its own transaction, so a failure part-way through
-- (which is exactly what happened when the last-fuel-category guard fired on
-- the categories delete) left the account half destroyed and unrecoverable.
-- A single plpgsql function body runs in one transaction: either every row
-- goes or none does, so the operation is always safe to retry.
--
-- Why SECURITY DEFINER with no arguments: the function derives the owner from
-- auth.uid() only. There is no caller-supplied id, so it is impossible to use
-- it to delete anyone else's data.
--
-- Why the guard is bypassed here: protect_last_fuel_category exists to stop an
-- ordinary edit leaving a live account with no fuel category to file fill-ups
-- against. During a full teardown the account itself is going away, so the
-- invariant it protects is meaningless. The bypass is a transaction-local
-- setting (set_config(..., is_local => true)), so it exists only for the
-- duration of this function's transaction and cannot leak into normal editing
-- sessions; every other code path still hits the guard unchanged.

CREATE OR REPLACE FUNCTION public.tg_protect_last_fuel_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE remaining int;
BEGIN
  -- Skip the guard while a full-account teardown is in progress. The flag is
  -- transaction-local and only ever set by public.delete_own_account_data().
  IF coalesce(current_setting('app.account_teardown', true), '') = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.delete_own_account_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM set_config('app.account_teardown', 'on', true);

  -- Order matters only for expenses -> categories, because
  -- expenses.category_id REFERENCES categories(id) ON DELETE RESTRICT.
  DELETE FROM public.expenses        WHERE user_id = uid;
  DELETE FROM public.past_repairs    WHERE user_id = uid;
  DELETE FROM public.recurring_costs WHERE user_id = uid;
  DELETE FROM public.reminders       WHERE user_id = uid;
  DELETE FROM public.categories      WHERE user_id = uid;
  DELETE FROM public.vehicles        WHERE user_id = uid;
  DELETE FROM public.profiles        WHERE user_id = uid;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_own_account_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_account_data() TO service_role;