"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createFlow } from "@/lib/actions/flows";

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
    <div className="mx-auto max-w-xl">
      <Link href="/flows" className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Novo funil</CardTitle>
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
