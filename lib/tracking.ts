"use client";

import type { EventType } from "@/lib/types";

// Rastreio em lote: os eventos ficam numa fila e vão juntos para /api/track.
// Uma visita típica faz poucos envios, em vez de um por clique.
//
// Cada evento leva um id único (event_id): se o envio for repetido (retry,
// sendBeacon + fetch), o banco ignora a cópia. Nenhum evento leva resposta,
// nome, telefone ou e-mail: só tipo, funil e posição da etapa.

// Fim da visita (saída para o WhatsApp, conclusão ou saída): envia na hora.
const TERMINAL = new Set<EventType>(["flow_completed", "flow_exited", "whatsapp_clicked"]);

const FLUSH_AFTER_MS = 8000;
const MAX_BATCH = 30;

interface QueuedEvent {
  type: EventType;
  event_id: string;
  flow_id: string;
  organization_id: string;
  step_index?: number;
  step_id?: string;
}

let queue: QueuedEvent[] = [];

// UUID v4. randomUUID só existe em contexto seguro e navegadores recentes;
// a reserva usa getRandomValues para nenhum evento ficar sem id.
function newEventId(): string {
  const c: Partial<Crypto> | undefined = typeof crypto !== "undefined" ? crypto : undefined;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (typeof c?.getRandomValues === "function") c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function flush(leaving: boolean) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;
  const body = JSON.stringify({ events: queue });
  queue = [];
  try {
    // sendBeacon sobrevive à troca de página (ex.: abrir o WhatsApp).
    if (leaving && typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/track", body)) return;
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    /* rastreio nunca quebra o funil */
  }
}

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
  window.addEventListener("pagehide", () => flush(true));
}

export function track(
  type: EventType,
  payload: {
    flow_id: string;
    organization_id: string;
    step_index?: number;
    step_id?: string;
  },
) {
  if (typeof window === "undefined") return;
  listen();
  const event_id = newEventId();
  queue.push({
    type,
    event_id,
    flow_id: payload.flow_id,
    organization_id: payload.organization_id,
    ...(payload.step_index !== undefined ? { step_index: payload.step_index } : {}),
    ...(payload.step_id ? { step_id: payload.step_id.slice(0, 64) } : {}),
  });
  if (TERMINAL.has(type)) flush(true);
  else if (queue.length >= MAX_BATCH) flush(false);
  else if (!timer) timer = setTimeout(() => flush(false), FLUSH_AFTER_MS);
}

export function detectDevice(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  return "desktop";
}

export function detectBrowser(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Edg/i.test(ua)) return "Edge";
  if (/Chrome/i.test(ua)) return "Chrome";
  if (/Safari/i.test(ua)) return "Safari";
  if (/Firefox/i.test(ua)) return "Firefox";
  return "Outro";
}
