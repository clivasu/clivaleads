-- ============================================================================
-- Prelead — 0004: identificador por conta (/handle/funil), slug por org e admin geral
-- ============================================================================

-- 1) Admin geral -------------------------------------------------------------
alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

-- Marca o e-mail do dono como super admin (se já tiver conta).
update public.profiles set is_super_admin = true
where id in (select id from auth.users where email = 'mmarquessbsb@gmail.com');

-- 2) Slug do funil passa a ser único POR ORGANIZAÇÃO (não mais global),
--    pra dois clientes poderem ter /marco/estetica e /ana/estetica.
alter table public.flows drop constraint if exists flows_slug_key;
create unique index if not exists flows_org_slug_key
  on public.flows (organization_id, slug);

-- 3) Onboarding: cria profile (+ super admin se for o dono), organização com
--    identificador legível a partir do e-mail, e vínculo owner.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_org_id uuid;
  base_slug text;
  is_admin boolean;
begin
  is_admin := (new.email = 'mmarquessbsb@gmail.com');

  insert into public.profiles (id, full_name, is_super_admin)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), is_admin);

  -- identificador a partir do e-mail (ex.: marco@x.com -> "marco")
  base_slug := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then base_slug := 'clinica'; end if;
  -- garante unicidade sem falhar o cadastro
  if exists (select 1 from public.organizations where slug = base_slug) then
    base_slug := base_slug || '-' || substr(replace(new.id::text, '-', ''), 1, 4);
  end if;

  insert into public.organizations (name, slug, default_message)
  values (
    coalesce(new.raw_user_meta_data->>'full_name', 'Minha Clínica'),
    base_slug,
    'Olá! Vim pelo site e quero mais informações.'
  )
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;
