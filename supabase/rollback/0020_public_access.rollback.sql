-- Desfaz a 0020 (volta a leitura pública direta; reabre a listagem).
create policy "flows - public read published" on public.flows for select to anon, authenticated using (status = 'published');
create policy "steps - public read published" on public.flow_steps for select to anon, authenticated
  using (flow_id in (select id from public.flows where status = 'published'));
create policy "orgs - public read when published" on public.organizations for select to anon, authenticated
  using (id in (select organization_id from public.flows where status = 'published')
      or id in (select organization_id from public.bio_pages where status = 'published'));
create policy "bio - public read published" on public.bio_pages for select to anon, authenticated using (status = 'published');
drop policy if exists "media org read" on storage.objects;
create policy "media public read" on storage.objects for select using (bucket_id = 'media');
drop function if exists public.public_funnel(text, text);
drop function if exists public.public_bio(text);
drop function if exists public.public_legacy_path(text);
