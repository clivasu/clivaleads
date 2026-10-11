-- ============================================================================
-- Cliva — 0011: integridade (Entrega B / Fase 2)
-- ============================================================================
-- Aditiva. Rollback: supabase/rollback/0011_integrity.rollback.sql
-- Depende da 0010 (user_admin_org_ids).

-- ---------------------------------------------------------------------------
-- 2.1) Salvar funil de forma atômica
-- ---------------------------------------------------------------------------
-- Atualiza o funil e troca as etapas numa única transação: se qualquer etapa
-- falhar, nada muda (as etapas anteriores ficam intactas).
-- SECURITY INVOKER: a RLS vale normalmente (só owner/admin da clínica).
create or replace function public.save_flow(p_flow_id uuid, p_flow jsonb, p_steps jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid;
begin
  if p_steps is null or jsonb_typeof(p_steps) <> 'array' then
    raise exception 'etapas inválidas' using errcode = '22023';
  end if;
  if jsonb_array_length(p_steps) > 500 then
    raise exception 'funil com etapas demais' using errcode = '22023';
  end if;

  update public.flows set
    name            = coalesce(nullif(p_flow->>'name', ''), name),
    slug            = coalesce(nullif(p_flow->>'slug', ''), slug),
    procedure       = nullif(p_flow->>'procedure', ''),
    description     = nullif(p_flow->>'description', ''),
    status          = coalesce(nullif(p_flow->>'status', ''), status),
    whatsapp_number = nullif(p_flow->>'whatsapp_number', ''),
    final_message   = nullif(p_flow->>'final_message', ''),
    cover_image_url = nullif(p_flow->>'cover_image_url', ''),
    settings        = coalesce(p_flow->'settings', settings)
  where id = p_flow_id
  returning organization_id into v_org;

  if v_org is null then
    raise exception 'sem permissão para editar este funil' using errcode = '42501';
  end if;

  delete from public.flow_steps where flow_id = p_flow_id;

  insert into public.flow_steps (id, flow_id, position, type, config)
  select coalesce((s->>'id')::uuid, gen_random_uuid()),
         p_flow_id,
         coalesce((s->>'position')::int, (ord - 1)::int),
         s->>'type',
         coalesce(s->'config', '{}'::jsonb)
  from jsonb_array_elements(p_steps) with ordinality as t(s, ord);

  return v_org;
end;
$$;

revoke all on function public.save_flow(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_flow(uuid, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 2.3) Excluir lead (direito de eliminação). Antes não havia policy de
--      DELETE: a exclusão não apagava nada. Respostas saem por cascade.
-- ---------------------------------------------------------------------------
drop policy if exists "lead_sessions - admin delete" on public.lead_sessions;
create policy "lead_sessions - admin delete" on public.lead_sessions
  for delete to authenticated
  using (organization_id in (select public.user_admin_org_ids()));

-- ---------------------------------------------------------------------------
-- 2.5) Stripe: eventos processados (idempotência) e ordem dos eventos
-- ---------------------------------------------------------------------------
create table if not exists public.stripe_events (
  id           text primary key,          -- evt_...
  type         text not null,
  processed_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;

-- Momento (created do evento Stripe) do último estado aplicado: eventos mais
-- antigos que chegarem depois são ignorados.
alter table public.org_billing add column if not exists stripe_event_at timestamptz;
