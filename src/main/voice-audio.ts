import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnection as DiscordVoiceConnection,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import prism from "prism-media";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { createOnlineAudioStream, resolveDirectAudioUrl, type StreamingProcessHandle } from "./youtube-service";

export type AudioStateCallback = (state: AudioPlayerState) => void;

export interface AudioPlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  loop: boolean;
  trackName: string;
  trackPath: string;
  thumbnail?: string;
  author?: string;
  sourceType?: "local" | "youtube" | "spotify";
  targetToken: string | "all";
}

export function getFfmpegPath(): string {
  try {
    const ffmpegStatic = require("ffmpeg-static");
    if (ffmpegStatic && typeof ffmpegStatic === "string" && fs.existsSync(ffmpegStatic)) {
      return ffmpegStatic;
    }
  } catch {}

  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }

  const candidates: string[] = [
    path.join(__dirname, "ffmpeg.exe"),
    path.join(__dirname, "..", "ffmpeg.exe"),
    path.join(__dirname, "..", "main", "ffmpeg.exe"),
    path.join(__dirname, "..", "..", "node_modules", "ffmpeg-static", "ffmpeg.exe"),
    path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg.exe"),
    path.join(process.cwd(), "dist", "main", "ffmpeg.exe"),
    typeof process.resourcesPath !== "undefined"
      ? path.join(process.resourcesPath, "ffmpeg.exe")
      : "",
    typeof process.resourcesPath !== "undefined"
      ? path.join(process.resourcesPath, "app.asar.unpacked", "node_modules", "ffmpeg-static", "ffmpeg.exe")
      : "",
  ];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      return c;
    }
  }

  return "ffmpeg";
}

// Ensure FFMPEG_PATH environment variable is set for prism-media
const resolvedFfmpeg = getFfmpegPath();
if (resolvedFfmpeg && fs.existsSync(resolvedFfmpeg)) {
  process.env.FFMPEG_PATH = resolvedFfmpeg;
}

/**
 * Global Audio Player Engine powered by @discordjs/voice.
 * Single unified player for playing audio directly into active Discord voice connections.
 */
export class AudioPlayerService {
  private connections = new Map<string, DiscordVoiceConnection>();
  private player: AudioPlayer;
  private currentResource: AudioResource | null = null;
  private activeOnlineStream: StreamingProcessHandle | null = null;
  private progressTimer: NodeJS.Timeout | null = null;

  private isPlaying = false;
  private isPaused = false;
  private currentTime = 0;
  private duration = 0;
  private volume = 100;
  private loop = false;
  private trackName = "";
  private trackPath = "";
  private thumbnail = "";
  private author = "";
  private sourceType: "local" | "youtube" | "spotify" = "local";
  private targetToken: string | "all" = "all";
  private currentSeekOffset = 0;

