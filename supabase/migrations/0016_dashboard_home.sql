-- ============================================================================
-- Cliva — 0016: preço por procedimento e Dashboard calculado pela agenda
-- Aditiva. Rollback: supabase/rollback/0016_dashboard_home.rollback.sql
-- ============================================================================
--
-- Receita = soma do preço dos atendimentos CONCLUÍDOS (status "done").
-- Agendado, cancelado ou em aberto não conta como receita.

alter table public.schedule_procedures
  add column if not exists price_cents integer check (price_cents is null or price_cents between 0 and 100000000);

-- SECURITY INVOKER: a RLS da agenda limita às clínicas do usuário.
create or replace function public.dashboard_home(p_org uuid, p_now timestamptz default now())
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with
tz as (select 'America/Sao_Paulo'::text as z),
b as (
  select
    date_trunc('month', p_now at time zone (select z from tz)) as m0,          -- início do mês (local)
    (p_now at time zone (select z from tz)) as now_l,
    date_trunc('day', p_now at time zone (select z from tz)) as d0
),
ap as (
  select a.*, (a.starts_at at time zone (select z from tz)) as s_l,
         coalesce(p.price_cents, 0) as price
  from public.schedule_appointments a
  left join public.schedule_procedures p
    on p.organization_id = a.organization_id and lower(p.name) = lower(a.procedure_name)
  where a.organization_id = p_org
    and a.organization_id in (select public.user_org_ids())
),
-- mês atual até agora × mesmo trecho do mês anterior (comparação justa)
cur as (select * from ap, b where s_l >= b.m0 and s_l < b.now_l),
prev as (select * from ap, b where s_l >= b.m0 - interval '1 month' and s_l < b.now_l - interval '1 month'),
kpis as (
  select jsonb_build_object(
    'patients',      (select count(distinct coalesce(patient_id::text, lower(patient_name))) from cur where status <> 'cancelled'),
    'patients_prev', (select count(distinct coalesce(patient_id::text, lower(patient_name))) from prev where status <> 'cancelled'),
    'appointments',      (select count(*) from cur where status <> 'cancelled'),
    'appointments_prev', (select count(*) from prev where status <> 'cancelled'),
    'revenue_cents',      (select coalesce(sum(price), 0) from cur where status = 'done'),
    'revenue_prev_cents', (select coalesce(sum(price), 0) from prev where status = 'done'),
    'professionals', (select count(*) from public.schedule_professionals where organization_id = p_org and active)
  ) as j
),
months as (
  select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'), 'revenue_cents', coalesce(r, 0)) order by m), '[]'::jsonb) as j
  from (
    select gs.m, (select sum(price) from ap where status = 'done' and date_trunc('month', s_l) = gs.m) as r
    from b, generate_series(b.m0 - interval '8 months', b.m0, interval '1 month') as gs(m)
  ) x
),
donut as (
  select jsonb_build_object(
    'done',      (select count(*) from ap, b where s_l >= b.m0 and s_l < b.m0 + interval '1 month' and status = 'done'),
    'upcoming',  (select count(*) from ap, b where s_l >= b.m0 and s_l < b.m0 + interval '1 month' and status in ('registered', 'confirmed', 'in_progress')),
    'cancelled', (select count(*) from ap, b where s_l >= b.m0 and s_l < b.m0 + interval '1 month' and status = 'cancelled')
  ) as j
),
today as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'professional', pr.name, 'patient', a.patient_name, 'procedure', a.procedure_name,
    'time', to_char(a.s_l, 'HH24:MI'), 'status', a.status, 'is_return', a.is_return
  ) order by a.s_l), '[]'::jsonb) as j
  from ap a
  join public.schedule_professionals pr on pr.id = a.professional_id
  , b
  where a.s_l >= b.d0 and a.s_l < b.d0 + interval '1 day'
),
recent as (
  select coalesce(jsonb_agg(jsonb_build_object('name', patient_name, 'procedure', procedure_name, 'date', to_char(s_l, 'YYYY-MM-DD')) order by s_l desc), '[]'::jsonb) as j
  from (
    select * from (
      select distinct on (lower(patient_name)) patient_name, procedure_name, s_l
      from ap, b
      where status = 'done' and s_l < b.now_l
      order by lower(patient_name), s_l desc
    ) x
    order by s_l desc
    limit 5
  ) y
)
select jsonb_build_object(
  'kpis', (select j from kpis),
  'months', (select j from months),
  'donut', (select j from donut),
  'today', (select j from today),
  'recent', (select j from recent)
);
$$;

revoke all on function public.dashboard_home(uuid, timestamptz) from public, anon;
grant execute on function public.dashboard_home(uuid, timestamptz) to authenticated;
