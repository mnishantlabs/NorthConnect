import {
  entersState,
  joinVoiceChannel,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import type { SettingsRepository } from "./settings";
import { VoiceConnection, type VoiceJoinResult } from "./gateway";
import { LogService } from "./log-service";
import { AudioPlayerService } from "./voice-audio";
import { RECENT_VOICE_MAX } from "../shared/constants";

export interface RecentVoiceTarget {
  guild_id: string;
  guild_name: string;
  channel_id: string;
  channel_name: string;
}

export class VoiceService {
  private connections = new Map<string, VoiceConnection>();

  constructor(
    private settings: SettingsRepository,
    private log: LogService,
    private audioPlayer: AudioPlayerService,
    private onStateChanged?: (payload: { type: string; token?: string }) => void
  ) {}

  get connected_count() {
    return this.connections.size;
  }

  get_connections() {
    return new Map(this.connections);
  }

  connected_tokens(): string[] {
    return [...this.connections.keys()];
  }

  is_connected(token: string) {
    return this.connections.has(token);
  }

  private tokenLabel(token: string) {
    return `${token.slice(0, 8)}…`;
  }

  async join(
    token: string,
    guildId: string,
    channelId: string,
    mute = false,
    deaf = false
  ): Promise<VoiceJoinResult> {
    let vc = this.connections.get(token);
    if (!vc) {
      vc = new VoiceConnection(token, (m, l) => {
        this.log.log(`${this.tokenLabel(token)} ${m}`, l as any);
      });
      this.connections.set(token, vc);
    }

    const gatewayOk = await vc.connect();
    if (!gatewayOk) {
      this.connections.delete(token);
      return { success: false, error: "Failed to connect to Discord Gateway" };
    }

    try {
      const djsConnection = joinVoiceChannel({
        channelId: channelId,
        guildId: guildId,
        adapterCreator: vc.createAdapter(),
        selfDeaf: deaf,
        selfMute: mute,
      });

      this.audioPlayer.registerConnection(token, djsConnection);

      djsConnection.on(VoiceConnectionStatus.Ready, () => {
        this.log.log(`${this.tokenLabel(token)} Voice stream ready`, "success");
      });

      djsConnection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(djsConnection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(djsConnection, VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch {
          this.log.log(`${this.tokenLabel(token)} Voice disconnected`, "warn");
          djsConnection.destroy();
          this.audioPlayer.removeConnection(token);
        }
      });

      djsConnection.on("error", (err) => {
        this.log.log(`${this.tokenLabel(token)} Voice error: ${err.message}`, "error");
      });

      // Wait up to 10 seconds for ready state
      try {
        await entersState(djsConnection, VoiceConnectionStatus.Ready, 10_000);
      } catch {
        this.log.log(`${this.tokenLabel(token)} Voice stream connecting in background…`, "info");
      }

      this.onStateChanged?.({ type: "joined", token });
      return { success: true };
    } catch (err: any) {
      this.connections.delete(token);
      this.audioPlayer.removeConnection(token);
      this.log.log(`${this.tokenLabel(token)} join failed: ${err?.message ?? err}`, "error");
      return { success: false, error: err?.message ?? String(err) };
    }
  }

  async leave(token: string): Promise<void> {
    const vc = this.connections.get(token);
    this.audioPlayer.removeConnection(token);
    if (vc) {
      this.connections.delete(token);
      try {
        await vc.leave_voice();
        await vc.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.onStateChanged?.({ type: "left", token });
  }

  set_mute(token: string, mute: boolean): void {
    const vc = this.connections.get(token);
    if (vc) {
      vc.update_voice_state(mute, undefined);
      this.onStateChanged?.({ type: "state_updated", token });
    }
  }

  set_deaf(token: string, deaf: boolean): void {
    const vc = this.connections.get(token);
    if (vc) {
      vc.update_voice_state(undefined, deaf);
      this.onStateChanged?.({ type: "state_updated", token });
    }
  }

  set_stream(token: string, stream: boolean): void {
    const vc = this.connections.get(token);
    if (vc) {
      vc.update_voice_state(undefined, undefined, stream);
      this.onStateChanged?.({ type: "state_updated", token });
    }
  }

  get_voice_states(): Record<string, { guildId: string | null; channelId: string | null; mute: boolean; deaf: boolean; isStreaming: boolean }> {
    const res: Record<string, any> = {};
    for (const [token, vc] of this.connections.entries()) {
      res[token] = vc.getVoiceState();
    }
    return res;
  }

  async disconnect_all(allTokens?: string[]): Promise<void> {
    this.audioPlayer.clearConnections();
    const conns = [...this.connections.values()];
    this.connections.clear();
    for (const vc of conns) {
      try {
        await vc.leave_voice();
        await vc.disconnect();
      } catch {
        /* ignore */
      }
    }
    if (allTokens && allTokens.length > 0) {
      for (const t of allTokens) {
        try {
          const temp = new VoiceConnection(t);
          await temp.connect();
          await temp.leave_voice();
          await temp.disconnect();
        } catch {
          /* ignore */
        }
      }
    }
    this.onStateChanged?.({ type: "all_cleared" });
  }

  push_recent(guildId: string, guildName: string, channelId: string, channelName: string) {
    const recent: RecentVoiceTarget[] = [...(this.settings.get("recent_voice") ?? [])];
    recent.unshift({ guild_id: guildId, guild_name: guildName, channel_id: channelId, channel_name: channelName });
    this.settings.set("recent_voice", recent.slice(0, RECENT_VOICE_MAX));
    this.settings.save();
  }

  target_from_recent(index = 0): RecentVoiceTarget | null {
    const recent: RecentVoiceTarget[] = this.settings.get("recent_voice") ?? [];
    return index >= 0 && index < recent.length ? { ...recent[index] } : null;
  }
}