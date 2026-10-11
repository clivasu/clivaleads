import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/data/org";
import { getFunnelAnalytics } from "@/lib/data/funnel-analytics";
import { parseFilters } from "@/lib/analytics/filters";
import { AnalyticsView } from "@/components/analytics/analytics-view";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");
  const data = await getFunnelAnalytics(org.id, parseFilters(await searchParams));
  return <AnalyticsView data={data} />;
}
