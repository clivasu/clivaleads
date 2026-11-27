-- ============================================================================
-- Cliva — 0020: páginas públicas sem listagem pela API
-- Rollback: supabase/rollback/0020_public_access.rollback.sql
-- ============================================================================
--
-- Antes: com a chave pública do site (anon), qualquer pessoa listava pela API
-- todas as clínicas com algo publicado (nome, WhatsApp, Instagram), todos os
-- funis publicados de todas as contas (com as etapas) e todas as bios, e ainda
-- listava os arquivos enviados de todas as clínicas no Storage.
--
-- Agora: o público só abre o que já tem o endereço exato
--   public_funnel(identificador, funil)  → um funil publicado
--   public_bio(identificador)            → a bio publicada
--   public_legacy_path(funil)            → link antigo /f/<funil>
-- e cada clínica só lista os próprios arquivos (os links públicos continuam
-- funcionando, porque o bucket "media" é público).

-- Funil publicado: só as colunas que a página do paciente usa.
create or replace function public.public_funnel(p_handle text, p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'flow', jsonb_build_object(
      'id', f.id, 'organization_id', f.organization_id, 'name', f.name, 'slug', f.slug,
      'procedure', f.procedure, 'description', f.description, 'cover_image_url', f.cover_image_url,
      'status', f.status, 'whatsapp_number', f.whatsapp_number, 'final_message', f.final_message,
      'created_at', f.created_at, 'updated_at', f.updated_at),
    'settings', coalesce(f.settings, '{}'::jsonb),
    'organization', jsonb_build_object(
      'id', o.id, 'name', o.name, 'slug', o.slug, 'logo_url', o.logo_url, 'primary_color', o.primary_color,
      'whatsapp_number', o.whatsapp_number, 'default_message', o.default_message, 'instagram', o.instagram),
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'flow_id', s.flow_id, 'position', s.position, 'type', s.type, 'config', s.config) order by s.position)
      from public.flow_steps s where s.flow_id = f.id), '[]'::jsonb))
  from public.organizations o
  join public.flows f on f.organization_id = o.id
  where o.slug = p_handle and f.slug = p_slug and f.status = 'published'
  limit 1;
$$;

create or replace function public.public_bio(p_handle text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', b.id, 'config', b.config)
  from public.organizations o
  join public.bio_pages b on b.organization_id = o.id
  where o.slug = p_handle and b.status = 'published'
  order by b.updated_at desc
  limit 1;
$$;

-- Link antigo /f/<funil>: o funil publicado mais antigo com esse endereço.
create or replace function public.public_legacy_path(p_slug text)
returns text language sql stable security definer set search_path = public as $$
  select '/' || o.slug || '/' || f.slug
  from public.flows f join public.organizations o on o.id = f.organization_id
  where f.slug = p_slug and f.status = 'published'
  order by f.created_at
  limit 1;
$$;

revoke all on function public.public_funnel(text, text) from public;
revoke all on function public.public_bio(text) from public;
revoke all on function public.public_legacy_path(text) from public;
grant execute on function public.public_funnel(text, text) to anon, authenticated;
grant execute on function public.public_bio(text) to anon, authenticated;
grant execute on function public.public_legacy_path(text) to anon, authenticated;

-- Sem leitura direta pelo público (nem por usuários de outras clínicas).
-- Membros continuam lendo a própria clínica pelas policies de membro.
drop policy if exists "flows - public read published" on public.flows;
drop policy if exists "steps - public read published" on public.flow_steps;
drop policy if exists "orgs - public read when published" on public.organizations;
drop policy if exists "orgs - public read for published flows" on public.organizations;
drop policy if exists "bio - public read published" on public.bio_pages;

-- Storage: listar arquivos só da própria clínica (download pelo link público continua).
drop policy if exists "media public read" on storage.objects;
drop policy if exists "media org read" on storage.objects;
create policy "media org read" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] in (select org_id::text from public.user_org_ids() as org_id));
