"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next.length < 6) {
      setMsg({ ok: false, text: "A nova senha precisa ter ao menos 6 caracteres." });
      return;
    }
    if (next !== confirm) {
      setMsg({ ok: false, text: "A confirmação não confere com a nova senha." });
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) {
        setMsg({ ok: false, text: "Sessão expirada. Entre novamente." });
        return;
      }
      // Confirma a senha atual antes de trocar.
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: current,
      });
      if (signErr) {
        setMsg({ ok: false, text: "Senha atual incorreta." });
        return;
      }
      const { error: updErr } = await supabase.auth.updateUser({ password: next });
      if (updErr) {
        setMsg({ ok: false, text: updErr.message });
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setMsg({ ok: true, text: "Senha alterada com sucesso." });
    });
  }

  return (
    <Card className="mt-6">
      <CardHeader><CardTitle>Trocar senha</CardTitle></CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="cur">Senha atual</Label>
            <Input id="cur" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="np">Nova senha</Label>
            <Input id="np" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={6} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cp">Confirmar nova senha</Label>
            <Input id="cp" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={6} required />
          </div>
          {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? "Alterando..." : "Alterar senha"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
