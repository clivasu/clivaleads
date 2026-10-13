-- ROLLBACK da 0015 (entregas de webhook).
-- Ordem: reverter o CÓDIGO antes. O histórico de entregas não tem dados de
-- pacientes (só status e códigos), então pode ser removido.
begin;
drop table if exists public.webhook_deliveries;
alter table public.flow_private_settings drop column if exists webhook_include_answers;
commit;
select 'rollback da 0015: histórico de entregas removido' as aviso;
