-- ROLLBACK da 0014: volta à regra da 0003 (só clínicas com funil publicado).
drop policy if exists "orgs - public read when published" on public.organizations;
create policy "orgs - public read for published flows" on public.organizations
  for select to anon, authenticated
  using (id in (select organization_id from public.flows where status = 'published'));
