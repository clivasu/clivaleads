-- ============================================================================
-- Cliva — 0012: agenda no banco (Entrega B / 2.4)
-- ============================================================================
-- Antes a agenda ficava só no localStorage do navegador. Aditiva; não apaga
-- nada. A importação dos dados do navegador é feita pela tela, com confirmação.
-- Rollback: supabase/rollback/0012_schedule.rollback.sql
--
-- Fuso: horários gravados como timestamptz; a tela usa America/Sao_Paulo.
-- Todos os membros da clínica (owner/admin/attendant) usam a agenda.

create extension if not exists btree_gist with schema extensions;

-- Profissionais ----------------------------------------------------------------
create table if not exists public.schedule_professionals (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 120),
  initials        text check (char_length(initials) <= 4),
  avatar_color    text check (char_length(avatar_color) <= 80),
  active          boolean not null default true, -- removido da tela, histórico preservado
  created_at      timestamptz not null default now(),
  unique (id, organization_id)
);
create unique index if not exists schedule_professionals_name_key
  on public.schedule_professionals (organization_id, lower(name)) where active;

-- Procedimentos ---------------------------------------------------------------
create table if not exists public.schedule_procedures (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 120),
  color           text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at      timestamptz not null default now()
);
create unique index if not exists schedule_procedures_name_key
  on public.schedule_procedures (organization_id, lower(name));

-- Pacientes (mínimo necessário para agendar) ----------------------------------
create table if not exists public.schedule_patients (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 160),
  phone           text check (char_length(phone) <= 40),
  notes           text check (char_length(notes) <= 2000),
  created_at      timestamptz not null default now(),
  unique (id, organization_id)
);
create index if not exists schedule_patients_name_idx
  on public.schedule_patients (organization_id, lower(name));

-- Agendamentos ----------------------------------------------------------------
create table if not exists public.schedule_appointments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  professional_id uuid not null,
  patient_id      uuid,
  patient_name    text not null check (char_length(patient_name) between 1 and 160),
  procedure_name  text not null check (char_length(procedure_name) between 1 and 120),
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  status          text not null default 'registered'
                  check (status in ('registered', 'confirmed', 'in_progress', 'done', 'cancelled')),
  is_return       boolean not null default false,
  notes           text check (char_length(notes) <= 2000),
  created_by      uuid default auth.uid() references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_at > starts_at and ends_at - starts_at <= interval '12 hours'),
  -- profissional e paciente precisam ser da MESMA clínica do agendamento
  foreign key (professional_id, organization_id)
    references public.schedule_professionals (id, organization_id) on delete restrict,
  foreign key (patient_id, organization_id)
    references public.schedule_patients (id, organization_id) on delete set null (patient_id),
  -- um profissional não atende dois horários sobrepostos (cancelados não contam)
  constraint schedule_no_overlap exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'cancelled')
);
create index if not exists schedule_appointments_org_time_idx
  on public.schedule_appointments (organization_id, starts_at);

drop trigger if exists schedule_appointments_updated_at on public.schedule_appointments;
create trigger schedule_appointments_updated_at before update on public.schedule_appointments
  for each row execute function public.set_updated_at();

-- RLS: membros da clínica ------------------------------------------------------
alter table public.schedule_professionals enable row level security;
alter table public.schedule_procedures    enable row level security;
alter table public.schedule_patients      enable row level security;
alter table public.schedule_appointments  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['schedule_professionals', 'schedule_procedures', 'schedule_patients', 'schedule_appointments'] loop
    execute format('drop policy if exists "schedule - member all" on public.%I', t);
    execute format(
      'create policy "schedule - member all" on public.%I for all to authenticated
         using (organization_id in (select public.user_org_ids()))
         with check (organization_id in (select public.user_org_ids()))', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
