-- Conferência SOMENTE LEITURA depois de aplicar 0010 a 0013 (uma tabela só).
with checks as (
  select 1 as n, '0010: profiles só permite alterar nome e foto' as item,
         (select string_agg(column_name, ', ' order by column_name) from information_schema.column_privileges
           where table_schema='public' and table_name='profiles' and grantee='authenticated' and privilege_type='UPDATE') as detalhe,
         (select string_agg(column_name, ', ' order by column_name) from information_schema.column_privileges
           where table_schema='public' and table_name='profiles' and grantee='authenticated' and privilege_type='UPDATE') = 'avatar_url, full_name' as ok
  union all
  select 2, '0010: sem vínculo/criação de clínica pelo cliente', null,
         not exists (select 1 from pg_policies where schemaname='public' and policyname in ('members - insert self','org - insert by authenticated'))
  union all
  select 3, '0010: barreiras (3 gatilhos)',
         (select string_agg(tgname, ', ') from pg_trigger where tgname in ('profiles_guard_admin','organizations_guard_slug','flows_strip_private_settings') and not tgisinternal),
         (select count(*) from pg_trigger where tgname in ('profiles_guard_admin','organizations_guard_slug','flows_strip_private_settings') and not tgisinternal) = 3
  union all
  select 4, '0010: segredos fora do JSON público',
         (select count(*)::text from public.flows where settings ?| array['webhookUrl','webhookSecret','headScripts','notifyEmail','notifyWhatsapp']),
         not exists (select 1 from public.flows where settings ?| array['webhookUrl','webhookSecret','headScripts','notifyEmail','notifyWhatsapp'])
  union all
  select 5, '0010: storage por pasta da clínica',
         (select string_agg(policyname, ', ' order by policyname) from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'media%'),
         (select count(*) from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'media org%') = 3
  union all
  select 6, '0011: save_flow e stripe_events', null,
         exists (select 1 from pg_proc where proname='save_flow') and to_regclass('public.stripe_events') is not null
  union all
  select 7, '0012: agenda (4 tabelas com RLS) e anti-sobreposição', null,
         (select count(*) from pg_tables where schemaname='public' and tablename like 'schedule_%' and rowsecurity) = 4
           and exists (select 1 from pg_constraint where conname='schedule_no_overlap')
  union all
  select 8, '0013: funções de métricas e gatilho de agendamento', null,
         (select count(*) from pg_proc where proname in ('analytics_overview','analytics_answers','lead_sessions_appointment_event')) = 3
           and exists (select 1 from pg_trigger where tgname='lead_sessions_appointment_event')
  union all
  select 9, '0014 continua valendo', null,
         exists (select 1 from pg_policies where schemaname='public' and policyname='orgs - public read when published')
  union all
  select 10, 'dados preservados (clínicas / funis / leads / eventos)',
         (select count(*) from public.organizations) || ' / ' || (select count(*) from public.flows) || ' / ' ||
         (select count(*) from public.lead_sessions) || ' / ' || (select count(*) from public.events),
         true
)
select n, item, detalhe, ok from checks order by n;
