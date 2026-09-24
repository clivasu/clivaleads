-- ============================================================================
-- Prelead — 0003: leitura pública da organização no funil aberto
-- O funil público (/f/[slug]) é anônimo e precisa ler a marca da clínica
-- (nome, cor, logo, whatsapp). Sem esta policy o RLS bloqueia o JOIN e a
-- página quebra (500). Liberamos apenas orgs que têm ao menos um funil
-- publicado.
-- ============================================================================

drop policy if exists "orgs - public read for published flows" on public.organizations;
create policy "orgs - public read for published flows" on public.organizations
  for select to anon, authenticated
  using (id in (select organization_id from public.flows where status = 'published'));
