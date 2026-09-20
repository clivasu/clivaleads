import type { ContactInfo, LeadAnswer } from "@/lib/types";

// Normalizes a Brazilian phone into wa.me digits (adds country code 55 when
// a bare DDD+number is given).
export function normalizeWhatsapp(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

// Builds a natural, human-sounding WhatsApp message from the lead's answers.
export function buildLeadMessage(
  procedure: string | null | undefined,
  answers: LeadAnswer[],
  finalMessage?: string | null,
  contact?: ContactInfo,
): string {
  const parts: string[] = [];
  const proc = procedure ? procedure : "o procedimento";
  const greeting = contact?.name
    ? `Olá! Meu nome é ${contact.name}, vim pelo site e tenho interesse em ${proc}.`
    : `Olá! Vim pelo site e tenho interesse em ${proc}.`;
  parts.push(greeting);

  const fragments = answers
    .map((a) => a.phrase?.trim())
    .filter((f): f is string => Boolean(f));

  if (fragments.length > 0) {
    parts.push(fragments.join(" "));
  }

  if (finalMessage && finalMessage.trim()) {
    parts.push(finalMessage.trim());
  }

  return parts.join(" ");
}

export function buildWhatsappUrl(number: string, message: string): string {
  const digits = normalizeWhatsapp(number);
  const text = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${text}`;
}
