-- ============================================================================
-- Cliva — 0017: Dashboard por período (este mês, 15 dias, mês passado, datas)
-- Requer a 0016 (preço por procedimento). Aditiva.
-- Rollback: supabase/rollback/0017_dashboard_period.rollback.sql
-- ============================================================================
--
-- Período [p_from, p_to). Indicadores contam só a parte que já passou
-- (até p_now) e comparam com o mesmo trecho do período anterior de igual
-- tamanho: mês em andamento não aparece "caindo" só por estar pela metade.
-- Série por dia/mês/ano: faturamento (atendimentos concluídos × preço) e
-- quantidade de atendimentos; períodos futuros vêm nulos (a linha para hoje).

create or replace function public.dashboard_period(
  p_org    uuid,
  p_from   timestamptz,
  p_to     timestamptz,
  p_bucket text default 'day',
  p_now    timestamptz default now()
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with
u as (select case when p_bucket in ('day', 'month', 'year') then p_bucket else 'day' end as unit),
w as (
  select p_to - p_from as len,
         least(p_to, greatest(p_from, p_now)) as elapsed_to
),
ap as (
  select a.status, a.patient_id, a.patient_name, a.starts_at,
         (a.starts_at at time zone 'America/Sao_Paulo') as s_l,
         coalesce(p.price_cents, 0) as price
  from public.schedule_appointments a
  left join public.schedule_procedures p
    on p.organization_id = a.organization_id and lower(p.name) = lower(a.procedure_name)
  , w
  where a.organization_id = p_org
    and a.organization_id in (select public.user_org_ids())
    and a.starts_at >= p_from - w.len and a.starts_at < p_to
),
cur  as (select ap.* from ap, w where ap.starts_at >= p_from and ap.starts_at < w.elapsed_to),
prev as (select ap.* from ap, w where ap.starts_at >= p_from - w.len and ap.starts_at < w.elapsed_to - w.len),
kpis as (
  select jsonb_build_object(
    'patients',           (select count(distinct coalesce(patient_id::text, lower(patient_name))) from cur where status = 'done'),
    'patients_prev',      (select count(distinct coalesce(patient_id::text, lower(patient_name))) from prev where status = 'done'),
    'appointments',       (select count(*) from cur where status = 'done'),
    'appointments_prev',  (select count(*) from prev where status = 'done'),
    'revenue_cents',      (select coalesce(sum(price), 0) from cur where status = 'done'),
    'revenue_prev_cents', (select coalesce(sum(price), 0) from prev where status = 'done'),
    'scheduled',          (select count(*) from ap where starts_at >= p_from and status <> 'cancelled'),
    'professionals',      (select count(*) from public.schedule_professionals where organization_id = p_org and active)
  ) as j
),
buckets as (
  select gs.b
  from u, generate_series(
    date_trunc(u.unit, p_from at time zone 'America/Sao_Paulo'),
    date_trunc(u.unit, (p_to - interval '1 second') at time zone 'America/Sao_Paulo'),
    ('1 ' || u.unit)::interval) as gs(b)
),
series as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'bucket', to_char(b, 'YYYY-MM-DD'),
    -- bucket que ainda não começou: nulo (a linha termina hoje)
    'revenue_cents', case when b > (p_now at time zone 'America/Sao_Paulo') then null else coalesce(r, 0) end,
    'done',          case when b > (p_now at time zone 'America/Sao_Paulo') then null else coalesce(n, 0) end
  ) order by b), '[]'::jsonb) as j
  from (
    select bk.b, s.r, s.n
    from buckets bk
    left join (
      select date_trunc((select unit from u), s_l) as b, sum(price) as r, count(*) as n
      from cur where status = 'done' group by 1
    ) s on s.b = bk.b
  ) x
),
donut as (
  select jsonb_build_object(
    'done',      (select count(*) from ap where starts_at >= p_from and status = 'done'),
    'upcoming',  (select count(*) from ap where starts_at >= p_from and status in ('registered', 'confirmed', 'in_progress')),
    'cancelled', (select count(*) from ap where starts_at >= p_from and status = 'cancelled')
  ) as j
)
select jsonb_build_object('kpis', (select j from kpis), 'series', (select j from series), 'donut', (select j from donut));
$$;

revoke all on function public.dashboard_period(uuid, timestamptz, timestamptz, text, timestamptz) from public, anon;
grant execute on function public.dashboard_period(uuid, timestamptz, timestamptz, text, timestamptz) to authenticated;
