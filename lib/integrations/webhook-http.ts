import "server-only";
import https from "node:https";
import dns from "node:dns";
import type { LookupFunction } from "node:net";
import { isBlockedAddress, validateWebhookUrl } from "./webhook-core";

// Envio HTTPS com proteção contra SSRF na própria conexão: o IP é checado
// depois do DNS (vale contra DNS rebinding), redirecionamentos não são
// seguidos, tempo limite de 10 s e resposta lida no máximo 2 KB e descartada.

type Resolver = (host: string, cb: (err: NodeJS.ErrnoException | null, addrs: dns.LookupAddress[]) => void) => void;
const systemResolver: Resolver = (host, cb) => dns.lookup(host, { all: true, verbatim: true }, cb);

export function guardedLookup(resolve: Resolver = systemResolver): LookupFunction {
  return ((hostname: string, options: dns.LookupOptions, callback: (...args: unknown[]) => void) => {
    resolve(hostname, (err, addrs) => {
      if (err) return callback(err);
      const list = (addrs ?? []).filter((a) => !options?.family || a.family === options.family);
      // Qualquer endereço interno na resposta derruba o envio.
      if (list.length === 0 || list.some((a) => isBlockedAddress(a.address))) {
        const e = Object.assign(new Error("blocked address"), { code: "BLOCKED_ADDRESS" });
        return callback(e);
      }
      if (options?.all) return callback(null, list);
      callback(null, list[0].address, list[0].family);
    });
  }) as unknown as LookupFunction;
}

export interface SendResult { ok: boolean; status?: number; error?: unknown; ms: number }

export function postJson(
  rawUrl: string,
  body: string,
  headers: Record<string, string>,
  opts: { timeoutMs?: number; resolver?: Resolver } = {},
): Promise<SendResult> {
  const started = Date.now();
  const check = validateWebhookUrl(rawUrl);
  if (!check.ok) return Promise.resolve({ ok: false, error: { code: "BLOCKED_ADDRESS" }, ms: 0 });
  const url = check.url;
  const timeoutMs = opts.timeoutMs ?? 10_000;

  return new Promise((resolve) => {
    let settled = false;
    const done = (r: Omit<SendResult, "ms">) => { if (!settled) { settled = true; resolve({ ...r, ms: Date.now() - started }); } };
    const req = https.request(
      {
        protocol: "https:",
        hostname: url.hostname.replace(/^\[|\]$/g, ""),
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body).toString(), "User-Agent": "Cliva-Webhook/1.0", ...headers },
        lookup: guardedLookup(opts.resolver),
        timeout: timeoutMs,
        agent: false,
      },
      (res) => {
        let read = 0;
        res.on("data", (chunk: Buffer) => { read += chunk.length; if (read > 2048) res.destroy(); });
        res.on("end", () => done({ ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300, status: res.statusCode }));
        res.on("close", () => done({ ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300, status: res.statusCode }));
        res.on("error", (e) => done({ ok: false, status: res.statusCode, error: e }));
      },
    );
    req.on("timeout", () => { req.destroy(Object.assign(new Error("timeout"), { code: "TIMEOUT" })); });
    req.on("error", (e) => done({ ok: false, error: e }));
    // Tempo total (DNS + TLS + resposta), não só inatividade do socket.
    const total = setTimeout(() => req.destroy(Object.assign(new Error("timeout"), { code: "TIMEOUT" })), timeoutMs + 500);
    req.on("close", () => clearTimeout(total));
    req.end(body);
  });
}
