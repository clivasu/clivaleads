import { describe, expect, it } from "vitest";
import { fromTimestamp, toTimestamp } from "@/lib/schedule-time";

describe("2.4 fuso da agenda (Brasília)", () => {
  it("09:30 em Brasília vira 12:30 UTC e volta igual", () => {
    const ts = toTimestamp("2026-10-20", 9.5);
    expect(ts).toBe("2026-10-20T12:30:00.000Z");
    expect(fromTimestamp(ts)).toEqual({ date: "2026-10-20", hour: 9.5 });
  });
  it("horário noturno não troca de dia na tela", () => {
    const ts = toTimestamp("2026-10-20", 22.25); // 22:15 BRT = 01:15 UTC do dia seguinte
    expect(ts).toBe("2026-10-21T01:15:00.000Z");
    expect(fromTimestamp(ts)).toEqual({ date: "2026-10-20", hour: 22.25 });
  });
});
