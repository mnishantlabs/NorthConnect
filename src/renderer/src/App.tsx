import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sidebar, type ViewId } from './components/Sidebar';
import { Titlebar } from './components/Titlebar';
import { HomeView } from './components/HomeView';
import { AccountsView } from './components/AccountsView';
import { ConnectView } from './components/ConnectView';
import { ToolsView } from './components/ToolsView';
import { PlayView } from './components/PlayView';
import { ActivityView, type LogEntry } from './components/ActivityView';
import { SettingsView, type SettingsShape } from './components/SettingsView';
import { VoiceBar } from './components/VoiceBar';
import { ImportDialog } from './components/ImportDialog';
import { useTheme } from './contexts/ThemeContext';
import { tokenFromDict } from '@shared/types';
import { status } from '@shared/predicates';

const DEFAULT_SETTINGS: SettingsShape & { recent_voice?: any[] } = {
  concurrency: 5,
  retry_delay: 3,
  proxy: '',
  api_timeout: 10,
  delay: 0.5,
  show_badges: true,
  show_ids: true,
  auto_validate: false,
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<ViewId>('home');
  const [tokens, setTokens] = useState<any[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<SettingsShape & { recent_voice?: any[] }>(DEFAULT_SETTINGS);
  const [importOpen, setImportOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validatingSet, setValidatingSet] = useState<Set<string>>(new Set());
  const [selectedVoiceToken, setSelectedVoiceToken] = useState<string | null>(null);
  const [selectedGuildId, setSelectedGuildId] = useState<string>(() => localStorage.getItem('nc-voice-guild-id') || '');
  const [selectedGuildName, setSelectedGuildName] = useState<string>(() => localStorage.getItem('nc-voice-guild-name') || '');
  const [selectedChannelId, setSelectedChannelId] = useState<string>(() => localStorage.getItem('nc-voice-channel-id') || '');
  const [selectedChannelName, setSelectedChannelName] = useState<string>(() => localStorage.getItem('nc-voice-channel-name') || '');

  const handleSelectServer = useCallback((gid: string, gname: string) => {
    setSelectedGuildId(gid);
    setSelectedGuildName(gname);
    setSelectedChannelId('');
    setSelectedChannelName('');
    localStorage.setItem('nc-voice-guild-id', gid);
    localStorage.setItem('nc-voice-guild-name', gname);
    localStorage.removeItem('nc-voice-channel-id');
    localStorage.removeItem('nc-voice-channel-name');
  }, []);

  const handleSelectChannel = useCallback((cid: string, cname: string) => {
    setSelectedChannelId(cid);
    setSelectedChannelName(cname);
    localStorage.setItem('nc-voice-channel-id', cid);
    localStorage.setItem('nc-voice-channel-name', cname);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [list, logList, settingsData] = await Promise.all([
        window.electronAPI?.getTokens() ?? Promise.resolve([]),
        window.electronAPI?.getLog() ?? Promise.resolve([]),
        window.electronAPI?.getSettings() ?? Promise.resolve({}),
      ]);
      setTokens(list.map((d: any) => tokenFromDict(d.token, d)));
      if (logList) setLogs(logList);
      if (settingsData) setSettings({ ...DEFAULT_SETTINGS, ...settingsData });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!window.electronAPI) return;

    const offLog = window.electronAPI.onLog((r) => setLogs((prev) => [...prev.slice(-999), r]));
    const offStore = window.electronAPI.onStoreChanged(() => {
      setValidating(false);
      setValidatingSet(new Set());
      refresh();
    });
    const offVoice = window.electronAPI.onVoiceState(({ type, token }) => {
      setConnected((prev) => {
        const next = new Set(prev);
        if (type === 'joined' && token) next.add(token);
        else if (type === 'left' && token) next.delete(token);
        else if (type === 'all_cleared') next.clear();
        return next;
      });
    });
    const offProgress = window.electronAPI.onValidationProgress(({ token }) => {
      setValidating(true);
      setValidatingSet((prev) => {
        const next = new Set(prev);
        next.add(token);
        return next;
      });
    });

    return () => {
      offLog();
      offStore();
      offVoice();
      offProgress();
    };
  }, [refresh]);

  const handleValidate = useCallback(async (list: any[]) => {
    if (!list?.length || validating) return;
    const keys = list.map((t) => (typeof t === 'string' ? t : t.token)).filter(Boolean);
    setValidating(true);
    setValidatingSet((prev) => new Set([...prev, ...keys]));
    try {
      await window.electronAPI?.validateTokens(keys);
    } finally {
      setValidating(false);
      setValidatingSet(new Set());
      refresh();
    }
  }, [validating, refresh]);

  const handleDelete = useCallback(async (keys: string[]) => {
    if (!keys?.length) return;
    await window.electronAPI?.deleteTokens(keys);
    refresh();
  }, [refresh]);

  const handleRename = useCallback(async (token: string, name: string) => {
    await window.electronAPI?.renameToken(token, name);
    refresh();
  }, [refresh]);

  const handleJoinVoice = useCallback((token: string) => {
    setSelectedVoiceToken(token);
    setView('connect');
  }, []);

  const joinedTokensFor = useCallback((preferred: string | null) => {
    if (connected.size > 0) return [...connected];
    if (preferred) return [preferred];
    return tokens.filter((t) => status(t) === 'valid').map((t) => t.token);
  }, [connected, tokens]);

  const runJoins = useCallback(async (keys: string[], payload: any) => {
    for (const token of keys) {
      const res = await window.electronAPI?.voiceJoin({ ...payload, token });
      if (res?.success === false) {
        setLogs((prev) => [...prev, { timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }), message: `${token.slice(0, 8)}… failed: ${res.error ?? 'unknown'}`, level: 'error' }]);
      }
      await sleep((settings.delay ?? 0.5) * 1000);
    }
  }, [settings.delay]);

  const handleVoiceJoin = useCallback((keys: string[], payload: any) => {
    runJoins(keys, payload);
  }, [runJoins]);

  const handleJoinRecent = useCallback((target: any) => {
    const keys = joinedTokensFor(selectedVoiceToken);
    runJoins(keys, {
      guildId: target.guild_id,
      guildName: target.guild_name,
      channelId: target.channel_id,
      channelName: target.channel_name,
      mute: false,
      deaf: false,
    });
  }, [joinedTokensFor, selectedVoiceToken, runJoins]);

  const handleLeaveAll = useCallback(async () => {
    setConnected(new Set());
    await window.electronAPI?.voiceDisconnectAll();
  }, []);

  const handleLeaveOne = useCallback((token: string) => {
    if (!token) {
      handleLeaveAll();
      return;
    }
    setConnected((prev) => {
      const next = new Set(prev);
      next.delete(token);
      return next;
    });
    window.electronAPI?.voiceLeave(token);
  }, [handleLeaveAll]);

  const handleSaveSettings = useCallback((patch: Partial<SettingsShape>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    window.electronAPI?.saveSettings(patch);
  }, []);

  const serverCount = useMemo(() => {
    const ids = new Set<string>();
    for (const t of tokens) for (const s of t.servers ?? []) ids.add(s.id);
    return ids.size;
  }, [tokens]);

  const recents: Array<{ guild_id: string; guild_name: string; channel_id: string; channel_name: string }> =
    settings.recent_voice ?? [];

  const counts = useMemo(() => {
    const c = { valid: 0, invalid: 0, locked: 0 };
    for (const t of tokens) {
      const s = status(t);
      if (s === 'valid') c.valid++;
      else if (s === 'locked') c.locked++;
      else c.invalid++;
    }
    return c;
  }, [tokens]);

  return (
    <div className="app-container" style={{ position: 'relative' }}>
      {/* Main Workspace Frame */}
      <div className="main-content">
        {/* Left Navigation Sidebar (full height) */}
        <Sidebar
          currentView={view}
          onViewChange={setView}
          theme={theme === 'light' ? 'light' : 'dark'}
          onToggleTheme={toggleTheme}
          counts={{ accounts: tokens.length, servers: serverCount, connected: connected.size }}
        />

        {/* Right Area: Main app layout container with Titlebar inside */}
        <div className="app-main" style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', minWidth: 0, height: '100%' }}>
          {/* Top Titlebar / Header inside the right area */}
          <Titlebar
            tokens={tokens}
            validating={validating}
            onNavigate={setView}
            onImport={() => setImportOpen(true)}
            onValidateAll={() => handleValidate(tokens)}
            onDisconnectAll={handleLeaveAll}
            onSelectToken={handleJoinVoice}
            onToggleTheme={toggleTheme}
            theme={theme === 'light' ? 'light' : 'dark'}
          />

          <div style={{ display: 'flex', flexDirection: 'row', flex: 1, overflow: 'hidden', width: '100%', minHeight: 0 }}>
            <div className="app-content" style={{ minWidth: 0, flex: 1, height: '100%', overflow: 'hidden' }}>
              {view === 'home' && (
                <HomeView
                  tokens={tokens}
                  connectedCount={connected.size}
                  serverCount={serverCount}
                  validating={validating}
                  onImport={() => setImportOpen(true)}
                  onRequestValidate={handleValidate}
                  onNavigate={setView}
                  onJoinVoice={handleJoinVoice}
                />
              )}
              {(view === 'tokens' || view === 'accounts') && (
                <AccountsView
                  tokens={tokens}
                  validating={validating}
                  validatingSet={validatingSet}
                  onImport={() => setImportOpen(true)}
                  onRequestValidate={handleValidate}
                  onDelete={handleDelete}
                  onRename={handleRename}
                  onJoinVoice={handleJoinVoice}
                />
              )}
              {(view === 'connect' || view === 'voice' || view === 'servers') && (
                <ConnectView
                  tokens={tokens}
                  connected={connected}
                  selectedToken={selectedVoiceToken}
                  onChangeSelectedToken={setSelectedVoiceToken}
                  onJoin={handleVoiceJoin}
                  onLeave={handleLeaveOne}
                  onJoinRecent={handleJoinRecent}
                  recents={recents}
                  delay={settings.delay}
                  selectedGuildId={selectedGuildId}
                  selectedGuildName={selectedGuildName}
                  onSelectServer={handleSelectServer}
                  selectedChannelId={selectedChannelId}
                  selectedChannelName={selectedChannelName}
                  onSelectChannel={handleSelectChannel}
                />
              )}
              {view === 'tools' && <ToolsView tokens={tokens} onRefresh={refresh} />}
              {view === 'play' && <PlayView tokens={tokens} connected={connected} onNavigate={setView} />}
              {view === 'activity' && <ActivityView logs={logs} onClear={() => window.electronAPI?.clearLog()} />}
              {view === 'settings' && <SettingsView settings={settings} onSave={handleSaveSettings} />}
            </div>
          </div>

          <VoiceBar
            connectedCount={connected.size}
            tokenCount={tokens.length}
            counts={counts}
            validating={validating}
            onLeaveAll={handleLeaveAll}
            onOpenVoice={() => setView('connect')}
          />
        </div>
      </div>

      {importOpen && <ImportDialog onDone={() => setImportOpen(false)} />}
    </div>
  );
}