import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/data/org";
import { getAnalytics } from "@/lib/data/analytics";
import { AnalyticsView } from "@/components/analytics/analytics-view";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");
  const data = await getAnalytics(org.id);
  return <AnalyticsView data={data} />;
}
