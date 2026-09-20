-- ============================================================================
-- Prelead — schema inicial (multi-tenant + RLS)
-- Rode isto no SQL Editor do Supabase (ou via `supabase db push`).
-- ============================================================================

create extension if not exists "pgcrypto";

-- updated_at helper -----------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- PROFILES  (1:1 com auth.users)
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Cria profile automaticamente ao criar usuário no Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- ORGANIZATIONS  (clínica / tenant)
-- ============================================================================
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  primary_color text default '#0F172A',
  whatsapp_number text,
  default_message text,
  instagram text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ORGANIZATION_MEMBERS  (vínculo usuário <-> clínica + papel)
-- ============================================================================
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','attendant')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index if not exists idx_org_members_user on public.organization_members(user_id);
create index if not exists idx_org_members_org on public.organization_members(organization_id);

-- Helper: ids das orgs do usuário logado (evita recursão nas policies).
create or replace function public.user_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.organization_members where user_id = auth.uid();
$$;

-- ============================================================================
-- FLOWS  (funil)
-- ============================================================================
create table if not exists public.flows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null unique,
  procedure text,
  description text,
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft','published')),
  whatsapp_number text,
  final_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_flows_org on public.flows(organization_id);
create index if not exists idx_flows_slug on public.flows(slug);
create index if not exists idx_flows_status on public.flows(status);
create trigger flows_updated_at before update on public.flows
  for each row execute function public.set_updated_at();

-- ============================================================================
-- FLOW_STEPS  (etapas ordenadas; config JSONB flexível)
-- ============================================================================
create table if not exists public.flow_steps (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.flows(id) on delete cascade,
  position int not null default 0,
  type text not null check (type in (
    'start','question','multi_choice','rating','text','image','before_after',
    'carousel','testimonial','video','stats','alert','timer','loading','level',
    'faq','form','cta','result','whatsapp'
  )),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_flow_steps_flow on public.flow_steps(flow_id, position);

-- ============================================================================
-- QUESTIONS / QUESTION_OPTIONS
-- (normalizadas para uso futuro; na V1 o runner lê de flow_steps.config)
-- ============================================================================
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  flow_step_id uuid not null references public.flow_steps(id) on delete cascade,
  title text not null,
  subtitle text,
  image_url text,
  created_at timestamptz not null default now()
);
create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  label text not null,
  value text not null,
  score int not null default 0,
  position int not null default 0,
  action jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- LEAD_SESSIONS  (sessão anônima — sem cadastro do lead)
-- ============================================================================
create table if not exists public.lead_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  flow_id uuid not null references public.flows(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  procedure text,
  score int not null default 0,
  status text not null default 'new' check (status in
    ('new','qualified','whatsapp','scheduled','converted','lost')),
  device text,
  browser text,
  entry_page text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  whatsapp_clicked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_lead_sessions_org on public.lead_sessions(organization_id, created_at desc);
create index if not exists idx_lead_sessions_flow on public.lead_sessions(flow_id);

-- ============================================================================
-- LEAD_ANSWERS  (respostas denormalizadas para relatório rápido)
-- ============================================================================
create table if not exists public.lead_answers (
  id uuid primary key default gen_random_uuid(),
  lead_session_id uuid not null references public.lead_sessions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  question_key text,
  question_title text not null,
  answer_value text not null,
  answer_label text,
  score int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_lead_answers_session on public.lead_answers(lead_session_id);
create index if not exists idx_lead_answers_org on public.lead_answers(organization_id);

-- ============================================================================
-- EVENTS  (telemetria do funil)
-- ============================================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  flow_id uuid references public.flows(id) on delete cascade,
  session_id text,
  type text not null check (type in (
    'page_view','flow_started','question_viewed','option_clicked','flow_completed','whatsapp_clicked'
  )),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_events_org on public.events(organization_id, created_at desc);
create index if not exists idx_events_flow on public.events(flow_id, type);

-- ============================================================================
-- MEDIA
-- ============================================================================
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  url text not null,
  type text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles              enable row level security;
alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.flows                 enable row level security;
alter table public.flow_steps            enable row level security;
alter table public.questions             enable row level security;
alter table public.question_options      enable row level security;
alter table public.lead_sessions         enable row level security;
alter table public.lead_answers          enable row level security;
alter table public.events                enable row level security;
alter table public.media                 enable row level security;

-- profiles -------------------------------------------------------------------
create policy "own profile - select" on public.profiles
  for select using (id = auth.uid());
create policy "own profile - update" on public.profiles
  for update using (id = auth.uid());

-- organizations --------------------------------------------------------------
create policy "org members - select" on public.organizations
  for select using (id in (select public.user_org_ids()));
create policy "org - insert by authenticated" on public.organizations
  for insert to authenticated with check (true);
create policy "org - update by member" on public.organizations
  for update using (id in (select public.user_org_ids()));

-- organization_members -------------------------------------------------------
create policy "members - select own orgs" on public.organization_members
  for select using (organization_id in (select public.user_org_ids()) or user_id = auth.uid());
create policy "members - insert self" on public.organization_members
  for insert to authenticated with check (user_id = auth.uid());

-- flows: membros gerenciam; público lê apenas publicados ----------------------
create policy "flows - member all" on public.flows
  for all using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
create policy "flows - public read published" on public.flows
  for select to anon, authenticated using (status = 'published');

-- flow_steps: idem via flow --------------------------------------------------
create policy "steps - member all" on public.flow_steps
  for all using (flow_id in (select id from public.flows where organization_id in (select public.user_org_ids())))
  with check (flow_id in (select id from public.flows where organization_id in (select public.user_org_ids())));
create policy "steps - public read published" on public.flow_steps
  for select to anon, authenticated
  using (flow_id in (select id from public.flows where status = 'published'));

-- questions / options --------------------------------------------------------
create policy "questions - member all" on public.questions
  for all using (flow_step_id in (
    select id from public.flow_steps where flow_id in (
      select id from public.flows where organization_id in (select public.user_org_ids()))))
  with check (flow_step_id in (
    select id from public.flow_steps where flow_id in (
      select id from public.flows where organization_id in (select public.user_org_ids()))));
create policy "options - member all" on public.question_options
  for all using (question_id in (
    select id from public.questions where flow_step_id in (
      select id from public.flow_steps where flow_id in (
        select id from public.flows where organization_id in (select public.user_org_ids())))))
  with check (question_id in (
    select id from public.questions where flow_step_id in (
      select id from public.flow_steps where flow_id in (
        select id from public.flows where organization_id in (select public.user_org_ids())))));

-- lead_sessions / lead_answers / events:
-- escrita feita pelo servidor (service_role, bypassa RLS); membros só leem.
create policy "lead_sessions - member read" on public.lead_sessions
  for select using (organization_id in (select public.user_org_ids()));
create policy "lead_sessions - member update" on public.lead_sessions
  for update using (organization_id in (select public.user_org_ids()));
create policy "lead_answers - member read" on public.lead_answers
  for select using (organization_id in (select public.user_org_ids()));
create policy "events - member read" on public.events
  for select using (organization_id in (select public.user_org_ids()));

-- media ----------------------------------------------------------------------
create policy "media - member all" on public.media
  for all using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
