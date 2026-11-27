# Agendamento online pelo funil

## Como funciona
1. **Configurações → Agendamento online:** horário de atendimento por dia (com pausa), intervalo entre horários, antecedência mínima, até quantos dias à frente, feriados nacionais, confirmação automática, datas bloqueadas e duração/preço de cada procedimento.
2. **Editor do funil → bloco "Agendamento (horários livres)":** escolha o procedimento, a duração (ou use a da Agenda) e o profissional (ou "qualquer profissional livre").
3. **Paciente:** escolhe o dia e um horário livre. Se o funil ainda não pediu, informa nome e WhatsApp. Ao confirmar, o horário entra na Agenda na hora.
4. **Painel:** o calendário ao lado do sino mostra quantos agendamentos novos chegaram; cada item abre a Agenda no dia.

## Regras e proteções
- Os horários vêm do servidor: regras da clínica + agenda atual (agendamentos cancelados não ocupam horário).
- Ao confirmar, o servidor confere de novo o horário. Dois pacientes no mesmo horário: o banco aceita só um (restrição `schedule_no_overlap`); o outro vê "Esse horário acabou de ser ocupado".
- Clique duplo ou reenvio não duplica (identificador do pedido).
- Profissional, duração e clínica são definidos pelo funil, nunca pelo navegador.
- Paciente é reaproveitada pelo telefone na mesma clínica.
- O agendamento fica ligado ao lead; o lead passa a "agendado" e entra no indicador "Agendamentos" da Analytics.
- Status na Agenda: "aguardando" (padrão) ou "confirmado" (com confirmação automática).
- Fuso de Brasília. Feriados nacionais incluem Carnaval, Sexta-feira Santa e Corpus Christi. Feriados municipais: use "Datas sem atendimento".

## Material grátis (bloco `gift`)

Entrega um PDF e convida para o próximo passo (por exemplo, o bloco Agendamento).

- O lead é gravado quando a pessoa chega ao bloco, mesmo que ela não agende. Se a gravação falhar, a etapa seguinte tenta de novo com o mesmo `client_ref`.
- Ao agendar, o lead vira "Agendado", o agendamento e a ficha do paciente apontam para o lead, e a página do lead mostra data e horário.
- Campos extras do formulário (Instagram, cidade) são gravados como respostas do lead.
- O arquivo é um link https ou um arquivo de `public/`. Não há upload de PDF no editor.

Primeiro uso: `supabase/seed/funil_diagnostico_viviane.sql` (só na conta mamsbsb@icloud.com).

## Dias e horários do próprio bloco

O bloco Agendamento usa o horário da clínica ou, em "Só deste bloco", dias da semana e períodos próprios (`booking_hours`, até 6 períodos por dia) e intervalo próprio (`booking_slot_minutes`). Esses dias valem mesmo fora do horário da clínica. Feriados, datas bloqueadas, antecedência e janela continuam os da clínica. O servidor confere o horário pelas mesmas regras ao confirmar.

## Tema do funil

A aba Design grava em `flows.settings.theme` só o que foi mudado. A página pública aplica valores validados por `normalizeTheme`.

## Respostas escritas e personalização

- Bloco `open_answer`: resposta curta (uma linha) ou longa (texto livre, até 2000 caracteres). A resposta fica no lead para leitura. Com `save_as` (`name`, `phone`, `email`) ela vai para o contato do lead.
- Bloco mágico "Nome": `open_answer` com `save_as: "name"`. Depois dele, `{nome}` (primeiro nome) e `{nome_completo}` funcionam em títulos, textos, opções e botões.
- Variáveis: pergunta de escolha única, múltipla, nota ou resposta escrita com "Nome da variável" (`config.key`) pode ser citada depois como `{variavel}`.
- As respostas são gravadas com o título original (com `{nome}`), para a pontuação do servidor continuar batendo. O painel mostra a pergunta com o nome do lead. Sem resposta, a variável some do texto sem deixar vírgula solta.

## Datas do mês

Terceiro modo do bloco (`booking_mode: "dates"`): `booking_dates` lista datas (AAAA-MM-DD) com os períodos de cada uma. Só essas datas abrem, mesmo em feriado; datas bloqueadas e antecedência continuam as da clínica, e a agenda fica aberta até a última data escolhida (até 180 dias). `booking_view` escolhe como quem agenda vê: calendário do mês (`month`, padrão nesse modo) ou faixa da semana (`week`). Sem `booking_mode`, bloco com `booking_hours` continua em "Semana fixa".
