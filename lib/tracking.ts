"use client";

import type { EventType } from "@/lib/types";

// Rastreio em lote: os eventos ficam numa fila e vão juntos para /api/track.
// Uma visita típica faz 1 a 3 envios, em vez de um por clique.
//
// Só são gravados os tipos que os relatórios usam (e que a tabela aceita:
// a saída "sem interesse" já fica no status "lost" do lead). O caminho de cada lead
// (etapas e respostas) já fica em lead_sessions/lead_answers, então
// question_viewed e option_clicked não precisam de uma linha por clique.
const PERSISTED = new Set<EventType>([
  "page_view",
  "flow_started",
  "flow_completed",
  "whatsapp_clicked",
]);

// Fim da visita (ou saída para o WhatsApp): envia na hora.
const TERMINAL = new Set<EventType>(["flow_completed", "whatsapp_clicked"]);

const FLUSH_AFTER_MS = 8000;
const MAX_BATCH = 20;

interface QueuedEvent {
  type: EventType;
  flow_id: string;
  organization_id: string;
  metadata?: Record<string, unknown>;
}

let queue: QueuedEvent[] = [];
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
    metadata?: Record<string, unknown>;
  },
) {
  if (!PERSISTED.has(type) || typeof window === "undefined") return;
  listen();
  queue.push({ type, ...payload });
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
