import { z } from "zod";

// Validação estrita das APIs públicas dos funis (usadas sem login).
// Limites de tamanho evitam abuso; organization_id nunca é aceito como fonte
// de verdade: o servidor deriva a clínica a partir do funil.

export const MAX_BODY_BYTES = 64 * 1024;

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max);

export const answerSchema = z.object({
  question_title: text(300),
  answer_value: text(500),
  answer_label: text(500),
  question_key: text(100).optional().nullable(),
  phrase: text(500).optional().nullable(),
  score: z.number().optional(), // ignorado: o servidor recalcula
});

export const sessionCreateSchema = z.object({
  flow_id: uuid,
  organization_id: uuid.optional(), // aceito por compatibilidade, ignorado
  client_ref: uuid.optional(),
  procedure: text(200).optional().nullable(),
  answers: z.array(answerSchema).max(60).default([]),
  contact: z.object({
    name: text(120).optional(),
    phone: text(40).optional(),
    email: text(200).optional(),
  }).partial().optional(),
  device: text(40).optional(),
  browser: text(40).optional(),
  entry_page: text(500).optional(),
  whatsapp_clicked: z.boolean().optional(),
  disqualified: z.boolean().optional(),
});
export type SessionCreate = z.infer<typeof sessionCreateSchema>;

export const sessionPatchSchema = z.object({
  id: uuid,
  token: z.string().min(10).max(200),
  whatsapp_clicked: z.boolean().optional(),
});

export const TRACK_TYPES = ["page_view", "flow_started", "flow_completed", "whatsapp_clicked"] as const;
const trackEvent = z.object({
  type: z.enum(TRACK_TYPES),
  flow_id: uuid,
  organization_id: uuid.optional(), // ignorado
});
export const trackSchema = z.union([
  z.object({ events: z.array(z.unknown()).max(50) }),
  trackEvent.passthrough(),
]);
export const trackEventSchema = trackEvent;

export const bioClickSchema = z.object({
  bio_page_id: uuid,
  label: text(120).optional().nullable(),
  url: z.string().trim().max(2048).refine((u) => /^https?:\/\//i.test(u) || u.startsWith("/") || u.startsWith("mailto:") || u.startsWith("tel:"), "url inválida").optional().nullable(),
});

// Lê o corpo como texto com limite de tamanho (evita JSON gigante).
export async function readJsonLimited(request: Request): Promise<{ ok: true; data: unknown } | { ok: false; status: number }> {
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) return { ok: false, status: 413 };
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return { ok: false, status: 413 };
  try {
    return { ok: true, data: JSON.parse(raw) };
  } catch {
    return { ok: false, status: 400 };
  }
}
