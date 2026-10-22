import { describe, expect, it } from "vitest";
import { holidayName } from "@/lib/booking/holidays";
import { computeSlots, DEFAULT_BOOKING_SETTINGS, isOfferedSlot, normalizeBookingSettings, type Busy } from "@/lib/booking/slots";

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
