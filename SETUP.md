# Prelead — Setup

Construtor de funis de pré-atendimento para clínicas. Next.js 15 + TypeScript + Tailwind + Supabase.

## Rodar em modo demo (sem Supabase)

```bash
npm install
npm run dev
```

Abra http://localhost:3000. Sem `.env.local`, a app roda em **modo demonstração**: o funil público (`/f/...`), o WhatsApp dinâmico e o painel usam dados de exemplo em memória. Nada é persistido.

Funis de exemplo:
- `/f/rinomodelacao-clinica-demo`
- `/f/botox-full-face-clinica-demo`
- `/f/preenchimento-labial-clinica-demo`

## Conectar o Supabase (persistência real) — ~5 min

1. Crie um projeto em https://supabase.com.
2. Em **SQL Editor**, rode na ordem:
   - `supabase/migrations/0001_init.sql` (schema + RLS + policies)
   - `supabase/seed.sql` (Clínica Demo + 3 funis)
3. Em **Project Settings → API**, copie a `Project URL`, a `anon public` key e a `service_role` key.
4. `cp .env.example .env.local` e cole os três valores.
5. `npm run dev` novamente. O aviso de "modo demonstração" some.

### Reivindicar a Clínica Demo para o seu usuário

Depois de criar sua conta em `/login`, rode no SQL Editor (troque o email):

```sql
insert into public.organization_members (organization_id, user_id, role)
select '11111111-1111-1111-1111-111111111111', id, 'owner'
from auth.users where email = 'voce@email.com'
on conflict do nothing;
```

Agora o painel mostra os funis e leads reais da Clínica Demo.

## Deploy (Vercel)

1. `git init && git add . && git commit -m "init"` e suba para o GitHub.
2. Importe na Vercel.
3. Adicione as 3 variáveis de ambiente (as mesmas do `.env.local`).
4. Deploy.

## Estrutura

- `app/f/[slug]` — funil público (SSR, mobile-first).
- `app/(dashboard)/*` — painel (dashboard, flows, leads, analytics, settings).
- `app/api/track` e `app/api/sessions` — telemetria e captura de leads.
- `lib/` — supabase, whatsapp, scoring, tracking, camada de dados.
- `supabase/` — migration e seed SQL.

## O que já funciona

- Funil público completo com avanço automático, transições, progresso e WhatsApp dinâmico.
- Captura de sessão + respostas + UTMs + eventos (com Supabase conectado).
- Painel: dashboard com KPIs, desempenho por procedimento, leads, detalhe do lead, analytics de respostas, configurações.
- Multi-tenant com RLS por `organization_id`.

## Próximos incrementos

- Builder visual com drag-and-drop e CRUD de blocos/perguntas.
- Persistência de criação/edição de funis e settings via server actions.
- Upload de imagens (Supabase Storage).
- Integração Meta Ads (arquitetura já preparada nas UTMs/eventos).
