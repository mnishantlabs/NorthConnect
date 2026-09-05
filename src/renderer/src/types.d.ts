interface VoiceJoinPayload {
  token: string;
  guildId: string;
  channelId: string;
  mute?: boolean;
  deaf?: boolean;
  guildName?: string;
  channelName?: string;
}

interface ServerEntry {
  name: string;
  id: string;
  tokens: Array<{ token: string; username: string }>;
}

interface LogEntry {
  timestamp: string;
  message: string;
  level: string;
}

interface AudioTrack {
  id: string;
  title: string;
  filePath: string;
  fileName: string;
  sizeBytes: number;
  duration: number;
  ext: string;
  thumbnail?: string;
  author?: string;
  sourceType?: "local" | "youtube" | "spotify";
}

interface OnlineTrackResult {
  id: string;
  title: string;
  author: string;
  duration: number;
  durationFormatted: string;
  thumbnail: string;
  url: string;
  views?: number;
  ago?: string;
  source: "youtube" | "spotify";
}

interface AudioPlayerState {
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

interface SoundboardPreset {
  id: string;
  name: string;
  category: string;
  icon: string;
  duration: string;
  filePath: string;
}

interface ElectronAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  getWindowState: () => Promise<{ isMaximized: boolean }>;
  onWindowStateChanged: (callback: (state: { isMaximized: boolean }) => void) => () => void;

  getThemeSync: () => string;
  getSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<any>;

  getTokens: () => Promise<any[]>;
  importTokens: (text: string) => Promise<number>;
  deleteTokens: (tokens: string[]) => Promise<void>;
  renameToken: (token: string, name: string) => Promise<void>;
  validateTokens: (tokens: string[]) => Promise<any[]>;
  onValidationProgress: (callback: (data: { token: string; ok: boolean; isNew?: boolean }) => void) => () => void;

  getServers: () => Promise<Record<string, ServerEntry>>;
  getChannels: (token: string, guildId: string) => Promise<Array<{ id: string; name: string }>>;

  voiceJoin: (payload: VoiceJoinPayload) => Promise<{ success: boolean; error?: string }>;
  voiceLeave: (token: string) => Promise<void>;
  voiceSetMute?: (token: string, mute: boolean) => Promise<{ success: boolean }>;
  voiceSetDeaf?: (token: string, deaf: boolean) => Promise<{ success: boolean }>;
  voiceSetStream?: (token: string, stream: boolean) => Promise<{ success: boolean }>;
  voiceGetStates?: () => Promise<Record<string, { mute: boolean; deaf: boolean; isStreaming: boolean }>>;
  getScreenSources?: () => Promise<Array<{ id: string; name: string; thumbnail: string; isScreen: boolean }>>;
  voiceStartScreenshare?: (payload: { token: string; sourceId: string; sourceName: string }) => Promise<{ success: boolean }>;
  voiceStopScreenshare?: (token: string) => Promise<{ success: boolean }>;
  voiceDisconnectAll: () => Promise<void>;
  onVoiceState: (callback: (data: { type: string; token?: string }) => void) => () => void;
  onVoiceStateUpdate?: (callback: (data: any) => void) => () => void;

  joinInvite: (tokens: string[], invite: string) => Promise<void>;

  leaveServers: (payload: { tokens: string[]; guildIds: string[]; delay?: number }) => Promise<{ success: boolean; left: number; errors?: string[] }>;
  onLeaveServerProgress: (callback: (data: { token: string; guildId: string; success: boolean; error?: string }) => void) => () => void;

  // audio & music player
  audioSelectFiles: () => Promise<AudioTrack[]>;
  audioParseDroppedFiles: (filePaths: string[]) => Promise<AudioTrack[]>;
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
  }) => Promise<{ success: boolean; error?: string }>;
  audioSearchOnline: (query: string, limit?: number) => Promise<OnlineTrackResult[]>;
  audioPause: () => Promise<void>;
  audioResume: () => Promise<void>;
  audioStop: () => Promise<void>;
  audioSeek: (seconds: number) => Promise<void>;
  audioSetVolume: (volume: number) => Promise<void>;
  audioSetLoop: (loop: boolean) => Promise<void>;
  audioSetTarget: (targetToken: string | "all") => Promise<void>;
  audioGetState: () => Promise<AudioPlayerState>;
  audioGetPresets: () => Promise<SoundboardPreset[]>;
  audioGetLibrary: () => Promise<AudioTrack[]>;
  audioSaveLibrary: (items: AudioTrack[]) => Promise<void>;
  onAudioStateChanged: (callback: (state: AudioPlayerState) => void) => () => void;

  getLog: () => Promise<LogEntry[]>;
  clearLog: () => Promise<void>;
  onLog: (callback: (record: LogEntry) => void) => () => void;
  onStoreChanged: (callback: () => void) => () => void;

  // extension bridge
  getBridgeStatus: () => Promise<{
    enabled: boolean;
    running: boolean;
    host: string;
    port: number;
    secret: string;
    version: string;
    count: number;
  } | null>;
  regenerateBridgeSecret: () => Promise<string>;
}

interface Window {
  electronAPI?: ElectronAPI;
}