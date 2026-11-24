-- ============================================================================
-- Cliva: funil "Checklist Consultório 20K" (Dra. Viviane, Método VIKA)
-- Conta: mamsbsb@icloud.com. Rodar no SQL Editor do Supabase.
-- Requer as migrations até a 0019 e o deploy com o bloco "Material grátis".
-- ============================================================================
--
-- Só acrescenta, e só na clínica dessa conta:
--   - 1 funil em RASCUNHO (9 etapas), slug checklist-consultorio-20k;
--   - 1 procedimento na Agenda (R$ 0, para a sessão gratuita não somar receita);
--   - 1 profissional "Dra. Viviane" na Agenda, se ainda não houver uma Viviane.
-- Não altera nem apaga nada que já existe. Rodar de novo não duplica.
-- Desfazer: funil_diagnostico_viviane_remove.sql

begin;
do $$
declare
  v_email text := 'mamsbsb@icloud.com';
  v_slug  text := 'checklist-consultorio-20k';
  v_proc  text := 'Sessão gratuita de diagnóstico de carreira';
  v_aviso text := 'A equipe da Drª avaliará as respostas e entrará em contato se você for selecionado(a).';
  v_pdf   text := '/materiais/checklist-consultorio-20k.pdf';
  v_capa  text := '/materiais/checklist-consultorio-20k-capa.webp';
  v_org   uuid;
  v_flow  uuid;
  v_prof  uuid;
  s_sim   uuid := gen_random_uuid();  -- PDF + convite (tem interesse)
  s_nao   uuid := gen_random_uuid();  -- só o PDF
  s_agenda uuid := gen_random_uuid(); -- agendamento
