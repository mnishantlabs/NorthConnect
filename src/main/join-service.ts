import { DiscordClient } from "./discord-client";
import { TokenRepository } from "./token-repository";
import { LogService } from "./log-service";

export class JoinService {
  constructor(
    private client: DiscordClient,
    private repo: TokenRepository,
    private log: LogService
  ) {}

  /** Join one or more tokens to an invite. Sequential to mirror the original. */
  async run(tokens: string[], invite: string): Promise<void> {
    const code = invite.trim().split("/").pop() ?? "";
    for (const token of tokens) {
      const info = this.repo.get(token);
      const username = info.username ?? "Unknown";
      const result = await this.call(code, token);
      if (result.success) {
        const guildId = result.guild_id;
        const guildName = result.guild_name ?? "Unknown";
        const servers = Array.isArray(info.servers) ? [...info.servers] : [];
        if (!servers.some((s: any) => String(s.id) === guildId)) {
          servers.push({ id: guildId, name: guildName });
          this.repo.update(token, { servers });
        }
        this.log.success(`${username} joined ${guildName}`);
      } else {
        this.log.error(`${username}: ${result.error ?? "?"}`);
      }
    }
  }

  private async call(
    code: string,
    token: string
  ): Promise<{ success: boolean; guild_id?: string; guild_name?: string; channel_name?: string; error?: string }> {
    try {
      const resp = await this.client.post(`/invites/${code}`, { token });
      return await this.interpret(resp);
    } catch (err: any) {
      return { success: false, error: String(err?.message ?? err).slice(0, 80) };
    }
  }

  private async interpret(resp: any) {
    if (resp.status === 200) {
      const data = await resp.json();
      return {
        success: true,
        guild_name: data?.guild?.name ?? "Unknown",
        guild_id: String(data?.guild?.id ?? ""),
        channel_name: data?.channel?.name ?? "Unknown",
      };
    }
    if (resp.status === 400) return { success: false, error: "Invalid invite or already in server" };
    if (resp.status === 404) return { success: false, error: "Invite not found or expired" };
    if (resp.status === 429) return { success: false, error: "Rate limited" };
    const text = await resp.text();
    return { success: false, error: `Error ${resp.status}: ${String(text).slice(0, 80)}` };
  }
}