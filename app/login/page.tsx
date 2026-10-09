"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion, type Variants } from "framer-motion";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { ClivaMark } from "@/components/brand/logo";
import { HandleInput, type HandleStatus } from "@/components/settings/handle-input";
import { claimHandle } from "@/lib/actions/handle";
import { slugifyHandle } from "@/lib/handles";
import "./auth.css";

type Mode = "signin" | "signup";

// Mensagens do Supabase Auth em português.
function translateAuthError(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/already registered|already exists/i.test(msg)) return "Já existe uma conta com este e-mail. Entre com sua senha.";
  if (/email not confirmed/i.test(msg)) return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
  if (/password should be at least/i.test(msg)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/rate limit|too many/i.test(msg)) return "Muitas tentativas. Espere um minuto e tente de novo.";
  if (/invalid email|unable to validate email/i.test(msg)) return "E-mail inválido.";
  return msg;
}

/* ---------- animações (mesmo ritmo do modelo login page v2) ---------- */
const stagger = (dir: 1 | -1): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
  exit: { transition: { staggerChildren: 0.05, staggerDirection: dir } },
});
const loginItem: Variants = {
  hidden: { x: -40, opacity: 0, scale: 0.98 },
  visible: { x: 0, opacity: 1, scale: 1, transition: { duration: 0.45 } },
  exit: { x: -40, opacity: 0, scale: 0.98, transition: { duration: 0.45 } },
};
const signupItem: Variants = {
  hidden: { x: 40, opacity: 0, filter: "blur(8px)" },
  visible: { x: 0, opacity: 1, filter: "blur(0px)", transition: { duration: 0.5 } },
  exit: { x: 40, opacity: 0, filter: "blur(8px)", transition: { duration: 0.45 } },
};
const welcomeLogin: Variants = {
  hidden: { opacity: 0, x: -30, y: -30 },
  visible: { opacity: 1, x: 0, y: 0, transition: { duration: 0.6, delay: 0.2 } },
  exit: { opacity: 0, x: 30, y: 30, transition: { duration: 0.4 } },
};
const welcomeSignup: Variants = {
  hidden: { opacity: 0, x: 30, y: 30 },
  visible: { opacity: 1, x: 0, y: 0, transition: { duration: 0.6, delay: 0.2 } },
  exit: { opacity: 0, x: -30, y: -30, transition: { duration: 0.4 } },
};
const panel: Variants = {
  signin: { x: "25%", skewX: 20 },
  signup: { x: "-85%", skewX: 20 },
};

/* ---------- ícones dos campos ---------- */
const IconUser = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" /></svg>
);
const IconMail = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" /><path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" /></svg>
);
const IconLock = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" /></svg>
);

