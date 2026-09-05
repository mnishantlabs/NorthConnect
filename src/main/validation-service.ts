import { DiscordClient } from "./discord-client";
import { TokenRepository } from "./token-repository";
import { LogService } from "./log-service";
import { FLAG_NAMES } from "../shared/constants";

/** Result of validating a single token. */
export interface ValidationResult {
  valid: boolean;
  [key: string]: any;
}

export class ValidationService {
  private concurrency: number;

  constructor(
    private client: DiscordClient,
    private repo: TokenRepository,
    private log: LogService,
    concurrency: number = 10,
    private onProgress?: (token: string, ok: boolean, isNew?: boolean) => void
  ) {
    this.concurrency = Math.max(concurrency, 1);
  }

  /** Import: validate candidates and persist valid AND invalid entries. */
  async runImport(tokens: string[]): Promise<number> {
    const prev = new Set(Object.keys(this.repo.get_all()));
    let index = 0;
    const worker = async () => {
      while (index < tokens.length) {
        const token = tokens[index++];
        const res = await this.callMe(token);
        if (res.valid) {
          this.repo.add_token(token, res);
          this.log.success(`${res.username} valid`);
        } else {
          this.repo.add_token(token, {
            user_id: "",
            error: res.error ?? "",
            code: res.code ?? "",
          });
          this.log.error(`${token.slice(0, 8)}…: ${res.error ?? "?"}`);
        }
        this.onProgress?.(token, Boolean(res.valid), !prev.has(token));
      }
    };
    const workers = Array.from({ length: Math.min(this.concurrency, tokens.length) }, worker);
    await Promise.all(workers);
    return tokens.length;
  }

  /** Validate a list of existing tokens, writing results back to the repo. */
  async run(tokens: string[]): Promise<number> {
    let index = 0;
    let done = 0;
    const worker = async () => {
      while (index < tokens.length) {
        const token = tokens[index++];
        await this.validateOne(token);
        done++;
      }
    };
    const workers = Array.from({ length: Math.min(this.concurrency, tokens.length) }, worker);
    await Promise.all(workers);
    return done;
  }

  private async validateOne(token: string): Promise<void> {
    const res = await this.callMe(token);
    if (res.valid) {
      this.repo.add_token(token, res);
      this.log.success(`${res.username} valid`);
    } else {
      this.repo.update(token, {
        user_id: "",
        error: res.error ?? "",
        code: res.code ?? "",
      });
      this.log.error(`${token.slice(0, 8)}…: ${res.error ?? "?"}`);
    }
    this.onProgress?.(token, Boolean(res.valid));
  }

  private async callMe(token: string): Promise<ValidationResult> {
    try {
      const resp = await this.client.get("/users/@me", token);
      return await this.interpret(resp, token);
    } catch (err: any) {
      return { valid: false, error: String(err?.message ?? err).slice(0, 80), code: "NETWORK" };
    }
  }

  private async interpret(resp: any, token: string): Promise<ValidationResult> {
    if (resp.status === 200) {
      const data = await resp.json();
      const servers = await this.fetchServers(token);
      const flagsInt = Number(data.flags ?? 0) || 0;
      return {
        valid: true,
        username: data.username ?? "Unknown",
        discriminator: data.discriminator ?? "0",
        user_id: String(data.id ?? ""),
        email: data.email ?? null,
        phone: data.phone ?? null,
        mfa_enabled: Boolean(data.mfa_enabled ?? false),
        is_bot: Boolean(data.bot ?? false),
        is_verified: Boolean(data.verified ?? false),
        premium_type: Number(data.premium_type ?? 0) || 0,
        flags: Object.entries(FLAG_NAMES)
          .filter(([bit]) => flagsInt & Number(bit))
          .map(([, name]) => name),
        avatar: data.avatar ?? null,
        banner: data.banner ?? null,
        servers,
      };
    }
    if (resp.status === 401) return { valid: false, error: "Invalid or expired token", code: "INVALID" };
    if (resp.status === 403) return { valid: false, error: "Locked (account flagged)", code: "LOCKED" };
    if (resp.status === 429) return { valid: false, error: "Rate limited", code: "RATE_LIMIT" };
    return { valid: false, error: `API error: ${resp.status}`, code: String(resp.status) };
  }

  private async fetchServers(token: string): Promise<Array<{ id: string; name: string }>> {
    try {
      const resp = await this.client.get("/users/@me/guilds", token);
      if (resp.status === 200) {
        const guilds = await resp.json();
        return Array.isArray(guilds)
          ? guilds.map((g) => ({ id: String(g.id), name: String(g.name) }))
          : [];
      }
    } catch {
      /* ignore */
    }
    return [];
  }
}