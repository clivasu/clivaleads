"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { checkHandle } from "@/lib/actions/handle";
import { handleFormatError, slugifyHandle, typingHandle } from "@/lib/handles";
import { cn } from "@/lib/utils";

export type HandleStatus = "idle" | "checking" | "ok" | "taken";

// Campo do identificador público com checagem de disponibilidade enquanto
// a pessoa digita (cliva.me/<handle>).
export function HandleInput({
  value, onChange, onStatus, host = "cliva.me", id = "handle", optional = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onStatus?: (s: HandleStatus) => void;
  host?: string;
  id?: string;
  optional?: boolean; // no cadastro: vazio = usar parte do e-mail
}) {
  const [status, setStatus] = useState<HandleStatus>("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const handle = slugifyHandle(value);
    const set = (s: HandleStatus, m: string | null) => { setStatus(s); setMsg(m); onStatus?.(s); };
    if (!handle) { set("idle", null); return; }
    const formatError = handleFormatError(handle);
    if (formatError) { set("taken", formatError); return; }
    set("checking", null);
    const n = ++seq.current;
    const t = setTimeout(async () => {
      const res = await checkHandle(handle).catch(() => null);
      if (n !== seq.current) return; // resposta de uma digitação antiga
      if (!res) set("idle", null);
      else if (res.available) set("ok", "Disponível");
      else set("taken", res.error ?? "Já está em uso.");
    }, 400);
    return () => clearTimeout(t);
    // onStatus é estável o bastante para não refazer a checagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="grid gap-1.5">
      <div className={cn(
        "flex items-center overflow-hidden rounded-md border bg-white text-sm focus-within:ring-2",
        status === "taken" ? "border-rose-300 focus-within:ring-rose-100" : status === "ok" ? "border-emerald-300 focus-within:ring-emerald-100" : "border-input focus-within:ring-slate-100",
      )}>
        <span className="shrink-0 bg-slate-50 px-3 py-2 text-slate-400">{host}/</span>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(typingHandle(e.target.value))}
          onBlur={() => onChange(slugifyHandle(value))}
          placeholder={optional ? "seu-nome" : "marco"}
          className="min-w-0 flex-1 px-2 py-2 outline-none"
          autoComplete="off"
          spellCheck={false}
        />
        <span className="shrink-0 px-2.5">
          {status === "checking" && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          {status === "ok" && <Check className="h-4 w-4 text-emerald-600" />}
          {status === "taken" && <X className="h-4 w-4 text-rose-500" />}
        </span>
      </div>
      {msg && <p className={cn("text-xs", status === "taken" ? "text-rose-600" : "text-emerald-700")}>{msg}</p>}
    </div>
  );
}
