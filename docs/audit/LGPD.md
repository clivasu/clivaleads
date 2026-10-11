# Dados pessoais e de saúde — mapa e decisões (Entrega A)

Documento técnico de apoio. Não substitui avaliação jurídica: as respostas dos questionários podem conter dado pessoal sensível (saúde), o que exige base legal adequada e revisão por profissional de privacidade.

## Papéis

- **Clínica (cliente da Cliva):** controladora dos dados dos pacientes que respondem aos funis dela. Define a finalidade (pré-atendimento, contato pelo WhatsApp).
- **Cliva:** operadora, trata os dados em nome da clínica. Também é controladora dos dados de cadastro das próprias clínicas (nome, e-mail, cobrança).

## O que é coletado nos funis

| Dado | Onde fica | Quem acessa |
|---|---|---|
| Respostas do questionário (podem incluir queixas de saúde) | `lead_answers` | membros da clínica (RLS) |
| Nome, telefone, e-mail (formulário do funil) | `lead_sessions` | membros da clínica |
| Score calculado | `lead_sessions.score` | membros da clínica |
| Dispositivo, navegador, página de entrada, referrer, UTMs | `lead_sessions` | membros da clínica |
| Eventos (visita, início, conclusão, clique no WhatsApp) sem conteúdo | `events` | membros da clínica |
| Identificador anônimo do navegador (`pl_sid`, cookie de 180 dias) | cookie + `lead_sessions`/`events` | interno |

## Decisões aplicadas nesta entrega

1. **Scripts livres no `<head>` desativados.** O campo permitia colar qualquer JavaScript no funil, o que poderia ler as respostas e o formulário de saúde e enviá-los a terceiros. Conteúdo já salvo foi guardado em `flow_private_settings.head_scripts` e **não é executado**. Integrações de marketing voltarão na Entrega D só por provedores permitidos (IDs validados) e com consentimento.
2. **Eventos sem conteúdo.** `/api/track` não grava mais `metadata` vinda do navegador; só tipo do evento, funil e clínica. Nenhuma resposta, nome ou telefone vai para eventos.
3. **Segredos e contatos internos fora do funil público** (`flow_private_settings`).
4. **Isolamento entre clínicas** reforçado no banco (RLS + grants), testado em `tests/db/security.test.ts`.
5. **Logs sem dados pessoais:** as APIs públicas registram só códigos de erro.
6. **Pixels (Meta, GA4, GTM, TikTok):** os campos existem no editor, mas **não estão ativos** (nenhum script é carregado). Ao ativar (Entrega D): nunca enviar respostas, nome, telefone, e-mail ou score; carregar só após consentimento quando exigido; avaliar à parte qualquer gravação de sessão (ex.: Microsoft Clarity) em formulários de saúde.

## Pendências (próximas entregas)

- **Exclusão de lead** (direito de eliminação): hoje a exclusão não funciona por falta de policy de DELETE. Corrigir na Entrega B.
- **Retenção:** definir prazo de guarda dos leads e dos eventos por clínica (sugestão inicial: eventos brutos 13 meses, agregados depois).
- **Consentimento registrado:** o texto de consentimento do formulário é exibido, mas a escolha não é gravada com data/versão. Avaliar com jurídico se a base legal escolhida exige registro.
- **Exportação dos dados de um paciente** a pedido da clínica.
- **Webhooks:** payload mínimo, assinatura HMAC e opt-in explícito para envio de respostas (Entrega D).
