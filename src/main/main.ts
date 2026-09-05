import { app, BrowserWindow, ipcMain, shell, dialog, desktopCapturer } from "electron";
import path from "path";
import fs from "fs";

import {
  initSettingsRepo,
  getSettings,
  saveSettings,
  type SettingsRepository,
} from "./settings";
import { TokenRepository } from "./token-repository";
import { LogService } from "./log-service";
import { DiscordClient } from "./discord-client";
import { ValidationService } from "./validation-service";
import { VoiceService } from "./voice-service";
import { ChannelService } from "./channel-service";
import { JoinService } from "./join-service";
import { AudioPlayerService } from "./voice-audio";
import { searchOnlineMusic, type OnlineTrackResult } from "./youtube-service";
import { ensurePresetSounds } from "./sound-presets";
import { BridgeService } from "./bridge-service";
import { tokenFromDict } from "../shared/types";

// Ensure a consistent userData dir regardless of dev/packaged mode
try {
  app.setName("NorthConnect");
} catch {
  /* ignore */
}

let mainWindow: BrowserWindow | null = null;

function getThemeSync(): string {
  try {
    return repo?.get("theme", "dark") ?? "dark";
  } catch {
    return "dark";
  }
}

ipcMain.on("get-theme-sync", (event) => {
  event.returnValue = getThemeSync();
});

// Services (initialized in whenReady)
let repo: SettingsRepository | null = null;
let tokenRepo: TokenRepository | null = null;
let log: LogService | null = null;
let client: DiscordClient | null = null;
let validator: ValidationService | null = null;
let audioPlayer: AudioPlayerService | null = null;
let voice: VoiceService | null = null;
let channels: ChannelService | null = null;
let join: JoinService | null = null;
let bridge: BridgeService | null = null;

const broadcast = (channel: string, ...args: any[]) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
};

function rebuildClient() {
  const s = repo!;
  client = new DiscordClient({
    concurrency: Number(s.get("concurrency") ?? 5),
    apiTimeout: Number(s.get("api_timeout") ?? 10),
    proxy: String(s.get("proxy") ?? ""),
  });
  channels = new ChannelService(client, log!);
  join = new JoinService(client, tokenRepo!, log!);
  return client;
}

function buildValidator() {
  validator = new ValidationService(
    client!,
    tokenRepo!,
    log!,
    Number(repo!.get("concurrency") ?? 5),
    (token, ok) => broadcast("validation-progress", { token, ok })
  );
}

const toTokens = () =>
  tokenRepo!.items().map(([token, info]) => tokenFromDict(token, info));

function createWindow() {
  const initialTheme = getThemeSync();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 620,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: initialTheme === "light" ? "#f5f5f5" : "#0f0f0f",
    icon: path.join(__dirname, "../../resources/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  const isDev = !!process.env.VITE_DEV_SERVER_URL;

  // Block browser navigation/shortcuts, keep DevTools out in production
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const ctrl = input.control || input.meta;
    const shift = input.shift;
    const k = input.key.toLowerCase();
    if ((ctrl && shift && (k === "i" || k === "j" || k === "c")) || k === "f12") {
      event.preventDefault();
    }
    if ((ctrl && k === "r") || k === "f5") event.preventDefault();
    if (ctrl && (k === "f" || k === "g" || k === "p" || k === "u" || k === "l" || k === "t" || k === "n")) {
      event.preventDefault();
    }
    if (!isDev) {
      mainWindow?.webContents.on("devtools-opened", () => {
        mainWindow?.webContents.closeDevTools();
      });
    }
  });

  mainWindow.webContents.on("context-menu", (event) => event.preventDefault());
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("maximize", () => broadcast("window-state-changed", { isMaximized: true }));
  mainWindow.on("unmaximize", () => broadcast("window-state-changed", { isMaximized: false }));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ---- window controls -------------------------------------------------------
ipcMain.on("window-minimize", () => mainWindow?.minimize());
ipcMain.on("window-maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});
ipcMain.on("window-close", () => mainWindow?.close());
ipcMain.handle("get-window-state", () => ({ isMaximized: mainWindow?.isMaximized() ?? false }));

// ---- settings --------------------------------------------------------------
ipcMain.handle("get-settings", async () => getSettings());
ipcMain.handle("save-settings", async (_e, settings: any) => {
  const result = await saveSettings(settings);
  rebuildClient();
  buildValidator();
  return result;
});

// ---- tokens ----------------------------------------------------------------
ipcMain.handle("get-tokens", () => toTokens());

// ---- extension bridge ------------------------------------------------------
ipcMain.handle("bridge-status", () => bridge?.status() ?? null);
ipcMain.handle("bridge-regenerate-secret", () => bridge?.regenerateSecret() ?? "");

function parseLines(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of String(raw).split(/\r?\n/)) {
    const token = line.trim();
    if (token && !seen.has(token)) {
      seen.add(token);
      out.push(token);
    }
  }
  return out;
}

