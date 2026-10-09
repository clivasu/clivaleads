# Templates de e-mail do Supabase Auth (Cliva)

Cole cada arquivo em Supabase > Authentication > Emails, no template correspondente (aba Source).
Os links apontam para `/auth/confirm` do app, que valida o token e abre a sessão.
Requer **Site URL = https://cliva.me** em Authentication > URL Configuration.

| Template no Supabase | Arquivo | Assunto (Subject) |
|---|---|---|
| Confirm sign up | `01-confirmar-cadastro.html` | Confirme seu e-mail na Cliva |
| Invite user | `02-convite.html` | Você foi convidado para a Cliva |
| Magic link or OTP | `03-link-magico.html` | Seu acesso à Cliva |
| Change email address | `04-troca-de-email.html` | Confirme seu novo e-mail na Cliva |
| Reset password | `05-redefinir-senha.html` | Redefina sua senha da Cliva |
| Reauthentication | `06-reautenticacao.html` | Seu código de verificação da Cliva |
