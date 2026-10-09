"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { ClivaMark } from "@/components/brand/logo";
import "../login/auth.css";

// Nova senha: chega aqui pelo link do e-mail "Redefinir senha" (ou do convite),
// já com a sessão aberta pela rota /auth/confirm.
export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ready" | "nosession">("checking");
  const [invite, setInvite] = useState(false);
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setInvite(new URLSearchParams(window.location.search).has("convite"));
    if (!isSupabaseConfigured) { setState("nosession"); return; }
    createClient().auth.getUser().then(({ data }) => setState(data.user ? "ready" : "nosession"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pass.length < 6) return setError("A senha precisa ter pelo menos 6 caracteres.");
    if (pass !== confirm) return setError("As senhas não são iguais.");
    setSaving(true);
    const { error: err } = await createClient().auth.updateUser({ password: pass });
    setSaving(false);
    if (err) return setError(/different from the old/i.test(err.message) ? "A nova senha precisa ser diferente da atual." : err.message);
    router.push(invite ? "/assinar" : "/dashboard");
    router.refresh();
  }

  return (
    <div className="cl-auth-page">
      <div className="w-full max-w-[420px]">
        <div className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-[0_30px_80px_-30px_rgba(13,148,136,0.45)]">
          <div className="flex items-center gap-3 bg-gradient-to-br from-emerald-500 via-teal-600 to-teal-700 px-6 py-5 text-white">
            <span className="cl-auth-badge !h-10 !w-10 !rounded-xl"><ClivaMark size={26} /></span>
            <div>
              <b className="block text-[1.05rem]">{invite ? "Crie sua senha" : "Nova senha"}</b>
              <span className="text-[0.8rem] opacity-90">{invite ? "Último passo para acessar a Cliva." : "Escolha uma senha nova para sua conta."}</span>
            </div>
          </div>
          <div className="px-6 py-8">
            {state === "checking" && <p className="flex items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Verificando o link…</p>}
            {state === "nosession" && (
              <div className="text-center">
                <p className="font-semibold text-slate-900">Este link expirou ou já foi usado</p>
                <p className="mt-1 text-sm text-slate-500">Peça um novo link na tela de login, em “Esqueci minha senha”.</p>
                <Link href="/login?esqueci=1" className="cl-auth-btn mt-6 no-underline">Pedir novo link</Link>
              </div>
            )}
            {state === "ready" && (
              <form onSubmit={submit}>
                <div className="cl-auth-field">
                  <input id="new-pass" type="password" required placeholder=" " minLength={6} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" />
                  <label htmlFor="new-pass">Nova senha (mín. 6 caracteres)</label>
                </div>
                <div className="cl-auth-field">
                  <input id="new-pass-2" type="password" required placeholder=" " value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
                  <label htmlFor="new-pass-2">Repita a senha</label>
                </div>
                {error && <p className="cl-auth-error">{error}</p>}
                <button type="submit" className="cl-auth-btn" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar senha
                </button>
              </form>
            )}
          </div>
        </div>
        <Link href="/login" className="mt-5 block text-center text-xs text-slate-400 hover:text-slate-600">← Voltar para o login</Link>
      </div>
    </div>
  );
}
