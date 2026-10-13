-- ============================================================================
-- Cliva — 0013: eventos padronizados e métricas calculadas no banco
-- (Entrega C / Fase 3). Aditiva; mantém os tipos antigos já gravados.
-- Rollback: supabase/rollback/0013_events.rollback.sql
-- ============================================================================
--
-- Definições (usadas em todo o painel):
--   visita            = página do funil aberta (page_view; recarregar conta de novo)
--   visitante único   = navegador distinto (cookie pl_sid) com page_view no período
--   início            = primeira interação real no funil (flow_started, 1 por visita)
--   conclusão         = chegou ao fim do caminho principal (flow_completed, 1 por visita)
--   saída             = foi para o final "sem interesse" (flow_exited)
--   clique WhatsApp   = abriu o WhatsApp de verdade (whatsapp_clicked, 1 por visita)
--   lead              = registro gravado em lead_sessions no período
--   lead c/ contato   = lead com telefone ou e-mail
--   qualificado       = lead com score >= 61 (faixa "quente", lib/scoring.ts)
--   agendamento       = lead marcado como agendado pela clínica (appointment_booked)

-- Eventos -------------------------------------------------------------------
alter table public.events add column if not exists event_id uuid;           -- deduplicação de reenvio
alter table public.events add column if not exists step_index integer;      -- posição da etapa
alter table public.events add column if not exists step_id text;            -- id interno da etapa
alter table public.events add column if not exists lead_session_id uuid
  references public.lead_sessions(id) on delete cascade;                     -- eventos do servidor

-- Origem da visita (cookies UTM gravados pelo proxy), para filtrar visitas e
-- cliques por origem/campanha. Eventos anteriores à 0013 ficam como "(direto)".
alter table public.events add column if not exists utm_source text;
alter table public.events add column if not exists utm_campaign text;
alter table public.events drop constraint if exists events_utm_len;
alter table public.events add constraint events_utm_len check (
  (utm_source is null or char_length(utm_source) <= 200) and (utm_campaign is null or char_length(utm_campaign) <= 200)
);

alter table public.events drop constraint if exists events_step_id_len;
alter table public.events add constraint events_step_id_len check (step_id is null or char_length(step_id) <= 64);

alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (type in (
  -- atuais
  'page_view', 'flow_started', 'step_view', 'step_completed', 'flow_completed',
  'flow_exited', 'whatsapp_clicked', 'lead_qualified', 'appointment_booked',
  -- legados (já gravados; não são mais enviados)
  'question_viewed', 'option_clicked'
));

-- Índice único completo (NULLs não colidem) para o upsert ignorar reenvios.
create unique index if not exists events_event_id_key on public.events (event_id);
-- Um lead só é qualificado/agendado uma vez (evita contagem dupla).
create unique index if not exists events_lead_once_key on public.events (lead_session_id, type)
  where lead_session_id is not null;
create index if not exists idx_events_org_type_time on public.events (organization_id, type, created_at);

-- Lead: clique no botão final (formulário, "Continuar", botão) separado do
-- clique no WhatsApp. Antes os dois marcavam whatsapp_clicked.
alter table public.lead_sessions add column if not exists final_cta_clicked boolean not null default false;

-- Agendamento: quando a clínica marca o lead como agendado ou convertido (por
-- qualquer tela), grava appointment_booked uma única vez por lead. SECURITY
-- DEFINER porque usuários não inserem em events; só age sobre a linha que a
-- RLS já deixou o usuário alterar.
create or replace function public.lead_sessions_appointment_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('scheduled', 'converted')
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and coalesce(old.status, '') not in ('scheduled', 'converted') then
    insert into public.events (organization_id, flow_id, session_id, type, lead_session_id, metadata, utm_source, utm_campaign)
    values (new.organization_id, new.flow_id, new.session_id, 'appointment_booked', new.id, '{}'::jsonb,
            left(new.utm_source, 200), left(new.utm_campaign, 200))
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.lead_sessions_appointment_event() from public, anon, authenticated;

drop trigger if exists lead_sessions_appointment_event on public.lead_sessions;
create trigger lead_sessions_appointment_event
  after insert or update of status on public.lead_sessions
  for each row execute function public.lead_sessions_appointment_event();

-- Métricas -------------------------------------------------------------------
-- SECURITY INVOKER: a RLS limita às clínicas do usuário. Contagens feitas no
-- banco (sem trazer linhas para o app, sem o limite de 1.000 linhas da API).
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

-- Respostas agregadas (para gênero, idade e dores no painel), sem trazer leads.
create or replace function public.analytics_answers(
  p_org uuid, p_from timestamptz, p_to timestamptz, p_flow uuid default null,
  p_procedure text default null, p_source text default null, p_campaign text default null
)
returns table (question_title text, answer_label text, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select a.question_title, a.answer_label, count(*) as total
  from public.lead_answers a
  join public.lead_sessions l on l.id = a.lead_session_id
  where a.organization_id = p_org
    and l.created_at >= p_from and l.created_at < p_to
    and (p_flow is null or l.flow_id = p_flow)
    and (p_procedure is null or l.flow_id in (select f.id from public.flows f where f.organization_id = p_org and f.procedure = p_procedure))
    and (p_source is null or coalesce(nullif(l.utm_source, ''), '(direto)') = p_source)
    and (p_campaign is null or coalesce(l.utm_campaign, '') = p_campaign)
    and coalesce(a.answer_label, '') <> ''
  group by 1, 2
  order by 3 desc
  limit 500;
$$;

revoke all on function public.analytics_answers(uuid, timestamptz, timestamptz, uuid, text, text, text) from public, anon;
grant execute on function public.analytics_answers(uuid, timestamptz, timestamptz, uuid, text, text, text) to authenticated;
