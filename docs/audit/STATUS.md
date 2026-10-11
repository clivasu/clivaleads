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
| `npm test` (Vitest + Postgres real via PGlite) | feito, testado | 68 testes passando (após a Entrega B) |
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

## Entrega B — Fase 2

| Item | Situação | Evidência |
|---|---|---|
| 2.1 Save atômico do funil (função `save_flow`, RLS valendo) | feito, testado | erro numa etapa desfaz tudo; teste em `tests/db/integrity.test.ts` |
| 2.1 Ids de etapas estáveis e lógica (goto) preservada ao salvar | feito, testado | bug encontrado: salvar quebrava "vá para a etapa Y"; `tests/unit/flow-persistence.test.ts` |
| 2.1 Modelos criados com lógica entre etapas preservada | feito | mesmo mecanismo de ids |
| 2.2 Configurações salvas recarregam no editor | feito, testado | teste de ida e volta (SEO, pixels, cookies, privacidade, redirecionamento) |
| 2.3 Lead incompleto não é gravado (respostas falharam = lead desfeito) | feito (Entrega A) | `app/api/sessions/route.ts` |
| 2.3 Excluir lead funciona (policy de DELETE, respostas em cascata) | feito, testado | antes devolvia sucesso sem apagar |
| 2.3 Editar/excluir lead informa falha real | feito | `lib/data/leads.ts` |
| 2.4 Agenda no banco (profissionais, procedimentos, pacientes, agendamentos) | feito, testado no banco | `0012_schedule.sql`, `tests/db/schedule.test.ts` |
| 2.4 Sem horário sobreposto por profissional (cancelado não conta) | feito, testado | restrição `schedule_no_overlap` |
| 2.4 Isolamento entre clínicas e atendente com acesso | feito, testado | 9 testes |
| 2.4 Importação da agenda do navegador com confirmação e resumo | feito | banner na Agenda; cópia local só apagada a pedido |
| 2.4 Atualização entre dispositivos | feito | refresh ao voltar para a aba e a cada 60 s |
| 2.4 Teste em dois navegadores com Supabase real | autorização | depende de staging/produção |
| 2.5 Webhook Stripe idempotente e à prova de ordem | feito, testado | `lib/billing/sync.ts`, `tests/unit/billing.test.ts` |
| 2.5 Assinatura do webhook inválida/adulterada rejeitada | testado | 400 nos testes |
| 2.5 Origem canônica no checkout/portal | feito, testado | `lib/site-url.ts` |
| 2.5 Corrida no limite de funis publicados | pendente (risco aceito) | exige duas publicações simultâneas da mesma clínica; avaliar trigger no banco |
| 2.6 `/f/<slug>` → URL canônica, determinístico | feito | funil publicado mais antigo com o slug (dono do link antes da 0004) |
| Aplicar 0011 e 0012 em produção | autorização | `docs/audit/DEPLOY_SAFE.md` |

## Próximas entregas

| Entrega | Itens | Situação |
|---|---|---|
| C | eventos padronizados, deduplicação, agregações SQL, métricas com definição | pendente |
| D | pixels com consentimento, webhooks com HMAC/retry/anti-SSRF, SEO (canonical) | pendente |
| E | medições de performance, fontes, headers de segurança, observabilidade | pendente |
