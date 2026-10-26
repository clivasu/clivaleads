import { notFound, redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/data/org";
import { getPatientChart } from "@/lib/data/patients";
import { PatientChart } from "@/components/patients/patient-chart";

export const dynamic = "force-dynamic";

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");
  const { id } = await params;
  const data = await getPatientChart(org.id, id);
  if (!data) notFound();
  return <PatientChart data={data} />;
}
