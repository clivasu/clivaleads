-- ============================================================================
-- Prelead — 0005: contato do lead (nome, telefone, e-mail) na sessão
-- Alimenta a aba Leads (só quem deixou contato) e o diagnóstico.
-- ============================================================================

alter table public.lead_sessions
  add column if not exists name text,
  add column if not exists phone text,
  add column if not exists email text;

create index if not exists idx_lead_sessions_contact
  on public.lead_sessions (organization_id)
  where name is not null or phone is not null or email is not null;
