# Status da auditoria

Legenda: **feito** (código pronto na branch) · **testado** (teste automatizado ou manual executado) · **pendente** · **bloqueado** · **autorização** (precisa de autorização para produção).

Branch: `fix/security-integrity-cliva`. Nada aplicado em produção.

## Entrega A — Fase 0 e Fase 1

| Item | Situação | Evidência |
|---|---|---|
| Inventário e baseline | feito | `docs/audit/BASELINE.md` |
| Next.js 16.3.5 → 16.3.8, `npm audit` de produção zerado | feito, testado | `npm audit --omit=dev`: 0 vulnerabilidades |
| `npm run lint` (ESLint 9) | feito, testado | 0 erros, 23 avisos registrados |
| `npm run typecheck` | testado | sem erros |
| `npm test` (Vitest + Postgres real via PGlite) | feito, testado | 35 testes passando |
| `npm run build` / `build:local` | testado | build local com webpack passa |
| CI (GitHub Actions) | feito | `.github/workflows/ci.yml`; roda quando a branch for enviada |
| 1.1 Sem autoelevação a superadmin | feito, testado | grant por coluna + trigger; teste ANTES/DEPOIS |
| 1.2 Sem vínculo/criação de clínica pelo cliente | feito, testado | policies removidas; teste ANTES/DEPOIS |
| 1.2 Papéis owner/admin/attendant | feito, testado | atendente lê e atualiza leads, não edita funil nem clínica |
| 1.2 Identificador reservado no banco | feito, testado | trigger `organizations_guard_slug` |
| 1.2 Convite de equipe com token | pendente | não existe tela de equipe hoje; vínculo só pelo cadastro |
| 1.3 Storage por pasta da clínica | feito, testado | policies + upload em `<clinica>/img|video/` |
| 1.3 Limite de tipo/tamanho no Storage | feito, testado | 50 MB, sem SVG |
| 1.4 Segredos fora do funil público | feito, testado | `flow_private_settings`; funil público sem `settings` |
| 1.4 Segredo mascarado no editor | feito | campo mostra "configurado"; vazio mantém o atual |
| 1.4 Rotação dos segredos já expostos | autorização | segredos que estavam públicos devem ser trocados no CRM de destino |
| 1.5 APIs públicas validadas (Zod, 64 KB, rate limit) | feito, testado | testes de unidade + chamadas reais ao servidor local |
| 1.5 Clínica derivada do funil; score no servidor | feito, testado | `lib/security/scoring.ts` |
| 1.5 Token de posse para o PATCH do WhatsApp | feito, testado | `lib/security/lead-token.ts` |
| 1.5 Idempotência da captura (`client_ref`) | feito, testado no banco | índice único + reaproveitamento no POST |
| 1.5 Rate limit distribuído (firewall Vercel) | autorização | configurar no painel da Vercel |
| 1.6 Scripts livres no `<head>` desativados | feito | campo substituído por aviso; conteúdo antigo guardado e não executado |
| 1.6 Mapa de dados e LGPD | feito | `docs/audit/LGPD.md` (revisão jurídica recomendada) |
| Aplicar 0010 em produção | autorização | seguir `docs/audit/DEPLOY_SAFE.md` |

## Próximas entregas

| Entrega | Itens | Situação |
|---|---|---|
| B | 2.1 save atômico do funil, 2.3 exclusão de lead (policy) e erros silenciosos, 2.4 agenda no banco com importação do localStorage, 2.5 Stripe (idempotência, origem canônica), 2.6 slugs | pendente |
| C | eventos padronizados, deduplicação, agregações SQL, métricas com definição | pendente |
| D | pixels com consentimento, webhooks com HMAC/retry/anti-SSRF, SEO | pendente |
| E | medições de performance, fontes, headers de segurança, observabilidade | pendente |
