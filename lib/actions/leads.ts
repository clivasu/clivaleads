"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/data/org";
import { deleteLead, updateLead, type LeadPatch } from "@/lib/data/leads";

export interface LeadActionResult {
  ok: boolean;
  error?: string;
}

export async function deleteLeadAction(id: string): Promise<LeadActionResult> {
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "no-org" };
  const ok = await deleteLead(id);
  revalidatePath("/leads");
  return { ok, error: ok ? undefined : "delete-failed" };
}

export async function updateLeadAction(id: string, patch: LeadPatch): Promise<LeadActionResult> {
  const org = await getCurrentOrg();
  if (!org) return { ok: false, error: "no-org" };
  const ok = await updateLead(id, patch);
  revalidatePath("/leads");
  return { ok, error: ok ? undefined : "update-failed" };
}
