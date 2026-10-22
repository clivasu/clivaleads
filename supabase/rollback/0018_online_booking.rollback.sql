-- ROLLBACK da 0018. Reverter o código antes.
-- Mantém os agendamentos (inclusive os feitos pelo funil) e só remove as
-- colunas de origem, as regras do agendamento online e as notificações.
begin;
drop table if exists public.notifications;
drop table if exists public.schedule_booking_settings;
drop index if exists public.schedule_appointments_booking_ref_key;
alter table public.schedule_appointments
  drop column if exists booking_ref,
  drop column if exists lead_session_id,
  drop column if exists flow_id,
  drop column if exists source;
alter table public.schedule_procedures drop column if exists duration_min;
commit;
select 'rollback da 0018: agendamentos mantidos' as aviso;
