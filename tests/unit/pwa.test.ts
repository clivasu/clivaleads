import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { detectPlatform } from "@/lib/pwa";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const base = { standalone: false, maxTouchPoints: 0, platform: "" };

describe("app instalável", () => {
  it("identifica o aparelho para mostrar as instruções certas", () => {
    expect(detectPlatform(IPHONE, { ...base, maxTouchPoints: 5 })).toBe("ios");
    expect(detectPlatform(ANDROID, { ...base, maxTouchPoints: 5 })).toBe("android");
    expect(detectPlatform(MAC, { ...base, platform: "MacIntel" })).toBe("desktop");
    expect(detectPlatform(MAC, { ...base, platform: "MacIntel", maxTouchPoints: 5 })).toBe("ios"); // iPad
    expect(detectPlatform(`${IPHONE} Instagram 300.0`, { ...base, maxTouchPoints: 5 })).toBe("ios-inapp");
    expect(detectPlatform(`${ANDROID} FBAV/400`, { ...base, maxTouchPoints: 5 })).toBe("android-inapp");
    expect(detectPlatform(ANDROID, { ...base, standalone: true })).toBe("standalone");
  });

  it("manifesto instalável: abre no painel, com ícones que existem", () => {
    const m = JSON.parse(readFileSync("public/app.webmanifest", "utf8"));
    expect(m).toMatchObject({ name: "Cliva", start_url: "/dashboard", display: "standalone", scope: "/" });
    expect(m.icons.some((i: { sizes: string; purpose: string }) => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);
    for (const i of m.icons) expect(existsSync(`public${i.src}`)).toBe(true);
    expect(existsSync("public/offline.html")).toBe(true);
  });

  it("service worker não guarda dados de pacientes no aparelho", () => {
    const sw = readFileSync("public/sw.js", "utf8").replace(/^\s*\/\/.*$/gm, "");
    expect(sw).not.toMatch(/\.put\(/); // nada entra no cache durante o uso
    expect(sw.match(/SHELL = \[(.*)\]/)?.[1]).toBe('"/offline.html", "/pwa/icon-192.png"');
    expect(sw).not.toMatch(/\/(api|patients|leads|schedule|dashboard)\b/);
  });

  it("convite de instalação só no painel, não nos funis públicos", () => {
    expect(existsSync("app/manifest.ts") || existsSync("app/manifest.json")).toBe(false); // valeria para o site todo
    expect(readFileSync("app/layout.tsx", "utf8")).not.toMatch(/webmanifest/);
    expect(readFileSync("app/(dashboard)/layout.tsx", "utf8")).toMatch(/\/app\.webmanifest/);
  });
});
