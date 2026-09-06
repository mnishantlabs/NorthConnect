import WebSocket from "ws";
import type {
  DiscordGatewayAdapterCreator,
  DiscordGatewayAdapterLibraryMethods,
} from "@discordjs/voice";
import { GATEWAY_URL, HEADERS } from "../shared/constants";

export type LogCallback = (message: string, level: string) => void;

export interface VoiceJoinResult {
  success: boolean;
  session_id?: string;
  user_id?: string;
  voice_token?: string;
  endpoint?: string;
  error?: string;
}

interface GatewayMessage {
  op: number;
  t?: string;
  d?: any;
  s?: number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** A single Gateway connection used to join/leave voice channels. */
export class VoiceConnection {
  private ws: WebSocket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatIntervalMs = 0;
  private sessionId: string | null = null;
  private userId: string | null = null;
  private seq = 0;
  private connected = false;

  private currentGuildId: string | null = null;
  private currentChannelId: string | null = null;
  private isMuted = false;
  private isDeafened = false;
  private isStreaming = false;
  private adapterMethods: DiscordGatewayAdapterLibraryMethods | null = null;
  private messageListeners = new Set<(msg: GatewayMessage) => void>();

  constructor(
    private token: string,
    private onLog: LogCallback = () => {}
  ) {}

  get isConnected() {
    return this.connected;
  }

  get currentUserId() {
    return this.userId;
  }

  get currentSessionId() {
    return this.sessionId;
  }

  get currentGuild() {
    return this.currentGuildId;
  }

  get currentChannel() {
    return this.currentChannelId;
  }

  getVoiceState() {
    return {
      guildId: this.currentGuildId,
      channelId: this.currentChannelId,
      mute: this.isMuted,
      deaf: this.isDeafened,
      isStreaming: this.isStreaming,
    };
  }

