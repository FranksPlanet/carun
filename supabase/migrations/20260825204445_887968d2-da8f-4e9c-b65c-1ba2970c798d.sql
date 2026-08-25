-- Storage hardening: close the move/rename cross-tenant hole.
--
-- "Users update own receipts" and "Users update own vehicle photos" each had a
-- USING clause and a NULL WITH CHECK. Supabase Storage's move/rename endpoint
-- is an UPDATE ... SET name = ..., so with no WITH CHECK the destination path
-- was never validated: an authenticated user could rename an object they own
-- into another user's folder prefix, where it then reads as that user's file.
--
-- The fix is to give each policy a WITH CHECK identical to its USING clause, so
-- the destination must belong to the caller too. This is behaviour-preserving:
-- every legitimate operation (a user moving their own file within their own
-- prefix) satisfies both halves. Only cross-prefix moves are newly rejected.

DROP POLICY IF EXISTS "Users update own receipts" ON storage.objects;
CREATE POLICY "Users update own receipts"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "Users update own vehicle photos" ON storage.objects;
CREATE POLICY "Users update own vehicle photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'vehicle-photos'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- Version the bucket privacy expectation.
--
-- Bucket rows cannot be created or altered from a migration (writes to
-- storage.buckets are rejected), so this cannot *set* the configuration. What
-- it can do is assert it: if this project is ever recreated and a bucket comes
-- back public, or missing, this migration stops with a loud, specific error
-- instead of letting users' private files be served at guessable public URLs.
-- Idempotent: it only reads, so re-running it is harmless.
DO $$
DECLARE
  offenders text;
BEGIN
  SELECT string_agg(b.id, ', ' ORDER BY b.id) INTO offenders
  FROM (VALUES ('receipts'), ('vehicle-photos')) AS want(id)
  LEFT JOIN storage.buckets b ON b.id = want.id
  WHERE b.id IS NULL OR b.public IS DISTINCT FROM false;

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'Storage bucket privacy assertion failed for: %. Both buckets must exist and be private (public = false); the app reads vehicle photos only through signed URLs and never uses public URLs.',
      offenders;
  END IF;

  RAISE NOTICE 'Storage buckets receipts and vehicle-photos confirmed private.';
END
$$;