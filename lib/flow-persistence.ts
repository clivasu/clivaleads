import type { FlowStep } from "@/lib/types";

// Preparo das etapas para salvar: ids definitivos (UUID) para as etapas
// novas do editor ("s-xxxx") e as referências de lógica (goto) reescritas com
// o mesmo mapa, para que "vá para a etapa Y" continue apontando para Y depois
// de salvar e recarregar.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GOTO_KEYS = new Set(["goto", "score_gate_goto"]);

export type IdMap = Record<string, string>;

function newUuid(): string {
  return globalThis.crypto.randomUUID();
}

// Reescreve qualquer campo goto/score_gate_goto cujo valor esteja no mapa.
function remap(value: unknown, map: IdMap): unknown {
  if (Array.isArray(value)) return value.map((v) => remap(v, map));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = GOTO_KEYS.has(k) && typeof v === "string" && map[v] ? map[v] : remap(v, map);
    }
    return out;
  }
  return value;
}

export interface StepRow {
  id: string;
  position: number;
  type: string;
  config: Record<string, unknown>;
}

export function prepareStepsForSave(steps: FlowStep[]): { rows: StepRow[]; idMap: IdMap } {
  const idMap: IdMap = {};
  for (const s of steps) if (!UUID.test(s.id)) idMap[s.id] = newUuid();
  const rows = steps.map((s, i) => {
    const config = s.children && s.children.length > 0
      ? { ...s.config, __children: s.children }
      : s.config;
    return {
      id: idMap[s.id] ?? s.id,
      position: i,
      type: s.type,
      config: remap(config, idMap) as Record<string, unknown>,
    };
  });
  return { rows, idMap };
}

// Aplica no editor o mapa devolvido pelo servidor (ids e referências).
export function applyIdMap(steps: FlowStep[], map: IdMap): FlowStep[] {
  if (Object.keys(map).length === 0) return steps;
  return steps.map((s) => ({
    ...s,
    id: map[s.id] ?? s.id,
    config: remap(s.config, map) as FlowStep["config"],
    children: s.children ? (remap(s.children, map) as FlowStep[]) : s.children,
  }));
}
