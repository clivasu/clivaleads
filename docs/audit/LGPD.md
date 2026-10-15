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
6. **Pixels (Entrega D):** Meta, GA4 e TikTok por ID validado; carregam **só depois de "Aceitar"** no aviso de cookies do funil (obrigatório quando há pixel; "Recusar" impede qualquer carregamento). Eventos enviados: visita, `Lead` (concluiu o funil) e `Contact` (abriu o WhatsApp), **sem parâmetros**. Meta com `autoConfig` desligado e sem correspondência avançada; GA4 sem Google Signals e sem personalização de anúncios. Verificado no navegador: nenhuma requisição antes do consentimento; depois, nenhuma resposta ou dado de contato nas URLs dos pixels. **GTM desativado** (executa scripts livres configurados fora da Cliva). **Microsoft Clarity e gravação de sessão: não usados** no projeto.
7. **Webhooks (Entrega D):** conteúdo mínimo (contato, procedimento, interesse, origem); respostas do questionário só com opt-in da clínica; assinatura HMAC; destino só `https` público (proteção contra SSRF); histórico sem dados do paciente. Ver `docs/integrations/WEBHOOKS.md`.
8. **Escolha de cookies** guardada só no navegador do paciente (`localStorage`, por clínica), sem dado pessoal.

## Pendências (próximas entregas)

- **Fontes externas:** o site carrega fontes de `api.fontshare.com`, o que envia o IP do visitante a terceiros antes de qualquer consentimento. Hospedar localmente (Entrega E).
- **Retenção:** definir prazo de guarda dos leads e dos eventos por clínica (sugestão inicial: eventos brutos 13 meses, agregados depois).
- **Consentimento registrado:** o texto de consentimento do formulário é exibido, mas a escolha não é gravada com data/versão. Avaliar com jurídico se a base legal escolhida exige registro.
- **Exportação dos dados de um paciente** a pedido da clínica.
- **Notificação por e-mail/WhatsApp de novo lead:** campos guardados, envio ainda não existe (marcado "em breve").
