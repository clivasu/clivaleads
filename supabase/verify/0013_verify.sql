-- Verificação SOMENTE LEITURA da 0013 (eventos e métricas).

-- ANTES de aplicar: tipos já gravados em events. Todos precisam estar na nova
-- lista (page_view, flow_started, step_view, step_completed, flow_completed,
-- flow_exited, whatsapp_clicked, lead_qualified, appointment_booked,
-- question_viewed, option_clicked); senão o novo check falha ao ser criado.
select type, count(*) as total from public.events group by type order by 2 desc;

-- Colunas novas. Esperado: event_id, lead_session_id, step_id, step_index, utm_campaign, utm_source.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'events'
  and column_name in ('event_id', 'step_index', 'step_id', 'lead_session_id', 'utm_source', 'utm_campaign')
order by 1;

-- Coluna do botão final no lead. Esperado: 1 linha.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'lead_sessions' and column_name = 'final_cta_clicked';

-- Índices. Esperado: events_event_id_key, events_lead_once_key, idx_events_org_type_time.
select indexname from pg_indexes
where schemaname = 'public' and tablename = 'events'
  and indexname in ('events_event_id_key', 'events_lead_once_key', 'idx_events_org_type_time')
order by 1;

-- Funções de métricas: INVOKER (RLS vale). Gatilho do agendamento: DEFINER.
select p.proname, case when p.prosecdef then 'DEFINER' else 'INVOKER' end as security_type
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('analytics_overview', 'analytics_answers', 'lead_sessions_appointment_event')
order by 1;

-- Gatilho ligado. Esperado: lead_sessions_appointment_event.
select tgname from pg_trigger where tgrelid = 'public.lead_sessions'::regclass and not tgisinternal;

-- Execução: anon não pode chamar as funções. Esperado: false, false.
select has_function_privilege('anon', 'public.analytics_overview(uuid, timestamptz, timestamptz, uuid, text, text, text, text)', 'execute') as anon_overview,
       has_function_privilege('anon', 'public.analytics_answers(uuid, timestamptz, timestamptz, uuid, text, text, text)', 'execute') as anon_answers;

-- Volume (sem dados pessoais): eventos com e sem event_id nos últimos 7 dias.
select type, count(*) filter (where event_id is not null) as com_event_id, count(*) filter (where event_id is null) as sem_event_id
from public.events where created_at > now() - interval '7 days' group by type order by 1;
