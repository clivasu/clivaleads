-- Conferência SOMENTE LEITURA antes de aplicar 0010 a 0013.
-- Resultado numa tabela só (o SQL Editor mostra apenas o último resultado).
-- Coluna "ok": true = como esperado.
with checks as (
  select 1 as n, 'tabelas base existem' as item,
         (select string_agg(t, ', ') from unnest(array['profiles','organizations','organization_members','flows','flow_steps','bio_pages','lead_sessions','lead_answers','events','org_billing']) t
           where to_regclass('public.' || t) is null) as detalhe,
         (select count(*) from unnest(array['profiles','organizations','organization_members','flows','flow_steps','bio_pages','lead_sessions','lead_answers','events','org_billing']) t
           where to_regclass('public.' || t) is null) = 0 as ok
  union all
  select 2, 'migrations novas ainda não aplicadas',
         concat_ws(', ',
           case when to_regclass('public.flow_private_settings') is not null then '0010 já existe' end,
           case when to_regclass('public.stripe_events') is not null then '0011 já existe' end,
           case when to_regclass('public.schedule_appointments') is not null then '0012 já existe' end,
           case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='event_id') then '0013 já existe' end),
         to_regclass('public.flow_private_settings') is null and to_regclass('public.stripe_events') is null
           and to_regclass('public.schedule_appointments') is null
  union all
  select 3, 'função user_org_ids existe', null, exists (select 1 from pg_proc where proname = 'user_org_ids')
  union all
  select 4, 'bucket media existe', null, exists (select 1 from storage.buckets where id = 'media')
  union all
  select 5, 'coluna profiles.is_super_admin', null, exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_super_admin')
  union all
  select 6, 'tipos em events aceitos pela 0013',
         (select string_agg(distinct type, ', ') from public.events),
         not exists (select 1 from public.events where type not in ('page_view','flow_started','step_view','step_completed','flow_completed','flow_exited','whatsapp_clicked','lead_qualified','appointment_booked','question_viewed','option_clicked'))
  union all
  select 7, 'superadmins hoje',
         (select string_agg(u.email, ', ') from public.profiles p join auth.users u on u.id = p.id where p.is_super_admin),
         (select count(*) from public.profiles p join auth.users u on u.id = p.id where p.is_super_admin
            and lower(u.email) not in ('mmarquessbsb@gmail.com','clivasuporte@gmail.com')) = 0
  union all
  select 8, 'usuários em mais de uma clínica (possível uso da falha 1.2)',
         (select count(*)::text from (select user_id from public.organization_members group by user_id having count(*) > 1) x),
         not exists (select 1 from public.organization_members group by user_id having count(*) > 1)
  union all
  select 9, 'funis com segredo/integração no JSON público (serão movidos)',
         (select count(*)::text from public.flows where settings ?| array['webhookUrl','webhookSecret','headScripts','notifyEmail','notifyWhatsapp']),
         true
  union all
  select 10, 'volume (clínicas / funis / leads / eventos)',
         (select count(*) from public.organizations) || ' / ' || (select count(*) from public.flows) || ' / ' ||
         (select count(*) from public.lead_sessions) || ' / ' || (select count(*) from public.events),
         true
)
select n, item, detalhe, ok from checks order by n;
