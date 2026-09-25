import Link from "next/link";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { isSupabaseConfigured } from "@/lib/env";
import { getNavInfo } from "@/lib/data/org";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nav = await getNavInfo();
  return (
    <div className="relative flex min-h-screen bg-gradient-to-br from-emerald-50 via-slate-50 to-teal-50/60">
      <div className="pointer-events-none fixed -left-32 top-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      <div className="pointer-events-none fixed bottom-0 right-0 h-96 w-96 rounded-full bg-teal-200/20 blur-3xl" />
      <Sidebar orgName={nav.orgName} userName={nav.userName} userRole={nav.userRole} isAdmin={nav.isAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        {!isSupabaseConfigured && (
          <div className="border-b bg-amber-50 px-6 py-2 text-center text-xs text-amber-700">
            Modo demonstração — Supabase não conectado. Dados de exemplo.{" "}
            <Link href="/settings" className="font-semibold underline">
              Como conectar
            </Link>
          </div>
        )}
        <main className="flex-1 px-6 py-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
