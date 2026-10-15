-- ============================================================================
-- Cliva — DEMONSTRAÇÃO: clínica de estética da Dra. Marina (dados FICTÍCIOS)
-- Conta: mamsbsb@icloud.com. Rodar no SQL Editor do Supabase.
-- Requer as migrations até a 0016. Remover tudo: demo_dra_marina_remove.sql
-- ============================================================================
--
-- Cria, só na clínica dessa conta:
--   - profissional "Dra. Marina" e 4 procedimentos com preço;
--   - agenda lotada de 1º/ago até 2 dias depois de hoje (seg-sex 8h-18h com
--     almoço; sáb 8h-12h), sem domingos e sem feriados;
--   - 6 funis publicados (4 de avaliação + 2 roletas de desconto);
--   - visitas, abandono por etapa, leads com nome (fictícios) e respostas,
--     com mais de 200 leads por funil por mês.
-- Marcadores para remoção: sessões "demo-…", notas "demo-seed", slugs abaixo.
-- Telefones e e-mails são inventados: não envie mensagens para eles.

do $$
declare
  v_email   text := 'mamsbsb@icloud.com';
  v_org     uuid;
  v_prof    uuid;
  v_start   date := date '2026-08-01';
  v_until   timestamptz := now();
  v_end_day date := (now() at time zone 'America/Sao_Paulo')::date + 2;
  v_holidays date[] := array[date '2026-09-07', date '2026-10-12', date '2026-11-02', date '2026-11-15',
                             date '2026-11-20', date '2026-11-30', date '2026-12-25'];
  v_first text[] := array['Ana','Beatriz','Camila','Daniela','Eduarda','Fernanda','Gabriela','Helena','Isabela','Juliana',
    'Larissa','Letícia','Mariana','Natália','Patrícia','Rafaela','Sabrina','Tatiana','Vanessa','Yasmin','Aline','Bruna',
    'Carolina','Débora','Elaine','Flávia','Giovanna','Heloísa','Ingrid','Jéssica','Karina','Lívia','Luana','Manuela',
    'Nicole','Paula','Priscila','Renata','Sara','Thaís','Valéria','Vitória','Amanda','Bianca','Cláudia','Denise','Érica',
    'Fabiana','Graziela','Laura','Lorena','Marcela','Michele','Raquel','Simone','Talita','Rafael','Lucas','Bruno','Thiago',
    'Gustavo','Felipe','Diego','André'];
  v_last text[] := array['Silva','Santos','Oliveira','Souza','Lima','Pereira','Costa','Rodrigues','Almeida','Nascimento',
    'Carvalho','Araújo','Ribeiro','Gomes','Martins','Rocha','Barbosa','Melo','Cardoso','Teixeira','Moreira','Correia',
    'Mendes','Freitas','Vieira','Monteiro','Campos','Moura','Castro','Pinto','Farias','Cavalcanti','Duarte','Nogueira',
    'Peixoto','Rezende','Fontes','Siqueira','Bastos','Leal'];
  v_funnels jsonb;
  f jsonb; q jsonb; o jsonb;
  v_flow uuid;
  v_step uuid;
  i int; j int;
  d date; v_day_kind int; h int; v_slots int[];
  v_pat_ids uuid[] := '{}'; v_pat_names text[] := '{}';
  v_pid uuid; v_pname text; v_ret boolean;
  v_proc text; v_dur int; r float8;
  v_s timestamptz; v_e timestamptz; v_status text;
  v_new_pat int := 0;
