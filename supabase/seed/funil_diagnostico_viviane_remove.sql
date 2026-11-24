-- Desfaz funil_diagnostico_viviane.sql na conta mamsbsb@icloud.com.
-- ATENÇÃO: apaga o funil e os LEADS dele (cascata). A profissional e o
-- procedimento da Agenda ficam (podem ter agendamentos).
delete from public.flows f
using public.organization_members m, auth.users u
where f.organization_id = m.organization_id and m.role = 'owner' and m.user_id = u.id
  and lower(u.email) = 'mamsbsb@icloud.com' and f.slug = 'checklist-consultorio-20k';