ipcMain.handle("import-tokens", async (_e, text: string): Promise<number> => {
  const candidates = parseLines(text);
  const existing = new Set(Object.keys(tokenRepo!.get_all()));
  const newTokens = candidates.filter((t) => !existing.has(t));
  if (newTokens.length === 0) {
    log!.info("No new tokens to import");
    return 0;
  }
  await validator!.runImport(newTokens);
  tokenRepo!.save();
  broadcast("store-changed", { imported: newTokens.length });
  return newTokens.length;
});

ipcMain.handle("delete-tokens", async (_e, tokens: string[]) => {
  for (const t of tokens) tokenRepo!.remove_token(t);
  tokenRepo!.save();
  broadcast("store-changed", { deleted: tokens.length });
});

ipcMain.handle("rename-token", async (_e, token: string, name: string) => {
  tokenRepo!.rename(token, name);
  tokenRepo!.save();
  broadcast("store-changed", { renamed: true });
});

ipcMain.handle("validate-tokens", async (_e, tokens: string[]) => {
  await validator!.run(tokens);
  tokenRepo!.save();
  broadcast("store-changed", { validated: tokens.length });
  return toTokens();
});

// ---- servers + channels ----------------------------------------------------
ipcMain.handle("get-servers", () => tokenRepo!.get_server_map());

ipcMain.handle("get-channels", async (_e, token: string, guildId: string) => {
  return channels!.load(token, guildId);
});

// ---- voice -----------------------------------------------------------------
ipcMain.handle("voice-join", async (_e, payload: any) => {
  const res = await voice!.join(
    payload.token,
    payload.guildId,
    payload.channelId,
    Boolean(payload.mute),
    Boolean(payload.deaf)
  );
  if (res.success && payload.guildName) {
    voice!.push_recent(
      payload.guildId,
      payload.guildName,
      payload.channelId,
      payload.channelName ?? payload.channelId
    );
  }
  return res;
});

ipcMain.handle("voice-leave", async (_e, token: string) => {
  await voice!.leave(token);
});

ipcMain.handle("voice-set-mute", (_e, token: string, mute: boolean) => {
  voice!.set_mute(token, mute);
  broadcast("voice-state-update", { token, mute });
});

ipcMain.handle("voice-set-deaf", (_e, token: string, deaf: boolean) => {
  voice!.set_deaf(token, deaf);
  broadcast("voice-state-update", { token, deaf });
});

ipcMain.handle("voice-set-stream", (_e, token: string, stream: boolean) => {
  voice!.set_stream(token, stream);
  broadcast("voice-state-update", { token, stream });
});

ipcMain.handle("voice-get-states", () => {
  return voice!.get_voice_states();
});

ipcMain.handle("get-screen-sources", async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["window", "screen"],
      thumbnailSize: { width: 360, height: 200 },
      fetchWindowIcons: true,
    });
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
      appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
    }));
  } catch (err: any) {
    log!.error(`Failed to fetch desktop capture sources: ${err.message}`);
    return [];
  }
});

