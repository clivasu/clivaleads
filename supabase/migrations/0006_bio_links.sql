-- ============================================================================
-- Cliva — 0006: Link na Bio (página única por conta) + rastreio de cliques
-- ============================================================================

create table if not exists public.bio_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  title text,
  template text not null default 'wellness',
  config jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','published')),
  views int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger bio_pages_updated_at before update on public.bio_pages
  for each row execute function public.set_updated_at();

create table if not exists public.bio_clicks (
  id uuid primary key default gen_random_uuid(),
  bio_page_id uuid not null references public.bio_pages(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text,
  url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_bio_clicks_page on public.bio_clicks(bio_page_id, created_at desc);
create index if not exists idx_bio_clicks_org on public.bio_clicks(organization_id);

-- RLS ------------------------------------------------------------------------
alter table public.bio_pages  enable row level security;
alter table public.bio_clicks enable row level security;

-- membros gerenciam a bio da própria org
drop policy if exists "bio - member all" on public.bio_pages;
create policy "bio - member all" on public.bio_pages
  for all using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));

-- público lê bios publicadas (para servir em /<handle>)
drop policy if exists "bio - public read published" on public.bio_pages;
create policy "bio - public read published" on public.bio_pages
  for select to anon, authenticated using (status = 'published');

-- cliques: escrita pelo servidor (service_role); membros leem os seus
drop policy if exists "bio_clicks - member read" on public.bio_clicks;
create policy "bio_clicks - member read" on public.bio_clicks
  for select using (organization_id in (select public.user_org_ids()));
