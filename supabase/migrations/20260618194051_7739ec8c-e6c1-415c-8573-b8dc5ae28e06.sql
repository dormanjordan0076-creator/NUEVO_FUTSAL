
CREATE POLICY "public read team-logos" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'team-logos');
CREATE POLICY "admin write team-logos" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'team-logos' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'team-logos' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "public read player-photos" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'player-photos');
CREATE POLICY "admin write player-photos" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'player-photos' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'player-photos' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "public read match-gallery" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'match-gallery');
CREATE POLICY "admin write match-gallery" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'match-gallery' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'match-gallery' AND public.has_role(auth.uid(),'admin'));
