-- ============================================================================
-- Cliva — 0010: endurecimento de segurança multi-tenant (Entrega A / Fase 1)
-- ============================================================================
-- Aditiva e idempotente. NÃO apaga sessões, leads, funis, bios nem arquivos.
-- Rollback: supabase/rollback/0010_security_hardening.rollback.sql
-- Verificação somente leitura: supabase/verify/0010_verify.sql
--
-- Matriz de papéis (organization_members.role):
--   owner / admin : tudo da clínica (identidade, funis, bio, integrações)
--   attendant     : lê a clínica e os funis; lê e atualiza leads
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) Auxiliares
-- ---------------------------------------------------------------------------
-- Clínicas em que o usuário logado é owner/admin (gestão).
create or replace function public.user_admin_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.organization_members
  where user_id = auth.uid() and role in ('owner', 'admin');
$$;

revoke all on function public.user_admin_org_ids() from public;
grant execute on function public.user_admin_org_ids() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1.1) profiles: ninguém se autopromove a superadmin
-- ---------------------------------------------------------------------------
-- RLS limita LINHAS; as colunas precisam de grant explícito. O usuário só
-- pode alterar nome e foto do próprio perfil.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- Segunda barreira: mesmo com grants errados no futuro, a mudança de
-- is_super_admin vinda de um cliente (anon/authenticated) é recusada.
create or replace function public.profiles_guard_admin()
returns trigger language plpgsql as $$
begin
  if new.is_super_admin is distinct from old.is_super_admin
     and coalesce(auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'is_super_admin só pode ser alterado pelo servidor'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_admin on public.profiles;
create trigger profiles_guard_admin before update on public.profiles
  for each row execute function public.profiles_guard_admin();

-- ---------------------------------------------------------------------------
-- 1.2) organizations / organization_members: sem entrada em clínica alheia
-- ---------------------------------------------------------------------------
-- O vínculo com a clínica nasce só no onboarding (trigger handle_new_user,
-- security definer) ou por fluxo de servidor. Não há mais INSERT pelo cliente.
drop policy if exists "members - insert self" on public.organization_members;
revoke insert, update, delete on public.organization_members from anon, authenticated;

-- Criar clínica: só pelo onboarding. Editar: só owner/admin.
drop policy if exists "org - insert by authenticated" on public.organizations;
revoke insert, delete on public.organizations from anon, authenticated;

drop policy if exists "org - update by member" on public.organizations;
drop policy if exists "org - update by admin" on public.organizations;
create policy "org - update by admin" on public.organizations
  for update to authenticated
  using (id in (select public.user_admin_org_ids()))
  with check (id in (select public.user_admin_org_ids()));

-- Identificador público: nomes de rotas do app nunca; "cliva"/"clivame" só
-- para a conta oficial. Vale também para chamadas diretas à API do Supabase.
create or replace function public.organizations_guard_slug()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.slug is not distinct from old.slug then
    return new;
  end if;
  if new.slug in ('f', 'api', 'login', 'cadastro', 'dashboard', 'flows', 'leads', 'analytics',
                  'schedule', 'settings', 'admin', 'new', 'builder', 'assinar', 'bio', 'auth',
                  'redefinir-senha', 'templates', 'brand', 'www', 'app', 'suporte', 'ajuda',
                  'help', 'blog', 'planos') then
    raise exception 'identificador reservado: %', new.slug using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.slug in ('cliva', 'clivame') and not exists (
    select 1 from public.organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = new.id and m.role = 'owner'
      and lower(u.email) = 'clivasuporte@gmail.com'
  ) then
    raise exception 'identificador reservado: %', new.slug using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_guard_slug on public.organizations;
create trigger organizations_guard_slug before insert or update of slug on public.organizations
  for each row execute function public.organizations_guard_slug();

