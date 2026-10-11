-- ============================================================================
-- ROLLBACK da 0010 — SÓ EM EMERGÊNCIA (reabre as falhas de segurança!)
-- ============================================================================
-- Use apenas se a 0010 quebrar algo crítico em produção e não houver correção
-- rápida. Não apaga dados: a tabela flow_private_settings e a coluna
-- client_ref ficam; os valores privados são copiados de volta para settings.

-- Barreiras e funções novas
drop trigger if exists flows_strip_private_settings on public.flows;
drop function if exists public.flows_strip_private_settings();
drop trigger if exists profiles_guard_admin on public.profiles;
drop function if exists public.profiles_guard_admin();
drop trigger if exists organizations_guard_slug on public.organizations;
drop function if exists public.organizations_guard_slug();

-- Configurações privadas de volta ao JSON do funil (estado anterior)
update public.flows f
set settings = f.settings || jsonb_strip_nulls(jsonb_build_object(
  'webhookUrl', p.webhook_url, 'webhookSecret', p.webhook_secret, 'autoSendLead', p.auto_send_lead,
  'headScripts', p.head_scripts, 'notifyEmail', p.notify_email, 'notifyWhatsapp', p.notify_whatsapp,
  'notifyOnLead', p.notify_on_lead))
from public.flow_private_settings p
where p.flow_id = f.id;

-- Grants originais
grant insert, update, delete on public.profiles to authenticated;
grant insert, update, delete on public.organization_members to authenticated;
grant insert, delete on public.organizations to authenticated;

-- Políticas originais (0001 / 0006 / 0002)
drop policy if exists "org - update by admin" on public.organizations;
create policy "org - insert by authenticated" on public.organizations
  for insert to authenticated with check (true);
create policy "org - update by member" on public.organizations
  for update using (id in (select public.user_org_ids()));
create policy "members - insert self" on public.organization_members
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "flows - member read" on public.flows;
drop policy if exists "flows - admin insert" on public.flows;
drop policy if exists "flows - admin update" on public.flows;
drop policy if exists "flows - admin delete" on public.flows;
create policy "flows - member all" on public.flows
  for all using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));

drop policy if exists "steps - member read" on public.flow_steps;
drop policy if exists "steps - admin insert" on public.flow_steps;
drop policy if exists "steps - admin update" on public.flow_steps;
drop policy if exists "steps - admin delete" on public.flow_steps;
create policy "steps - member all" on public.flow_steps
  for all using (flow_id in (select id from public.flows where organization_id in (select public.user_org_ids())))
  with check (flow_id in (select id from public.flows where organization_id in (select public.user_org_ids())));

drop policy if exists "bio - member read" on public.bio_pages;
drop policy if exists "bio - admin insert" on public.bio_pages;
drop policy if exists "bio - admin update" on public.bio_pages;
drop policy if exists "bio - admin delete" on public.bio_pages;
create policy "bio - member all" on public.bio_pages
  for all using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));

drop policy if exists "lead_sessions - member update" on public.lead_sessions;
create policy "lead_sessions - member update" on public.lead_sessions
  for update using (organization_id in (select public.user_org_ids()));

drop policy if exists "media org insert" on storage.objects;
drop policy if exists "media org update" on storage.objects;
drop policy if exists "media org delete" on storage.objects;
create policy "media authenticated insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'media');
create policy "media authenticated update" on storage.objects
  for update to authenticated using (bucket_id = 'media');
create policy "media authenticated delete" on storage.objects
  for delete to authenticated using (bucket_id = 'media');
update storage.buckets set file_size_limit = null, allowed_mime_types = null where id = 'media';

-- A tabela privada fica (com os dados), apenas sem leitura pelo cliente.
drop policy if exists "private settings - admin read" on public.flow_private_settings;
drop function if exists public.user_admin_org_ids();
