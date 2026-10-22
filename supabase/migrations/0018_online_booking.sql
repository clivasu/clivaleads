-- ============================================================================
-- Cliva — 0018: agendamento online pelo funil + notificações
-- Aditiva. Rollback: supabase/rollback/0018_online_booking.rollback.sql
-- ============================================================================

-- Duração padrão de cada procedimento (o bloco do funil pode sobrepor).
alter table public.schedule_procedures
  add column if not exists duration_min integer not null default 60 check (duration_min between 5 and 720);

-- Origem do agendamento e ligação com o funil/lead.
alter table public.schedule_appointments
  add column if not exists source text not null default 'manual' check (source in ('manual', 'funnel', 'import')),
  add column if not exists flow_id uuid references public.flows(id) on delete set null,
  add column if not exists lead_session_id uuid references public.lead_sessions(id) on delete set null,
  add column if not exists booking_ref text check (booking_ref is null or char_length(booking_ref) <= 64);
-- Reenvio do mesmo pedido (duplo clique, rede) não cria dois agendamentos.
create unique index if not exists schedule_appointments_booking_ref_key
  on public.schedule_appointments (organization_id, booking_ref) where booking_ref is not null;

-- Regras do agendamento online (uma linha por clínica; ausente = padrão).
create table if not exists public.schedule_booking_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  settings        jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);
alter table public.schedule_booking_settings enable row level security;
revoke all on public.schedule_booking_settings from anon;
grant select, insert, update on public.schedule_booking_settings to authenticated;
drop policy if exists "booking settings - member read" on public.schedule_booking_settings;
create policy "booking settings - member read" on public.schedule_booking_settings
  for select to authenticated using (organization_id in (select public.user_org_ids()));
drop policy if exists "booking settings - admin write" on public.schedule_booking_settings;
create policy "booking settings - admin write" on public.schedule_booking_settings
  for insert to authenticated with check (organization_id in (select public.user_admin_org_ids()));
drop policy if exists "booking settings - admin update" on public.schedule_booking_settings;
create policy "booking settings - admin update" on public.schedule_booking_settings
  for update to authenticated
  using (organization_id in (select public.user_admin_org_ids()))
  with check (organization_id in (select public.user_admin_org_ids()));

-- Notificações do painel (ex.: "novo agendamento pelo funil").
-- Criadas só pelo servidor; membros leem e marcam como lidas.
create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type            text not null check (type in ('booking.created')),
  title           text not null check (char_length(title) <= 160),
  body            text check (char_length(body) <= 500),
  link            text check (char_length(link) <= 300),
  appointment_id  uuid references public.schedule_appointments(id) on delete cascade,
  created_at      timestamptz not null default now(),
  read_at         timestamptz
);
create index if not exists idx_notifications_org_time on public.notifications (organization_id, created_at desc);
create index if not exists idx_notifications_unread on public.notifications (organization_id) where read_at is null;
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
drop policy if exists "notifications - member read" on public.notifications;
create policy "notifications - member read" on public.notifications
  for select to authenticated using (organization_id in (select public.user_org_ids()));
drop policy if exists "notifications - member mark read" on public.notifications;
create policy "notifications - member mark read" on public.notifications
  for update to authenticated
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
