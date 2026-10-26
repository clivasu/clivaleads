-- ============================================================================
-- Cliva — 0019: ficha completa do paciente + lead manual
-- Aditiva. Rollback: supabase/rollback/0019_patient_records.rollback.sql
-- ============================================================================
--
-- Dados de saúde (anamnese) são dado pessoal sensível (LGPD art. 11): ficam
-- só na clínica (RLS da agenda: membros da clínica) e registram a data do
-- consentimento do paciente.

-- Ficha do paciente -----------------------------------------------------------
alter table public.schedule_patients
  add column if not exists cpf text check (cpf is null or cpf ~ '^[0-9]{11}$'),
  add column if not exists rg text check (rg is null or char_length(rg) <= 30),
  add column if not exists birth_date date check (birth_date is null or birth_date between date '1900-01-01' and current_date),
  add column if not exists gender text check (gender is null or gender in ('F', 'M', 'O', 'N')),
  add column if not exists email text check (email is null or char_length(email) <= 200),
  add column if not exists occupation text check (occupation is null or char_length(occupation) <= 120),
  add column if not exists source text check (source is null or char_length(source) <= 60),
  add column if not exists address jsonb not null default '{}'::jsonb,
  add column if not exists emergency_contact jsonb not null default '{}'::jsonb,
  add column if not exists anamnesis jsonb not null default '{}'::jsonb,
  add column if not exists consent_at timestamptz,
  add column if not exists lead_session_id uuid references public.lead_sessions(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();
alter table public.schedule_patients drop constraint if exists schedule_patients_json_size;
alter table public.schedule_patients add constraint schedule_patients_json_size check (
  pg_column_size(address) < 4000 and pg_column_size(emergency_contact) < 2000 and pg_column_size(anamnesis) < 20000);
-- Mesmo CPF não vira dois pacientes na mesma clínica.
create unique index if not exists schedule_patients_cpf_key on public.schedule_patients (organization_id, cpf) where cpf is not null;
create index if not exists schedule_patients_phone_idx on public.schedule_patients (organization_id, phone);
drop trigger if exists schedule_patients_updated_at on public.schedule_patients;
create trigger schedule_patients_updated_at before update on public.schedule_patients
  for each row execute function public.set_updated_at();

-- Lead manual (cadastrado pela equipe, sem funil) -----------------------------
alter table public.lead_sessions alter column flow_id drop not null;
alter table public.lead_sessions
  add column if not exists source text not null default 'funnel' check (source in ('funnel', 'manual')),
  add column if not exists notes text check (notes is null or char_length(notes) <= 2000);
-- Membros da clínica criam lead manual; leads de funil continuam só pelo servidor.
grant insert on public.lead_sessions to authenticated;
drop policy if exists "lead_sessions - member insert manual" on public.lead_sessions;
create policy "lead_sessions - member insert manual" on public.lead_sessions
  for insert to authenticated
  with check (organization_id in (select public.user_org_ids()) and source = 'manual' and flow_id is null);

-- Métricas do funil sem os leads manuais -------------------------------------
create or replace function public.analytics_overview(
  p_org       uuid,
  p_from      timestamptz,
  p_to        timestamptz,
  p_flow      uuid default null,
  p_bucket    text default 'day',
  p_procedure text default null,
  p_source    text default null,   -- '(direto)' = sem utm_source
  p_campaign  text default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with
bucket as (
  select case when p_bucket in ('day', 'week', 'month', 'year') then p_bucket else 'day' end as unit
),
-- Funis da clínica (só da própria: funis publicados são legíveis por todos).
fl as (
  select f.id, f.name, f.procedure
  from public.flows f
  where f.organization_id = p_org
    and f.organization_id in (select public.user_org_ids())
    and (p_flow is null or f.id = p_flow)
    and (p_procedure is null or f.procedure = p_procedure)
),
ev as (
  select e.type, e.session_id, e.flow_id, e.step_index, e.step_id, e.created_at,
         coalesce(nullif(e.utm_source, ''), '(direto)') as src, coalesce(e.utm_campaign, '') as camp
  from public.events e
  where e.organization_id = p_org
    and e.created_at >= p_from and e.created_at < p_to
    and ((p_flow is null and p_procedure is null) or e.flow_id in (select id from fl))
    and (p_source is null or coalesce(nullif(e.utm_source, ''), '(direto)') = p_source)
    and (p_campaign is null or coalesce(e.utm_campaign, '') = p_campaign)
),
ld as (
  select l.*, coalesce(nullif(l.utm_source, ''), '(direto)') as src, coalesce(l.utm_campaign, '') as camp
  from public.lead_sessions l
  where l.organization_id = p_org
    and l.flow_id is not null -- só leads dos funis (manuais ficam fora das métricas do funil)
    and l.created_at >= p_from and l.created_at < p_to
    and ((p_flow is null and p_procedure is null) or l.flow_id in (select id from fl))
    and (p_source is null or coalesce(nullif(l.utm_source, ''), '(direto)') = p_source)
    and (p_campaign is null or coalesce(l.utm_campaign, '') = p_campaign)
),
totals as (
  select jsonb_build_object(
    'visits',             (select count(*) from ev where type = 'page_view'),
    'unique_visitors',    (select count(distinct session_id) from ev where type = 'page_view'),
    'starts',             (select count(*) from ev where type = 'flow_started'),
    'completions',        (select count(*) from ev where type = 'flow_completed'),
    'exits',              (select count(*) from ev where type = 'flow_exited'),
    'whatsapp_clicks',    (select count(*) from ev where type = 'whatsapp_clicked'),
    'appointments',       (select count(*) from ev where type = 'appointment_booked'),
    'leads',              (select count(*) from ld),
    'leads_with_contact', (select count(*) from ld where coalesce(phone, '') <> '' or coalesce(email, '') <> ''),
    'qualified',          (select count(*) from ld where score >= 61),
    'warm',               (select count(*) from ld where score between 31 and 60),
    'cold',               (select count(*) from ld where score <= 30),
    'final_cta',          (select count(*) from ld where final_cta_clicked),
    'leads_whatsapp',     (select count(*) from ld where whatsapp_clicked),
    'devices_mobile',     (select count(*) from ld where device ilike '%mobile%'),
    'devices_desktop',    (select count(*) from ld where device ilike '%desktop%')
  ) as j
),
series as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'bucket', b, 'visits', v, 'starts', s, 'completions', c, 'whatsapp', w, 'leads', l
  ) order by b), '[]'::jsonb) as j
  from (
    select b, sum(v) as v, sum(s) as s, sum(c) as c, sum(w) as w, sum(l) as l
    from (
      select to_char(date_trunc((select unit from bucket), created_at at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD') as b,
             (type = 'page_view')::int as v, (type = 'flow_started')::int as s,
             (type = 'flow_completed')::int as c, (type = 'whatsapp_clicked')::int as w, 0 as l
      from ev
      union all
      select to_char(date_trunc((select unit from bucket), created_at at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD'),
             0, 0, 0, 0, 1
      from ld
    ) x
    group by b
  ) y
),
-- Abandono por etapa: só com um funil selecionado (posições de funis diferentes não se somam).
steps as (
  select coalesce(jsonb_agg(jsonb_build_object('step_index', step_index, 'step_id', step_id, 'views', views, 'completions', comps) order by step_index), '[]'::jsonb) as j
  from (
    select step_index,
           (array_agg(step_id order by created_at desc) filter (where step_id is not null))[1] as step_id,
           count(*) filter (where type = 'step_view') as views,
           count(*) filter (where type = 'step_completed') as comps
    from ev
    where p_flow is not null and step_index is not null and type in ('step_view', 'step_completed')
    group by step_index
  ) s
),
sources as (
  select coalesce(jsonb_agg(jsonb_build_object('source', src, 'campaign', camp, 'visits', v, 'leads', n, 'whatsapp', wa, 'qualified', q) order by n desc, v desc), '[]'::jsonb) as j
  from (
    select src, camp, sum(v) as v, sum(n) as n, sum(wa) as wa, sum(q) as q
    from (
      select src, camp, 1 as v, 0 as n, 0 as wa, 0 as q from ev where type = 'page_view'
      union all
      select src, camp, 0, 1, whatsapp_clicked::int, (score >= 61)::int from ld
    ) x
    group by src, camp
    order by 4 desc, 3 desc
    limit 20
  ) s
),
procedures as (
  select coalesce(jsonb_agg(jsonb_build_object('procedure', p, 'leads', n, 'whatsapp', wa, 'qualified', q, 'advanced', adv) order by n desc), '[]'::jsonb) as j
  from (
    select coalesce(nullif(procedure, ''), '—') as p, count(*) as n,
           count(*) filter (where whatsapp_clicked) as wa,
           count(*) filter (where score >= 61) as q,
           count(*) filter (where whatsapp_clicked or status in ('whatsapp', 'scheduled', 'converted')) as adv
    from ld group by 1 order by 2 desc limit 20
  ) s
),
by_flow as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'flow_id', fl.id, 'name', fl.name, 'procedure', fl.procedure,
    'visits', coalesce(e.visits, 0), 'starts', coalesce(e.starts, 0), 'completions', coalesce(e.comps, 0),
    'whatsapp', coalesce(e.wa, 0), 'leads', coalesce(l.n, 0)
  ) order by coalesce(e.visits, 0) desc, fl.name), '[]'::jsonb) as j
  from fl
  left join (
    select flow_id,
           count(*) filter (where type = 'page_view') as visits,
           count(*) filter (where type = 'flow_started') as starts,
           count(*) filter (where type = 'flow_completed') as comps,
           count(*) filter (where type = 'whatsapp_clicked') as wa
    from ev group by flow_id
  ) e on e.flow_id = fl.id
  left join (select flow_id, count(*) as n from ld group by flow_id) l on l.flow_id = fl.id
),
-- Opções dos filtros (sem aplicar os próprios filtros).
filters as (
  select jsonb_build_object(
    'procedures', coalesce((
      select jsonb_agg(distinct f.procedure order by f.procedure)
      from public.flows f
      where f.organization_id = p_org and f.organization_id in (select public.user_org_ids())
        and coalesce(f.procedure, '') <> ''), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(x.s order by x.s) from (
        select distinct coalesce(nullif(utm_source, ''), '(direto)') as s
        from public.lead_sessions
        where organization_id = p_org and created_at >= p_from and created_at < p_to
        limit 50) x), '[]'::jsonb),
    'campaigns', coalesce((
      select jsonb_agg(x.c order by x.c) from (
        select distinct utm_campaign as c
        from public.lead_sessions
        where organization_id = p_org and created_at >= p_from and created_at < p_to and coalesce(utm_campaign, '') <> ''
        limit 50) x), '[]'::jsonb)
  ) as j
)
select jsonb_build_object(
  'totals', (select j from totals),
  'series', (select j from series),
  'steps', (select j from steps),
  'sources', (select j from sources),
  'procedures', (select j from procedures),
  'by_flow', (select j from by_flow),
  'filters', (select j from filters)
);
$$;

revoke all on function public.analytics_overview(uuid, timestamptz, timestamptz, uuid, text, text, text, text) from public, anon;
grant execute on function public.analytics_overview(uuid, timestamptz, timestamptz, uuid, text, text, text, text) to authenticated;
