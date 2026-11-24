-- ============================================================================
-- Cliva: funil "Checklist Consultório 20K" no dourado da VIKA e publicado.
-- Conta: mamsbsb@icloud.com. Rodar no SQL Editor DEPOIS do deploy da aba Design.
-- ============================================================================
--   1. Plano: passa a conta de cortesia para Elite (10 funis). O Pro permite 5
--      e a conta já tem 7, por isso o editor recusava publicar. Só mexe se a
--      conta for cortesia ("comp"); conta que paga pela Stripe não é alterada.
--   2. Tema do funil: dourado e logo da VIKA.
--   3. Publica este funil. Nenhum outro funil é alterado.

begin;
do $$
declare v_org uuid; v_flow uuid; v_pub int; v_max int;
begin
  select o.id into v_org from public.organizations o
  join public.organization_members m on m.organization_id = o.id and m.role = 'owner'
  join auth.users u on u.id = m.user_id
  where lower(u.email) = 'mamsbsb@icloud.com' order by o.created_at limit 1;
  if v_org is null then raise exception 'Conta mamsbsb@icloud.com não encontrada.'; end if;

  select id into v_flow from public.flows where organization_id = v_org and slug = 'checklist-consultorio-20k';
  if v_flow is null then raise exception 'Funil checklist-consultorio-20k não encontrado. Rode antes funil_diagnostico_viviane.sql.'; end if;

  update public.org_billing set plan = 'elite', updated_at = now()
  where organization_id = v_org and status = 'comp' and plan in ('inicial', 'essencial', 'pro');

  -- Mesmos limites do editor: não publica acima do plano.
  select case b.plan when 'inicial' then 1 when 'essencial' then 2 when 'pro' then 5 when 'elite' then 10 end into v_max
  from public.org_billing b where b.organization_id = v_org;
  select count(*) into v_pub from public.flows where organization_id = v_org and status = 'published' and id <> v_flow;
  if v_max is not null and v_pub >= v_max then
    raise exception 'O plano permite % funis publicados e a conta já tem %. Despublique um funil ou troque o plano no Admin.', v_max, v_pub;
  end if;

  update public.flows
  set status = 'published',
      settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('theme', jsonb_build_object(
        'primaryColor', '#946C28',
        'backgroundColor', '#FFFFFF',
        'textColor', '#1F1A14',
        'logoUrl', '/materiais/logo-by-vika.webp'
      ))
  where id = v_flow;
end $$;
commit;

select f.name as funil, f.status, f.settings->'theme'->>'primaryColor' as cor, b.plan || ' (' || b.status || ')' as plano,
       (select count(*) from public.flows x where x.organization_id = o.id and x.status = 'published') as funis_publicados,
       'cliva.me/' || o.slug || '/' || f.slug as link
from public.flows f
join public.organizations o on o.id = f.organization_id
join public.organization_members m on m.organization_id = o.id and m.role = 'owner'
join auth.users u on u.id = m.user_id
left join public.org_billing b on b.organization_id = o.id
where lower(u.email) = 'mamsbsb@icloud.com' and f.slug = 'checklist-consultorio-20k';
