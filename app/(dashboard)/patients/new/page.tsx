import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/data/org";
import { PatientChart } from "@/components/patients/patient-chart";

export const dynamic = "force-dynamic";

export default async function NewPatientPage() {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");
  return (
    <PatientChart
      isNew
      data={{
        extended: true, visits: [], lead: null,
        record: {
          id: "", name: "", phone: null, cpf: null, rg: null, birth_date: null, gender: null, email: null, occupation: null, source: null,
          notes: null, address: {}, emergency_contact: {}, anamnesis: {}, consent_at: null, created_at: new Date().toISOString(), updated_at: null, lead_session_id: null,
        },
      }}
    />
  );
}
