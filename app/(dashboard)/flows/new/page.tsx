import { isSupabaseConfigured } from "@/lib/env";
import { NewFlowForm } from "@/components/flows/new-flow-form";

export default function NewFlowPage() {
  return <NewFlowForm configured={isSupabaseConfigured} />;
}
