"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Download, EllipsisVertical, MonitorSmartphone, Share, SquarePlus } from "lucide-react";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  detectPlatform, getInstallState, promptInstall, SERVER_INSTALL_STATE, subscribeInstall, type Platform,
} from "@/lib/pwa";

const noop = () => () => {};
function readPlatform(): Platform {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return detectPlatform(nav.userAgent, {
    standalone: window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true,
    maxTouchPoints: nav.maxTouchPoints,
    platform: nav.platform,
  });
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2.5 text-sm text-slate-700">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">{i + 1}</span>
          <span className="pt-0.5">{it}</span>
        </li>
      ))}
    </ol>
  );
}

const Key = ({ children }: { children: React.ReactNode }) => (
  <b className="inline-flex items-center gap-1 font-semibold text-slate-900">{children}</b>
);

// Configurações → "Baixe o app da Cliva". O app é instalado pelo navegador
// (PWA): não passa pela App Store nem pelo Google Play.
export function InstallAppCard() {
  const platform = useSyncExternalStore<Platform | null>(noop, readPlatform, () => null);
  const { canPrompt, installed } = useSyncExternalStore(subscribeInstall, getInstallState, () => SERVER_INSTALL_STATE);
  const [qr, setQr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (platform !== "desktop") return;
    QRCode.toDataURL(`${window.location.origin}/settings#app`, { width: 320, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } })
      .then(setQr).catch(() => {});
  }, [platform]);

  const install = async () => {
    setMsg(null);
    const r = await promptInstall();
    if (r === "dismissed") setMsg("Instalação cancelada. Você pode tentar de novo quando quiser.");
  };

  const done = installed || platform === "standalone";

  return (
    <Card id="app" className="mb-6 scroll-mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MonitorSmartphone className="h-5 w-5 text-emerald-600" /> Baixe o app da Cliva</CardTitle>
        <p className="text-sm text-slate-500">Agenda, pacientes e leads com um toque: ícone na tela inicial, tela cheia e sempre atualizado. Grátis e quase não ocupa espaço.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {platform === null ? (
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" aria-hidden />
        ) : done ? (
          <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            {platform === "standalone" ? "Você já está usando o app da Cliva." : "App instalado! Procure o ícone da Cliva no seu aparelho."}
          </p>
        ) : (
          <>
            {canPrompt && (
              <Button type="button" onClick={install} className="w-full gap-2 sm:w-auto">
                <Download className="h-4 w-4" /> {platform === "desktop" ? "Instalar neste computador" : "Instalar o app"}
              </Button>
            )}
            {msg && <p role="status" className="text-sm text-slate-500">{msg}</p>}

            {platform === "ios" && (
              <Steps items={[
                <>Toque em <Key>Compartilhar <Share className="h-4 w-4" /></Key> na barra do navegador.</>,
                <>Role e escolha <Key>Adicionar à Tela de Início <SquarePlus className="h-4 w-4" /></Key>.</>,
                <>Toque em <Key>Adicionar</Key>. O ícone da Cliva aparece na tela inicial.</>,
              ]} />
            )}
            {platform === "android" && !canPrompt && (
              <Steps items={[
                <>Abra o menu do navegador <Key><EllipsisVertical className="h-4 w-4" /></Key>.</>,
                <>Toque em <Key>Instalar app</Key> ou <Key>Adicionar à tela inicial</Key>.</>,
                <>Confirme. O ícone da Cliva aparece com os seus apps.</>,
              ]} />
            )}
            {(platform === "ios-inapp" || platform === "android-inapp") && (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                Este navegador, aberto de dentro de outro app, não instala aplicativos. Abra <b>cliva.me</b> no {platform === "ios-inapp" ? "Safari" : "Chrome"} e volte a esta tela.
              </p>
            )}
            {platform === "desktop" && (
              <div className="flex flex-col items-center gap-4 rounded-xl bg-slate-50 p-4 sm:flex-row">
                {qr
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={qr} alt="QR code para abrir a Cliva no celular" width={136} height={136} className="h-[136px] w-[136px] rounded-lg bg-white" />
                  : <div className="h-[136px] w-[136px] animate-pulse rounded-lg bg-slate-200" aria-hidden />}
                <div className="text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Para instalar no celular</p>
                  <p className="mt-1">Aponte a câmera do celular para o código, entre na sua conta e abra <b>Configurações</b>. As instruções aparecem aqui mesmo, de acordo com o seu aparelho.</p>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
