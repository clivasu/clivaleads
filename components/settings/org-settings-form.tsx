"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateOrg } from "@/lib/actions/org";
import { HandleInput, type HandleStatus } from "@/components/settings/handle-input";

interface OrgLike {
  name: string;
  slug: string;
  primary_color: string | null;
  whatsapp_number: string | null;
  instagram: string | null;
  default_message: string | null;
}

export function OrgSettingsForm({ org, baseUrl }: { org: OrgLike; baseUrl: string }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(org.name);
  const [handle, setHandle] = useState(org.slug);
  const [handleStatus, setHandleStatus] = useState<HandleStatus>("idle");
  const [color, setColor] = useState(org.primary_color ?? "#7C3AED");
  const [whatsapp, setWhatsapp] = useState(org.whatsapp_number ?? "");
  const [instagram, setInstagram] = useState(org.instagram ?? "");
  const [message, setMessage] = useState(org.default_message ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await updateOrg({ name, handle, primaryColor: color, whatsapp, instagram, defaultMessage: message });
      setMsg(res.ok ? { ok: true, text: "Salvo com sucesso." } : { ok: false, text: res.error ?? "Falha ao salvar." });
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Clínica</CardTitle></CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="handle">Seu identificador (link público)</Label>
            <HandleInput value={handle} onChange={setHandle} onStatus={setHandleStatus} host={baseUrl.replace(/^https?:\/\//, "")} />
            <p className="text-xs text-slate-500">
              Seus funis ficam em <span className="font-medium text-slate-700">{baseUrl}/{handle || "seu-id"}/nome-do-funil</span>
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="color">Cor principal</Label>
            <div className="flex items-center gap-3">
              <span className="h-9 w-9 shrink-0 rounded-md border" style={{ background: color }} />
              <Input id="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input id="whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="5561999999999" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="instagram">Instagram</Label>
            <Input id="instagram" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@suaclinica" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="msg">Mensagem padrão (fim do funil)</Label>
            <Input id="msg" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>

          {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
          <Button type="submit" disabled={pending || handleStatus === "taken" || handleStatus === "checking"} className="mt-2">
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
