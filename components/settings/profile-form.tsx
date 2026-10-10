"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { UploadButton } from "@/components/bio/upload-button";
import { createClient } from "@/lib/supabase/client";

// Foto de perfil e nome de quem usa a conta (ficam nos dados do usuário).
export function ProfileForm({ name: initialName, avatarUrl: initialAvatar, email }: { name: string; avatarUrl: string | null; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState<string | null>(initialAvatar);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const initials = (name || email || "?").split(" ").slice(0, 2).map((s) => s.charAt(0).toUpperCase()).join("");

  const save = (nextAvatar = avatar) =>
    start(async () => {
      setMsg(null);
      const supabase = createClient();
      const { data, error } = await supabase.auth.updateUser({ data: { full_name: name.trim(), avatar_url: nextAvatar ?? "" } });
      if (error) { setMsg({ ok: false, text: error.message }); return; }
      if (data.user) await supabase.from("profiles").update({ full_name: name.trim() || null }).eq("id", data.user.id);
      setMsg({ ok: true, text: "Perfil atualizado." });
      router.refresh();
    });

  return (
    <Card className="mb-6">
      <CardHeader><CardTitle>Seu perfil</CardTitle></CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-2xl font-semibold text-emerald-700 ring-4 ring-emerald-50">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="Foto de perfil" className="h-full w-full object-cover" />
            ) : initials}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <UploadButton label={avatar ? "Trocar foto" : "Enviar foto"} maxSizeMB={2} onUploaded={(url) => { setAvatar(url); save(url); }} />
            {avatar && (
              <button type="button" onClick={() => { setAvatar(null); save(null); }} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                <Trash2 className="h-4 w-4" /> Remover
              </button>
            )}
            <p className="w-full text-xs text-slate-400">JPG ou PNG. A foto é reduzida automaticamente.</p>
          </div>
        </div>

        <form className="mt-6 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <div className="grid gap-2">
            <Label htmlFor="profile-name">Seu nome</Label>
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Dra. Bárbara" />
          </div>
          <div className="grid gap-2">
            <Label>E-mail</Label>
            <Input value={email} disabled />
          </div>
          {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
          <Button type="submit" disabled={pending} className="mt-1 gap-2">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar perfil
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
