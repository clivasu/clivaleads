-- ============================================================================
-- Cliva: datas da sessão gratuita da Dra. Viviane (funil checklist-consultorio-20k)
-- Conta: mamsbsb@icloud.com. Rodar DEPOIS do deploy de "Datas do mês".
-- ============================================================================
--   Semana de 30/11: seg, qua, qui e sex (sem terça) 18h-19h, 19h-20h, 20h-21h;
--                    sábado 05/12 das 8h às 18h.
--   Semana de 07/12: segunda a sexta 18h-19h, 19h-20h, 20h-21h;
--                    sábado 12/12 das 8h às 18h.
--   Horários de hora em hora (sessão de 60 min): 18h, 19h e 20h; sábado 8h às 17h.
-- Só altera o bloco de agendamento desse funil. Rodar de novo dá o mesmo resultado.

begin;
do $$
declare
  noite jsonb := '[{"start":"18:00","end":"19:00"},{"start":"19:00","end":"20:00"},{"start":"20:00","end":"21:00"}]';
  sabado jsonb := '[{"start":"08:00","end":"18:00"}]';
  datas jsonb;
  n int;
begin
  datas := jsonb_build_array(
    jsonb_build_object('date', '2026-11-30', 'ranges', noite),
    jsonb_build_object('date', '2026-12-02', 'ranges', noite),
    jsonb_build_object('date', '2026-12-03', 'ranges', noite),
    jsonb_build_object('date', '2026-12-04', 'ranges', noite),
    jsonb_build_object('date', '2026-12-05', 'ranges', sabado),
    jsonb_build_object('date', '2026-12-07', 'ranges', noite),
    jsonb_build_object('date', '2026-12-08', 'ranges', noite),
    jsonb_build_object('date', '2026-12-09', 'ranges', noite),
    jsonb_build_object('date', '2026-12-10', 'ranges', noite),
    jsonb_build_object('date', '2026-12-11', 'ranges', noite),
    jsonb_build_object('date', '2026-12-12', 'ranges', sabado)
  );

  update public.flow_steps s
  set config = s.config || jsonb_build_object('booking_mode', 'dates', 'booking_dates', datas, 'booking_slot_minutes', 60, 'booking_view', 'month')
  from public.flows f
  join public.organization_members m on m.organization_id = f.organization_id and m.role = 'owner'
  join auth.users u on u.id = m.user_id
  where s.flow_id = f.id and s.type = 'booking'
    and lower(u.email) = 'mamsbsb@icloud.com' and f.slug = 'checklist-consultorio-20k';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Bloco de agendamento do funil checklist-consultorio-20k não encontrado.'; end if;
end $$;
commit;

select s.config->>'booking_mode' as modo, jsonb_array_length(s.config->'booking_dates') as datas,
       s.config->'booking_dates'->0->>'date' as primeira, s.config->'booking_dates'->-1->>'date' as ultima,
       s.config->>'booking_slot_minutes' as intervalo_min
from public.flow_steps s
join public.flows f on f.id = s.flow_id
join public.organization_members m on m.organization_id = f.organization_id and m.role = 'owner'
join auth.users u on u.id = m.user_id
where s.type = 'booking' and lower(u.email) = 'mamsbsb@icloud.com' and f.slug = 'checklist-consultorio-20k';