  constructor(
    private onStateChange: AudioStateCallback = () => {},
    private onLog: (msg: string, level?: "info" | "success" | "error" | "warn") => void = () => {}
  ) {
    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
        maxMissedFrames: 250,
      },
    });

    this.player.on("stateChange", (oldState, newState) => {
      console.log(`[AudioPlayer] ${oldState.status} -> ${newState.status}`);
      this.onLog(`Player: ${oldState.status} -> ${newState.status}`, "info");
    });

    this.player.on(AudioPlayerStatus.Playing, () => {
      this.isPlaying = true;
      this.isPaused = false;
      this.broadcastState();
    });

    this.player.on(AudioPlayerStatus.Paused, () => {
      this.isPaused = true;
      this.broadcastState();
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      if (this.loop && this.isPlaying && this.trackPath) {
        this.onLog(`Looping track: ${this.trackName}`, "info");
        this.play(this.trackPath, {
          title: this.trackName,
          volume: this.volume,
          loop: true,
          targetToken: this.targetToken,
          startSeconds: 0,
          duration: this.duration,
          thumbnail: this.thumbnail,
          author: this.author,
          sourceType: this.sourceType,
        });
      } else {
        this.onLog(`Finished playback: ${this.trackName}`, "info");
        this.stop();
      }
    });

    this.player.on("error", (error) => {
      console.error(`[AudioPlayer Error]`, error);
      this.onLog(`Audio player error: ${error.message}`, "error");
      this.stop();
    });
  }

  registerConnection(token: string, conn: DiscordVoiceConnection) {
    const prev = this.connections.get(token);
    if (prev && prev !== conn) {
      try {
        prev.destroy();
      } catch {}
    }
    this.connections.set(token, conn);

    // Subscribe connection to the player
    try {
      conn.subscribe(this.player);
    } catch {}

    conn.on(VoiceConnectionStatus.Ready, () => {
      this.onLog(`Voice connection ready for token ${token.slice(0, 8)}…`, "info");
      try {
        conn.subscribe(this.player);
      } catch {}
    });
  }

  isPlayingNow(): boolean {
    return this.isPlaying;
  }

  subscribeTarget(token: string) {
    const conn = this.connections.get(token);
    if (conn) {
      try {
        conn.subscribe(this.player);
      } catch (err: any) {
        this.onLog(`Subscribe error: ${err.message}`, "warn");
      }
    }
  }

  removeConnection(token: string) {
    const conn = this.connections.get(token);
    if (conn) {
      try {
        conn.destroy();
      } catch {}
      this.connections.delete(token);
    }
    if (this.connections.size === 0) {
      this.stop();
    }
  }

  clearConnections() {
    for (const conn of this.connections.values()) {
      try {
        conn.destroy();
      } catch {}
    }
    this.connections.clear();
    this.stop();
  }

  hasConnections() {
    return this.connections.size > 0;
  }

  private subscribeAllConnections() {
    for (const conn of this.connections.values()) {
      try {
        conn.subscribe(this.player);
      } catch {}
    }
  }

  getState(): AudioPlayerState {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentTime: Math.floor(this.currentTime),
      duration: Math.floor(this.duration),
      volume: this.volume,
      loop: this.loop,
      trackName: this.trackName,
      trackPath: this.trackPath,
      thumbnail: this.thumbnail,
      author: this.author,
      sourceType: this.sourceType,
      targetToken: this.targetToken,
    };
  }

  private broadcastState() {
    this.onStateChange(this.getState());
  }

  async getAudioDuration(filePath: string): Promise<number> {
    return new Promise((resolve) => {
      const bin = getFfmpegPath();
      if (!fs.existsSync(filePath)) {
        resolve(0);
        return;
      }
      try {
        const ff = spawn(bin, ["-i", filePath], {
          stdio: ["ignore", "ignore", "pipe"],
        });
        let stderr = "";
        ff.on("error", (err) => {
          this.onLog(`FFmpeg probe error: ${err.message}`, "warn");
          resolve(0);
        });
        if (ff.stderr) {
          ff.stderr.on("data", (d) => {
            stderr += d.toString();
          });
        }
        ff.on("close", () => {
          const match = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
          if (match) {
            const hours = parseInt(match[1], 10);
            const minutes = parseInt(match[2], 10);
            const seconds = parseInt(match[3], 10);
            resolve(hours * 3600 + minutes * 60 + seconds);
          } else {
            resolve(0);
          }
        });
      } catch (e: any) {
        this.onLog(`Failed to spawn FFmpeg: ${e.message}`, "warn");
        resolve(0);
      }
    });
  }

  async play(
    filePathOrUrl: string,
    options?: {
      targetToken?: string | "all";
      volume?: number;
      loop?: boolean;
      startSeconds?: number;
      title?: string;
      thumbnail?: string;
      author?: string;
      duration?: number;
      sourceType?: "local" | "youtube" | "spotify";
    }
  ): Promise<{ success: boolean; error?: string }> {
    const isOnline =
      filePathOrUrl.startsWith("http://") || filePathOrUrl.startsWith("https://");

    if (!isOnline && !fs.existsSync(filePathOrUrl)) {
      this.onLog(`Audio file not found: ${filePathOrUrl}`, "error");
      return { success: false, error: "File not found" };
    }

    // Clean up previous active online stream if any
    if (this.activeOnlineStream) {
      this.activeOnlineStream.cleanup();
      this.activeOnlineStream = null;
    }

    if (options?.targetToken !== undefined) this.targetToken = options.targetToken;
    if (options?.volume !== undefined) this.volume = options.volume;
    if (options?.loop !== undefined) this.loop = options.loop;

    this.trackPath = filePathOrUrl;
    this.trackName = options?.title || (isOnline ? "Online Stream" : path.basename(filePathOrUrl));
    this.thumbnail = options?.thumbnail || "";
    this.author = options?.author || "";
    this.sourceType = options?.sourceType || (isOnline ? (filePathOrUrl.includes("spotify") ? "spotify" : "youtube") : "local");

    if (isOnline) {
      this.duration = options?.duration || 0;
    } else {
      this.duration = await this.getAudioDuration(filePathOrUrl);
    }

    const startSec = options?.startSeconds || 0;
    this.currentSeekOffset = startSec;
    this.currentTime = startSec;

    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }

    try {
      let resource: AudioResource;

      if (isOnline) {
        let directUrl: string | null = null;
        try {
          directUrl = await resolveDirectAudioUrl(filePathOrUrl);
        } catch {
          directUrl = null;
        }

        if (directUrl) {
          const ffmpegArgs = [
            ...(startSec > 0 ? ["-ss", String(startSec)] : []),
            "-reconnect",
            "1",
            "-reconnect_streamed",
            "1",
            "-reconnect_delay_max",
            "5",
            "-i",
            directUrl,
            "-analyzeduration",
            "0",
            "-loglevel",
            "0",
            "-f",
            "s16le",
            "-ar",
            "48000",
            "-ac",
            "2",
          ];
          const ffmpegStream = new prism.FFmpeg({ args: ffmpegArgs });
          ffmpegStream.on("error", (err: any) => {
            this.onLog(`FFmpeg stream error: ${err.message}`, "error");
          });
          resource = createAudioResource(ffmpegStream, {
            inputType: StreamType.Raw,
            inlineVolume: true,
          });
        } else {
          const streamHandle = createOnlineAudioStream(
            filePathOrUrl,
            startSec,
            (err) => this.onLog(err.message, "error")
          );
          this.activeOnlineStream = streamHandle;

          resource = createAudioResource(streamHandle.stream, {
            inputType: StreamType.Raw,
            inlineVolume: true,
          });
        }
      } else {
        const ffmpegArgs = [
          ...(startSec > 0 ? ["-ss", String(startSec)] : []),
          "-i",
          filePathOrUrl,
          "-analyzeduration",
          "0",
          "-loglevel",
          "0",
          "-f",
          "s16le",
          "-ar",
          "48000",
          "-ac",
          "2",
        ];
        const ffmpegStream = new prism.FFmpeg({ args: ffmpegArgs });
        ffmpegStream.on("error", (err: any) => {
          this.onLog(`FFmpeg decode error: ${err.message}`, "error");
        });
        resource = createAudioResource(ffmpegStream, {
          inputType: StreamType.Raw,
          inlineVolume: true,
        });
      }

      if (resource.volume) {
        resource.volume.setVolume(this.volume / 100);
      }

      this.currentResource = resource;
      this.isPlaying = true;
      this.isPaused = false;

      // Subscribe all active voice connections
      this.subscribeAllConnections();

      // Start playing audio
      this.player.play(resource);

      this.onLog(`Playing: ${this.trackName}`, "info");
      this.broadcastState();

      // Progress ticker
      this.progressTimer = setInterval(() => {
        if (this.isPlaying && !this.isPaused && this.currentResource) {
          this.currentTime = this.currentSeekOffset + Math.floor(this.currentResource.playbackDuration / 1000);
          this.broadcastState();
        }
      }, 500);

      return { success: true };
    } catch (e: any) {
      this.onLog(`Failed to start audio playback: ${e.message}`, "error");
      this.stop();
      return { success: false, error: e.message };
    }
  }

  pause() {
    if (!this.isPlaying || this.isPaused) return;
    this.player.pause(true);
    this.isPaused = true;
    this.broadcastState();
  }

  resume() {
    if (!this.isPlaying || !this.isPaused) return;
    this.player.unpause();
    this.isPaused = false;
    this.broadcastState();
  }

  stop(emit = true) {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    if (this.activeOnlineStream) {
      this.activeOnlineStream.cleanup();
      this.activeOnlineStream = null;
    }
    this.player.stop(true);
    this.currentResource = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.currentTime = 0;
    this.currentSeekOffset = 0;

    if (emit) {
      this.broadcastState();
    }
  }

  seek(seconds: number) {
    if (!this.trackPath) return;
    const wasPaused = this.isPaused;
    this.play(this.trackPath, {
      title: this.trackName,
      volume: this.volume,
      loop: this.loop,
      targetToken: this.targetToken,
      startSeconds: Math.max(0, seconds),
      duration: this.duration,
      thumbnail: this.thumbnail,
      author: this.author,
      sourceType: this.sourceType,
    });
    if (wasPaused) {
      this.player.pause(true);
      this.isPaused = true;
      this.broadcastState();
    }
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(200, volume));
    if (this.currentResource?.volume) {
      this.currentResource.volume.setVolume(this.volume / 100);
    }
    this.broadcastState();
  }

  setLoop(loop: boolean) {
    this.loop = loop;
    this.broadcastState();
  }

  setTargetToken(token: string | "all") {
    this.targetToken = token;
    this.broadcastState();
  }
}
