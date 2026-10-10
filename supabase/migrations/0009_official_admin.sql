-- ============================================================================
-- Cliva — 0009: clivasuporte@gmail.com como admin oficial e links reservados
-- ============================================================================

-- 1) Admin geral (acesso ao /admin e nunca bloqueado pela cobrança).
update public.profiles set is_super_admin = true
where id in (
  select id from auth.users
  where lower(email) in ('mmarquessbsb@gmail.com', 'clivasuporte@gmail.com')
);

-- 2) Cadastro: marca os dois e-mails como admin e não deixa o identificador
--    gerado pelo e-mail cair num nome reservado. "cliva" e "clivame" só ficam
--    para a conta oficial (clivasuporte@gmail.com); rotas do app ficam para ninguém.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_org_id uuid;
  base_slug text;
  is_admin boolean;
  email_l text := lower(new.email);
begin
  is_admin := email_l in ('mmarquessbsb@gmail.com', 'clivasuporte@gmail.com');

  insert into public.profiles (id, full_name, is_super_admin)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), is_admin);

  -- identificador a partir do e-mail (ex.: marco@x.com -> "marco")
  base_slug := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then base_slug := 'clinica'; end if;

  -- nomes reservados viram nome + sufixo
  if (base_slug in ('cliva', 'clivame') and email_l <> 'clivasuporte@gmail.com')
     or base_slug in ('f', 'api', 'login', 'cadastro', 'dashboard', 'flows', 'leads', 'analytics',
                      'schedule', 'settings', 'admin', 'new', 'builder', 'assinar', 'bio', 'auth',
                      'redefinir-senha', 'templates', 'brand', 'www', 'app', 'suporte', 'ajuda',
                      'help', 'blog', 'planos') then
    base_slug := base_slug || '-' || substr(replace(new.id::text, '-', ''), 1, 4);
  end if;

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
