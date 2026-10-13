# Webhook de leads da Cliva

Envia cada lead capturado num funil para a URL configurada (CRM, Zapier, Make, n8n, sistema próprio).

## Configuração (editor do funil → Configurações → Integrações)

1. **URL do webhook:** precisa ser `https://`, porta 443, endereço público. Endereços internos (rede privada, localhost, metadata de nuvem) são recusados, inclusive quando um domínio aponta para eles.
2. **Gerar segredo:** a Cliva gera e mostra uma vez. Guarde no CRM para conferir a assinatura. "Gerar novo segredo" troca o anterior na hora.
3. **Enviar lead automaticamente:** liga o envio.
4. **Incluir respostas do questionário** (desligado por padrão): as respostas podem ser dados de saúde. Ligue só se o destino for da clínica e estiver no aviso de privacidade.
5. **Testar webhook:** envia um evento `webhook.test` para a URL digitada. Nenhum lead é criado.

## Requisição

`POST` com `Content-Type: application/json` e os cabeçalhos:

| Cabeçalho | Conteúdo |
|---|---|
| `X-Cliva-Event` | `lead.created` (ou `webhook.test`) |
| `X-Cliva-Delivery` | id da entrega (o mesmo em todas as tentativas) |
| `Idempotency-Key` | igual ao id da entrega: use para ignorar repetições |
| `X-Cliva-Signature` | `t=<unix>,v1=<hex>` (só com segredo configurado) |

Corpo de `lead.created`:

```json
{
  "id": "8b1c…",
  "event": "lead.created",
  "created_at": "2026-10-12T14:03:11.123Z",
  "lead": {
    "id": "e5f2…",
    "name": "Ana", "phone": "5561999990000", "email": null,
    "procedure": "Botox",
    "score": 72, "interest": "hot", "disqualified": false,
    "whatsapp_clicked": true,
    "utm": { "source": "instagram", "medium": "cpc", "campaign": "outubro", "content": null, "term": null },
    "answers": [{ "question": "…", "answer": "…" }]
  },
  "funnel": { "id": "…", "name": "Botox", "url": "https://cliva.me/clinica/botox" }
}
```

`answers` só aparece com a opção ligada. `interest`: `hot` (score 61+), `warm` (31–60), `cold` (0–30). `disqualified`: o lead foi para o final "sem interesse".

## Conferir a assinatura

`v1` = HMAC-SHA256 do texto `"<t>.<corpo bruto>"` com o segredo, em hexadecimal. Recuse se não bater ou se `t` tiver mais de 5 minutos.

```js
import crypto from "node:crypto";

function verify(secret, header, rawBody) {
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header || "");
  if (!m || Math.abs(Date.now() / 1000 - Number(m[1])) > 300) return false;
  const mac = crypto.createHmac("sha256", secret).update(`${m[1]}.${rawBody}`).digest();
  return crypto.timingSafeEqual(mac, Buffer.from(m[2], "hex"));
}
```

Use o corpo **bruto** (antes de converter para objeto).

## Entrega e novas tentativas

- Resposta `2xx` = entregue. Qualquer outra coisa (inclusive redirecionamento `3xx`, que não é seguido) = falha.
- Tempo limite: 10 segundos. A resposta do CRM é descartada (não é guardada).
- Falhas são tentadas de novo após 1 min, 5 min, 30 min, 2 h e 12 h (6 tentativas no total). As novas tentativas rodam quando chegam novos leads, no cron diário (`/api/cron/webhooks`) e pelo botão **Reenviar**.
- O histórico (editor → Integrações → Últimas entregas) mostra status, tentativas e um motivo curto, sem dados do paciente.
- O mesmo lead nunca gera duas entregas; uma entrega pode chegar mais de uma vez se o CRM demorar a responder. Use `Idempotency-Key`.