begin
  select o.id into v_org
  from public.organizations o
  join public.organization_members m on m.organization_id = o.id and m.role = 'owner'
  join auth.users u on u.id = m.user_id
  where lower(u.email) = lower(v_email)
  order by o.created_at
  limit 1;
  if v_org is null then raise exception 'Conta % não encontrada (ou sem clínica).', v_email; end if;

  if exists (select 1 from public.flows where organization_id = v_org and slug = v_slug) then
    raise notice 'O funil % já existe nesta conta. Nada foi alterado.', v_slug;
    return;
  end if;

  -- Agenda: quem atende e qual é o atendimento
  select id into v_prof from public.schedule_professionals
  where organization_id = v_org and active and name ilike '%vivian%'
  order by created_at limit 1;
  if v_prof is null then
    insert into public.schedule_professionals (organization_id, name, initials, avatar_color)
    values (v_org, 'Dra. Viviane', 'DV', 'bg-amber-100 text-amber-700')
    returning id into v_prof;
  end if;

  insert into public.schedule_procedures (organization_id, name, color, duration_min, price_cents)
  values (v_org, v_proc, '#b8863b', 60, 0)
  on conflict (organization_id, lower(name)) do nothing;

  -- Funil
  insert into public.flows (organization_id, name, slug, procedure, description, status, settings)
  values (
    v_org,
    'Checklist Consultório 20K: Diagnóstico de Carreira',
    v_slug,
    'Diagnóstico de carreira',
    'Questionário rápido com o checklist em PDF de brinde e convite para a sessão gratuita de diagnóstico de carreira.',
    'draft',
    jsonb_build_object(
      'seoTitle', 'Checklist do Consultório 20K (grátis)',
      'seoDescription', 'Responda algumas perguntas rápidas e receba o Checklist do Consultório 20K em PDF, do Método VIKA®.',
      'ogImage', 'https://cliva.me/materiais/checklist-consultorio-20k-banner.jpg'
    )
  )
  returning id into v_flow;

  -- 1. Início
  insert into public.flow_steps (flow_id, position, type, config) values (v_flow, 0, 'start', jsonb_build_object(
    'title', 'Receba grátis o Checklist do Consultório 20K',
    'subtitle', '36 checkpoints para construir uma carreira de autoridade na estética e na saúde integrativa, sem depender da agenda lotada.',
    'image_url', '/materiais/checklist-consultorio-20k-banner.jpg',
    'duration_label', 'Leva 1 minuto',
    'button_label', 'Quero meu checklist'
  ));

  -- 2. Contato
  insert into public.flow_steps (flow_id, position, type, config) values (v_flow, 1, 'form', jsonb_build_object(
    'title', 'Antes, me conte quem é você',
    'subtitle', 'O checklist é liberado no final, para baixar na hora.',
    'fields', jsonb_build_array(
      jsonb_build_object('name', 'name', 'label', 'Nome completo', 'type', 'text', 'required', true, 'placeholder', 'Seu nome'),
      jsonb_build_object('name', 'phone', 'label', 'WhatsApp com DDD', 'type', 'tel', 'required', true, 'placeholder', '(00) 00000-0000'),
      jsonb_build_object('name', 'email', 'label', 'E-mail', 'type', 'email', 'required', true, 'placeholder', 'voce@email.com'),
      jsonb_build_object('name', 'instagram', 'label', 'Instagram', 'type', 'text', 'required', true, 'placeholder', '@seuperfil')
    ),
    'consent', 'Ao continuar, você autoriza a equipe da Drª Viviane a usar estes dados para liberar o material e falar com você. Seus dados estão protegidos (LGPD).'
  ));

  -- 3. Trabalho
  insert into public.flow_steps (flow_id, position, type, config) values (v_flow, 2, 'question', jsonb_build_object(
    'title', 'Como você trabalha hoje?',
    'options', jsonb_build_array(
      jsonb_build_object('label', 'Em hospital ou outra instituição de saúde', 'value', 'hospital', 'score', 10),
      jsonb_build_object('label', 'Empreendo: consultório próprio ou coworking', 'value', 'empreende', 'score', 10),
      jsonb_build_object('label', 'Trabalho em hospital e também empreendo', 'value', 'hospital-e-empreende', 'score', 10),
      jsonb_build_object('label', 'Ainda não atuo ou estou em transição', 'value', 'transicao', 'score', 5)
    )
  ));

  -- 4. Faturamento atual
  insert into public.flow_steps (flow_id, position, type, config) values (v_flow, 3, 'question', jsonb_build_object(
    'title', 'Qual é o seu faturamento mensal aproximado hoje?',
    'subtitle', 'Uma estimativa já ajuda. Some tudo o que você recebe com o seu trabalho.',
    'options', jsonb_build_array(
      jsonb_build_object('label', 'Até R$ 3 mil', 'value', 'ate-3k', 'score', 5),
      jsonb_build_object('label', 'De R$ 3 mil a R$ 5 mil', 'value', '3k-5k', 'score', 10),
      jsonb_build_object('label', 'De R$ 5 mil a R$ 10 mil', 'value', '5k-10k', 'score', 15),
      jsonb_build_object('label', 'De R$ 10 mil a R$ 20 mil', 'value', '10k-20k', 'score', 15),
      jsonb_build_object('label', 'Acima de R$ 20 mil', 'value', 'acima-20k', 'score', 15)
    )
  ));

  -- 5. Faturamento dos sonhos
  insert into public.flow_steps (flow_id, position, type, config) values (v_flow, 4, 'question', jsonb_build_object(
    'title', 'E quanto você sonha em faturar por mês?',
    'options', jsonb_build_array(
      jsonb_build_object('label', 'Até R$ 10 mil', 'value', 'ate-10k', 'score', 5),
      jsonb_build_object('label', 'De R$ 10 mil a R$ 20 mil', 'value', '10k-20k', 'score', 10),
      jsonb_build_object('label', 'De R$ 20 mil a R$ 30 mil', 'value', '20k-30k', 'score', 15),
      jsonb_build_object('label', 'De R$ 30 mil a R$ 50 mil', 'value', '30k-50k', 'score', 15),
      jsonb_build_object('label', 'Acima de R$ 50 mil', 'value', 'acima-50k', 'score', 15)
    )
  ));

  -- 6. Interesse na sessão (só depois das informações principais).
  -- Pontos: "sim" deixa o lead Quente (61+) em qualquer combinação; "não" nunca.
  insert into public.flow_steps (flow_id, position, type, config) values (v_flow, 5, 'question', jsonb_build_object(
    'title', 'Você tem interesse em receber uma sessão gratuita de diagnóstico de carreira comigo?',
    'subtitle', v_aviso,
    'options', jsonb_build_array(
      jsonb_build_object('label', 'Sim, tenho interesse', 'value', 'sim', 'score', 60, 'goto', s_sim::text),
      jsonb_build_object('label', 'Agora não, quero só o checklist', 'value', 'nao', 'score', 0, 'goto', s_nao::text)
    )
  ));

  -- 7. Material + convite (tem interesse)
  insert into public.flow_steps (id, flow_id, position, type, config) values (s_sim, v_flow, 6, 'gift', jsonb_build_object(
    'title', 'Seu Checklist do Consultório 20K está pronto',
    'body', 'Baixe agora e marque só o que você já tem implementado.',
    'image_url', v_capa, 'file_url', v_pdf, 'file_label', 'Baixar checklist (PDF)',
    'invite_title', 'Sua sessão gratuita de diagnóstico de carreira',
    'invite_body', 'Escolha o melhor dia e horário. Ele fica pré-reservado na agenda da Drª Viviane.',
    'invite_label', 'Quero agendar minha sessão',
    'invite_goto', s_agenda::text,
    'invite_note', v_aviso
  ));

  -- 8. Só o material (sem interesse agora)
  insert into public.flow_steps (id, flow_id, position, type, config) values (s_nao, v_flow, 7, 'gift', jsonb_build_object(
    'title', 'Seu Checklist do Consultório 20K está pronto',
    'body', 'Baixe agora e marque só o que você já tem implementado.',
    'image_url', v_capa, 'file_url', v_pdf, 'file_label', 'Baixar checklist (PDF)',
    'invite_title', '',
    'invite_label', 'Mudei de ideia: quero a sessão gratuita',
    'invite_goto', s_agenda::text
  ));

  -- 9. Agendamento (entra na Agenda da Cliva)
  insert into public.flow_steps (id, flow_id, position, type, config) values (s_agenda, v_flow, 8, 'booking', jsonb_build_object(
    'title', 'Escolha o horário da sua sessão gratuita',
    'subtitle', 'Horários livres da agenda da Drª Viviane.',
    'booking_procedure', v_proc,
    'booking_duration', 60,
    'booking_professional', v_prof::text,
    'booking_ask_contact', true,
    'booking_success_title', 'Horário pré-reservado!',
    'booking_success_body', v_aviso,
    'button_label', 'Concluir'
  ));

  raise notice 'Funil criado em rascunho para %.', v_email;