  update_voice_state(mute?: boolean, deaf?: boolean, stream?: boolean): void {
    if (mute !== undefined) this.isMuted = mute;
    if (deaf !== undefined) this.isDeafened = deaf;
    if (stream !== undefined) this.isStreaming = stream;

    if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN && this.currentGuildId) {
      this.ws.send(
        JSON.stringify({
          op: 4,
          d: {
            guild_id: this.currentGuildId,
            channel_id: this.currentChannelId,
            self_mute: this.isMuted,
            self_deaf: this.isDeafened,
            self_video: this.isStreaming,
            self_stream: this.isStreaming,
          },
        })
      );
      this.onLog(`Voice state updated: Mute=${this.isMuted}, Deafen=${this.isDeafened}, Stream=${this.isStreaming}`, "info");
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ op: 1, d: this.seq }));
      }
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** Resolve with the first message matching `pred` within `timeoutMs`, else null. */
  private once(pred: (m: GatewayMessage) => boolean, timeoutMs: number): Promise<GatewayMessage | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.messageListeners.delete(listener);
        resolve(null);
      }, timeoutMs);

      const listener = (msg: GatewayMessage) => {
        if (pred(msg)) {
          clearTimeout(timer);
          this.messageListeners.delete(listener);
          resolve(msg);
        }
      };

      this.messageListeners.add(listener);
    });
  }

  createAdapter(): DiscordGatewayAdapterCreator {
    return (methods: DiscordGatewayAdapterLibraryMethods) => {
      this.adapterMethods = methods;
      return {
        sendPayload: (data: any) => {
          if (data?.op === 4 && data?.d) {
            if (data.d.guild_id !== undefined && data.d.guild_id !== null) this.currentGuildId = String(data.d.guild_id);
            if (data.d.channel_id !== undefined) this.currentChannelId = data.d.channel_id ? String(data.d.channel_id) : null;
            if (data.d.self_mute !== undefined) this.isMuted = Boolean(data.d.self_mute);
            if (data.d.self_deaf !== undefined) this.isDeafened = Boolean(data.d.self_deaf);
          }
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
            return true;
          }
          return false;
        },
        destroy: () => {
          this.adapterMethods = null;
        },
      };
    };
  }

  async connect(): Promise<boolean> {
    if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      return true;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(GATEWAY_URL, { headers: HEADERS });
        this.ws = ws;

        ws.on("open", () => resolve());
        ws.on("error", (err) => {
          ws.close();
          reject(err);
        });

        ws.on("message", (data: WebSocket.RawData) => {
          let msg: GatewayMessage;
          try {
            msg = JSON.parse(data.toString());
          } catch {
            return;
          }

          if (typeof msg.s === "number") {
            this.seq = msg.s;
          }

          // Handle Voice Gateway Dispatch events
          if (msg.op === 0) {
            if (msg.t === "VOICE_STATE_UPDATE") {
              if (!this.userId || msg.d?.user_id === this.userId) {
                if (msg.d?.session_id) {
                  this.sessionId = msg.d.session_id;
                }
                if (msg.d?.guild_id) {
                  this.currentGuildId = String(msg.d.guild_id);
                }
                if (msg.d?.channel_id !== undefined) {
                  this.currentChannelId = msg.d.channel_id ? String(msg.d.channel_id) : null;
                }
                if (msg.d?.self_mute !== undefined) {
                  this.isMuted = Boolean(msg.d.self_mute);
                }
                if (msg.d?.self_deaf !== undefined) {
                  this.isDeafened = Boolean(msg.d.self_deaf);
                }
                this.adapterMethods?.onVoiceStateUpdate(msg.d);
              }
            } else if (msg.t === "VOICE_SERVER_UPDATE") {
              if (msg.d?.guild_id) {
                this.currentGuildId = String(msg.d.guild_id);
              }
              this.adapterMethods?.onVoiceServerUpdate(msg.d);
            }
          }

          // Notify any pending `once` listeners
          for (const listener of this.messageListeners) {
            try {
              listener(msg);
            } catch {
              /* ignore */
            }
          }
        });
      });

      const hello = await this.once((m) => m.op === 10, 10000);
      if (!hello) {
        this.onLog("Gateway HELLO timed out", "error");
        return false;
      }
      this.heartbeatIntervalMs = Number(hello.d?.heartbeat_interval ?? 41250);
      this.startHeartbeat();

      this.ws!.send(
        JSON.stringify({
          op: 2,
          d: {
            token: this.token,
            properties: { $os: "windows", $browser: "chrome", $device: "chrome" },
            presence: { status: "online", afk: false },
          },
        })
      );

      const ready = await this.once(
        (m) => m.op === 9 || (m.op === 0 && m.t === "READY"),
        15000
      );
      if (!ready) {
        this.onLog("No READY before timeout", "error");
        return false;
      }
      if (ready.op === 9) {
        this.onLog("Invalid session (token rejected)", "error");
        return false;
      }
      this.sessionId = ready.d?.session_id ?? this.sessionId;
      this.userId = ready.d?.user?.id ?? this.userId;
      this.connected = true;
      this.onLog("Gateway ready", "success");
      return true;
    } catch (err: any) {
      this.onLog(`Connection failed: ${err?.message ?? err}`, "error");
      return false;
    }
  }

  async join_voice(
    guildId: string,
    channelId: string,
    mute = false,
    deaf = false
  ): Promise<VoiceJoinResult> {
    if (!this.connected) {
      const ok = await this.connect();
      if (!ok) return { success: false, error: "Failed to connect to gateway" };
    }
    try {
      this.currentGuildId = guildId;
      this.currentChannelId = channelId;
      this.isMuted = mute;
      this.isDeafened = deaf;

      this.ws!.send(
        JSON.stringify({
          op: 4,
          d: { guild_id: guildId, channel_id: channelId, self_mute: mute, self_deaf: deaf },
        })
      );

      const serverUpdate = await this.once(
        (m) => m.op === 0 && (m.t === "VOICE_SERVER_UPDATE" || m.t === "VOICE_STATE_UPDATE"),
        8000
      );

      this.onLog(`Voice connected to channel ${channelId}`, "success");
      return {
        success: true,
        session_id: this.sessionId ?? "",
        user_id: this.userId ?? "",
        voice_token: serverUpdate?.d?.token ?? "",
        endpoint: serverUpdate?.d?.endpoint ?? "",
      };
    } catch (err: any) {
      return { success: false, error: String(err?.message ?? err) };
    }
  }

  async leave_voice(guildId?: string): Promise<void> {
    const gid = guildId || this.currentGuildId;
    if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            op: 4,
            d: { guild_id: gid ?? null, channel_id: null, self_mute: false, self_deaf: false },
          })
        );
        await sleep(100);
      } catch {
        /* ignore */
      }
    }
    this.currentChannelId = null;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.stopHeartbeat();
    this.messageListeners.clear();
    this.adapterMethods = null;
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN && this.currentGuildId) {
          this.ws.send(
            JSON.stringify({
              op: 4,
              d: { guild_id: this.currentGuildId, channel_id: null, self_mute: false, self_deaf: false },
            })
          );
          await sleep(50);
        }
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.onLog("Disconnected", "info");
    await sleep(0);
  }
}