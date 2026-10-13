# Plano de deploy seguro — Entregas A, B e C

Nada deste plano foi executado. Cada passo em produção depende de autorização.

## Dependência entre código e banco

A ordem é obrigatória: **primeiro a migration 0010, logo em seguida o deploy do código**.

- **Código novo sem a 0010**: a captura de leads continua funcionando (se a coluna `client_ref` não existir, o servidor grava sem ela), mas perde a proteção contra duplicidade, e as configurações privadas de integração salvas nesse intervalo não são guardadas. Evite publicar o código antes da migration.
- **A 0010 com o código antigo ainda no ar** funciona, com dois efeitos temporários até o deploy:
  - envio de imagens falha (o código antigo grava em `bio/`, pasta que a 0010 deixa de aceitar);
  - se alguém salvar um funil com segredo de webhook nesse intervalo, o banco tira o segredo do JSON e ele não é guardado (precisa digitar de novo depois).
- Funis abertos no navegador antes do deploy podem enviar `PATCH` sem token; o servidor novo recusa (403) e o lead fica sem a marca de clique no WhatsApp. Impacto pequeno e passa sozinho.

Por isso: aplicar a 0010 e fazer o merge em seguida, no mesmo horário.

### Entrega B (0011 e 0012)

Ordem: **0010 → 0011 → 0012 → deploy**, na mesma janela.

- **0011** depende da 0010 (usa `user_admin_org_ids`). Sem ela, o código salva funis pelo caminho antigo (não atômico) e o webhook da Stripe funciona sem a deduplicação. Nada quebra.
- **0012** cria a agenda no banco. Sem ela, a Agenda continua no navegador (modo antigo). Com ela, cada clínica vê um aviso para importar o que estiver salvo no navegador de quem usa; nada é importado sem clique.
- A agenda antiga fica no navegador de **cada pessoa**. Avisar as clínicas para abrirem a Agenda no computador onde costumam agendar e clicarem em **Importar** (o resumo mostra o que entrou e o que foi ignorado por duplicidade ou conflito).

### Entrega C (0013)

Ordem: **0010 → 0011 → 0012 → 0013 → deploy**, na mesma janela.

- **0013 com o código antigo no ar** funciona: o código antigo só grava tipos que continuam aceitos, e o painel antigo continua lendo `events`.
- **Código novo sem a 0013** não quebra: `/api/track` grava só os tipos antigos (sem `event_id`, etapa e UTM), a captura grava o lead sem `final_cta_clicked`, e as telas de Analytics mostram "métricas indisponíveis" em vez de números errados.
- Funis abertos antes do deploy mandam `PATCH` sem `action`: o servidor trata como WhatsApp, como antes.
- **Os números mudam de propósito** após o deploy: "inícios" deixa de ser igual a "visitas", conclusões não contam mais os descartados e formulário final não conta mais como WhatsApp. Avisar as clínicas que a comparação com semanas anteriores ao deploy não é direta.
- Abandono por etapa, origem das visitas e deduplicação só valem para eventos gravados depois da 0013. Leads já agendados antes dela não geram `appointment_booked` retroativo.
- Antes de aplicar, rode a primeira consulta de `supabase/verify/0013_verify.sql`: todos os tipos já gravados precisam estar na lista nova.

### 0014 (página pública do identificador)

Independe das outras: pode ser aplicada antes, sozinha, com o código atual no ar. Só amplia a leitura pública da clínica para quem tem Link na Bio publicado. Rollback: `supabase/rollback/0014_public_handle.rollback.sql`.

## Passo a passo

1. **Backup.** No Supabase: Database → Backups. No plano Free não há backup automático: exporte antes com `pg_dump` (ou Database → Backups → download, se disponível) e guarde o arquivo fora do Supabase.
2. **Conferência somente leitura.** Rode `supabase/verify/0010_verify.sql` e guarde o resultado (estado "antes").
3. **Staging (recomendado).** Crie um projeto Supabase de teste, aplique 0001 a 0010 em ordem e aponte uma preview da Vercel para ele. Testar: cadastro, login, editar e publicar funil, enviar foto, responder funil até o WhatsApp, painel admin.
4. **Janela.** Escolha um horário de pouco tráfego. A migration é rápida (segundos) e não bloqueia leitura dos funis.
5. **Aplicar 0010, 0011, 0012 e 0013**, nessa ordem, no SQL Editor de produção.
6. **Conferência** com `supabase/verify/0010_verify.sql`, `supabase/verify/0011_0012_verify.sql` e `supabase/verify/0013_verify.sql` (comparar com os comentários dos arquivos).
7. **Deploy:** merge da branch na `main` (a Vercel publica sozinha).
8. **Validação pós-deploy (15 min):**
   - abrir um funil publicado e concluir até o WhatsApp;
   - no painel: editar e salvar um funil, enviar uma imagem, abrir Configurações e Admin geral;
   - conferir em Leads se o lead de teste entrou com o score certo, e excluir o lead de teste;
   - criar uma lógica "vá para a etapa X" num funil, salvar, recarregar e conferir que continua apontando para X;
   - Agenda: criar profissional, agendamento, tentar sobrepor horário (deve recusar), abrir em outro navegador e ver o mesmo agendamento;
   - Analytics: abrir `/analytics`, trocar período e funil; responder um funil de teste até o fim e conferir +1 visita, +1 início, +1 conclusão e +1 WhatsApp; marcar o lead como Agendado e conferir +1 agendamento;
   - Supabase → Logs → API: procurar erros 401/403/42501 inesperados.
9. **Segredos expostos:** quem tinha segredo de webhook salvo deve gerar um novo no CRM de destino e salvar no editor (o antigo esteve legível em funis publicados).
10. **Rate limit na borda:** Vercel → Firewall → regra de rate limit para `/api/sessions`, `/api/track`, `/api/bio-click` (sugestão: 60 req/min por IP).
11. **Variável opcional:** `LEAD_TOKEN_SECRET` na Vercel (texto aleatório longo). Sem ela, o token é derivado da service role, o que funciona, mas trocar a service role invalida tokens de sessões em andamento.

## Monitoramento nas primeiras 48 h

- Vercel → Logs: respostas 4xx/5xx de `/api/sessions` e `/api/track` (as mensagens não contêm dados pessoais).
- Admin geral → contas: leads chegando normalmente.
- Reclamações de clientes sobre salvar funil ou enviar imagem (atendente não salva funil: comportamento novo e esperado).

## Rollback

- **Código:** reverter o merge na `main` (a Vercel publica a versão anterior).
- **Banco:** `supabase/rollback/0013_events.rollback.sql` (remove funções e gatilho, mantém colunas e eventos), `0012_schedule.rollback.sql` (não apaga a agenda), `0011_integrity.rollback.sql`, `0010_security_hardening.rollback.sql`, nessa ordem.
- O rollback da 0010 é só para emergência: reabre as falhas. Não apaga dados; copia as configurações privadas de volta ao funil. Testado em `tests/db/security.test.ts` (bloco ROLLBACK).