-- ---------------------------------------------------------------------------
-- 1.2) funis, etapas e bio: atendente lê; owner/admin escreve
-- ---------------------------------------------------------------------------
drop policy if exists "flows - member all" on public.flows;
drop policy if exists "flows - member read" on public.flows;
drop policy if exists "flows - admin insert" on public.flows;
drop policy if exists "flows - admin update" on public.flows;
drop policy if exists "flows - admin delete" on public.flows;
create policy "flows - member read" on public.flows
  for select to authenticated using (organization_id in (select public.user_org_ids()));
create policy "flows - admin insert" on public.flows
  for insert to authenticated with check (organization_id in (select public.user_admin_org_ids()));
create policy "flows - admin update" on public.flows
  for update to authenticated
  using (organization_id in (select public.user_admin_org_ids()))
  with check (organization_id in (select public.user_admin_org_ids()));
create policy "flows - admin delete" on public.flows
  for delete to authenticated using (organization_id in (select public.user_admin_org_ids()));

drop policy if exists "steps - member all" on public.flow_steps;
drop policy if exists "steps - member read" on public.flow_steps;
drop policy if exists "steps - admin insert" on public.flow_steps;
drop policy if exists "steps - admin update" on public.flow_steps;
drop policy if exists "steps - admin delete" on public.flow_steps;
create policy "steps - member read" on public.flow_steps
  for select to authenticated
  using (flow_id in (select id from public.flows where organization_id in (select public.user_org_ids())));
create policy "steps - admin insert" on public.flow_steps
  for insert to authenticated
  with check (flow_id in (select id from public.flows where organization_id in (select public.user_admin_org_ids())));
create policy "steps - admin update" on public.flow_steps
  for update to authenticated
  using (flow_id in (select id from public.flows where organization_id in (select public.user_admin_org_ids())))
  with check (flow_id in (select id from public.flows where organization_id in (select public.user_admin_org_ids())));
create policy "steps - admin delete" on public.flow_steps
  for delete to authenticated
  using (flow_id in (select id from public.flows where organization_id in (select public.user_admin_org_ids())));

drop policy if exists "bio - member all" on public.bio_pages;
drop policy if exists "bio - member read" on public.bio_pages;
drop policy if exists "bio - admin write" on public.bio_pages;
drop policy if exists "bio - admin insert" on public.bio_pages;
drop policy if exists "bio - admin update" on public.bio_pages;
drop policy if exists "bio - admin delete" on public.bio_pages;
create policy "bio - member read" on public.bio_pages
  for select to authenticated using (organization_id in (select public.user_org_ids()));
create policy "bio - admin insert" on public.bio_pages
  for insert to authenticated with check (organization_id in (select public.user_admin_org_ids()));
create policy "bio - admin update" on public.bio_pages
  for update to authenticated
  using (organization_id in (select public.user_admin_org_ids()))
  with check (organization_id in (select public.user_admin_org_ids()));
create policy "bio - admin delete" on public.bio_pages
  for delete to authenticated using (organization_id in (select public.user_admin_org_ids()));

-- Leads: membros leem e atualizam os da própria clínica (inalterado), sem
-- poder mover um lead para outra clínica.
drop policy if exists "lead_sessions - member update" on public.lead_sessions;
create policy "lead_sessions - member update" on public.lead_sessions
  for update to authenticated
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));

-- ---------------------------------------------------------------------------
-- 1.3) Storage: cada clínica só mexe na própria pasta (<organization_id>/...)
-- ---------------------------------------------------------------------------
-- Leitura pública continua (imagens dos funis). Arquivos antigos em "bio/" e
-- "video/" continuam públicos e acessíveis; só deixam de ser alteráveis por
-- qualquer usuário.
drop policy if exists "media authenticated insert" on storage.objects;
drop policy if exists "media authenticated update" on storage.objects;
drop policy if exists "media authenticated delete" on storage.objects;
drop policy if exists "media org insert" on storage.objects;
drop policy if exists "media org update" on storage.objects;
drop policy if exists "media org delete" on storage.objects;

create policy "media org insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in (select org_id::text from public.user_org_ids() as org_id)
  );
create policy "media org update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in (select org_id::text from public.user_org_ids() as org_id)
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in (select org_id::text from public.user_org_ids() as org_id)
  );
