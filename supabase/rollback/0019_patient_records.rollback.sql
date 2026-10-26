-- ROLLBACK da 0019. Reverter o código antes.
-- Mantém as fichas e os leads manuais (dados de pacientes); remove só a
-- permissão de criar lead manual. Para voltar flow_id a obrigatório seria
-- preciso apagar os leads manuais: não fazer sem autorização.
drop policy if exists "lead_sessions - member insert manual" on public.lead_sessions;
revoke insert on public.lead_sessions from authenticated;
select 'rollback da 0019: criação de lead manual desligada; dados mantidos' as aviso;
