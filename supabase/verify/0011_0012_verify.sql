-- Verificação SOMENTE LEITURA da 0011 e 0012.

-- 0011: função de save atômico. Esperado: 1 linha, security_type INVOKER.
select p.proname, case when p.prosecdef then 'DEFINER' else 'INVOKER' end as security_type
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'save_flow';

-- 0011: policy de exclusão de lead. Esperado: "lead_sessions - admin delete".
select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'lead_sessions' order by policyname;

-- 0011: eventos Stripe processados (contagem).
select count(*) as eventos_stripe_processados from public.stripe_events;

-- 0012: tabelas da agenda e RLS ligada. Esperado: 4 linhas, rowsecurity = true.
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename like 'schedule_%' order by tablename;

-- 0012: restrição contra horário sobreposto. Esperado: schedule_no_overlap.
select conname from pg_constraint where conname = 'schedule_no_overlap';

-- 0012: volume por clínica (sem dados pessoais).
select organization_id, count(*) as agendamentos from public.schedule_appointments group by organization_id order by 2 desc limit 20;