begin
  perform setseed(0.2026);

  select o.id into v_org
  from public.organizations o
  join public.organization_members m on m.organization_id = o.id and m.role = 'owner'
  join auth.users u on u.id = m.user_id
  where lower(u.email) = lower(v_email)
  order by o.created_at
  limit 1;
  if v_org is null then raise exception 'Conta % não encontrada (ou sem clínica).', v_email; end if;

  if exists (select 1 from public.flows where organization_id = v_org
             and slug in ('limpeza-de-pele', 'peeling-de-diamante', 'microagulhamento', 'drenagem-linfatica', 'roleta-premiada', 'roleta-da-sorte')) then
    raise exception 'A demonstração já existe nesta clínica. Rode demo_dra_marina_remove.sql antes de recriar.';
  end if;

  -- ---------------------------------------------------------------- agenda base
  insert into public.schedule_professionals (organization_id, name, initials, avatar_color)
  values (v_org, 'Dra. Marina', 'DM', 'bg-emerald-100 text-emerald-700')
  on conflict do nothing;
  select id into v_prof from public.schedule_professionals where organization_id = v_org and lower(name) = 'dra. marina' and active limit 1;

  insert into public.schedule_procedures (organization_id, name, color, price_cents) values
    (v_org, 'Limpeza de pele', '#10b981', 22000),
    (v_org, 'Peeling de diamante', '#0ea5e9', 26000),
    (v_org, 'Microagulhamento', '#a855f7', 48000),
    (v_org, 'Drenagem linfática', '#f59e0b', 19000)
  on conflict (organization_id, lower(name)) do update set price_cents = excluded.price_cents, color = excluded.color;

  -- pacientes (fictícios)
  create temp table _pat on commit drop as
  select gen_random_uuid() as id,
         v_first[1 + floor(random() * array_length(v_first, 1))::int] || ' ' ||
         v_last[1 + floor(random() * array_length(v_last, 1))::int] || ' ' ||
         v_last[1 + floor(random() * array_length(v_last, 1))::int] as name,
         '55619' || lpad((80000000 + floor(random() * 9999999))::bigint::text, 8, '0') as phone,
         g as n
  from generate_series(1, 420) g;
  insert into public.schedule_patients (id, organization_id, name, phone, notes)
  select id, v_org, name, phone, 'demo-seed' from _pat;

  -- agendamentos: todos os horários de cada dia útil (agenda lotada)
  d := v_start;
  while d <= v_end_day loop
    v_day_kind := extract(isodow from d)::int; -- 1=seg ... 7=dom
    if v_day_kind <> 7 and not (d = any(v_holidays)) then
      v_slots := case when v_day_kind = 6 then array[8, 9, 10, 11] else array[8, 9, 10, 11, 13, 14, 15, 16, 17] end;
      foreach h in array v_slots loop
        r := random();
        if r < 0.35 then v_proc := 'Limpeza de pele'; v_dur := 60;
        elsif r < 0.60 then v_proc := 'Peeling de diamante'; v_dur := 45;
        elsif r < 0.80 then v_proc := 'Microagulhamento'; v_dur := 60;
        else v_proc := 'Drenagem linfática'; v_dur := 50; end if;

        -- 30% retorno de paciente já atendida; senão, paciente nova
        v_ret := array_length(v_pat_ids, 1) > 20 and random() < 0.30;
        if v_ret then
          j := 1 + floor(random() * array_length(v_pat_ids, 1))::int;
          v_pid := v_pat_ids[j]; v_pname := v_pat_names[j];
        else
          v_new_pat := v_new_pat + 1;
          select id, name into v_pid, v_pname from _pat where n = 1 + ((v_new_pat - 1) % 420);
          v_pat_ids := v_pat_ids || v_pid; v_pat_names := v_pat_names || v_pname;
        end if;

        v_s := (d + make_time(h, 0, 0)) at time zone 'America/Sao_Paulo';
        v_e := v_s + make_interval(mins => v_dur);
        v_status := case
          when v_e <= v_until then case when random() < 0.025 then 'cancelled' else 'done' end
          when v_s <= v_until then 'in_progress'
          else case when random() < 0.7 then 'confirmed' else 'registered' end end;

        insert into public.schedule_appointments
          (organization_id, professional_id, patient_id, patient_name, procedure_name, starts_at, ends_at, status, is_return, notes, created_at)
        values (v_org, v_prof, v_pid, v_pname, v_proc, v_s, v_e, v_status, v_ret, 'demo-seed', v_s - interval '3 days');
      end loop;
    end if;
    d := d + 1;
  end loop;

  -- ------------------------------------------------------------------- funis
  v_funnels := $j$[
    {"slug":"limpeza-de-pele","name":"Limpeza de Pele — Avaliação","procedure":"Limpeza de pele","daily":17,
     "intro":"Descubra a limpeza de pele ideal para o seu tipo de pele","color":"#10b981",
     "questions":[
       {"title":"Como você descreveria a sua pele?","options":[["Oleosa","oleosa",20],["Mista","mista",15],["Seca","seca",10],["Sensível","sensivel",10]]},
       {"title":"O que mais te incomoda hoje?","options":[["Cravos e poros dilatados","cravos",20],["Espinhas","espinhas",20],["Pele sem viço","sem-vico",15],["Manchas","manchas",15]]},
       {"title":"Quando você gostaria de fazer?","options":[["Ainda esta semana","semana",30],["Este mês","mes",20],["Só pesquisando","pesquisando",5]]}]},
    {"slug":"peeling-de-diamante","name":"Peeling de Diamante — Avaliação","procedure":"Peeling de diamante","daily":18,
     "intro":"Veja se o peeling de diamante é indicado para você","color":"#0ea5e9",
     "questions":[
       {"title":"Qual o seu principal objetivo?","options":[["Renovar a pele","renovar",20],["Suavizar linhas finas","linhas",20],["Clarear manchas","manchas",15],["Afinar a textura","textura",15]]},
       {"title":"Já fez algum peeling antes?","options":[["Sim, gostei do resultado","sim",20],["Nunca fiz","nunca",15],["Fiz e tive irritação","irritacao",5]]},
       {"title":"Quando você gostaria de fazer?","options":[["Ainda esta semana","semana",30],["Este mês","mes",20],["Só pesquisando","pesquisando",5]]}]},
    {"slug":"microagulhamento","name":"Microagulhamento — Avaliação","procedure":"Microagulhamento","daily":18,
     "intro":"Descubra se o microagulhamento resolve o que te incomoda","color":"#a855f7",
     "questions":[
       {"title":"O que você quer tratar?","options":[["Cicatrizes de acne","acne",25],["Flacidez leve","flacidez",20],["Poros dilatados","poros",15],["Linhas finas","linhas",15]]},
       {"title":"Há quanto tempo isso te incomoda?","options":[["Mais de 1 ano","1ano",20],["Alguns meses","meses",15],["Começou agora","agora",10]]},
       {"title":"Quando você gostaria de começar?","options":[["Ainda esta semana","semana",30],["Este mês","mes",20],["Só pesquisando","pesquisando",5]]}]},
    {"slug":"drenagem-linfatica","name":"Drenagem Linfática — Avaliação","procedure":"Drenagem linfática","daily":17,
     "intro":"Desinche e sinta-se mais leve: veja o pacote ideal","color":"#f59e0b",
     "questions":[
       {"title":"Qual o seu objetivo?","options":[["Desinchar","desinchar",20],["Pós-operatório","pos-op",25],["Celulite","celulite",15],["Relaxar","relaxar",10]]},
       {"title":"Com que frequência você sente inchaço?","options":[["Todos os dias","diario",20],["Algumas vezes por semana","semana",15],["Raramente","raro",5]]},
       {"title":"Quando você gostaria de começar?","options":[["Ainda esta semana","semana",30],["Este mês","mes",20],["Só pesquisando","pesquisando",5]]}]},
    {"slug":"roleta-premiada","name":"Roleta Premiada — Cadastro","procedure":"Limpeza de pele","daily":19,"wheel":"rigged",
     "intro":"Cadastre-se e gire a roleta: você tem 3 chances de ganhar desconto","color":"#ec4899"},
    {"slug":"roleta-da-sorte","name":"Roleta da Sorte — Desconto Garantido","procedure":"Peeling de diamante","daily":18,"wheel":"random",
     "intro":"Todo giro ganha: descubra o seu desconto","color":"#f97316"}
  ]$j$::jsonb;

  create temp table _steps (flow_id uuid, idx int, step_id uuid) on commit drop;
  create temp table _opts (flow_id uuid, qn int, title text, label text, value text, score int) on commit drop;
  create temp table _fl (flow_id uuid, slug text, procedure text, daily int, kind text, n_steps int, probs float8[]) on commit drop;

  for f in select * from jsonb_array_elements(v_funnels) loop
    insert into public.flows (organization_id, name, slug, procedure, description, status, final_message, settings, created_at, updated_at)
    values (v_org, f->>'name', f->>'slug', f->>'procedure', f->>'intro', 'published',
            case when f ? 'wheel' then 'Quero resgatar meu desconto!' else 'Quero agendar minha avaliação.' end,
            jsonb_build_object('seoTitle', f->>'name', 'seoDescription', f->>'intro'),
            timestamptz '2026-07-28 12:00:00-03', now())
    returning id into v_flow;

    if f ? 'wheel' then
      -- 0 cadastro (nome para receber o prêmio) · 1 roleta · 2 WhatsApp
      insert into public.flow_steps (flow_id, position, type, config) values
        (v_flow, 0, 'form', jsonb_build_object(
          'title', f->>'intro', 'subtitle', 'Informe seu nome e WhatsApp para liberar o giro e receber o prêmio.',
          'fields', jsonb_build_array(
            jsonb_build_object('name','name','label','Seu nome','type','text','required',true,'placeholder','Como podemos te chamar?'),
            jsonb_build_object('name','phone','label','WhatsApp','type','tel','required',true,'placeholder','(61) 90000-0000')),
          'consent', 'Ao continuar, você concorda em ser contatada pela clínica. Seus dados estão protegidos (LGPD).'))
      returning id into v_step;
      insert into _steps values (v_flow, 0, v_step);

      insert into public.flow_steps (flow_id, position, type, config) values
        (v_flow, 1, 'spin_wheel', case when f->>'wheel' = 'rigged' then jsonb_build_object(
          'title', 'Roleta Premiada', 'subtitle', 'Você tem 3 giros. Boa sorte!', 'spin_enabled', true,
          'button_label', 'GIRE!', 'result_prefix', 'Você ganhou:', 'cta_label', 'Resgatar no WhatsApp', 'retry_label', 'Girar novamente',
          'max_attempts', 3, 'attempt_outcomes', jsonb_build_array(0, 1, 5),
          'wheel_bg', '#831843', 'wheel_color_a', '#f472b6', 'wheel_color_b', '#be185d', 'wheel_ring', '#d4a017', 'wheel_accent', '#ffcf3f',
          'wheel_segments', jsonb_build_array(
            jsonb_build_object('label','Não foi dessa vez'), jsonb_build_object('label','5% OFF'), jsonb_build_object('label','10% OFF'),
            jsonb_build_object('label','Não foi dessa vez'), jsonb_build_object('label','15% OFF'), jsonb_build_object('label','20% OFF Limpeza de pele'),
            jsonb_build_object('label','25% OFF Peeling'), jsonb_build_object('label','30% OFF Drenagem')))
        else jsonb_build_object(
          'title', 'Roleta da Sorte', 'subtitle', 'Todo giro ganha desconto!', 'spin_enabled', true,
          'button_label', 'GIRE!', 'result_prefix', 'Seu desconto:', 'cta_label', 'Resgatar no WhatsApp',
          'max_attempts', 1, 'attempt_outcomes', jsonb_build_array(),
          'wheel_bg', '#7c2d12', 'wheel_color_a', '#fb923c', 'wheel_color_b', '#ea580c', 'wheel_ring', '#d4a017', 'wheel_accent', '#ffe08a',
          'wheel_segments', jsonb_build_array(
            jsonb_build_object('label','10% OFF'), jsonb_build_object('label','15% OFF'), jsonb_build_object('label','20% OFF'),
            jsonb_build_object('label','10% OFF'), jsonb_build_object('label','25% OFF'), jsonb_build_object('label','15% OFF'),
            jsonb_build_object('label','30% OFF'), jsonb_build_object('label','20% OFF'))) end)
      returning id into v_step;
      insert into _steps values (v_flow, 1, v_step);

      insert into public.flow_steps (flow_id, position, type, config) values
        (v_flow, 2, 'whatsapp', jsonb_build_object('title', 'Prêmio garantido!', 'body', 'Fale com a clínica para agendar e usar o seu desconto.', 'button_label', 'Resgatar no WhatsApp'))
      returning id into v_step;
      insert into _steps values (v_flow, 2, v_step);

      -- prêmios sorteados (todos de desconto)
      insert into _opts (flow_id, qn, title, label, value, score)
      select v_flow, 1, 'Prêmio da roleta', x, x, 0
      from unnest(case when f->>'wheel' = 'rigged' then array['20% OFF Limpeza de pele'] else array['10% OFF','15% OFF','20% OFF','25% OFF','30% OFF'] end) x;

      -- cadastro 80% · roleta até o WhatsApp 93%
      insert into _fl values (v_flow, f->>'slug', f->>'procedure', (f->>'daily')::int, 'wheel', 3, array[0.80, 0.93]);
    else
      -- 0 início · 1-3 perguntas · 4 cadastro · 5 WhatsApp
      insert into public.flow_steps (flow_id, position, type, config) values
        (v_flow, 0, 'start', jsonb_build_object('title', f->>'intro', 'subtitle', 'Responda 3 perguntas rápidas e receba a indicação da Dra. Marina.',
          'duration_label', 'Leva 1 minuto', 'button_label', 'Começar avaliação'))
      returning id into v_step;
      insert into _steps values (v_flow, 0, v_step);

      i := 0;
      for q in select * from jsonb_array_elements(f->'questions') loop
        i := i + 1;
        insert into public.flow_steps (flow_id, position, type, config) values
          (v_flow, i, 'question', jsonb_build_object('key', 'q' || i, 'title', q->>'title',
            'options', (select jsonb_agg(jsonb_build_object('label', x->>0, 'value', x->>1, 'score', (x->>2)::int)) from jsonb_array_elements(q->'options') x)))
        returning id into v_step;
        insert into _steps values (v_flow, i, v_step);
        insert into _opts (flow_id, qn, title, label, value, score)
        select v_flow, i, q->>'title', x->>0, x->>1, (x->>2)::int from jsonb_array_elements(q->'options') x;
      end loop;

      insert into public.flow_steps (flow_id, position, type, config) values
        (v_flow, 4, 'form', jsonb_build_object('title', 'Falta pouco!', 'subtitle', 'Deixe seu contato para receber a indicação.',
          'fields', jsonb_build_array(
            jsonb_build_object('name','name','label','Seu nome','type','text','required',true),
            jsonb_build_object('name','phone','label','WhatsApp','type','tel','required',true)),
          'consent', 'Ao continuar, você concorda em ser contatada pela clínica. Seus dados estão protegidos (LGPD).'))
      returning id into v_step;
      insert into _steps values (v_flow, 4, v_step);

      insert into public.flow_steps (flow_id, position, type, config) values
        (v_flow, 5, 'whatsapp', jsonb_build_object('title', 'Avaliação concluída!', 'body', 'A Dra. Marina vai te mostrar o melhor protocolo para o seu caso.', 'button_label', 'Agendar avaliação no WhatsApp'))
      returning id into v_step;
      insert into _steps values (v_flow, 5, v_step);

      -- clicou em começar 82% · perguntas 92%, 93%, 95% · cadastro 88%
      insert into _fl values (v_flow, f->>'slug', f->>'procedure', (f->>'daily')::int, 'eval', 6, array[0.82, 0.92, 0.93, 0.95, 0.88]);
    end if;
  end loop;

  -- ------------------------------------------------------- visitas e jornada
  -- Visitas por dia ≈ leads desejados ÷ taxa de conclusão; varia por dia da semana.
  create temp table _v on commit drop as
  select gen_random_uuid() as vid, fl.flow_id, fl.kind, fl.n_steps, fl.probs, fl.procedure,
         ts, 'demo-' || gen_random_uuid()::text as sid,
         (array['instagram','instagram','instagram','instagram','instagram','facebook','facebook','google','(direto)','(direto)'])[1 + floor(random() * 10)::int] as src,
         random() as r_wa, random() as r_status, random() as r_dev
  from _fl fl
  cross join generate_series(v_start::timestamp, (now() at time zone 'America/Sao_Paulo')::date::timestamp, interval '1 day') as day
  cross join lateral generate_series(1, greatest(1, round(fl.daily / (case when fl.kind = 'wheel' then 0.744 else 0.587 end)
      * (case extract(isodow from day) when 6 then 0.8 when 7 then 0.7 else 1.0 end) * (0.85 + random() * 0.3))::int)) as k
  cross join lateral (select ((day + make_interval(hours => 7 + floor(random() * 16)::int, mins => floor(random() * 60)::int)) at time zone 'America/Sao_Paulo') as ts) t
  where t.ts < v_until;

  -- profundidade: até qual etapa a visita chegou (abandono progressivo)
  alter table _v add column depth int;
  update _v set depth = (
    select count(*) from (
      select bool_and(rr < p) over (order by ord) as ok
      from (select p, ord, random() as rr from unnest(probs) with ordinality as u(p, ord)) z
    ) s where ok);

  -- eventos da jornada (sem dados pessoais)
  insert into public.events (organization_id, flow_id, session_id, type, created_at, step_index, step_id, utm_source, utm_campaign, metadata)
  select v_org, v.flow_id, v.sid, e.type, v.ts + make_interval(secs => e.sec), e.idx, s.step_id::text,
         nullif(v.src, '(direto)'), case when v.src in ('instagram','facebook') then 'outubro-' || v.kind end, '{}'::jsonb
  from _v v
  cross join lateral (
    select 'page_view' as type, 0 as sec, null::int as idx
    union all select 'step_view', 1, 0
    union all select 'flow_started', 4, null where v.depth >= 1
    union all select 'step_completed', 4 + g * 9, g - 1 from generate_series(1, v.depth) g
    union all select 'step_view', 5 + g * 9, g from generate_series(1, least(v.depth, v.n_steps - 1)) g
    union all select 'flow_completed', 5 + (v.n_steps - 1) * 9, null where v.depth >= v.n_steps - 1
    union all select 'whatsapp_clicked', 12 + (v.n_steps - 1) * 9, null where v.depth >= v.n_steps - 1 and v.r_wa < 0.86
  ) e
  left join _steps s on s.flow_id = v.flow_id and s.idx = e.idx;

  -- leads: quem chegou ao fim (com nome, telefone e, às vezes, e-mail)
  create temp table _l on commit drop as
  select gen_random_uuid() as lid, v.*,
         v_first[1 + floor(random() * array_length(v_first, 1))::int] as fn,
         v_last[1 + floor(random() * array_length(v_last, 1))::int] as ln1,
         v_last[1 + floor(random() * array_length(v_last, 1))::int] as ln2,
         random() as r_mail
  from _v v where v.depth >= v.n_steps - 1;

  insert into public.lead_sessions (id, session_id, flow_id, organization_id, name, phone, email, procedure, score, status,
    whatsapp_clicked, final_cta_clicked, device, browser, entry_page, utm_source, utm_medium, utm_campaign, created_at)
  select l.lid, l.sid, l.flow_id, v_org, l.fn || ' ' || l.ln1 || ' ' || l.ln2,
         '55619' || lpad((80000000 + floor(random() * 9999999))::bigint::text, 8, '0'),
         case when l.r_mail < 0.4 then lower(translate(l.fn || '.' || l.ln1, 'áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ', 'aeiouaeoaocAEIOUAEOAOC')) || floor(random() * 90 + 10)::int || '@exemplo.com' end,
         l.procedure, 0,
         case
           when l.r_wa >= 0.86 then 'new'
           when l.ts > now() - interval '3 days' then 'whatsapp'
           when l.r_status < 0.10 then 'scheduled'
           when l.r_status < 0.15 then 'converted'
           when l.r_status < 0.22 then 'lost'
           else 'whatsapp' end,
         l.r_wa < 0.86, false,
         case when l.r_dev < 0.86 then 'mobile' else 'desktop' end,
         case when l.src = 'instagram' then 'Instagram' when l.src = 'facebook' then 'Facebook' else 'Chrome' end,
         '/' || (select slug from public.organizations where id = v_org) || '/' || (select slug from public.flows where id = l.flow_id),
         nullif(l.src, '(direto)'),
         case when l.src in ('instagram','facebook') then 'cpc' when l.src = 'google' then 'organic' end,
         case when l.src in ('instagram','facebook') then 'outubro-' || l.kind end,
         l.ts + make_interval(secs => 60)
  from _l l;

  -- respostas (uma opção por pergunta) e score do lead
  insert into public.lead_answers (lead_session_id, organization_id, question_key, question_title, answer_value, answer_label, score)
  select l.lid, v_org, 'q' || o.qn, o.title, o.value, o.label, o.score
  from _l l
  cross join lateral (select distinct qn from _opts where flow_id = l.flow_id) qs
  cross join lateral (
    select * from _opts o where o.flow_id = l.flow_id and o.qn = qs.qn
    order by -ln(1 - random()) / (o.score + 8) limit 1 -- sorteio com peso: respostas de maior interesse saem mais
  ) o;

  update public.lead_sessions ls set score = least(100, x.s)
  from (select lead_session_id, sum(score)::int as s from public.lead_answers
        where lead_session_id in (select lid from _l) group by 1) x
  where ls.id = x.lead_session_id;
  -- roletas não têm perguntas de qualificação: interesse pelo engajamento
  update public.lead_sessions set score = 35 + floor(random() * 45)::int
  where id in (select lid from _l where kind = 'wheel');

  -- agendamentos vindos dos funis: data do evento = 1 dia após o lead
  update public.events e set created_at = l.created_at + interval '1 day'
  from public.lead_sessions l
  where e.lead_session_id = l.id and e.type = 'appointment_booked' and l.session_id like 'demo-%';

  raise notice 'Demonstração criada para %.', v_email;
end $$;

-- Resumo
select 'funis' as item, count(*)::text as total from public.flows f
  join public.organization_members m on m.organization_id = f.organization_id and m.role = 'owner'
  join auth.users u on u.id = m.user_id
  where lower(u.email) = 'mamsbsb@icloud.com' and f.slug in ('limpeza-de-pele','peeling-de-diamante','microagulhamento','drenagem-linfatica','roleta-premiada','roleta-da-sorte')
union all
select 'leads de demonstração', count(*)::text from public.lead_sessions where session_id like 'demo-%'
  and organization_id in (select m.organization_id from public.organization_members m join auth.users u on u.id = m.user_id where lower(u.email) = 'mamsbsb@icloud.com' and m.role = 'owner')
union all
select 'agendamentos de demonstração', count(*)::text from public.schedule_appointments where notes = 'demo-seed'
  and organization_id in (select m.organization_id from public.organization_members m join auth.users u on u.id = m.user_id where lower(u.email) = 'mamsbsb@icloud.com' and m.role = 'owner');
