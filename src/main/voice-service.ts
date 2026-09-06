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

    // 1. Connect to Gateway
    const gatewayOk = await vc.connect();
    if (!gatewayOk) {
      this.connections.delete(token);
      this.log.log(`${this.tokenLabel(token)} Gateway connection failed`, "error");
      return { success: false, error: "Failed to connect to Discord Gateway" };
    }

    // 2. Join voice channel using @discordjs/voice with our Gateway adapter
    try {
      const djsConnection = joinVoiceChannel({
        channelId: channelId,
        guildId: guildId,
        adapterCreator: vc.createAdapter(),
        group: token,
        selfDeaf: deaf,
        selfMute: mute,
      });

      this.audioPlayer.registerConnection(token, djsConnection);

      djsConnection.on("stateChange", (oldState, newState) => {
        console.log(`[VoiceConnection] ${oldState.status} -> ${newState.status}`);
        this.log.log(`Voice connection: ${oldState.status} -> ${newState.status}`, "info");
      });

      djsConnection.on(VoiceConnectionStatus.Ready, () => {
        console.log(`[VoiceConnection] Ready ✓ - Subscribing player`);
        this.log.log(`${this.tokenLabel(token)} Voice audio ready ✓`, "success");
        this.audioPlayer.subscribeTarget(token);
      });

      djsConnection.on(VoiceConnectionStatus.Disconnected, async () => {
        console.log(`[VoiceConnection] Disconnected`);
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
        console.error(`[VoiceConnection Error]`, err);
        this.log.log(`${this.tokenLabel(token)} Voice error: ${err.message}`, "error");
      });

      djsConnection.on("debug", (msg) => {
        console.log(`[VoiceConnection Debug]`, msg);
      });

      // Wait up to 6 seconds for Ready state (non-blocking if it takes longer)
      try {
        await entersState(djsConnection, VoiceConnectionStatus.Ready, 6_000);
      } catch {
        this.log.log(`${this.tokenLabel(token)} Voice stream connecting in background…`, "info");
      }

      this.onStateChanged?.({ type: "joined", token });
      return { success: true, session_id: vc.currentSessionId ?? "" };
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

  watch_stream(token: string, targetUserId: string, guildId?: string, channelId?: string): boolean {
    const vc = this.connections.get(token);
    if (vc) {
      const ok = vc.watchStream(targetUserId, guildId, channelId);
      this.onStateChanged?.({ type: "stream_watch_updated", token });
      return ok;
    }
    return false;
  }

  stop_watching_stream(token: string): void {
    const vc = this.connections.get(token);
    if (vc) {
      vc.stopWatchingStream();
      this.onStateChanged?.({ type: "stream_watch_updated", token });
    }
  }

  get_active_streamers(token?: string) {
    if (token) {
      const vc = this.connections.get(token);
      return vc ? vc.getActiveStreamers() : [];
    }
    const all = new Map<string, any>();
    for (const vc of this.connections.values()) {
      for (const s of vc.getActiveStreamers()) {
        all.set(s.userId, s);
      }
    }
    return Array.from(all.values());
  }

  get_voice_states(): Record<
    string,
    {
      guildId: string | null;
      channelId: string | null;
      mute: boolean;
      deaf: boolean;
      isStreaming: boolean;
      isWatching?: boolean;
      watchingUserId?: string | null;
      watchingStreamKey?: string | null;
    }
  > {
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

  push_recent(
    guildId: string,
    guildName: string,
    channelId: string,
    channelName: string
  ) {
    const recent: RecentVoiceTarget[] = [...(this.settings.get("recent_voice") ?? [])];
    recent.unshift({
      guild_id: guildId,
      guild_name: guildName,
      channel_id: channelId,
      channel_name: channelName,
    });
    this.settings.set("recent_voice", recent.slice(0, RECENT_VOICE_MAX));
    this.settings.save();
  }

  target_from_recent(index = 0): RecentVoiceTarget | null {
    const recent: RecentVoiceTarget[] = this.settings.get("recent_voice") ?? [];
    return index >= 0 && index < recent.length ? { ...recent[index] } : null;
  }
}