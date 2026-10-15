-- ROLLBACK da 0016. Reverter o código antes (o Dashboard volta aos zeros).
-- O preço dos procedimentos é mantido (não atrapalha o código antigo).
drop function if exists public.dashboard_home(uuid, timestamptz);
select 'rollback da 0016: função do dashboard removida; preços mantidos' as aviso;
