-- ============================================================================
-- Verificação SOMENTE LEITURA da 0010 (pode rodar em produção sem risco).
-- Cada consulta mostra o valor esperado no comentário.
-- ============================================================================

-- 1) Colunas de profiles que o papel authenticated pode atualizar.
--    Esperado: só full_name e avatar_url.
select column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee = 'authenticated' and privilege_type = 'UPDATE'
order by column_name;

-- 2) Privilégios de escrita do cliente em organization_members / organizations.
--    Esperado: organization_members sem INSERT/UPDATE/DELETE; organizations sem INSERT/DELETE.
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('authenticated', 'anon')
  and table_name in ('organization_members', 'organizations')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
order by table_name, privilege_type;

-- 3) Políticas atuais nas tabelas sensíveis.
--    Esperado: sem "members - insert self", sem "org - insert by authenticated",
--    flows/steps/bio com "member read" + "admin insert/update/delete".
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('organizations', 'organization_members', 'flows', 'flow_steps', 'bio_pages', 'lead_sessions', 'flow_private_settings')
order by tablename, policyname;

-- 4) Políticas do Storage. Esperado: "media public read" + "media org insert/update/delete".
select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname;

-- 5) Limites do bucket media. Esperado: 52428800 e lista sem image/svg+xml.
select id, file_size_limit, allowed_mime_types from storage.buckets where id = 'media';

-- 6) Funis que ainda têm segredo no JSON público. Esperado: 0.
select count(*) as funis_com_segredo_publico
from public.flows
where settings ?| array['webhookUrl', 'webhookSecret', 'headScripts', 'notifyEmail', 'notifyWhatsapp'];

-- 7) Configurações privadas migradas (quantas, sem mostrar valores).
select count(*) as total,
       count(webhook_secret) as com_segredo,
       count(head_scripts) as com_scripts_guardados
from public.flow_private_settings;

-- 8) Barreiras ativas. Esperado: 3 linhas.
select tgname from pg_trigger
where tgname in ('profiles_guard_admin', 'organizations_guard_slug', 'flows_strip_private_settings')
  and not tgisinternal;

-- 9) Quem é superadmin hoje (conferir se só as contas esperadas).
select u.email from public.profiles p join auth.users u on u.id = p.id where p.is_super_admin;

-- 10) Vínculos com clínica que NÃO vieram do cadastro (usuário em mais de uma
--     clínica). Antes da 0010 qualquer um podia se vincular: revisar se houver.
select m.user_id, count(*) as clinicas
from public.organization_members m
group by m.user_id having count(*) > 1;