function Field({
  id, label, type = "text", value, onChange, icon, variants, autoComplete, minLength,
}: {
  id: string; label: string; type?: string; value: string; onChange: (v: string) => void;
  icon: React.ReactNode; variants: Variants; autoComplete?: string; minLength?: number;
}) {
  return (
    <motion.div className="cl-auth-field" variants={variants}>
      <input id={id} type={type} required placeholder=" " value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} minLength={minLength} />
      <label htmlFor={id}>{label}</label>
      {icon}
    </motion.div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null); // null até ler a URL
  const [animating, setAnimating] = useState(false);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleStatus, setHandleStatus] = useState<HandleStatus>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Vindo da landing: abre em "Criar conta" e preenche o e-mail digitado no hero.
  useEffect(() => {
    setMode(new URLSearchParams(window.location.search).get("cadastro") ? "signup" : "signin");
    try {
      const saved = sessionStorage.getItem("cliva_signup_email");
      if (saved) { setEmail(saved); sessionStorage.removeItem("cliva_signup_email"); }
    } catch { /* noop */ }
  }, []);

  const toggle = (next: Mode) => {
    if (animating || next === mode) return;
    setAnimating(true);
    setError(null);
    setMode(next);
    setTimeout(() => setAnimating(false), 1200);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isSupabaseConfigured) {
      setError("Supabase ainda não conectado. Você pode explorar o painel em modo demo.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: authError } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() } } });
    if (authError) {
      setLoading(false);
      setError(translateAuthError(authError.message));
      return;
    }
    // Identificador escolhido no cadastro; se não der, fica o gerado pelo e-mail.
    if (mode === "signup" && slugifyHandle(handle)) {
      await claimHandle(handle).catch(() => null);
    }
    setLoading(false);
    // Conta nova vai direto escolher o plano (o painel também redireciona).
    if (mode === "signup") {
      const plano = new URLSearchParams(window.location.search).get("plano");
      router.push(plano ? `/assinar?plano=${encodeURIComponent(plano)}` : "/assinar");
    } else {
      router.push("/dashboard");
    }
    router.refresh();
  }

  const isLogin = mode !== "signup";
  const blockSignup = handleStatus === "taken" || handleStatus === "checking";

  return (
    <div className="cl-auth-page">
      <div className="w-full max-w-[820px]">
        <div
          className="cl-auth-card mx-auto"
          style={{ opacity: mode ? 1 : 0, transition: "opacity .3s" }}
          // O painel diagonal é maior que o cartão; se o navegador rolar o
          // cartão por dentro ao focar um campo, volta para o topo.
          onScroll={(e) => { if (e.currentTarget.scrollTop) e.currentTarget.scrollTop = 0; }}
        >
          {/* Painel diagonal que varre o cartão ao trocar de modo */}
          <motion.div
            className="cl-auth-shape"
            variants={panel}
            initial={false}
            animate={isLogin ? "signin" : "signup"}
            transition={{ duration: 0.9, ease: "easeInOut" }}
          />

          <LayoutGroup>
            <div className="cl-auth-content">
              {/* Cabeçalho só no celular (o painel diagonal some) */}
              <div className="cl-auth-mobilehead">
                <span className="cl-auth-badge"><ClivaMark size={26} /></span>
                <div>
                  <b>{isLogin ? "Bem-vindo de volta" : "Vamos começar?"}</b>
                  <span>{isLogin ? "Entre para ver seus funis e leads." : "7 dias grátis para testar a Cliva."}</span>
                </div>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {isLogin ? (
                  <motion.div key="login" className="cl-auth-form is-login" variants={stagger(1)} initial="hidden" animate="visible" exit="exit">
                    <form onSubmit={submit}>
                      <motion.h2 variants={loginItem}>Entrar</motion.h2>
                      <Field id="login-email" label="E-mail" type="email" value={email} onChange={setEmail} icon={<IconMail />} variants={loginItem} autoComplete="email" />
                      <Field id="login-password" label="Senha" type="password" value={password} onChange={setPassword} icon={<IconLock />} variants={loginItem} autoComplete="current-password" />
                      {error && <motion.p className="cl-auth-error" variants={loginItem}>{error}</motion.p>}
                      <motion.div variants={loginItem}>
                        <button type="submit" className="cl-auth-btn" disabled={loading || animating}>
                          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Entrar
                        </button>
                      </motion.div>
                      <motion.p className="cl-auth-bottom" variants={loginItem}>
                        Ainda não tem conta?
                        <button type="button" className="cl-auth-link" onClick={() => toggle("signup")} disabled={animating}>Criar conta</button>
                      </motion.p>
                      {!isSupabaseConfigured && (
                        <motion.p className="mt-3 text-center text-xs" variants={loginItem}>
                          <Link href="/dashboard" className="text-slate-400 hover:text-slate-600">Explorar painel em modo demo →</Link>
                        </motion.p>
                      )}
                    </form>
                  </motion.div>
                ) : (
                  <motion.div key="signup" className="cl-auth-form is-signup" variants={stagger(-1)} initial="hidden" animate="visible" exit="exit">
                    <form onSubmit={submit}>
                      <motion.h2 variants={signupItem}>Criar conta</motion.h2>
                      <Field id="signup-name" label="Seu nome" value={name} onChange={setName} icon={<IconUser />} variants={signupItem} autoComplete="name" />
                      <motion.div className="mb-6" variants={signupItem}>
                        <label htmlFor="signup-handle" className="cl-auth-label-static">Seu link (opcional)</label>
                        <HandleInput id="signup-handle" variant="line" value={handle} onChange={setHandle} onStatus={setHandleStatus} optional />
                        {!handle && <p className="mt-1 text-[11px] text-slate-400">Em branco, usamos a parte do seu e-mail antes do @.</p>}
                      </motion.div>
                      <Field id="signup-email" label="E-mail" type="email" value={email} onChange={setEmail} icon={<IconMail />} variants={signupItem} autoComplete="email" />
                      <Field id="signup-password" label="Senha (mín. 6 caracteres)" type="password" value={password} onChange={setPassword} icon={<IconLock />} variants={signupItem} autoComplete="new-password" minLength={6} />
                      {error && <motion.p className="cl-auth-error" variants={signupItem}>{error}</motion.p>}
                      <motion.div variants={signupItem}>
                        <button type="submit" className="cl-auth-btn" disabled={loading || animating || blockSignup}>
                          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Criar conta
                        </button>
                      </motion.div>
                      <motion.p className="cl-auth-bottom" variants={signupItem}>
                        Já tem conta?
                        <button type="button" className="cl-auth-link" onClick={() => toggle("signin")} disabled={animating}>Entrar</button>
                      </motion.p>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Boas-vindas sobre o painel */}
              <AnimatePresence mode="wait" initial={false}>
                {isLogin ? (
                  <motion.div key="w-login" className="cl-auth-welcome is-login" variants={welcomeLogin} initial="hidden" animate="visible" exit="exit">
                    <span className="cl-auth-badge"><ClivaMark size={28} /></span>
                    <h1>Bem-vindo<br />de volta!</h1>
                    <p>Seus funis, leads e agenda<br />esperando por você.</p>
                  </motion.div>
                ) : (
                  <motion.div key="w-signup" className="cl-auth-welcome is-signup" variants={welcomeSignup} initial="hidden" animate="visible" exit="exit">
                    <span className="cl-auth-badge"><ClivaMark size={28} /></span>
                    <h1>Olá, vamos<br />começar?</h1>
                    <p>Crie sua conta e teste a Cliva<br />por 7 dias grátis.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </LayoutGroup>
        </div>

        <Link href="/" className="mt-5 block text-center text-xs text-slate-400 hover:text-slate-600">← Voltar para o site</Link>
      </div>
    </div>
  );
}
