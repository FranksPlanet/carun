
-- vehicle-photos bucket policies (per-user folder)
CREATE POLICY "Users read own vehicle photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'vehicle-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users insert own vehicle photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'vehicle-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own vehicle photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'vehicle-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own vehicle photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'vehicle-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
