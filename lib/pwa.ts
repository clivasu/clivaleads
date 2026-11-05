// App instalável (PWA): guarda o convite de instalação do navegador e registra
// o service worker. O convite chega uma única vez, no carregamento da página,
// então precisa ser capturado no painel e usado depois em Configurações.

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallState = { canPrompt: boolean; installed: boolean };

let deferred: InstallPromptEvent | null = null;
let installed = false;
let snapshot: InstallState = { canPrompt: false, installed: false };
let started = false;
const listeners = new Set<() => void>();

function emit() {
  snapshot = { canPrompt: Boolean(deferred), installed };
  listeners.forEach((l) => l());
}

export function initPwa() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // o convite aparece só no cartão de Configurações
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* o painel funciona sem ele */ });
  }
}

export const subscribeInstall = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const getInstallState = () => snapshot;
export const SERVER_INSTALL_STATE: InstallState = { canPrompt: false, installed: false };

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  const ev = deferred;
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  deferred = null; // o navegador só permite usar o convite uma vez
  if (outcome === "accepted") installed = true;
  emit();
  return outcome;
}

export type Platform = "standalone" | "ios" | "ios-inapp" | "android" | "android-inapp" | "desktop";

export function detectPlatform(ua: string, opts: { standalone: boolean; maxTouchPoints: number; platform?: string }): Platform {
  if (opts.standalone) return "standalone";
  const inApp = /FBAN|FBAV|Instagram|Line\/|TikTok|musical_ly|; wv\)/i.test(ua);
  // iPadOS se apresenta como Mac, mas tem tela de toque.
  const ios = /iPhone|iPad|iPod/i.test(ua) || (opts.platform === "MacIntel" && opts.maxTouchPoints > 1);
  if (ios) return inApp ? "ios-inapp" : "ios";
  if (/Android/i.test(ua)) return inApp ? "android-inapp" : "android";
  return "desktop";
}
