# Plano de deploy seguro — Entrega A

Nada deste plano foi executado. Cada passo em produção depende de autorização.

## Dependência entre código e banco

A ordem é obrigatória: **primeiro a migration 0010, logo em seguida o deploy do código**.

- **Código novo sem a 0010**: a captura de leads continua funcionando (se a coluna `client_ref` não existir, o servidor grava sem ela), mas perde a proteção contra duplicidade, e as configurações privadas de integração salvas nesse intervalo não são guardadas. Evite publicar o código antes da migration.
- **A 0010 com o código antigo ainda no ar** funciona, com dois efeitos temporários até o deploy:
  - envio de imagens falha (o código antigo grava em `bio/`, pasta que a 0010 deixa de aceitar);
  - se alguém salvar um funil com segredo de webhook nesse intervalo, o banco tira o segredo do JSON e ele não é guardado (precisa digitar de novo depois).
- Funis abertos no navegador antes do deploy podem enviar `PATCH` sem token; o servidor novo recusa (403) e o lead fica sem a marca de clique no WhatsApp. Impacto pequeno e passa sozinho.

Por isso: aplicar a 0010 e fazer o merge em seguida, no mesmo horário.

## Passo a passo

1. **Backup.** No Supabase: Database → Backups. No plano Free não há backup automático: exporte antes com `pg_dump` (ou Database → Backups → download, se disponível) e guarde o arquivo fora do Supabase.
2. **Conferência somente leitura.** Rode `supabase/verify/0010_verify.sql` e guarde o resultado (estado "antes").
3. **Staging (recomendado).** Crie um projeto Supabase de teste, aplique 0001 a 0010 em ordem e aponte uma preview da Vercel para ele. Testar: cadastro, login, editar e publicar funil, enviar foto, responder funil até o WhatsApp, painel admin.
4. **Janela.** Escolha um horário de pouco tráfego. A migration é rápida (segundos) e não bloqueia leitura dos funis.
5. **Aplicar a 0010** no SQL Editor de produção.
6. **Conferência** com `supabase/verify/0010_verify.sql` (estado "depois", comparar com os comentários do arquivo).
7. **Deploy:** merge da branch na `main` (a Vercel publica sozinha).
8. **Validação pós-deploy (15 min):**
   - abrir um funil publicado e concluir até o WhatsApp;
   - no painel: editar e salvar um funil, enviar uma imagem, abrir Configurações e Admin geral;
   - conferir em Leads se o lead de teste entrou com o score certo;
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
- **Banco:** `supabase/rollback/0010_security_hardening.rollback.sql`. Só em emergência: reabre as falhas. Não apaga dados; copia as configurações privadas de volta ao funil. Testado em `tests/db/security.test.ts` (bloco ROLLBACK).
