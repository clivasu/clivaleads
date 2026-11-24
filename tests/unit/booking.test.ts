import { describe, expect, it } from "vitest";
import { holidayName } from "@/lib/booking/holidays";
import { applyBlockHours, computeSlots, DEFAULT_BOOKING_SETTINGS, isOfferedSlot, normalizeBlockHours, normalizeBookingSettings, openDaysLabel, type Busy } from "@/lib/booking/slots";

const S = DEFAULT_BOOKING_SETTINGS;
const NOW = new Date("2026-10-22T11:00:00Z"); // qui 22/10/2026, 08:00 em Brasília
const P = ["dra-marina"];

describe("feriados nacionais", () => {
  it("fixos e móveis (Páscoa 2027 = 28/03)", () => {
    expect(holidayName("2026-11-20")).toBe("Consciência Negra");
    expect(holidayName("2027-03-26")).toBe("Sexta-feira Santa");
    expect(holidayName("2027-02-08")).toBe("Carnaval");
    expect(holidayName("2027-05-27")).toBe("Corpus Christi");
    expect(holidayName("2026-10-23")).toBeNull();
  });
});

describe("horários livres", () => {
  const day = (date: string, busy: Busy[] = [], settings = S, duration = 60) =>
    computeSlots({ settings, from: date, to: date, duration, professionals: P, busy, now: NOW })[0];

  it("antecedência mínima de 2h: hoje começa às 10h", () => {
    expect(day("2026-10-22").slots[0].time).toBe("10:00");
  });

  it("dia útil: 08h-18h de 30 em 30 min, sem invadir o almoço", () => {
    const times = day("2026-10-23").slots.map((s) => s.time);
    expect(times[0]).toBe("08:00");
    expect(times).toContain("11:00");
    expect(times).not.toContain("11:30"); // 11:30 + 60 min invade 12-13
    expect(times).not.toContain("12:30");
    expect(times).toContain("13:00");
    expect(times.at(-1)).toBe("17:00");
  });

  it("sábado meio período, domingo e feriado fechados", () => {
    expect(day("2026-10-24").slots.map((s) => s.time).at(-1)).toBe("11:00");
    expect(day("2026-10-25").closed).toBe("Fechado");
    expect(day("2026-11-02").closed).toBe("Feriado: Finados");
  });

  it("horário ocupado some; outro profissional livre mantém o horário", () => {
    const busy: Busy[] = [{ professional_id: "dra-marina", start: new Date("2026-10-23T17:00:00Z"), end: new Date("2026-10-23T18:00:00Z") }]; // 14h-15h
    const times = day("2026-10-23", busy).slots.map((s) => s.time);
    expect(times).not.toContain("14:00");
    expect(times).not.toContain("13:30"); // 13:30-14:30 colide
    expect(times).toContain("15:00");
    const two = computeSlots({ settings: S, from: "2026-10-23", to: "2026-10-23", duration: 60, professionals: ["dra-marina", "dra-ana"], busy, now: NOW })[0];
    expect(two.slots.find((s) => s.time === "14:00")?.professionals).toEqual(["dra-ana"]);
  });

  it("janela máxima e datas bloqueadas", () => {
    expect(day("2026-12-30").closed).toBe("Agenda ainda não aberta");
    expect(day("2026-10-23", [], { ...S, blocked_dates: ["2026-10-23"] }).closed).toBe("Fechado");
  });

  it("confere o horário pedido (não aceita horário inventado)", () => {
    const base = { settings: S, duration: 60, professionals: P, busy: [], now: NOW, from: "", to: "" };
    expect(isOfferedSlot({ ...base, date: "2026-10-23", time: "09:00" })).toEqual(P);
    expect(isOfferedSlot({ ...base, date: "2026-10-23", time: "09:10" })).toEqual([]);
    expect(isOfferedSlot({ ...base, date: "2026-10-23", time: "12:00" })).toEqual([]);
    expect(isOfferedSlot({ ...base, date: "2026-10-25", time: "09:00" })).toEqual([]);
  });

  it("normaliza configurações inválidas", () => {
    const s = normalizeBookingSettings({ slot_minutes: 7, max_days_ahead: 9999, hours: [{ open: true, start: "25:00", end: "08:00" }], blocked_dates: ["x", "2026-12-24"] });
    expect(s.slot_minutes).toBe(30);
    expect(s.max_days_ahead).toBe(30);
    expect(s.hours[0]).toMatchObject({ open: true, start: "08:00", end: "12:00" });
    expect(s.blocked_dates).toEqual(["2026-12-24"]);
  });
});