ipcMain.handle("voice-start-screenshare", async (_e, { token, sourceId, sourceName }: { token: string; sourceId: string; sourceName: string }) => {
  try {
    voice!.set_stream(token, true);
    log!.info(`[${token.slice(0, 8)}...] Started screen sharing: "${sourceName}"`);
    broadcast("voice-state-update", { token, isStreaming: true, sourceName });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("voice-stop-screenshare", async (_e, token: string) => {
  try {
    voice!.set_stream(token, false);
    log!.info(`[${token.slice(0, 8)}...] Stopped screen sharing`);
    broadcast("voice-state-update", { token, isStreaming: false });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("voice-disconnect-all", async () => {
  const allTokens = tokenRepo ? Object.keys(tokenRepo.get_all()) : [];
  await voice!.disconnect_all(allTokens);
});

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---- leave servers ---------------------------------------------------------
ipcMain.handle(
  "leave-servers",
  async (_e, { tokens, guildIds, delay = 0.5 }: { tokens: string[]; guildIds: string[]; delay?: number }) => {
    let leftCount = 0;
    const errors: string[] = [];
    for (const token of tokens) {
      for (const guildId of guildIds) {
        try {
          const res = await client!.delete(`/users/@me/guilds/${guildId}`, token);
          if (res.status === 204 || res.status === 200 || res.ok) {
            tokenRepo!.remove_guild_from_token(token, guildId);
            leftCount++;
            log!.info(`[${token.slice(0, 8)}...] Left server ${guildId}`);
            broadcast("leave-server-progress", { token, guildId, success: true });
          } else {
            const data = await res.json();
            const err = data?.message || `HTTP ${res.status}`;
            errors.push(`${guildId}: ${err}`);
            log!.warn(`[${token.slice(0, 8)}...] Failed to leave server ${guildId}: ${err}`);
            broadcast("leave-server-progress", { token, guildId, success: false, error: err });
          }
        } catch (e: any) {
          errors.push(`${guildId}: ${e?.message || e}`);
        }
        await sleep((delay || 0.5) * 1000);
      }
    }
    tokenRepo!.save();
    broadcast("store-changed", { leftServers: leftCount });
    return { success: true, left: leftCount, errors };
  }
);

// ---- activity log ----------------------------------------------------------
ipcMain.handle("get-log", () => log!.iter_all());
ipcMain.handle("clear-log", () => log!.clear());

// ---- audio & music player --------------------------------------------------
ipcMain.handle("audio-select-files", async () => {
  if (!mainWindow) return [];
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "Select Audio / Music Files",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Audio Files", extensions: ["mp3", "wav", "ogg", "flac", "m4a", "aac", "opus", "wma"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (res.canceled || !res.filePaths?.length) return [];
  const items = [];
  for (const fp of res.filePaths) {
    try {
      const stat = fs.statSync(fp);
      const dur = await audioPlayer!.getAudioDuration(fp);
      items.push({
        id: Buffer.from(fp).toString("base64"),
        title: path.parse(fp).name,
        filePath: fp,
        fileName: path.basename(fp),
        sizeBytes: stat.size,
        duration: dur,
        ext: path.extname(fp).replace(".", "").toUpperCase(),
      });
    } catch {
      /* ignore */
    }
  }
  return items;
});

ipcMain.handle("audio-parse-dropped-files", async (_e, filePaths: string[]) => {
  const items = [];
  for (const fp of filePaths) {
    try {
      if (!fs.existsSync(fp)) continue;
      const stat = fs.statSync(fp);
      if (stat.isDirectory()) continue;
      const dur = await audioPlayer!.getAudioDuration(fp);
      items.push({
        id: Buffer.from(fp).toString("base64"),
        title: path.parse(fp).name,
        filePath: fp,
        fileName: path.basename(fp),
        sizeBytes: stat.size,
        duration: dur,
        ext: path.extname(fp).replace(".", "").toUpperCase(),
      });
    } catch {
      /* ignore */
    }
  }
  return items;
});

ipcMain.handle("audio-play", async (_e, payload: {
  filePath: string;
  title?: string;
  targetToken?: string | "all";
  volume?: number;
  loop?: boolean;
  startSeconds?: number;
  thumbnail?: string;
  author?: string;
  duration?: number;
  sourceType?: "local" | "youtube" | "spotify";
}) => {
  return audioPlayer!.play(payload.filePath, payload);
});

ipcMain.handle("audio-search-online", async (_e, query: string, limit = 15) => {
  return searchOnlineMusic(query, limit);
});

ipcMain.handle("audio-pause", () => audioPlayer!.pause());
ipcMain.handle("audio-resume", () => audioPlayer!.resume());
ipcMain.handle("audio-stop", () => audioPlayer!.stop());
ipcMain.handle("audio-seek", (_e, seconds: number) => audioPlayer!.seek(seconds));
ipcMain.handle("audio-set-volume", (_e, volume: number) => audioPlayer!.setVolume(volume));
ipcMain.handle("audio-set-loop", (_e, loop: boolean) => audioPlayer!.setLoop(loop));
ipcMain.handle("audio-set-target", (_e, targetToken: string | "all") => audioPlayer!.setTargetToken(targetToken));
ipcMain.handle("audio-get-state", () => audioPlayer!.getState());
ipcMain.handle("audio-get-presets", () => ensurePresetSounds());
ipcMain.handle("audio-get-library", () => repo?.get("audio_library", []) ?? []);
ipcMain.handle("audio-save-library", (_e, items: any[]) => {
  repo?.set("audio_library", items);
  repo?.save();
});

app.whenReady().then(() => {
  const userData = app.getPath("userData");
  repo = initSettingsRepo(userData);
  tokenRepo = new TokenRepository(userData);
  log = new LogService(1000, (record) => broadcast("log-event", record));

  audioPlayer = new AudioPlayerService(
    (state) => broadcast("audio-state-changed", state),
    (m, l) => log!.log(m, (l as any) || "info")
  );

  voice = new VoiceService(repo, log, audioPlayer, (payload) => broadcast("voice-state", payload));

  rebuildClient();
  buildValidator();

  bridge = new BridgeService(
    repo,
    tokenRepo,
    validator!,
    log,
    (channel, ...args) => broadcast(channel, ...args),
    () => app.getVersion()
  );
  bridge.start();

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  audioPlayer?.stop();
  voice?.disconnect_all();
  bridge?.stop();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  audioPlayer?.stop();
  voice?.disconnect_all();
  bridge?.stop();
});