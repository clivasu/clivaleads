-- ============================================================================
-- Prelead — dados de demonstração
-- Rode DEPOIS de 0001_init.sql. Cria a "Clínica Demo" e 3 funis publicados.
-- Para ver no painel, vincule seu usuário à org (veja SETUP.md, passo "Reivindicar demo").
-- ============================================================================

-- Clínica Demo ---------------------------------------------------------------
insert into public.organizations (id, name, slug, primary_color, whatsapp_number, default_message, instagram)
values (
  '11111111-1111-1111-1111-111111111111',
  'Clínica Demo',
  'clinica-demo',
  '#7C3AED',
  '5561999999999',
  'Fico no aguardo, obrigado!',
  '@clinicademo'
) on conflict (id) do nothing;

-- ============================================================================
-- FUNIL 1 — RINOMODELAÇÃO (completo, conforme especificação)
-- ============================================================================
insert into public.flows (id, organization_id, name, slug, procedure, description, status, whatsapp_number, final_message, cover_image_url)
values (
  '22222222-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Rinomodelação — Clínica Demo',
  'rinomodelacao-clinica-demo',
  'Rinomodelação',
  'Melhore o perfil do nariz sem cirurgia, com avaliação profissional.',
  'published',
  '5561999999999',
  'Quando podemos conversar?',
  'https://placehold.co/1200x630/7C3AED/FFFFFF/png?text=Rinomodelacao'
) on conflict (id) do nothing;

insert into public.flow_steps (flow_id, position, type, config) values
('22222222-0000-0000-0000-000000000001', 0, 'question', jsonb_build_object(
  'key','incomodo',
  'title','O que você gostaria de melhorar no seu nariz?',
  'subtitle','Escolha o que mais te incomoda hoje.',
  'options', jsonb_build_array(
    jsonb_build_object('label','Ponta caída','value','ponta_caida','score',15,'phrase','O que mais me incomoda é a ponta caída.'),
    jsonb_build_object('label','Dorso / elevação','value','dorso','score',15,'phrase','Gostaria de trabalhar o dorso do nariz.'),
    jsonb_build_object('label','Perfil','value','perfil','score',15,'phrase','Quero melhorar o perfil do nariz.')
  ))),
('22222222-0000-0000-0000-000000000001', 1, 'before_after', jsonb_build_object(
  'caption','Resultados podem variar conforme avaliação profissional.',
  'before_url','https://placehold.co/400x400/E2E8F0/475569/png?text=Antes',
  'after_url','https://placehold.co/400x400/DDD6FE/5B21B6/png?text=Depois')),
('22222222-0000-0000-0000-000000000001', 2, 'text', jsonb_build_object(
  'title','Como funciona','body','A rinomodelação pode trabalhar pontos específicos do perfil do nariz, de acordo com avaliação profissional. É um procedimento rápido e sem cirurgia.')),
('22222222-0000-0000-0000-000000000001', 3, 'question', jsonb_build_object(
  'key','quando',
  'title','Quando você gostaria de realizar?',
  'options', jsonb_build_array(
    jsonb_build_object('label','O quanto antes','value','asap','score',30,'phrase','Gostaria de realizar o quanto antes.'),
    jsonb_build_object('label','Ainda este mês','value','este_mes','score',20,'phrase','Pretendo realizar ainda este mês.'),
    jsonb_build_object('label','Estou apenas pesquisando','value','pesquisando','score',5,'phrase','No momento estou apenas pesquisando.')
  ))),
('22222222-0000-0000-0000-000000000001', 4, 'question', jsonb_build_object(
  'key','ajuda',
  'title','Como podemos te ajudar agora?',
  'options', jsonb_build_array(
    jsonb_build_object('label','Quero saber se é indicado para mim','value','indicado','score',20,'phrase','Quero entender se o procedimento é indicado para mim.'),
    jsonb_build_object('label','Quero saber valores','value','valores','score',15,'phrase','Gostaria de saber os valores.'),
    jsonb_build_object('label','Quero ver horários disponíveis','value','horarios','score',25,'phrase','Quero ver os horários disponíveis.')
  ))),
('22222222-0000-0000-0000-000000000001', 5, 'whatsapp', jsonb_build_object(
  'title','Tudo certo!','body','Vamos te encaminhar para um especialista com o seu contexto.',
  'button_label','Falar com especialista no WhatsApp'));

