-- ROLLBACK da 0013 (eventos e métricas).
--
-- Ordem segura: 1) reverter o CÓDIGO (o código novo envia tipos e colunas que
-- só existem com a 0013; o código antigo funciona com ou sem ela);
-- 2) só depois, se necessário, rodar este arquivo.
--
-- O que NÃO é desfeito, de propósito:
--   - colunas novas de events (event_id, step_index, step_id, lead_session_id,
--     utm_source, utm_campaign) e lead_sessions.final_cta_clicked: guardam dados
--     e não atrapalham o código antigo;
--   - o check de tipos: eventos novos (step_view, flow_exited, ...) já gravados
--     impediriam voltar ao check antigo. Para restaurá-lo seria preciso apagar
--     esses eventos, o que perde histórico. Não fazer sem autorização.

begin;

drop trigger if exists lead_sessions_appointment_event on public.lead_sessions;
drop function if exists public.lead_sessions_appointment_event();

drop function if exists public.analytics_overview(uuid, timestamptz, timestamptz, uuid, text, text, text, text);
drop function if exists public.analytics_answers(uuid, timestamptz, timestamptz, uuid, text, text, text);

-- Índices de apoio (recriáveis a qualquer momento).
drop index if exists public.idx_events_org_type_time;

commit;

select 'rollback da 0013: funções e gatilho removidos; colunas e dados mantidos' as aviso;
