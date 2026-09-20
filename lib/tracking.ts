"use client";

import type { EventType } from "@/lib/types";

// Fire-and-forget client tracking. Uses sendBeacon when leaving the page
// (e.g. whatsapp_clicked) so the event survives navigation.
export function track(
  type: EventType,
  payload: {
    flow_id: string;
    organization_id: string;
    metadata?: Record<string, unknown>;
  },
) {
  const body = JSON.stringify({ type, ...payload });
  try {
    if (
      (type === "whatsapp_clicked" || type === "flow_completed") &&
      typeof navigator.sendBeacon === "function"
    ) {
      navigator.sendBeacon("/api/track", body);
      return;
    }
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Tracking must never break the lead experience.
  }
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
