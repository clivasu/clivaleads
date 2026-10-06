-- ============================================================================
-- Cliva — 0007: assinatura (Stripe) por organização
-- ============================================================================
-- Tabela separada de organizations de propósito: membros podem LER, mas só o
-- servidor (service role, via webhook da Stripe) escreve. Assim ninguém
-- consegue se dar um plano pelo navegador.

create table if not exists public.org_billing (
  organization_id        uuid primary key references public.organizations(id) on delete cascade,
  plan                   text,            -- inicial | essencial | pro | elite
  status                 text,            -- trialing | active | past_due | canceled | unpaid | incomplete | legacy
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  trial_used             boolean not null default false,
  updated_at             timestamptz not null default now()
);

alter table public.org_billing enable row level security;

drop policy if exists "billing - member read" on public.org_billing;
create policy "billing - member read" on public.org_billing
  for select using (organization_id in (select public.user_org_ids()));

-- Contas que já existiam antes da cobrança continuam com acesso (plano Elite,
-- status "legacy"). Para cobrar alguma delas, apague a linha correspondente.
insert into public.org_billing (organization_id, plan, status)
select id, 'elite', 'legacy' from public.organizations
on conflict (organization_id) do nothing;
