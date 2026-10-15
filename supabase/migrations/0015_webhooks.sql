-- ============================================================================
-- Cliva — 0015: entregas de webhook (fila durável com nova tentativa)
-- (Entrega D / Fase 4.2). Aditiva. Rollback: supabase/rollback/0015_webhooks.rollback.sql
-- ============================================================================
--
-- Cada lead gera no máximo uma entrega por evento (índice único). A entrega
-- fica registrada com o resultado de cada tentativa, sem o corpo enviado nem a
-- resposta do CRM (só código HTTP e um motivo curto, sem dados pessoais).
-- Somente o servidor (service_role) cria e atualiza entregas; owner/admin da
-- clínica leem o histórico do próprio funil.

-- Respostas do questionário só vão para o CRM se a clínica marcar (opt-in).
alter table public.flow_private_settings
  add column if not exists webhook_include_answers boolean not null default false;
grant select (webhook_include_answers) on public.flow_private_settings to authenticated;

create table if not exists public.webhook_deliveries (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  flow_id          uuid not null references public.flows(id) on delete cascade,
  lead_session_id  uuid references public.lead_sessions(id) on delete cascade,
  event            text not null check (event in ('lead.created')),
  status           text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  attempts         integer not null default 0,
  next_attempt_at  timestamptz not null default now(),
  last_attempt_at  timestamptz,
  last_status      integer,             -- código HTTP da última tentativa
  last_error       text check (last_error is null or char_length(last_error) <= 200),
  created_at       timestamptz not null default now()
);

-- Idempotência: o mesmo lead não gera duas entregas do mesmo evento.
create unique index if not exists webhook_deliveries_once
  on public.webhook_deliveries (lead_session_id, event) where lead_session_id is not null;
create index if not exists idx_webhook_deliveries_due
  on public.webhook_deliveries (next_attempt_at) where status = 'pending';
create index if not exists idx_webhook_deliveries_flow
  on public.webhook_deliveries (flow_id, created_at desc);

alter table public.webhook_deliveries enable row level security;
revoke all on public.webhook_deliveries from anon, authenticated;
grant select on public.webhook_deliveries to authenticated;
drop policy if exists "webhook deliveries - admin read" on public.webhook_deliveries;
create policy "webhook deliveries - admin read" on public.webhook_deliveries
  for select to authenticated using (organization_id in (select public.user_admin_org_ids()));
