-- ROLLBACK da 0011. Não apaga dados de clientes.
-- O código continua funcionando sem a função save_flow (cai no caminho antigo).
drop function if exists public.save_flow(uuid, jsonb, jsonb);
drop policy if exists "lead_sessions - admin delete" on public.lead_sessions;
-- stripe_events e org_billing.stripe_event_at são mantidos (inofensivos).
-- Para remover de vez (perde o histórico de eventos processados):
--   drop table if exists public.stripe_events;
--   alter table public.org_billing drop column if exists stripe_event_at;
