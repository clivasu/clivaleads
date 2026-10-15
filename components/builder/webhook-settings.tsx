"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, KeyRound, RefreshCw, Send } from "lucide-react";
import type { FunnelSettings } from "@/lib/flow-settings";
import {
  generateWebhookSecret, listWebhookDeliveries, resendWebhookDelivery, testWebhook,
  type DeliveryRow, type WebhookTestResult,
} from "@/lib/actions/webhooks";
import { cn } from "@/lib/utils";

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none";

const STATUS: Record<DeliveryRow["status"], { label: string; cls: string }> = {
  delivered: { label: "Entregue", cls: "bg-emerald-50 text-emerald-700" },
  pending: { label: "Nova tentativa agendada", cls: "bg-amber-50 text-amber-700" },
  failed: { label: "Falhou", cls: "bg-rose-50 text-rose-700" },
};

const fmt = (d: string | null) => d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

// Seção "Integrações (Webhook / CRM)" do editor.
export function WebhookSettings({
  s, setS, flowId, hasWebhookSecret, Toggle,
}: {
  s: FunnelSettings;
  setS: (p: Partial<FunnelSettings>) => void;
  flowId: string;
  hasWebhookSecret: boolean;
  Toggle: (p: { on: boolean; onChange: (v: boolean) => void }) => React.ReactElement;
}) {
  const [test, setTest] = useState<WebhookTestResult | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [hasSecret, setHasSecret] = useState(hasWebhookSecret);
  const [copied, setCopied] = useState(false);
  const [rows, setRows] = useState<DeliveryRow[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const refresh = () => start(async () => setRows(await listWebhookDeliveries(flowId)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refresh(); }, [flowId]);

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">URL do webhook (https)</span>
        <input className={inputCls} value={s.webhookUrl} onChange={(e) => { setS({ webhookUrl: e.target.value }); setTest(null); }} placeholder="https://seu-crm.com/webhook" />
      </label>

      <div className="rounded-xl border border-slate-200 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-700">Segredo de assinatura</p>
            <p className="text-xs text-slate-400">
              {hasSecret ? "Configurado. Cada envio leva o cabeçalho X-Cliva-Signature (HMAC-SHA256)." : "Sem segredo: o CRM não consegue confirmar que o envio veio da Cliva."}
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => {
              const r = await generateWebhookSecret(flowId);
              if (r.ok && r.secret) { setSecret(r.secret); setHasSecret(true); setCopied(false); } else setMsg(r.message ?? "Falha ao gerar.");
            })}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <KeyRound className="h-3.5 w-3.5" /> {hasSecret ? "Gerar novo segredo" : "Gerar segredo"}
          </button>
        </div>
        {secret && (
          <div className="mt-3 rounded-lg bg-amber-50 p-3">
            <p className="mb-1.5 text-xs font-medium text-amber-800">Copie agora e cole no seu CRM. Ele não será mostrado de novo.</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1.5 text-xs text-slate-800">{secret}</code>
              <button type="button" onClick={() => { void navigator.clipboard?.writeText(secret); setCopied(true); }} className="flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>
        )}
        <details className="mt-2 text-xs text-slate-400">
          <summary className="cursor-pointer select-none">Já tenho um segredo do CRM</summary>
          <input className={cn(inputCls, "mt-2")} type="password" autoComplete="off" value={s.webhookSecret} onChange={(e) => setS({ webhookSecret: e.target.value })}
            placeholder={hasSecret ? "Digite para trocar (vale ao salvar o funil)" : "Cole o segredo (vale ao salvar o funil)"} />
        </details>
      </div>

      <div className="flex items-center justify-between gap-4 py-1">
        <div>
          <p className="text-sm font-medium text-slate-700">Enviar lead automaticamente</p>
          <p className="text-xs text-slate-400">A cada lead gravado. Se o CRM falhar, a Cliva tenta de novo sozinha (até 6 tentativas) e você pode reenviar abaixo.</p>
        </div>
        <Toggle on={s.autoSendLead} onChange={(v) => setS({ autoSendLead: v })} />
      </div>
      <div className="flex items-center justify-between gap-4 border-t py-2.5">
        <div>
          <p className="text-sm font-medium text-slate-700">Incluir respostas do questionário</p>
          <p className="text-xs text-slate-400">Desligado: vão só contato, procedimento, interesse e origem. As respostas podem ser dados de saúde (LGPD): ligue só se o CRM for da clínica e estiver no seu aviso de privacidade.</p>
        </div>
        <Toggle on={s.webhookIncludeAnswers} onChange={(v) => setS({ webhookIncludeAnswers: v })} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || !s.webhookUrl.trim()}
          onClick={() => start(async () => setTest(await testWebhook(flowId, s.webhookUrl)))}
          className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" /> Testar webhook
        </button>
        <span className="text-xs text-slate-400">Envia um evento de teste. Nenhum lead é criado.</span>
      </div>
      {test && (
        <p role="status" className={cn("rounded-lg px-3 py-2 text-xs", test.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700")}>{test.message}</p>
      )}
      {msg && <p role="alert" className="text-xs text-rose-600">{msg}</p>}

      <div className="border-t pt-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Últimas entregas</p>
          <button type="button" onClick={refresh} disabled={pending} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700">
            <RefreshCw className={cn("h-3.5 w-3.5", pending && "animate-spin")} /> Atualizar
          </button>
        </div>
        {rows === null ? (
          <p className="text-xs text-slate-400">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhuma entrega ainda.</p>
        ) : (
          <ul className="divide-y rounded-lg border text-xs">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className={cn("rounded-full px-2 py-0.5 font-medium", STATUS[r.status].cls)}>{STATUS[r.status].label}</span>
                <span className="text-slate-500">{fmt(r.created_at)}</span>
                <span className="text-slate-400">{r.attempts} tentativa{r.attempts === 1 ? "" : "s"}</span>
                {r.status !== "delivered" && r.last_error && <span className="text-slate-500">· {r.last_error}</span>}
                {r.status === "pending" && <span className="text-slate-400">· próxima {fmt(r.next_attempt_at)}</span>}
                {r.status !== "delivered" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => start(async () => { const x = await resendWebhookDelivery(flowId, r.id); setMsg(x.ok ? null : x.message); setRows(await listWebhookDeliveries(flowId)); })}
                    className="ml-auto rounded-md border px-2 py-1 font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Reenviar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
