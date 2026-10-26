# Status da auditoria

Legenda: **feito** (código pronto na branch) · **testado** (teste automatizado ou manual executado) · **pendente** · **bloqueado** · **autorização** (precisa de autorização para produção).

Branch: `fix/security-integrity-cliva`, com merge na `main` (PR #1, `bdffdaf`) em 2026-10-12.

**Produção (2026-10-12):** migrations 0010 a 0014 aplicadas no Supabase; deploy `bdffdaf` no ar em cliva.me; teste com login aprovado (funis, imagens, leads, Analytics, Agenda, admin). Pendentes: rotação das credenciais expostas, rate limit no firewall da Vercel, variável `LEAD_TOKEN_SECRET`.

## Entrega A — Fase 0 e Fase 1

| Item | Situação | Evidência |
|---|---|---|
| Inventário e baseline | feito | `docs/audit/BASELINE.md` |
| Next.js 16.3.5 → 16.3.8, `npm audit` de produção zerado | feito, testado | `npm audit --omit=dev`: 0 vulnerabilidades |
| `npm run lint` (ESLint 9) | feito, testado | 0 erros, 24 avisos registrados (nenhum nos arquivos da Entrega C) |
| `npm run typecheck` | testado | sem erros |
| `npm test` (Vitest + Postgres real via PGlite) | feito, testado | 133 testes passando (após a Entrega D) |
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
| Aplicar 0010 em produção | feito (2026-10-12) | seguir `docs/audit/DEPLOY_SAFE.md` |

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
| Aplicar 0011 e 0012 em produção | feito (2026-10-12) | `docs/audit/DEPLOY_SAFE.md` |

## Entrega C — Fase 3

| Item | Situação | Evidência |
|---|---|---|
| Eventos padronizados (`page_view`, `flow_started`, `step_view`, `step_completed`, `flow_completed`, `flow_exited`, `whatsapp_clicked`, `lead_qualified`, `appointment_booked`) | feito, testado | `0013_events.sql`; tipos antigos mantidos no check |
| `flow_started` só na primeira interação real (não na abertura) | feito | `components/flow-runner/flow-runner.tsx` |
| `step_view`/`step_completed` só com posição e id interno da etapa (nunca resposta) | feito, testado | validação Zod recusa metadados |
| `flow_completed` não conta quem foi para o final "sem interesse" (`flow_exited`) | feito, testado | fixture v3 |
| `whatsapp_clicked` só quando o WhatsApp abre; formulário/"Continuar" viram `final_cta_clicked` | feito, testado | fixture v4; PATCH com `action` |
| Corrida POST × PATCH (clique enquanto o lead é gravado) | feito | cliques pendentes aplicados após o POST |
| `lead_qualified` gravado pelo servidor (score ≥ 61), uma vez por lead | feito, testado | índice único `(lead_session_id, type)` |
| `appointment_booked` só quando a clínica marca agendado/convertido, uma vez por lead | feito, testado | gatilho no banco; vale para qualquer tela |
| Código de tracking morto removido (`question_viewed`, `option_clicked`, `flow_disqualified`) | feito | eram descartados pelo servidor |
| `event_id` e deduplicação de reenvio | feito, testado | índice único + upsert `ignoreDuplicates` |
| Visitas × visitantes únicos × inícios × conclusões × leads com contato × cliques × agendamentos | feito, testado | `analytics_overview` (números exatos na fixture) |
| Agregações no banco (sem o limite de 1.000 linhas nem o recorte de 200 leads) | feito, testado | RPCs `analytics_overview` e `analytics_answers` (RLS valendo) |
| Isolamento entre clínicas nas métricas | feito, testado | clínica B pedindo o id da A recebe zeros |
| Taxas com denominador explícito e período anterior comparável | feito, testado | `lib/analytics/metrics.ts`, `period.ts` |
| Filtros: período, funil, procedimento, origem, campanha | feito, testado | UTM gravada também nos eventos |
| Paginação da lista de leads no banco | feito | 50 por página, total exato |
| "Receita" renomeada para **potencial estimado** | feito | tooltip explica que não é faturamento |
| Sem números demo com banco real; "sem dados" quando vazio | feito | demo só sem Supabase |
| Gráficos (Recharts) com definição de cada métrica no ⓘ | feito | `/analytics` e resumo em `/flows` |
| Editar/excluir lead desfaz na tela se o banco recusar | feito | `components/leads/leads-table.tsx` |
| Abandono por etapa | feito | só com funil selecionado e só com dados registrados após a 0013 |
| Preço por procedimento configurável pela clínica | pendente | hoje usa ticket fixo (rotulado como estimativa) |
| Receita confirmada | pendente | não existe fonte de receita real no sistema |
| Aplicar 0013 em produção | feito (2026-10-12) | `docs/audit/DEPLOY_SAFE.md` |
| Bug: `cliva.me/<identificador>` dava 404 para conta só com Link na Bio publicado (ou sem funil publicado) | feito, testado | `0014_public_handle.sql`, `tests/db/public-handle.test.ts`; independe das outras migrations |

## Entrega D — Fase 4

| Item | Situação | Evidência |
|---|---|---|
| Pixels Meta, GA4 e TikTok funcionando (antes: só salvos, nada carregava) | feito, testado | `components/flow-runner/marketing-pixels.tsx`; verificado no navegador |
| IDs de pixel validados por provedor (editor e servidor) | feito, testado | `lib/public-funnel-config.ts` |
| Pixels só após consentimento; "Recusar" impede carregamento; link "Cookies" para rever | feito, testado | rede: 0 requisições antes de aceitar |
| Eventos aos pixels sem respostas, contato ou score | feito, testado | rede: só `PageView`, `Lead`, `Contact`, sem parâmetros |
| GTM desativado (scripts livres) | feito | ID salvo guardado e não carregado |
| Microsoft Clarity / gravação de sessão | não usado | nenhum script no projeto |
| SEO do funil: título, descrição, imagem OG, favicon, noindex, canonical | feito, testado | `lib/seo.ts`; rota `/<identificador>/<funil>` |
| `robots.txt` (painel e APIs fora do índice) | feito | `app/robots.ts` |
| Redirecionar após conversão (https) | feito | `flow-runner.tsx` |
| Texto de consentimento e link de privacidade no funil | feito | formulário e rodapé |
| Webhook: fila durável, idempotente, 6 tentativas com espera crescente | feito, testado | `0015_webhooks.sql`, `lib/integrations/webhook-outbox.ts` |
| Webhook: assinatura HMAC, segredo gerado e rotacionável, nunca exibido de novo | feito, testado | `X-Cliva-Signature`; `docs/integrations/WEBHOOKS.md` |
| Webhook: proteção contra SSRF (https público, IP checado depois do DNS, sem redirecionamento) | feito, testado | 30 casos em `tests/unit/integrations.test.ts` |
| Webhook: respostas do questionário só com opt-in | feito, testado | desligado por padrão |
| "Testar webhook" real, sem criar lead | feito | `lib/actions/webhooks.ts` |
| Histórico de entregas e "Reenviar" | feito, testado | RLS: só owner/admin da clínica |
| Reiniciar ao concluir, Permitir voltar, Salvar progresso, CSS personalizado | em breve | marcados no editor; antes pareciam ativos |
| Notificação de novo lead por e-mail/WhatsApp | pendente | não aparece no editor; sem envio |
| Domínio personalizado | em breve | arquitetura em `docs/integrations/CUSTOM_DOMAINS.md` |
| Aplicar 0015 em produção e `CRON_SECRET` na Vercel | autorização | `docs/audit/DEPLOY_SAFE.md` |

## Demonstração e Dashboard real (fora do plano da auditoria)

| Item | Situação | Evidência |
|---|---|---|
| Dashboard inicial lê a agenda (antes: zeros fixos em conta real) | feito, testado | `0016_dashboard_home.sql`, `lib/data/home.ts` |
| Preço por procedimento; receita = atendimentos concluídos | feito, testado | `schedule_procedures.price_cents` |
| Script de demonstração da Dra. Marina (dados fictícios) e remoção | feito, testado | `supabase/seed/`, `tests/db/demo-seed.test.ts` |

## Agendamento online (fora do plano da auditoria)

| Item | Situação | Evidência |
|---|---|---|
| Bloco "Agendamento" no funil com horários livres reais | feito, testado | `components/flow-runner/booking-step.tsx`, `lib/booking/slots.ts` |
| Regras por clínica (horário, pausa, antecedência, janela, feriados, bloqueios, confirmação) | feito, testado | Configurações; `0018_online_booking.sql` |
| Sem horário duplo (concorrência) e sem pedido duplicado | feito, testado | `tests/db/booking.test.ts` |
| Notificações no calendário do topo (contagem de não lidas) | feito, testado | `components/dashboard/booking-notifications.tsx`; RLS testada |
| Aplicar 0018 em produção | autorização | `docs/integrations/AGENDAMENTO_ONLINE.md` |

## Fichas de pacientes e lead manual (fora do plano da auditoria)

| Item | Situação | Evidência |
|---|---|---|
| Página Pacientes (busca por nome/telefone/CPF, atendimentos, último e próximo) | feito | `app/(dashboard)/patients` |
| Ficha completa: dados pessoais, endereço, emergência, anamnese, alertas de saúde, consentimento LGPD | feito, testado | `lib/patients.ts`, `components/patients/patient-chart.tsx` |
| Histórico de atendimentos e origem (lead do funil e respostas) | feito | aba Atendimentos / Origem |
| CPF validado e único por clínica | feito, testado | `0019_patient_records.sql`, `tests/db/patients.test.ts` |
| Lead manual (página Leads) fora das métricas e da cota do plano | feito, testado | RLS `source = 'manual'` |
| Novo agendamento: busca de pacientes e leads, preenchimento automático | feito | `components/schedule/appointment-modal.tsx` |
| Aplicar 0019 em produção | autorização | `supabase/deploy/APLICAR_0019.sql` |

## Próximas entregas

| Entrega | Itens | Situação |
|---|---|---|
| E | medições de performance, fontes, headers de segurança, observabilidade | pendente |
