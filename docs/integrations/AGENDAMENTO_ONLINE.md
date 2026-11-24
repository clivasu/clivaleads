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
