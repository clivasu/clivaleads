-- ============================================================================
-- Cliva — 0014: cliva.me/<identificador> funciona com Link na Bio publicado
-- Rollback: supabase/rollback/0014_public_handle.rollback.sql
-- ============================================================================
--
-- Problema: a policy da 0003 só deixava o visitante ler a clínica que tivesse
-- funil publicado. Conta com só o Link na Bio publicado (ou sem funil
-- publicado) dava 404 em cliva.me/<identificador>, mesmo com a bio no ar.
--
-- Correção: a clínica também fica legível quando tem bio publicada. Clínica
-- sem nada publicado continua invisível para visitantes (não dá para listar
-- todas as clínicas pela API).

drop policy if exists "orgs - public read for published flows" on public.organizations;
drop policy if exists "orgs - public read when published" on public.organizations;
create policy "orgs - public read when published" on public.organizations
  for select to anon, authenticated
  using (
    id in (select organization_id from public.flows where status = 'published')
    or id in (select organization_id from public.bio_pages where status = 'published')
  );
