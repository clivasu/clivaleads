"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { ClivaLogo } from "@/components/brand/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);

  // Vindo da landing: abre em "Criar conta" e preenche o e-mail digitado no hero.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("cadastro")) setMode("signup");
    try {
      const saved = sessionStorage.getItem("cliva_signup_email");
      if (saved) { setEmail(saved); sessionStorage.removeItem("cliva_signup_email"); }
    } catch { /* noop */ }
  }, []);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isSupabaseConfigured) {
      setError("Supabase ainda não conectado. Você pode explorar o painel em modo demo.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const fn =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() } } });
    const { error } = await fn;
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center">
          <ClivaLogo size={36} wordmarkClassName="text-xl" />
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>{mode === "signin" ? "Entrar" : "Criar conta"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="flex flex-col gap-4">
              {mode === "signup" && (
                <div className="grid gap-2">
                  <Label htmlFor="name">Seu nome</Label>
                  <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ex.: Dra. Bárbara" />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={loading}>
                {loading ? "..." : mode === "signin" ? "Entrar" : "Criar conta"}
              </Button>
            </form>
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-900"
            >
              {mode === "signin" ? "Não tem conta? Criar" : "Já tem conta? Entrar"}
            </button>
            <Link href="/dashboard" className="mt-2 block text-center text-xs text-slate-400 hover:text-slate-600">
              Explorar painel em modo demo →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
