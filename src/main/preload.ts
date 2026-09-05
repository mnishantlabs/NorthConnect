import { contextBridge, ipcRenderer } from "electron";

// Synchronously bootstrap theme to prevent visual flash on load
try {
  const theme = ipcRenderer.sendSync("get-theme-sync");
  document.documentElement.setAttribute("data-theme", theme || "dark");
} catch (e) {
  console.error("Failed to bootstrap theme synchronously in preload:", e);
}

const subscribe = (channel: string, callback: (...args: any[]) => void) => {
  const listener = (_event: any, ...args: any[]) => callback(...args);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
};

contextBridge.exposeInMainWorld("electronAPI", {
  // window controls
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
  minimizeWindow: () => ipcRenderer.send("window-minimize"),
  maximizeWindow: () => ipcRenderer.send("window-maximize"),
  closeWindow: () => ipcRenderer.send("window-close"),
  getWindowState: () => ipcRenderer.invoke("get-window-state"),
  onWindowStateChanged: (callback: (state: { isMaximized: boolean }) => void) =>
    subscribe("window-state-changed", callback),

  // theme + settings
  getThemeSync: () => ipcRenderer.sendSync("get-theme-sync"),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (settings: any) => ipcRenderer.invoke("save-settings", settings),

  // tokens
  getTokens: () => ipcRenderer.invoke("get-tokens"),
  importTokens: (text: string) => ipcRenderer.invoke("import-tokens", text),
  deleteTokens: (tokens: string[]) => ipcRenderer.invoke("delete-tokens", tokens),
  renameToken: (token: string, name: string) => ipcRenderer.invoke("rename-token", token, name),
  validateTokens: (tokens: string[]) => ipcRenderer.invoke("validate-tokens", tokens),
  onValidationProgress: (callback: (data: { token: string; ok: boolean }) => void) =>
    subscribe("validation-progress", callback),

  // extension bridge
  getBridgeStatus: () => ipcRenderer.invoke("bridge-status"),
  regenerateBridgeSecret: () => ipcRenderer.invoke("bridge-regenerate-secret"),

  // servers + channels
  getServers: () => ipcRenderer.invoke("get-servers"),
  getChannels: (token: string, guildId: string) =>
    ipcRenderer.invoke("get-channels", token, guildId),

  // voice
  voiceJoin: (payload: {
    token: string;
    guildId: string;
    channelId: string;
    mute?: boolean;
    deaf?: boolean;
    guildName?: string;
    channelName?: string;
  }) => ipcRenderer.invoke("voice-join", payload),
  voiceLeave: (token: string) => ipcRenderer.invoke("voice-leave", token),
  voiceSetMute: (token: string, mute: boolean) => ipcRenderer.invoke("voice-set-mute", token, mute),
  voiceSetDeaf: (token: string, deaf: boolean) => ipcRenderer.invoke("voice-set-deaf", token, deaf),
  voiceSetStream: (token: string, stream: boolean) => ipcRenderer.invoke("voice-set-stream", token, stream),
  voiceGetStates: () => ipcRenderer.invoke("voice-get-states"),
  getScreenSources: () => ipcRenderer.invoke("get-screen-sources"),
  voiceStartScreenshare: (payload: { token: string; sourceId: string; sourceName: string }) =>
    ipcRenderer.invoke("voice-start-screenshare", payload),
  voiceStopScreenshare: (token: string) => ipcRenderer.invoke("voice-stop-screenshare", token),
  voiceDisconnectAll: () => ipcRenderer.invoke("voice-disconnect-all"),
  onVoiceState: (callback: (data: { type: string; token?: string }) => void) =>
    subscribe("voice-state", callback),
  onVoiceStateUpdate: (callback: (data: any) => void) =>
    subscribe("voice-state-update", callback),

  // leave servers
  leaveServers: (payload: { tokens: string[]; guildIds: string[]; delay?: number }) =>
    ipcRenderer.invoke("leave-servers", payload),
  onLeaveServerProgress: (callback: (data: { token: string; guildId: string; success: boolean; error?: string }) => void) =>
    subscribe("leave-server-progress", callback),

  // audio & music player
  audioSelectFiles: () => ipcRenderer.invoke("audio-select-files"),
  audioParseDroppedFiles: (filePaths: string[]) => ipcRenderer.invoke("audio-parse-dropped-files", filePaths),
  audioPlay: (payload: {
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
  }) => ipcRenderer.invoke("audio-play", payload),
  audioSearchOnline: (query: string, limit?: number) => ipcRenderer.invoke("audio-search-online", query, limit),
  audioPause: () => ipcRenderer.invoke("audio-pause"),
  audioResume: () => ipcRenderer.invoke("audio-resume"),
  audioStop: () => ipcRenderer.invoke("audio-stop"),
  audioSeek: (seconds: number) => ipcRenderer.invoke("audio-seek", seconds),
  audioSetVolume: (volume: number) => ipcRenderer.invoke("audio-set-volume", volume),
  audioSetLoop: (loop: boolean) => ipcRenderer.invoke("audio-set-loop", loop),
  audioSetTarget: (targetToken: string | "all") => ipcRenderer.invoke("audio-set-target", targetToken),
  audioGetState: () => ipcRenderer.invoke("audio-get-state"),
  audioGetPresets: () => ipcRenderer.invoke("audio-get-presets"),
  audioGetLibrary: () => ipcRenderer.invoke("audio-get-library"),
  audioSaveLibrary: (items: any[]) => ipcRenderer.invoke("audio-save-library", items),
  onAudioStateChanged: (callback: (state: any) => void) => subscribe("audio-state-changed", callback),

  // activity log
  getLog: () => ipcRenderer.invoke("get-log"),
  clearLog: () => ipcRenderer.invoke("clear-log"),
  onLog: (callback: (record: { timestamp: string; message: string; level: string }) => void) =>
    subscribe("log-event", callback),

  onStoreChanged: (callback: () => void) => subscribe("store-changed", callback),
});