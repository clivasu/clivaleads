-- ============================================================================
-- Prelead — 0002: builder persistente, settings, Storage e onboarding
-- Rode DEPOIS do 0001. (SQL Editor do Supabase ou `supabase db push`.)
-- ============================================================================

-- 1) flow_steps.type: o catálogo de blocos evoluiu (container, hero, roleta,
--    áudio, botões, notícia, gráficos...). Removemos o CHECK rígido — o tipo é
--    validado na aplicação e o config é JSONB flexível.
alter table public.flow_steps drop constraint if exists flow_steps_type_check;

-- 2) flows.settings: guarda tudo da aba Configurações (pixels, webhook, SEO,
--    notificações, LGPD, CSS, etc.) num JSONB único.
alter table public.flows
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- 3) Onboarding automático: ao criar usuário no Auth, além do profile,
--    cria uma organização pessoal e vincula como owner. Assim o painel já
--    funciona no primeiro login, sem SQL manual.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_org_id uuid;
  base_slug text;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));

  base_slug := 'clinica-' || substr(replace(new.id::text, '-', ''), 1, 8);

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

-- (o trigger on_auth_user_created do 0001 continua válido e agora usa esta versão)

-- 4) Storage: bucket público "media" para imagens/logos/OG do funil.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Leitura pública (funil aberto na internet).
drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects
  for select using (bucket_id = 'media');

-- Upload/gestão: qualquer usuário autenticado pode subir no bucket media.
-- (o path recomendado é <organization_id>/arquivo — a app organiza assim)
drop policy if exists "media authenticated insert" on storage.objects;
create policy "media authenticated insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'media');

drop policy if exists "media authenticated update" on storage.objects;
create policy "media authenticated update" on storage.objects
  for update to authenticated using (bucket_id = 'media');

drop policy if exists "media authenticated delete" on storage.objects;
create policy "media authenticated delete" on storage.objects
  for delete to authenticated using (bucket_id = 'media');