create policy "media org delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in (select org_id::text from public.user_org_ids() as org_id)
  );

-- Tipo e tamanho validados pelo próprio Storage (não só no navegador).
-- SVG fica de fora: pode carregar script.
update storage.buckets
set file_size_limit = 52428800, -- 50 MB (vídeos de até 40 MB no editor)
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
      'video/mp4', 'video/webm', 'video/quicktime'
    ]
where id = 'media';

-- ---------------------------------------------------------------------------
-- 1.4) Segredos fora do funil público
-- ---------------------------------------------------------------------------
-- flows.settings é lido publicamente (funis publicados). Integrações e
-- contatos internos passam para uma tabela sem acesso público.
create table if not exists public.flow_private_settings (
  flow_id         uuid primary key references public.flows(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  webhook_url     text,
  webhook_secret  text,
  auto_send_lead  boolean not null default false,
  head_scripts    text,  -- guardado, NÃO executado (ver docs/audit/LGPD.md)
  notify_email    text,
  notify_whatsapp text,
  notify_on_lead  boolean,
  updated_at      timestamptz not null default now()
);

alter table public.flow_private_settings enable row level security;
revoke all on public.flow_private_settings from anon, authenticated;
-- owner/admin enxergam o que está configurado, nunca o segredo em si.
grant select (flow_id, organization_id, webhook_url, auto_send_lead, notify_email,
              notify_whatsapp, notify_on_lead, updated_at)
  on public.flow_private_settings to authenticated;
drop policy if exists "private settings - admin read" on public.flow_private_settings;
create policy "private settings - admin read" on public.flow_private_settings
  for select to authenticated using (organization_id in (select public.user_admin_org_ids()));

-- Migra o que já existe (sem perder nada) e tira do JSON público.
insert into public.flow_private_settings
  (flow_id, organization_id, webhook_url, webhook_secret, auto_send_lead, head_scripts,
   notify_email, notify_whatsapp, notify_on_lead)
select f.id, f.organization_id,
       nullif(f.settings->>'webhookUrl', ''),
       nullif(f.settings->>'webhookSecret', ''),
       coalesce((f.settings->>'autoSendLead')::boolean, false),
       nullif(f.settings->>'headScripts', ''),
       nullif(f.settings->>'notifyEmail', ''),
       nullif(f.settings->>'notifyWhatsapp', ''),
       (f.settings->>'notifyOnLead')::boolean
from public.flows f
where f.settings ?| array['webhookUrl', 'webhookSecret', 'autoSendLead', 'headScripts',
                          'notifyEmail', 'notifyWhatsapp', 'notifyOnLead']
on conflict (flow_id) do nothing;

update public.flows
set settings = settings - array['webhookUrl', 'webhookSecret', 'autoSendLead', 'headScripts',
                                'notifyEmail', 'notifyWhatsapp', 'notifyOnLead']
where settings ?| array['webhookUrl', 'webhookSecret', 'autoSendLead', 'headScripts',
                        'notifyEmail', 'notifyWhatsapp', 'notifyOnLead'];

-- Barreira contínua: mesmo um cliente antigo não volta a gravar segredos no
-- JSON público.
create or replace function public.flows_strip_private_settings()
returns trigger language plpgsql as $$
begin
  new.settings := coalesce(new.settings, '{}'::jsonb)
    - array['webhookUrl', 'webhookSecret', 'autoSendLead', 'headScripts',
            'notifyEmail', 'notifyWhatsapp', 'notifyOnLead'];
  return new;
end;
$$;

drop trigger if exists flows_strip_private_settings on public.flows;
create trigger flows_strip_private_settings before insert or update of settings on public.flows
  for each row execute function public.flows_strip_private_settings();

-- ---------------------------------------------------------------------------
-- 1.5) Idempotência da captura de leads (reenvio/refresh não duplica)
-- ---------------------------------------------------------------------------
alter table public.lead_sessions add column if not exists client_ref uuid;
create unique index if not exists lead_sessions_client_ref_key
  on public.lead_sessions (client_ref) where client_ref is not null;
