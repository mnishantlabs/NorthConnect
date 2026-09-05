import http from "node:http";
import crypto from "node:crypto";
import type { SettingsRepository } from "./settings";
import type { TokenRepository } from "./token-repository";
import type { ValidationService } from "./validation-service";
import type { LogService } from "./log-service";

const TOKEN_RE = /^[MN][A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/;
const MAX_BODY = 2 * 1024 * 1024;

export interface BridgeStatus {
  enabled: boolean;
  running: boolean;
  host: string;
  port: number;
  secret: string;
  version: string;
  count: number;
}

/**
 * Loopback HTTP bridge that lets the browser extension push tokens into the
 * app's store. Bound to 127.0.0.1 only. Every request must carry the shared
 * secret in the `X-Bridge-Key` header; because that header is custom, web
 * pages are blocked by CORS preflight while extension pages (which hold the
 * host permission) are free to call us.
 */
export class BridgeService {
  private server: http.Server | null = null;

  constructor(
    private repo: SettingsRepository,
    private tokenRepo: TokenRepository,
    private validator: ValidationService,
    private log: LogService,
    private broadcast: (channel: string, ...args: any[]) => void,
    private getVersion: () => string
  ) {}

  get enabled(): boolean {
    return Boolean(this.repo.get("bridge_enabled", true));
  }

  get host(): string {
    return "127.0.0.1";
  }

  get port(): number {
    return Number(this.repo.get("bridge_port", 47474)) || 47474;
  }

  private secret(): string {
    let s = String(this.repo.get("bridge_secret", "") ?? "");
    if (s.length < 16) {
      s = crypto.randomBytes(24).toString("base64url");
      this.repo.set("bridge_secret", s);
      this.repo.save();
    }
    return s;
  }

  regenerateSecret(): string {
    const s = crypto.randomBytes(24).toString("base64url");
    this.repo.set("bridge_secret", s);
    this.repo.save();
    return s;
  }

  status(): BridgeStatus {
    return {
      enabled: this.enabled,
      running: this.server !== null,
      host: this.host,
      port: this.port,
      secret: this.secret(),
      version: this.getVersion(),
      count: this.tokenRepo.count,
    };
  }

  start(): void {
    if (!this.enabled || this.server) return;
    const server = http.createServer((req, res) => this.dispatch(req, res));
    server.on("error", (err: any) => this.log.warning(`Bridge server error: ${err?.message ?? err}`));
    server.on("clientError", (_err: unknown, socket: any) => {
      try {
        socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
      } catch {
        /* ignore */
      }
    });
    server.listen(this.port, this.host, () => {
      this.log.info(`Extension bridge listening on http://${this.host}:${this.port}`);
    });
    this.server = server;
  }

  stop(): void {
    if (this.server) {
      try {
        this.server.close();
      } catch {
        /* ignore */
      }
      this.server = null;
    }
  }

  private dispatch(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.setHeader("Cache-Control", "no-store");
    try {
      const url = new URL(req.url ?? "/", `http://${this.host}:${this.port}`);
      if (req.method === "GET" && url.pathname === "/api/bridge/ping") return this.ping(req, res);
      if (req.method === "POST" && url.pathname === "/api/bridge/import") return this.importTokens(req, res);
      this.json(res, 404, { ok: false, error: "not_found" });
    } catch (err: any) {
      this.json(res, 500, { ok: false, error: String(err?.message ?? err) });
    }
  }

  private authorized(req: http.IncomingMessage): boolean {
    const given = req.headers["x-bridge-key"];
    if (typeof given !== "string" || given.length === 0) return false;
    const a = crypto.createHash("sha256").update(given).digest();
    const b = crypto.createHash("sha256").update(this.secret()).digest();
    return crypto.timingSafeEqual(a, b);
  }

  private ping(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (!this.authorized(req)) return this.json(res, 403, { ok: false, error: "forbidden" });
    this.json(res, 200, {
      ok: true,
      app: "NorthConnect",
      version: this.getVersion(),
      host: this.host,
      port: this.port,
      count: this.tokenRepo.count,
    });
  }

  private readBody(req: http.IncomingMessage, cb: (err: Error | null, body?: Buffer) => void): void {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const done = (err: Error | null, body?: Buffer) => {
      if (settled) return;
      settled = true;
      cb(err, body);
    };
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        done(new Error("payload_too_large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => done(null, Buffer.concat(chunks)));
    req.on("error", (e: Error) => done(e));
  }

  private importTokens(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (!this.authorized(req)) return this.json(res, 403, { ok: false, error: "forbidden" });
    this.readBody(req, (err, body) => {
      if (err) return this.json(res, 400, { ok: false, error: err.message });
      let payload: any;
      try {
        payload = JSON.parse((body ?? Buffer.alloc(0)).toString("utf-8") || "{}");
      } catch {
        return this.json(res, 400, { ok: false, error: "bad_json" });
      }
      const raw = Array.isArray((payload as any)?.tokens) ? (payload as any).tokens : [];
      const seen = new Set<string>();
      const candidates: string[] = [];
      for (const item of raw) {
        const token = typeof item === "string" ? item : (item as any)?.token;
        if (typeof token !== "string") continue;
        const t = token.trim();
        if (t && TOKEN_RE.test(t) && !seen.has(t)) {
          seen.add(t);
          candidates.push(t);
        }
      }
      if (candidates.length === 0) {
        return this.json(res, 200, { ok: true, imported: 0, skipped: 0, invalid: 0, total: this.tokenRepo.count });
      }
      const existing = new Set(Object.keys(this.tokenRepo.get_all()));
      const fresh = candidates.filter((t) => !existing.has(t));
      const skipped = candidates.length - fresh.length;
      if (fresh.length === 0) {
        return this.json(res, 200, { ok: true, imported: 0, skipped, invalid: 0, total: this.tokenRepo.count });
      }
      this.validator
        .runImport(fresh)
        .then(() => {
          this.tokenRepo.save();
          this.log.success(`[bridge] Imported ${fresh.length} token(s) from the extension`);
          this.broadcast("store-changed", { imported: fresh.length, source: "extension" });
          this.json(res, 200, {
            ok: true,
            imported: fresh.length,
            skipped,
            invalid: candidates.length - fresh.length,
            total: this.tokenRepo.count,
          });
        })
        .catch((e: any) => {
          this.json(res, 500, { ok: false, error: String(e?.message ?? e) });
        });
    });
  }

  private json(res: http.ServerResponse, status: number, data: unknown): void {
    const out = JSON.stringify(data);
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(out),
    });
    res.end(out);
  }
}