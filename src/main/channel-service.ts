import { DiscordClient } from "./discord-client";
import { LogService } from "./log-service";
import { TYPE_CATEGORY, TYPE_GUILD_TEXT, TYPE_GUILD_VOICE } from "../shared/constants";
import type { ChannelInfo } from "../shared/types";

/** Voice-channel listing for a guild with a tiny cache (port of ChannelService). */
export class ChannelService {
  private cache = new Map<string, Array<{ id: string; name: string }>>();

  constructor(
    private client: DiscordClient,
    private log: LogService
  ) {}

  async load(token: string, guildId: string): Promise<Array<{ id: string; name: string }>> {
    let channels: ChannelInfo[] = [];
    try {
      const resp = await this.client.get(`/guilds/${guildId}/channels`, token);
      if (resp.status === 200) {
        const data = await resp.json();
        if (Array.isArray(data)) {
          channels = data
            .filter((c) => [TYPE_CATEGORY, TYPE_GUILD_TEXT, TYPE_GUILD_VOICE].includes(c.type))
            .map((c) => ({
              id: String(c.id),
              name: c.name,
              type: Number(c.type) || 0,
            }));
        }
      }
    } catch (err: any) {
      this.log.error(`Channel load failed: ${err?.message ?? err}`);
    }
    const voice = channels.filter((c) => c.type === TYPE_GUILD_VOICE).map(({ id, name }) => ({ id, name }));
    this.cache.set(guildId, voice);
    return voice;
  }

  cached(guildId: string): Array<{ id: string; name: string }> {
    return this.cache.get(guildId) ?? [];
  }

  async resolve(token: string, channelId: string): Promise<{ id: string; name: string; guild_id: string; type: number } | null> {
    try {
      const resp = await this.client.get(`/channels/${channelId}`, token);
      if (resp.status === 200) {
        const data = await resp.json();
        if (data && data.id) {
          return {
            id: String(data.id),
            name: data.name || `Channel ${data.id}`,
            guild_id: data.guild_id ? String(data.guild_id) : "",
            type: Number(data.type) || 0,
          };
        }
      }
    } catch (err: any) {
      this.log.error(`Channel resolve failed for ${channelId}: ${err?.message ?? err}`);
    }
    return null;
  }
}