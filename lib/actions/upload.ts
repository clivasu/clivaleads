"use server";

import { getCurrentOrg } from "@/lib/data/org";

// Pasta de upload da clínica logada no bucket "media" (<organization_id>/...).
// O Storage só aceita escrita na pasta de uma clínica da qual o usuário é membro.
export async function getUploadFolder(): Promise<string | null> {
  const org = await getCurrentOrg();
  return org?.id ?? null;
}
