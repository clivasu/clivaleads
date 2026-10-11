# Baseline da auditoria — Cliva

Levantamento feito na branch `fix/security-integrity-cliva`, criada a partir de `main` no commit `cacb7a9` (2026-10-11). Evidências por leitura do código e por testes executados num Postgres real (PGlite) com o ambiente do Supabase imitado (`tests/db/`). Nada foi executado no banco de produção.

## Stack verificada

| Item | Antes | Agora (branch) |
|---|---|---|
| Next.js | 16.3.5 | 16.3.8 |
| React | 19.3 | 19.3 |
| Supabase JS / SSR | 2.45 / 0.5 | sem mudança |
| Stripe SDK | 23.0 | sem mudança |
| Lint | `next lint` (removido no Next 16, não rodava) | ESLint 9 flat config |
| Testes | nenhum | Vitest + PGlite |
| `npm audit` (produção) | 1 crítica, 2 altas | 0 |

A falha crítica era execução remota de código em `next/og` (16.2.0 a 16.3.5). O projeto não importa `next/og`, mas a versão foi atualizada mesmo assim. As falhas moderadas de cache foram corrigidas na 16.3.8.

## Migrations (ordem de execução)

`0001_init` → `0002_builder_storage` → `0003_public_org_read` → `0004_handles_and_admin` → `0005_lead_contact` → `0006_bio_links` → `0007_billing` → `0008_admin_billing` → `0009_official_admin` → **`0010_security_hardening` (nova)**.

As migrations são aplicadas pelo SQL Editor do Supabase. O estado real do banco pode divergir dos arquivos. Antes de aplicar a 0010, rode `supabase/verify/0010_verify.sql` (somente leitura) e compare.

## Caminhos com `service_role` (ignoram RLS)

| Arquivo | Uso | Autorização |
|---|---|---|
| `app/api/sessions/route.ts` | grava leads dos funis públicos | funil precisa estar publicado; clínica derivada do funil (corrigido) |
| `app/api/track/route.ts` | grava eventos | idem (corrigido) |
| `app/api/bio-click/route.ts` | grava cliques da bio | bio precisa estar publicada (corrigido) |
| `app/api/stripe/webhook/route.ts` | sincroniza assinatura | assinatura do webhook Stripe |
| `lib/actions/admin.ts`, `lib/data/admin*.ts` | painel do admin geral | `isSuperAdmin()` no servidor (depende do item 1.1) |
| `lib/actions/handle.ts` | checa disponibilidade de identificador | só lê `slug` |
| `lib/actions/flows.ts` | grava configurações privadas | só depois de a RLS aceitar a edição do funil |
| `lib/data/flows.ts` | lê configurações privadas (mascaradas) | só se a RLS mostrar a linha ao usuário |
| `lib/data/billing.ts` | limite de leads na captura | interno |

## Achados

Gravidade: **Crítica** (comprometimento de várias clínicas), **Alta** (dado ou ativo de outra clínica), **Média**, **Baixa**.

| # | Achado | Evidência | Gravidade | Situação |
|---|---|---|---|---|
| 1.1 | Usuário comum se promove a superadmin: a policy de UPDATE em `profiles` não restringe colunas e `is_super_admin` está na tabela. O admin geral usa `service_role` e vê todas as clínicas. | `0001_init.sql` (policy "own profile - update"), `0004` (coluna). Reproduzido em `tests/db/security.test.ts` (bloco ANTES). | Crítica | Corrigido na 0010 |
| 1.2 | Usuário entra em qualquer clínica: INSERT em `organization_members` só exige `user_id = auth.uid()`. O id da clínica aparece nas páginas públicas. Dá acesso a leads, funis e configurações. | `0001_init.sql` ("members - insert self"). Reproduzido. | Crítica | Corrigido na 0010 |
| 1.2b | Qualquer autenticado cria clínica; qualquer membro altera a clínica. | `0001_init.sql` | Média | Corrigido (owner/admin) |
| 1.3 | Qualquer autenticado altera ou apaga arquivos de qualquer clínica no bucket `media` (imagens de funis publicados). | `0002_builder_storage.sql`. Reproduzido. | Alta | Corrigido (pasta por clínica) |
| 1.3b | Sem limite de tipo e tamanho no Storage; SVG aceito. | `0002` | Média | Corrigido (bucket com limites) |
| 1.4 | Segredo de webhook, scripts e contatos internos em `flows.settings`, lido publicamente e enviado ao navegador no HTML/RSC do funil (`select('*')`). | `builder-client.tsx`, `lib/data/flows.ts`, policy "flows - public read published". Reproduzido. | Alta | Corrigido (tabela privada + colunas explícitas) |
| 1.5a | `POST /api/sessions` aceita `organization_id` e `score` do navegador. | `app/api/sessions/route.ts` | Alta | Corrigido |
| 1.5b | `PATCH /api/sessions` marca conversão de qualquer sessão só pelo UUID. | idem | Média | Corrigido (token assinado) |
| 1.5c | `/api/track` grava `organization_id` e `metadata` vindos do navegador. | `app/api/track/route.ts` | Média | Corrigido |
| 1.5d | Sem validação de tamanho nem limite de requisições nas APIs públicas. | APIs públicas | Média | Corrigido (Zod, 64 KB, rate limit) |
| 1.5e | `lead_answers` gravado sem checar erro: lead podia ficar sem respostas. | `sessions/route.ts` | Média | Corrigido (desfaz o lead) |
| 1.2c | Identificadores reservados validados só no app; a API do Supabase permitia gravar `admin`, `login`, `cliva`. | `lib/actions/org.ts` | Baixa | Corrigido (trigger no banco) |
| 2.2 | Editor não recarregava `flows.settings`: SEO, pixels e cookies voltavam ao padrão a cada abertura. | `builder-client.tsx` | Média | Corrigido junto com 1.4 |
| B1 | Excluir lead não funciona: não existe policy de DELETE em `lead_sessions`; a ação devolve sucesso sem apagar. | `lib/data/leads.ts:103`, `0001` | Média | Pendente (Entrega B) |
| 2.1 | Salvar funil apaga e reinsere etapas sem transação. | `lib/actions/flows.ts` | Alta | Pendente (Entrega B) |
| 2.4 | Agenda só no `localStorage`. | `components/schedule/schedule-board.tsx` | Média | Pendente (Entrega B) |
| 2.5 | URLs do checkout montadas com o header `Host`. | `lib/actions/billing.ts` | Baixa | Pendente (Entrega B) |
| 2.6 | `/f/<slug>` pode ser ambíguo (slug único por clínica). Hoje retorna 404 em caso de ambiguidade, sem vazar dados. | `lib/data/flows.ts` | Baixa | Pendente (Entrega B) |

## Dívida técnica registrada

- 23 avisos de lint, quase todos regras novas do React Compiler (`set-state-in-effect`, `purity`, `static-components`). Ficaram como aviso para não mudar comportamento às cegas.
- O build baixa 7 famílias de fonte do Google em `app/layout.tsx`. Uma falha temporária do Google Fonts derrubou um build local durante esta auditoria (repetido em seguida, passou). Tratar na Fase 5 (fontes locais ou por necessidade).
- O limite de requisições é por instância (memória). Para abuso distribuído, configurar regra de rate limit no firewall da Vercel.
- `images.remotePatterns` com `hostname: "**"` (Fase 5).
