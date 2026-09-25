"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";

export function UploadButton({
  onUploaded,
  label = "Enviar foto",
}: {
  onUploaded: (url: string) => void;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      alert("A imagem deve ter até 6 MB.");
      return;
    }
    setBusy(true);
    try {
      if (isSupabaseConfigured) {
        const supabase = createClient();
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `bio/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("media")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (error) throw error;
        const { data } = supabase.storage.from("media").getPublicUrl(path);
        onUploaded(data.publicUrl);
      } else {
        // Modo demo: pré-visualização local (não é persistido).
        const url = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        onUploaded(url);
      }
    } catch (err) {
      alert("Falha no upload: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
      >
        <Upload className="h-4 w-4" /> {busy ? "Enviando..." : label}
      </button>
      <input ref={ref} type="file" accept="image/*" hidden onChange={handle} />
    </>
  );
}
