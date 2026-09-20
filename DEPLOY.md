# Prelead — Do zero ao ar (Supabase + Vercel)

Guia único para sair do modo demo e publicar o MVP. Tempo: ~15 min.

---

## Parte 1 — Supabase (banco + login + storage)

1. Crie um projeto em https://supabase.com (plano free serve).
2. Abra **SQL Editor** e rode, **nesta ordem**, o conteúdo de cada arquivo:
   1. `supabase/migrations/0001_init.sql` — schema, RLS e políticas.
   2. `supabase/migrations/0002_builder_storage.sql` — blocos novos, coluna `settings`, bucket de imagens (`media`) e criação automática de organização a cada novo cadastro.
   3. `supabase/seed.sql` — *(opcional)* Clínica Demo + 3 funis de exemplo.
3. Em **Project Settings → API**, copie:
   - `Project URL`
   - `anon public` key
   - `service_role` key (secreta — só no servidor)
4. Em **Authentication → Providers → Email**: deixe **Email** ativo. Para testar rápido, desligue "Confirm email" (senão precisa confirmar por e-mail antes de entrar).

### Rodar local com o banco conectado

```bash
cp .env.example .env.local
```

Preencha as 3 variáveis no `.env.local` e rode:

```bash
npm install
npm run dev
```

Crie sua conta em http://localhost:3000/login — o cadastro **já cria sua organização automaticamente** (migration 0002). O painel abre com dados reais (vazios até você criar um funil).

> Rodou o `seed.sql` e quer os funis de exemplo no seu usuário? No SQL Editor:
> ```sql
> insert into public.organization_members (organization_id, user_id, role)
> select '11111111-1111-1111-1111-111111111111', id, 'owner'
> from auth.users where email = 'SEU_EMAIL_AQUI'
> on conflict do nothing;
> ```

---

## Parte 2 — Vercel (publicar)

1. Suba o código para o GitHub (o `git init` e o primeiro commit já estão feitos):
   ```bash
   git remote add origin https://github.com/SEU_USUARIO/prelead.git
   git push -u origin main
   ```
2. Em https://vercel.com → **Add New → Project** → importe o repositório.
3. Framework: **Next.js** (detecta sozinho). Não precisa mudar build command.
4. Em **Environment Variables**, adicione as mesmas 3 do `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. **Deploy**.
6. No Supabase, em **Authentication → URL Configuration**, coloque a URL da Vercel em **Site URL** e em **Redirect URLs** (ex.: `https://prelead.vercel.app`).

Pronto. O funil público fica em `https://seu-projeto.vercel.app/f/SLUG-DO-FUNIL`.

---

## O que já funciona de verdade (com Supabase conectado)

- **Login/cadastro** com criação automática de organização.
- **Criar funil** (`/flows/new`) e **editar no builder** com **Salvar** persistindo funil + etapas (inclui blocos aninhados) + todas as Configurações (pixels, webhook, SEO, LGPD...).
- **Funil público** (`/f/[slug]`) servindo do banco, com captura de sessão do lead, respostas, UTMs e eventos.
- **Painel**: dashboard, leads, analytics — lendo eventos/respostas reais.
- **Upload de imagens**: bucket `media` público criado (Storage) — pronto para o próximo incremento de UI de upload.

## Ainda em modo demo (não persiste)

- Sem `.env.local`, tudo roda com dados de exemplo em memória — ótimo para demonstrar sem banco.

## Próximos incrementos sugeridos

- UI de **upload de imagem** (Hero/OG) direto para o bucket `media`.
- **Disparar os pixels** (Meta/GA/TikTok) salvos em Configurações na página pública.
- **Enviar o webhook** ao concluir o funil (lead → CRM), lendo `settings.webhookUrl`.
