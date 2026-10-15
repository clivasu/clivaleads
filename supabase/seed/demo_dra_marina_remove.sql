-- ============================================================================
-- Cliva — remove a DEMONSTRAÇÃO da Dra. Marina (conta mamsbsb@icloud.com)
-- Apaga só o que o script de demonstração criou: os 6 funis (com leads,
-- respostas e eventos em cascata), leads/eventos "demo-…", agendamentos e
-- pacientes marcados "demo-seed". Procedimentos e a profissional ficam se
-- tiverem agendamentos reais; senão, também saem.
-- ============================================================================
do $$
declare v_org uuid;
begin
  select o.id into v_org
  from public.organizations o
  join public.organization_members m on m.organization_id = o.id and m.role = 'owner'
  join auth.users u on u.id = m.user_id
  where lower(u.email) = 'mamsbsb@icloud.com'
  order by o.created_at limit 1;
  if v_org is null then raise exception 'Conta não encontrada.'; end if;

  delete from public.flows where organization_id = v_org
    and slug in ('limpeza-de-pele','peeling-de-diamante','microagulhamento','drenagem-linfatica','roleta-premiada','roleta-da-sorte');
  delete from public.lead_sessions where organization_id = v_org and session_id like 'demo-%';
  delete from public.events where organization_id = v_org and session_id like 'demo-%';
  delete from public.schedule_appointments where organization_id = v_org and notes = 'demo-seed';
  delete from public.schedule_patients where organization_id = v_org and notes = 'demo-seed';
  delete from public.schedule_procedures p where p.organization_id = v_org
    and p.name in ('Limpeza de pele','Peeling de diamante','Microagulhamento','Drenagem linfática')
    and not exists (select 1 from public.schedule_appointments a where a.organization_id = v_org and lower(a.procedure_name) = lower(p.name));
  delete from public.schedule_professionals pr where pr.organization_id = v_org and lower(pr.name) = 'dra. marina'
    and not exists (select 1 from public.schedule_appointments a where a.professional_id = pr.id);
  raise notice 'Demonstração removida.';
end $$;