-- ============================================================================
-- FUNIL 2 — BOTOX FULL FACE
-- ============================================================================
insert into public.flows (id, organization_id, name, slug, procedure, description, status, whatsapp_number, final_message, cover_image_url)
values (
  '22222222-0000-0000-0000-000000000002',
  '11111111-1111-1111-1111-111111111111',
  'Botox Full Face — Clínica Demo',
  'botox-full-face-clinica-demo',
  'Botox Full Face',
  'Suavize linhas de expressão com naturalidade.',
  'published',
  '5561999999999',
  'Quando podemos conversar?',
  'https://placehold.co/1200x630/0EA5E9/FFFFFF/png?text=Botox+Full+Face'
) on conflict (id) do nothing;

insert into public.flow_steps (flow_id, position, type, config) values
('22222222-0000-0000-0000-000000000002', 0, 'question', jsonb_build_object(
  'key','regiao',
  'title','Qual região mais te incomoda?',
  'options', jsonb_build_array(
    jsonb_build_object('label','Testa','value','testa','score',15,'phrase','O que mais me incomoda é a testa.'),
    jsonb_build_object('label','Olhos (pés de galinha)','value','olhos','score',15,'phrase','Me incomoda a região dos olhos.'),
    jsonb_build_object('label','Rosto todo','value','full','score',20,'phrase','Tenho interesse no rosto todo.')
  ))),
('22222222-0000-0000-0000-000000000002', 1, 'question', jsonb_build_object(
  'key','quando',
  'title','Quando pretende realizar?',
  'options', jsonb_build_array(
    jsonb_build_object('label','O quanto antes','value','asap','score',30,'phrase','Gostaria de realizar o quanto antes.'),
    jsonb_build_object('label','Ainda este mês','value','este_mes','score',20,'phrase','Pretendo realizar ainda este mês.'),
    jsonb_build_object('label','Só pesquisando','value','pesquisando','score',5,'phrase','No momento estou apenas pesquisando.')
  ))),
('22222222-0000-0000-0000-000000000002', 2, 'whatsapp', jsonb_build_object(
  'button_label','Falar no WhatsApp'));

-- ============================================================================
-- FUNIL 3 — PREENCHIMENTO LABIAL
-- ============================================================================
insert into public.flows (id, organization_id, name, slug, procedure, description, status, whatsapp_number, final_message, cover_image_url)
values (
  '22222222-0000-0000-0000-000000000003',
  '11111111-1111-1111-1111-111111111111',
  'Preenchimento Labial — Clínica Demo',
  'preenchimento-labial-clinica-demo',
  'Preenchimento Labial',
  'Volume e contorno com resultado natural.',
  'published',
  '5561999999999',
  'Quando podemos conversar?',
  'https://placehold.co/1200x630/EC4899/FFFFFF/png?text=Preenchimento+Labial'
) on conflict (id) do nothing;

insert into public.flow_steps (flow_id, position, type, config) values
('22222222-0000-0000-0000-000000000003', 0, 'question', jsonb_build_object(
  'key','objetivo',
  'title','Qual é o seu objetivo?',
  'options', jsonb_build_array(
    jsonb_build_object('label','Mais volume','value','volume','score',15,'phrase','Meu objetivo é ganhar mais volume nos lábios.'),
    jsonb_build_object('label','Melhorar o contorno','value','contorno','score',15,'phrase','Quero melhorar o contorno dos lábios.'),
    jsonb_build_object('label','Hidratação / naturalidade','value','natural','score',10,'phrase','Busco um resultado natural e hidratado.')
  ))),
('22222222-0000-0000-0000-000000000003', 1, 'question', jsonb_build_object(
  'key','ajuda',
  'title','Como podemos te ajudar?',
  'options', jsonb_build_array(
    jsonb_build_object('label','Saber se é indicado','value','indicado','score',20,'phrase','Quero saber se é indicado para mim.'),
    jsonb_build_object('label','Saber valores','value','valores','score',15,'phrase','Gostaria de saber os valores.'),
    jsonb_build_object('label','Ver horários','value','horarios','score',25,'phrase','Quero ver os horários disponíveis.')
  ))),
('22222222-0000-0000-0000-000000000003', 2, 'whatsapp', jsonb_build_object(
  'button_label','Falar no WhatsApp'));
