-- ROLLBACK da 0017. Reverter o código antes (o Dashboard volta à visão do mês).
drop function if exists public.dashboard_period(uuid, timestamptz, timestamptz, text, timestamptz);
select 'rollback da 0017: função removida' as aviso;
