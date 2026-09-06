import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Legacy Python app wrote to %APPDATA%\DiscordTokenManager\tokens.json. */
const LEGACY_TOKENS_FILE = path.join(
  os.homedir(),
  "AppData",
  "Roaming",
  "DiscordTokenManager",
  "tokens.json"
);

export class TokenRepository {
  private data: Record<string, any> = {};
  private file: string;
  private serverCache: Record<string, any> | null = null;

  constructor(userDataDir: string) {
    this.file = path.join(userDataDir, "tokens.json");
    this.load();
  }

  get filePath() {
    return this.file;
  }

  load(): void {
    let tokens: Record<string, any> = {};
    if (fs.existsSync(this.file)) {
      try {
        const stored = JSON.parse(fs.readFileSync(this.file, "utf-8"));
        tokens = stored?.tokens && typeof stored.tokens === "object" ? stored.tokens : {};
      } catch {
        tokens = {};
      }
    } else if (fs.existsSync(LEGACY_TOKENS_FILE)) {
      try {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        fs.copyFileSync(LEGACY_TOKENS_FILE, this.file);
        const stored = JSON.parse(fs.readFileSync(this.file, "utf-8"));
        tokens = stored?.tokens && typeof stored.tokens === "object" ? stored.tokens : {};
      } catch {
        tokens = {};
      }
    }
    this.data = tokens;
    this.serverCache = null;
  }

  save(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify({ tokens: this.data }, null, 2), "utf-8");
    } catch {
      /* ignore write errors, same as Python */
    }
  }

  // ---- queries ---------------------------------------------------------------
  get_all(): Record<string, any> {
    return { ...this.data };
  }

  get(token: string): Record<string, any> {
    return this.data[token] ?? {};
  }

  contains(token: string): boolean {
    return token in this.data;
  }

  get count(): number {
    return Object.keys(this.data).length;
  }

  items(): Array<[string, Record<string, any>]> {
    return Object.entries(this.data);
  }

  get_server_map(): Record<string, { id: string; tokens: Array<{ token: string; username: string }> }> {
    if (this.serverCache !== null) return this.serverCache;
    const smap: Record<string, { id: string; tokens: any[] }> = {};
    for (const [token, info] of Object.entries(this.data)) {
      for (const server of info.servers ?? []) {
        const name = server.name;
        let entry = smap[name];
        if (!entry) {
          entry = { id: String(server.id), tokens: [] };
          smap[name] = entry;
        }
        entry.tokens.push({ token, username: info.username ?? "Unknown" });
      }
    }
    this.serverCache = smap;
    return smap;
  }

  // ---- mutations (invalidate the memo) --------------------------------------
  private invalidate(): void {
    this.serverCache = null;
  }

  add_token(token: string, info: Record<string, any>): void {
    this.data[token] = this.normalize(info);
    this.invalidate();
  }

  update(token: string, info: Record<string, any>): void {
    if (token in this.data) {
      this.data[token] = { ...this.data[token], ...info };
      this.invalidate();
    }
  }

  rename(token: string, name: string): void {
    if (token in this.data) {
      this.data[token].username = name;
      this.invalidate();
    }
  }

  remove_token(token: string): void {
    delete this.data[token];
    this.invalidate();
  }

  remove_guild_from_token(token: string, guildId: string): void {
    if (token in this.data && Array.isArray(this.data[token].servers)) {
      this.data[token].servers = this.data[token].servers.filter((s: any) => String(s.id) !== String(guildId));
      this.invalidate();
    }
  }

  remove_by_ids(ids: Set<string>): number {
    const toRemove = Object.entries(this.data)
      .filter(([, info]) => ids.has(String(info.user_id)))
      .map(([t]) => t);
    for (const t of toRemove) delete this.data[t];
    this.invalidate();
    return toRemove.length;
  }

  remove_invalid(): number {
    const toRemove = Object.entries(this.data)
      .filter(([, info]) => info.valid === false || (!info.user_id && info.error))
      .map(([t]) => t);
    for (const t of toRemove) delete this.data[t];
    this.invalidate();
    return toRemove.length;
  }

  remove_locked(): number {
    const toRemove = Object.entries(this.data)
      .filter(([, info]) => {
        const err = String(info.error || '').toUpperCase();
        return err.includes('LOCK') || err.includes('FLAGGED') || info.code === 'LOCKED';
      })
      .map(([t]) => t);
    for (const t of toRemove) delete this.data[t];
    this.invalidate();
    return toRemove.length;
  }

  export_json(): string {
    return JSON.stringify(this.data, null, 2);
  }

  // ---- helpers ---------------------------------------------------------------
  private normalize(info: Record<string, any>): Record<string, any> {
    return {
      username: info.username ?? "Unknown",
      global_name: info.global_name ?? info.displayName ?? null,
      discriminator: info.discriminator ?? "0",
      user_id: info.user_id ?? "",
      avatar: info.avatar ?? null,
      avatar_url: info.avatar_url ?? null,
      email: info.email ?? null,
      phone: info.phone ?? null,
      mfa_enabled: Boolean(info.mfa_enabled ?? false),
      is_bot: Boolean(info.is_bot ?? false),
      is_verified: Boolean(info.is_verified ?? info.verified ?? false),
      premium_type: Number(info.premium_type ?? 0) || 0,
      flags: Array.isArray(info.flags) ? info.flags : [],
      servers: Array.isArray(info.servers) ? info.servers : [],
      valid: info.valid !== undefined ? Boolean(info.valid) : true,
      error: info.error ?? "",
      code: info.code ?? "",
    };
  }
}