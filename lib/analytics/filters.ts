import { isRangeKey, type RangeKey } from "./period";

// Filtros do painel vindos da URL (?periodo=30d&funil=<id>&procedimento=&origem=&campanha=).
export interface AnalyticsFilters {
  range: RangeKey;
  flow: string | null;
  procedure: string | null;
  source: string | null;
  campaign: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type SP = Record<string, string | string[] | undefined>;

function one(sp: SP, key: string): string | null {
  const v = sp[key];
  const s = (Array.isArray(v) ? v[0] : v)?.trim();
  return s ? s.slice(0, 200) : null;
}

export function parseFilters(sp: SP, fallback: RangeKey = "30d"): AnalyticsFilters {
  const range = one(sp, "periodo");
  const flow = one(sp, "funil");
  return {
    range: isRangeKey(range) ? range : fallback,
    flow: flow && UUID.test(flow) ? flow : null,
    procedure: one(sp, "procedimento"),
    source: one(sp, "origem"),
    campaign: one(sp, "campanha"),
  };
}

export function filtersToQuery(f: Partial<AnalyticsFilters>): string {
  const p = new URLSearchParams();
  if (f.range) p.set("periodo", f.range);
  if (f.flow) p.set("funil", f.flow);
  if (f.procedure) p.set("procedimento", f.procedure);
  if (f.source) p.set("origem", f.source);
  if (f.campaign) p.set("campanha", f.campaign);
  return p.toString();
}
