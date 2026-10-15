-- Conferência SOMENTE LEITURA depois de aplicar a 0015 (uma tabela só).
select 1 as n, 'tabela webhook_deliveries com RLS' as item,
       exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'webhook_deliveries' and rowsecurity) as ok
union all
select 2, 'uma entrega por lead (índice único)', exists (select 1 from pg_indexes where indexname = 'webhook_deliveries_once')
union all
select 3, 'coluna webhook_include_answers (padrão desligado)',
       exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'flow_private_settings'
               and column_name = 'webhook_include_answers' and column_default = 'false')
union all
select 4, 'cliente não grava entregas',
       not has_table_privilege('authenticated', 'public.webhook_deliveries', 'insert')
       and not has_table_privilege('anon', 'public.webhook_deliveries', 'select')
union all
select 5, 'segredo do webhook continua invisível ao cliente',
       not has_column_privilege('authenticated', 'public.flow_private_settings', 'webhook_secret', 'select')
order by 1;
