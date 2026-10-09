-- ============================================================================
-- Cliva — 0008: controle manual de contas pelo admin + custos da plataforma
-- ============================================================================

-- 1) Assinatura definida à mão pelo admin (cortesia, bloqueio ou troca de plano).
--    Com manual = true, o webhook da Stripe não sobrescreve plano/status.
--    Status novos usados pelo admin: 'comp' (cortesia liberada) e 'blocked'.
alter table public.org_billing
  add column if not exists manual boolean not null default false,
  add column if not exists admin_note text;

-- 2) Custos/investimentos da plataforma (Supabase, Vercel, anúncios, domínio...).
--    Só o servidor (service role) lê e escreve: sem políticas = sem acesso pelo navegador.
create table if not exists public.admin_costs (
  id           uuid primary key default gen_random_uuid(),
  description  text not null,
  category     text not null default 'infra',  -- infra | marketing | ferramentas | pessoas | outros
  amount_cents integer not null check (amount_cents >= 0),
  kind         text not null default 'monthly' check (kind in ('monthly', 'once')),
  starts_on    date not null default current_date,
  ends_on      date,
  created_at   timestamptz not null default now()
);

alter table public.admin_costs enable row level security;
