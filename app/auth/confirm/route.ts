import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Recebe os links dos e-mails de autenticação (cadastro, convite, link mágico,
// redefinir senha, troca de e-mail): valida o token, abre a sessão e leva a
// pessoa para a próxima tela. Os templates montam o link como:
// {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<tipo>&next=<rota>

const TYPES = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

// Só aceita caminhos internos (evita redirecionar para outro site).
function safeNext(raw: string | null, fallback: string) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

const DEFAULT_NEXT: Record<string, string> = {
  signup: "/assinar",
  email: "/assinar",
  invite: "/redefinir-senha?convite=1",
  magiclink: "/dashboard",
  recovery: "/redefinir-senha",
  email_change: "/settings",
};

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type && TYPES.has(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const next = safeNext(url.searchParams.get("next"), DEFAULT_NEXT[type] ?? "/dashboard");
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  // Link inválido, já usado ou expirado.
  return NextResponse.redirect(new URL("/login?link=expirado", url.origin));
}
