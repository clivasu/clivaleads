"use client";

import { useEffect, useState } from "react";
import type { PublicFunnelConfig } from "@/lib/public-funnel-config";
import { CONVERSION_EVENT, type ConversionKind } from "@/lib/tracking";

// Pixels de anúncio da clínica (Meta, GA4, TikTok) com consentimento (LGPD).
// - Nada de terceiros carrega antes de "Aceitar". "Recusar" é definitivo
//   para este navegador (pode mudar pelo link "Cookies" no rodapé).
// - Eventos enviados: visita da página, "lead" (concluiu o funil) e
//   "contato" (abriu o WhatsApp). Nunca respostas, nome, telefone, e-mail ou
//   score. A URL da página não contém respostas.
// - Meta: autoConfig desligado (não lê campos/botões da página) e sem
//   correspondência avançada. GA4: sem Google Signals e sem personalização.

type Choice = "granted" | "denied";
const KEY = (org: string) => `cliva_consent_v1:${org}`;

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
    _fbq?: unknown;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    ttq?: { load: (id: string) => void; page: () => void; track: (e: string) => void; [k: string]: unknown };
    TiktokAnalyticsObject?: string;
  }
}

function addScript(src: string) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  s.referrerPolicy = "strict-origin-when-cross-origin";
  document.head.appendChild(s);
}

function loadMeta(id: string) {
  if (!window.fbq) {
    const n = function (...args: unknown[]) {
      const f = n as unknown as { callMethod?: (...a: unknown[]) => void; queue: unknown[] };
      if (f.callMethod) f.callMethod(...args); else f.queue.push(args);
    } as NonNullable<Window["fbq"]>;
    Object.assign(n, { push: n, loaded: true, version: "2.0", queue: [] });
    window.fbq = n;
    window._fbq = n;
    addScript("https://connect.facebook.net/en_US/fbevents.js");
  }
  window.fbq("set", "autoConfig", false, id);
  window.fbq("init", id);
  window.fbq("track", "PageView");
}

function loadGa4(id: string) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(...args: unknown[]) { window.dataLayer!.push(args); };
  window.gtag("js", new Date());
  window.gtag("config", id, { allow_google_signals: false, allow_ad_personalization_signals: false });
  addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
}

function loadTikTok(id: string) {
  if (!window.ttq) {
    const methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
    const q: unknown[] = [];
    const ttq = { _q: q } as unknown as NonNullable<Window["ttq"]>;
    for (const m of methods) (ttq as Record<string, unknown>)[m] = (...args: unknown[]) => { q.push([m, ...args]); };
    ttq.load = (pid: string) => { addScript(`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(pid)}&lib=ttq`); };
    window.TiktokAnalyticsObject = "ttq";
    window.ttq = ttq;
  }
  window.ttq.load(id);
  window.ttq.page();
}

function sendConversion(kind: ConversionKind, p: PublicFunnelConfig["pixels"]) {
  if (p.metaPixel) window.fbq?.("track", kind === "lead" ? "Lead" : "Contact");
  if (p.ga4) window.gtag?.("event", kind === "lead" ? "generate_lead" : "contact");
  if (p.tiktokPixel) window.ttq?.track(kind === "lead" ? "SubmitForm" : "Contact");
}

export function MarketingPixels({ config, orgId }: { config: PublicFunnelConfig; orgId: string }) {
  const [choice, setChoice] = useState<Choice | null | undefined>(undefined); // undefined = ainda lendo
  const pixels = config.pixels;
  const hasPixels = Object.keys(pixels).length > 0;

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(KEY(orgId)); } catch { /* navegador sem storage: pergunta de novo */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do localStorage na montagem
    setChoice(saved === "granted" || saved === "denied" ? saved : null);
    const reopen = () => setChoice(null);
    window.addEventListener("cliva:cookie-settings", reopen);
    return () => window.removeEventListener("cliva:cookie-settings", reopen);
  }, [orgId]);

  // Carrega os pixels só com consentimento e escuta as conversões.
  useEffect(() => {
    if (choice !== "granted" || !hasPixels) return;
    if (pixels.metaPixel) loadMeta(pixels.metaPixel);
    if (pixels.ga4) loadGa4(pixels.ga4);
    if (pixels.tiktokPixel) loadTikTok(pixels.tiktokPixel);
    const onConv = (e: Event) => sendConversion((e as CustomEvent<ConversionKind>).detail, pixels);
    window.addEventListener(CONVERSION_EVENT, onConv);
    return () => window.removeEventListener(CONVERSION_EVENT, onConv);
  }, [choice, hasPixels, pixels]);

  const decide = (c: Choice) => {
    try { localStorage.setItem(KEY(orgId), c); } catch { /* vale só nesta visita */ }
    // Recusar depois de aceitar: recarrega para descarregar os scripts.
    if (c === "denied" && choice === "granted") { window.location.reload(); return; }
    setChoice(c);
  };

  if (!config.consent.banner || choice === undefined || choice !== null) return null;

  return (
    <div role="dialog" aria-live="polite" aria-label="Privacidade e cookies" className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-xl">
        {hasPixels ? (
          <p>
            Usamos cookies de medição de anúncios ({[pixels.metaPixel && "Meta", pixels.ga4 && "Google", pixels.tiktokPixel && "TikTok"].filter(Boolean).join(", ")}).
            Suas respostas e seus dados de contato <b className="text-slate-800">não</b> são enviados a essas empresas.
          </p>
        ) : (
          <p>{config.consent.text || "Este site usa apenas cookies necessários para funcionar."}</p>
        )}
        {config.consent.privacyUrl && (
          <a href={config.consent.privacyUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-medium underline underline-offset-2">
            Política de privacidade
          </a>
        )}
        <div className="mt-3 flex justify-end gap-2">
          {hasPixels ? (
            <>
              <button onClick={() => decide("denied")} className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Recusar</button>
              <button onClick={() => decide("granted")} className="brand-btn rounded-lg px-3.5 py-2 text-sm font-semibold">Aceitar</button>
            </>
          ) : (
            <button onClick={() => decide("denied")} className="brand-btn rounded-lg px-3.5 py-2 text-sm font-semibold">Entendi</button>
          )}
        </div>
      </div>
    </div>
  );
}

// Link discreto para rever a escolha (rodapé do funil).
export function CookieSettingsLink() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event("cliva:cookie-settings"))} className="text-[11px] text-slate-400 underline-offset-2 hover:underline">
      Cookies
    </button>
  );
}
