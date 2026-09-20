import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/data/org";
import { isSupabaseConfigured } from "@/lib/env";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-500">Identidade e white-label da clínica.</p>
      </header>

      {!isSupabaseConfigured && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardHeader><CardTitle className="text-amber-800">Conectar o Supabase</CardTitle></CardHeader>
          <CardContent className="text-sm text-amber-700">
            <ol className="list-decimal space-y-1 pl-4">
              <li>Crie um projeto em supabase.com.</li>
              <li>No SQL Editor, rode <code>supabase/migrations/0001_init.sql</code> e depois <code>supabase/seed.sql</code>.</li>
              <li>Copie <code>.env.example</code> para <code>.env.local</code> e cole URL + chaves.</li>
              <li>Reinicie o servidor. O modo demo desaparece e tudo passa a persistir.</li>
            </ol>
            <p className="mt-2">Detalhes completos em <code>SETUP.md</code>.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Clínica</CardTitle></CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" defaultValue={org.name} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="color">Cor principal</Label>
              <div className="flex items-center gap-3">
                <span className="h-9 w-9 rounded-md border" style={{ background: org.primary_color ?? "#0F172A" }} />
                <Input id="color" defaultValue={org.primary_color ?? "#0F172A"} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" defaultValue={org.whatsapp_number ?? ""} placeholder="5561999999999" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input id="instagram" defaultValue={org.instagram ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="msg">Mensagem padrão (fim do funil)</Label>
              <Input id="msg" defaultValue={org.default_message ?? ""} />
            </div>
            <Button type="button" disabled className="mt-2">
              Salvar (requer Supabase conectado)
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