end $$;
commit;

-- Resumo (confira o resultado)
with org as (
  select o.id, o.slug from public.organizations o
  join public.organization_members m on m.organization_id = o.id and m.role = 'owner'
  join auth.users u on u.id = m.user_id
  where lower(u.email) = 'mamsbsb@icloud.com' order by o.created_at limit 1
)
select 'funil' as item, f.name || ' · ' || f.status || ' · cliva.me/' || org.slug || '/' || f.slug as valor
  from org join public.flows f on f.organization_id = org.id and f.slug = 'checklist-consultorio-20k'
union all
select 'etapas', count(*)::text from org join public.flows f on f.organization_id = org.id and f.slug = 'checklist-consultorio-20k'
  join public.flow_steps s on s.flow_id = f.id
union all
select 'profissional do agendamento', coalesce(p.name, 'não encontrado') from org
  join public.flows f on f.organization_id = org.id and f.slug = 'checklist-consultorio-20k'
  join public.flow_steps s on s.flow_id = f.id and s.type = 'booking'
  left join public.schedule_professionals p on p.id::text = s.config->>'booking_professional' and p.active
union all
select 'agendamento online ligado', coalesce(b.settings->>'enabled', 'sim (padrão)') from org
  left join public.schedule_booking_settings b on b.organization_id = org.id
union all
select 'confirma sozinho', coalesce(b.settings->>'auto_confirm', 'não (padrão)') from org
  left join public.schedule_booking_settings b on b.organization_id = org.id
union all
select 'funis já publicados', count(*)::text from org join public.flows f on f.organization_id = org.id and f.status = 'published'
union all
select 'plano', coalesce(b.plan || ' (' || b.status || ')', 'sem registro') from org left join public.org_billing b on b.organization_id = org.id;