describe("dias e horários do próprio bloco", () => {
  const closed = { open: false, ranges: [] };
  const week = (o: Record<number, { start: string; end: string }[]>) => Array.from({ length: 7 }, (_, i) => (o[i] ? { open: true, ranges: o[i] } : closed));
  const slots = (date: string, c: Parameters<typeof applyBlockHours>[1], busy: Busy[] = []) =>
    computeSlots({ settings: applyBlockHours(S, c), from: date, to: date, duration: 60, professionals: P, busy, now: NOW })[0];

  // ter 27/10 e qui 29/10/2026; sáb 31/10
  const c = { booking_hours: week({ 2: [{ start: "19:00", end: "21:00" }], 6: [{ start: "08:00", end: "10:00" }, { start: "14:00", end: "16:00" }] }), booking_slot_minutes: 60 };

  it("só os dias marcados abrem, nos períodos marcados, mesmo fora do horário da clínica", () => {
    expect(slots("2026-10-27", c).slots.map((x) => x.time)).toEqual(["19:00", "20:00"]);
    expect(slots("2026-10-31", c).slots.map((x) => x.time)).toEqual(["08:00", "09:00", "14:00", "15:00"]);
    expect(slots("2026-10-29", c).closed).toBe("Fechado");
  });

  it("servidor recusa horário fora do bloco e respeita a agenda e os feriados da clínica", () => {
    const base = { settings: applyBlockHours(S, c), from: "2026-10-27", to: "2026-10-27", duration: 60, professionals: P, busy: [] as Busy[], now: NOW };
    expect(isOfferedSlot({ ...base, date: "2026-10-27", time: "10:00" })).toEqual([]);
    expect(isOfferedSlot({ ...base, date: "2026-10-27", time: "19:00" })).toEqual(P);
    const busy = [{ professional_id: P[0], start: new Date("2026-10-27T22:00:00Z"), end: new Date("2026-10-27T23:00:00Z") }]; // 19h-20h
    expect(slots("2026-10-27", c, busy).slots.map((x) => x.time)).toEqual(["20:00"]);
    expect(slots("2026-11-02", { booking_hours: week({ 1: [{ start: "09:00", end: "12:00" }] }) }).closed).toMatch(/Feriado/);
  });

  it("sem configuração (ou inválida) vale o horário da clínica", () => {
    for (const raw of [undefined, [], "x", [1, 2]]) expect(applyBlockHours(S, { booking_hours: raw as never })).toEqual(S);
    expect(applyBlockHours(S, { booking_slot_minutes: 7 }).slot_minutes).toBe(S.slot_minutes);
  });

  it("limpa períodos inválidos, ordena e junta os que se sobrepõem", () => {
    const n = normalizeBlockHours(week({ 1: [{ start: "14:00", end: "16:00" }, { start: "09:00", end: "11:00" }, { start: "10:00", end: "12:00" }, { start: "18:00", end: "17:00" }, { start: "aa", end: "12:00" }] }))!;
    expect(n[1]).toEqual({ open: true, ranges: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "16:00" }] });
    expect(normalizeBlockHours(week({ 3: [{ start: "18:00", end: "17:00" }] }))![3]).toEqual({ open: false, ranges: [] });
  });

  it("texto dos dias disponíveis", () => {
    const o = (...i: number[]) => Array.from({ length: 7 }, (_, k) => ({ open: i.includes(k) }));
    expect(openDaysLabel(o(2, 4))).toBe("terça e quinta");
    expect(openDaysLabel(o(1, 2, 3, 4, 5))).toBe("segunda a sexta");
    expect(openDaysLabel(o(1, 3, 5))).toBe("segunda, quarta e sexta");
    expect(openDaysLabel(o(0, 6))).toBe("sábado e domingo");
    expect(openDaysLabel(o(0, 1, 2, 3, 4, 5, 6))).toBe("todos os dias");
    expect(openDaysLabel(o())).toBe("");
  });
});
