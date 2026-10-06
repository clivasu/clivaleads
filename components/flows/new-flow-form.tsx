"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createFlow, createFlowFromTemplate } from "@/lib/actions/flows";
import { SPECIALTIES } from "@/lib/specialty-templates";

function slugify(v: string) {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function NewFlowForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [procedure, setProcedure] = useState("");
  const [slug, setSlug] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [usingTpl, setUsingTpl] = useState<string | null>(null);
  const [tplError, setTplError] = useState<string | null>(null);

  function applyTemplate(key: string) {
    setTplError(null);
    setUsingTpl(key);
    startTransition(async () => {
      const res = await createFlowFromTemplate(key);
      if (res.ok && res.id) {
        router.push(`/flows/${res.id}/builder`);
      } else {
        setTplError(res.error ?? "Falha ao criar o funil.");
        setUsingTpl(null);
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createFlow({
        name,
        procedure,
        slug: slug || slugify(name),
        whatsapp,
      });
      if (res.ok && res.id) {
        router.push(`/flows/${res.id}/builder`);
      } else {
        setError(res.error ?? "Falha ao criar o funil.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/flows" className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <Sparkles className="h-5 w-5 text-emerald-500" /> Comece com um modelo pronto
        </h1>
        <p className="text-sm text-slate-500">Funis completos por especialidade, com imagens, lógica de desinteresse e captura de WhatsApp. Você edita tudo no construtor.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {SPECIALTIES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => applyTemplate(t.key)}
            title={t.description}
            disabled={pending}
            className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md disabled:opacity-60"
          >
            <div className="relative h-24 overflow-hidden bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/templates/${t.key}/cover.webp`} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-700">{t.specialty}</span>
              {usingTpl === t.key && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="h-5 w-5 animate-spin text-emerald-600" /></div>
              )}
            </div>
            <div className="flex flex-1 flex-col p-2.5">
              <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-slate-900">{t.name.split(": ")[1] ?? t.name}</p>
              <span className="mt-auto pt-1.5 text-[11px] font-semibold text-emerald-600 group-hover:text-emerald-700">Usar modelo →</span>
            </div>
          </button>
        ))}
      </div>
      {tplError && <p className="mt-3 text-sm text-destructive">{tplError}</p>}

      <Card className="mx-auto mt-10 max-w-xl">
        <CardHeader>
          <CardTitle>Ou comece do zero</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <div className="grid gap-2">
              <Label htmlFor="name">Nome do funil</Label>
              <Input id="name" value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }} placeholder="Rinomodelação — Dra. Barbara" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="procedure">Procedimento</Label>
              <Input id="procedure" value={procedure} onChange={(e) => setProcedure(e.target.value)} placeholder="Rinomodelação" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slug">Slug (URL pública)</Label>
              <Input id="slug" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="rinomodelacao-dra-barbara" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="whatsapp">WhatsApp de destino</Label>
              <Input id="whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="5561999999999" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!configured && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Conecte o Supabase (.env.local) para criar funis persistentes. Em modo demo os funis de exemplo já estão disponíveis.
              </p>
            )}
            <Button type="submit" disabled={pending || !configured} className="mt-2">
              {pending ? "Criando..." : "Criar funil"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
