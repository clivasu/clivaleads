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
    <div className="flex min-h-screen bg-slate-50">
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
