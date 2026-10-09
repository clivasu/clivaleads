import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/lib/data/org";
import { isSupabaseConfigured } from "@/lib/env";
import { getAdminDashboard } from "@/lib/data/admin-metrics";
import { demoAdminDashboard } from "@/lib/demo-admin";
import { AdminDashboardView } from "@/components/admin/admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Modo demonstração (sem banco): mostra a vitrine com dados de exemplo.
  if (!isSupabaseConfigured) return <AdminDashboardView data={demoAdminDashboard()} demo />;
  if (!(await isSuperAdmin())) redirect("/dashboard");
  const data = await getAdminDashboard();
  return <AdminDashboardView data={data} />;
}
