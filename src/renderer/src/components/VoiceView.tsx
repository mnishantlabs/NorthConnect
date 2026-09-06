import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Server,
  RefreshCw,
  Search,
  Check,
  Radio,
  User,
  LogOut,
  Tv,
  Monitor,
  Eye,
  Sliders,
  X,
  Maximize2,
  Minimize2,
  Play,
  Square,
  Sparkles,
  Layers,
  Volume1,
  Share2,
} from 'lucide-react';
import type { Token } from '@shared/types';
import { status, displayName } from '@shared/predicates';
import { CustomSelect, type SelectOption } from './CustomSelect';

interface VoiceViewProps {
  tokens: Token[];
  connected: Set<string>;
  selectedToken: string | null;
  onChangeSelectedToken: (token: string | null) => void;
  selectedGuildId: string;
  selectedGuildName: string;
  onSelectServer: (guildId: string, guildName: string) => void;
  selectedChannelId: string;
  selectedChannelName: string;
  onSelectChannel: (channelId: string, channelName: string) => void;
  onJoin: (tokens: string[], payload: { guildId: string; guildName: string; channelId: string; channelName: string; mute: boolean; deaf: boolean }) => void;
  onLeave: (token: string) => void;
  onJoinRecent: (target: { guild_id: string; guild_name: string; channel_id: string; channel_name: string }) => void;
  recents: Array<{ guild_id: string; guild_name: string; channel_id: string; channel_name: string }>;
  delay: number;
}

interface ChannelOpt {
  id: string;
  name: string;
}

interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
  appIcon?: string | null;
}

export const VoiceView: React.FC<VoiceViewProps> = ({
  tokens,
  connected,
  selectedToken,
  onChangeSelectedToken,
  selectedGuildId,
  selectedGuildName,
  onSelectServer,
  selectedChannelId,
  selectedChannelName,
  onSelectChannel,
  onJoin,
  onLeave,
  onJoinRecent,
  recents,
}) => {
  const valid = useMemo(() => tokens.filter((t) => status(t) === 'valid'), [tokens]);

  const [channels, setChannels] = useState<ChannelOpt[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [channelMode, setChannelMode] = useState<'browse' | 'manual'>('browse');
  const [channelFilter, setChannelFilter] = useState('');
  const [manualChannelId, setManualChannelId] = useState('');
  const [resolvingChannel, setResolvingChannel] = useState(false);
  const [manualResolveStatus, setManualResolveStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Dynamic voice states per token: { mute, deaf, isStreaming, guildId, channelId, isWatching, watchingUserId }
  const [voiceStates, setVoiceStates] = useState<
    Record<string, { mute: boolean; deaf: boolean; isStreaming?: boolean; isWatching?: boolean; watchingUserId?: string | null; watchingStreamKey?: string | null }>
  >({});

  // Screen Share Modal State
  const [screenShareModalOpen, setScreenShareModalOpen] = useState(false);
  const [screenSources, setScreenSources] = useState<ScreenSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [targetScreenShareToken, setTargetScreenShareToken] = useState<string>('');
  const [streamQuality, setStreamQuality] = useState<'720p' | '1080p' | 'source'>('720p');

  // Watch Stream Modal State
  const [streamViewerOpen, setStreamViewerOpen] = useState(false);
  const [activeWatchingToken, setActiveWatchingToken] = useState<string>('');
  const [streamVolume, setStreamVolume] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [watchAllTokens, setWatchAllTokens] = useState(false);
  const [activeStreamers, setActiveStreamers] = useState<
    Array<{ userId: string; username: string; globalName: string; avatarUrl: string; streamKey: string }>
  >([]);
  const [loadingStreamers, setLoadingStreamers] = useState(false);
  const [streamerSearchQuery, setStreamerSearchQuery] = useState('');
  const [streamerSearchResults, setStreamerSearchResults] = useState<
    Array<{ userId: string; username: string; globalName: string; avatarUrl: string }>
  >([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [manualStreamerId, setManualStreamerId] = useState('');
  const [manualUserPreview, setManualUserPreview] = useState<{
    userId: string;
    username: string;
    globalName: string;
    avatarUrl: string;
  } | null>(null);
  const [isLoadingUserPreview, setIsLoadingUserPreview] = useState(false);
  const [streamActionMessage, setStreamActionMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Refresh voice states from backend
  const refreshVoiceStates = useCallback(async () => {
    if (!window.electronAPI?.voiceGetStates) return;
    try {
      const states = await window.electronAPI.voiceGetStates();
      if (states) setVoiceStates(states);
    } catch {
      /* ignore */
    }
  }, []);

  // Fetch detected active streamers
  const refreshStreamers = useCallback(async (tk?: string) => {
    if (!window.electronAPI?.voiceGetStreamers) return;
    setLoadingStreamers(true);
    try {
      const list = await window.electronAPI.voiceGetStreamers(tk || undefined);
      if (Array.isArray(list)) setActiveStreamers(list);
    } catch {
      /* ignore */
    } finally {
      setLoadingStreamers(false);
    }
  }, []);

  useEffect(() => {
    refreshVoiceStates();
    if (!window.electronAPI) return;

    const offState = window.electronAPI.onVoiceStateUpdate(() => {
      refreshVoiceStates();
      refreshStreamers(activeWatchingToken || undefined);
    });
    const offVoice = window.electronAPI.onVoiceState(() => {
      refreshVoiceStates();
      refreshStreamers(activeWatchingToken || undefined);
    });

    return () => {
      offState();
      offVoice();
    };
  }, [refreshVoiceStates, refreshStreamers, activeWatchingToken]);

  // Target Account Options
  const accountOptions: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = [
      {
        value: 'all',
        label: `All Valid Accounts (${valid.length})`,
        sublabel: 'Mass Connect',
        icon: <User size={14} />,
      },
    ];
    for (const t of valid) {
      opts.push({
        value: t.token,
        label: displayName(t),
        sublabel: `${t.servers?.length ?? 0} servers`,
        icon: <User size={14} />,
      });
    }
    return opts;
  }, [valid]);

  // Server Map from valid tokens (filtered by selected token if single account mode)
  const servers = useMemo(() => {
    const map = new Map<string, string>();
    const sourceTokens = selectedToken && selectedToken !== 'all'
      ? valid.filter((t) => t.token === selectedToken)
      : valid;
    for (const t of sourceTokens) for (const s of t.servers ?? []) map.set(s.id, s.name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [valid, selectedToken]);

  // Server Options for CustomSelect
  const serverOptions: SelectOption[] = useMemo(() => {
    return servers.map(([id, name]) => ({
      value: id,
      label: name,
      sublabel: id,
      icon: <Server size={14} />,
    }));
  }, [servers]);

  const effectiveToken = selectedToken && selectedToken !== 'all' && valid.some((t) => t.token === selectedToken)
    ? selectedToken
    : valid.find((t) => (t.servers ?? []).some((s) => s.id === selectedGuildId))?.token ?? valid[0]?.token ?? null;

  const loadChannels = async (gid = selectedGuildId) => {
    if (!gid || !effectiveToken) {
      setChannels([]);
      return;
    }
    setLoadingChannels(true);
    try {
      const list = await window.electronAPI!.getChannels(effectiveToken, gid);
      const voice = (list ?? []).filter((c) => c && c.name);
      setChannels(voice);

      // Auto-select first channel only if none currently selected or current not in list
      if (voice.length > 0 && (!selectedChannelId || !voice.some((c) => c.id === selectedChannelId))) {
        onSelectChannel(voice[0].id, voice[0].name);
      }
    } catch {
      setChannels([]);
    } finally {
      setLoadingChannels(false);
    }
  };

  useEffect(() => {
    if (selectedGuildId) {
      loadChannels(selectedGuildId);
    } else {
      setChannels([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveToken, selectedGuildId]);

  const handleServerChange = (gid: string) => {
    const found = servers.find(([id]) => id === gid);
    const name = found ? found[1] : '';
    onSelectServer(gid, name);
  };

  const handleAccountChange = (val: string) => {
    const nextToken = val === 'all' ? null : val;
    onChangeSelectedToken(nextToken);

    if (nextToken) {
      const targetTokenObj = valid.find((t) => t.token === nextToken);
      const tokenServers = targetTokenObj?.servers ?? [];
      const hasCurrentGuild = tokenServers.some((s) => s.id === selectedGuildId);
      if (!hasCurrentGuild && tokenServers.length > 0) {
        onSelectServer(tokenServers[0].id, tokenServers[0].name);
      }
    }
  };

  const handleResolveManualChannel = async () => {
    const cid = manualChannelId.trim();
    if (!cid || !effectiveToken) return;
    setResolvingChannel(true);
    setManualResolveStatus(null);
    try {
      const res = await window.electronAPI?.resolveChannel?.({ token: effectiveToken, channelId: cid });
      if (res && res.id) {
        if (res.guild_id) {
          const foundServer = servers.find(([id]) => id === res.guild_id);
          onSelectServer(res.guild_id, foundServer ? foundServer[1] : `Guild ${res.guild_id}`);
        }
        onSelectChannel(res.id, res.name);
        setManualResolveStatus({ ok: true, msg: `Resolved: ${res.name}` });
      } else {
        setManualResolveStatus({ ok: false, msg: 'Channel not found or token lacks access' });
      }
    } catch (e: any) {
      setManualResolveStatus({ ok: false, msg: e?.message || 'Resolution failed' });
    } finally {
      setResolvingChannel(false);
    }
  };

  const pickTokens = selectedToken && selectedToken !== 'all'
    ? [selectedToken]
    : valid.map((t) => t.token);

  const eligibleTokens = pickTokens.filter((tk) => {
    if (channelMode === 'manual' && !selectedGuildId) return true;
    const t = valid.find((v) => v.token === tk);
    return t?.servers?.some((s) => s.id === selectedGuildId) ?? true;
  });

  const handleJoin = () => {
    const targetChannel = channelMode === 'manual' ? manualChannelId.trim() : selectedChannelId;
    if (!targetChannel || eligibleTokens.length === 0) return;

    const gid = selectedGuildId || 'manual';
    const gname = selectedGuildName || (selectedGuildId ? selectedGuildId : 'Manual Guild');
    const cname = selectedChannelName || `Channel ${targetChannel}`;

    onJoin(eligibleTokens, {
      guildId: gid,
      guildName: gname,
      channelId: targetChannel,
      channelName: cname,
      mute: false,
      deaf: false,
    });
  };

  // Search server members for stream watching
  const handleSearchStreamers = async (q: string) => {
    setStreamerSearchQuery(q);
    if (!q.trim() || !selectedGuildId || !effectiveToken) {
      setStreamerSearchResults([]);
      return;
    }
    setIsSearchingMembers(true);
    try {
      const res = await window.electronAPI?.searchGuildMembers?.({
        token: effectiveToken,
        guildId: selectedGuildId,
        query: q.trim(),
      });
      if (Array.isArray(res)) setStreamerSearchResults(res);
    } catch {
      setStreamerSearchResults([]);
    } finally {
      setIsSearchingMembers(false);
    }
  };

  // Lookup manual Discord User ID
  const handleLookupManualUser = async (uid: string) => {
    setManualStreamerId(uid);
    const clean = uid.trim();
    if (!clean || clean.length < 17 || !effectiveToken) {
      setManualUserPreview(null);
      return;
    }
    setIsLoadingUserPreview(true);
    try {
      const u = await window.electronAPI?.getUserInfo?.({ token: effectiveToken, userId: clean });
      if (u) setManualUserPreview(u);
      else setManualUserPreview(null);
    } catch {
      setManualUserPreview(null);
    } finally {
      setIsLoadingUserPreview(false);
    }
  };

  // Trigger Watch Stream for a target user
  const handleWatchUserStream = async (targetUserId: string, displayName = '') => {
    if (!targetUserId) return;
    const tk = watchAllTokens ? 'all' : activeWatchingToken || Array.from(connected)[0];
    if (!tk) return;

    setStreamActionMessage(`Connecting stream watcher for ${displayName || targetUserId}...`);
    try {
      const res = await window.electronAPI?.voiceWatchStream?.({
        token: tk,
        targetUserId: targetUserId.trim(),
        guildId: selectedGuildId || undefined,
        channelId: selectedChannelId || undefined,
      });
      if (res?.success) {
        setStreamActionMessage(`✓ Watching live stream of ${displayName || targetUserId}`);
        refreshVoiceStates();
      } else {
        setStreamActionMessage(`Failed to watch stream: ${res?.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      setStreamActionMessage(`Error: ${e?.message || e}`);
    }
  };

  // Stop watching stream
  const handleStopWatchingStream = async () => {
    const tk = watchAllTokens ? 'all' : activeWatchingToken || Array.from(connected)[0];
    if (!tk) return;
    try {
      await window.electronAPI?.voiceStopWatchingStream?.(tk);
      setStreamActionMessage('Stopped watching stream');
      refreshVoiceStates();
    } catch (e: any) {
      setStreamActionMessage(`Error: ${e?.message || e}`);
    }
  };

  // Toggle Mute for an active token
  const handleToggleTokenMute = async (tk: string) => {
    const current = voiceStates[tk]?.mute ?? false;
    const next = !current;
    setVoiceStates((prev) => ({
      ...prev,
      [tk]: { ...prev[tk], mute: next, deaf: next ? prev[tk]?.deaf ?? false : prev[tk]?.deaf ?? false },
    }));
    await window.electronAPI?.voiceSetMute(tk, next);
  };

  // Toggle Deafen for an active token
  const handleToggleTokenDeaf = async (tk: string) => {
    const current = voiceStates[tk]?.deaf ?? false;
    const next = !current;
    setVoiceStates((prev) => ({
      ...prev,
      [tk]: { ...prev[tk], deaf: next, mute: next ? true : prev[tk]?.mute ?? false },
    }));
    await window.electronAPI?.voiceSetDeaf(tk, next);
  };

  // Global Mute All
  const handleMuteAll = async (targetMute: boolean) => {
    for (const tk of connected) {
      setVoiceStates((prev) => ({
        ...prev,
        [tk]: { ...prev[tk], mute: targetMute },
      }));
      await window.electronAPI?.voiceSetMute(tk, targetMute);
    }
  };

  // Global Deafen All
  const handleDeafenAll = async (targetDeaf: boolean) => {
    for (const tk of connected) {
      setVoiceStates((prev) => ({
        ...prev,
        [tk]: { ...prev[tk], deaf: targetDeaf, mute: targetDeaf ? true : prev[tk]?.mute ?? false },
      }));
      await window.electronAPI?.voiceSetDeaf(tk, targetDeaf);
    }
  };

  // Open Screen Share Dialog
  const handleOpenScreenShareModal = async (tk?: string) => {
    const target = tk || Array.from(connected)[0] || '';
    setTargetScreenShareToken(target);
    setScreenShareModalOpen(true);
    setLoadingSources(true);

    try {
      const sources = await window.electronAPI?.getScreenSources();
      if (sources) {
        setScreenSources(sources);
        if (sources.length > 0) setSelectedSourceId(sources[0].id);
      }
    } catch {
      setScreenSources([]);
    } finally {
      setLoadingSources(false);
    }
  };

  // Start Screen Share (Go Live)
  const handleStartScreenshare = async () => {
    if (!targetScreenShareToken || !selectedSourceId) return;
    const selectedSource = screenSources.find((s) => s.id === selectedSourceId);
    setScreenShareModalOpen(false);

    try {
      await window.electronAPI?.voiceStartScreenshare({
        token: targetScreenShareToken,
        sourceId: selectedSourceId,
        sourceName: selectedSource?.name || 'Screen',
      });
      setVoiceStates((prev) => ({
        ...prev,
        [targetScreenShareToken]: { ...prev[targetScreenShareToken], isStreaming: true },
      }));
    } catch {
      /* ignore */
    }
  };

  // Stop Screen Share
  const handleStopScreenshare = async (tk: string) => {
    try {
      await window.electronAPI?.voiceStopScreenshare(tk);
      setVoiceStates((prev) => ({
        ...prev,
        [tk]: { ...prev[tk], isStreaming: false },
      }));
    } catch {
      /* ignore */
    }
  };

  // Open Stream Viewer
  const handleOpenStreamViewer = (tk: string) => {
    setActiveWatchingToken(tk);
    setStreamViewerOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
      {/* 1. Top Metric Cards (Matches Home) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 14,
        }}
      >
        {/* Metric 1: Voice Sessions */}
        <div
          className="card"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-panel)',
            borderRadius: 10,
            padding: '16px 18px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Voice Engine</span>
            <Radio size={14} style={{ color: connected.size > 0 ? 'var(--primary)' : 'var(--text-muted)' }} />
          </div>

          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {connected.size}{' '}
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>active</span>
          </div>

          <div style={{ fontSize: 11.5, color: connected.size > 0 ? 'var(--primary)' : 'var(--text-secondary)', marginTop: 10 }}>
            <span>{connected.size > 0 ? 'Connected / Broadcasting' : 'Engine Standby'}</span>
          </div>
        </div>

        {/* Metric 2: Available Tokens */}
        <div
          className="card"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-panel)',
            borderRadius: 10,
            padding: '16px 18px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Available Tokens</span>
            <User size={14} style={{ color: 'var(--text-muted)' }} />
          </div>

          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {valid.length}{' '}
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>ready</span>
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 10 }}>
            <span>Valid tokens ready to connect</span>
          </div>
        </div>

        {/* Metric 3: Target Server */}
        <div
          className="card"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-panel)',
            borderRadius: 10,
            padding: '16px 18px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Target Server</span>
            <Server size={14} style={{ color: 'var(--text-muted)' }} />
          </div>

          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedGuildName || 'None Selected'}
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 10 }}>
            <span>{servers.length} accessible servers</span>
          </div>
        </div>
      </div>

      {/* 2. Main 2-Column Grid Layout (Space Efficient!) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: 16,
          alignItems: 'start',
          flex: 1,
        }}
      >
        {/* Left Column: Connect Configuration Deck */}
        <div
          className="card"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-panel)',
            borderRadius: 10,
            padding: '18px 20px',
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <h2 style={{ fontSize: 14.5, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Connection Builder
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* 1. Target Account */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 6 }}>
                1 · Target Account(s)
              </label>
              <CustomSelect
                options={accountOptions}
                value={selectedToken || 'all'}
                onChange={handleAccountChange}
                placeholder="Select account..."
              />
            </div>

            {/* 2. Target Server */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 6 }}>
                2 · Target Server
              </label>
              <CustomSelect
                options={serverOptions}
                value={selectedGuildId}
                onChange={handleServerChange}
                placeholder="Select server..."
                searchable
                disabled={servers.length === 0}
              />
            </div>
          </div>

          {/* 3. Voice Channels Selection */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                  3 · Voice Channel
                </label>

                {/* Mode Toggle: Browse vs Manual */}
                <div style={{ display: 'inline-flex', background: 'var(--bg-main)', borderRadius: 6, padding: 2, boxShadow: 'var(--shadow-sm)' }}>
                  <button
                    onClick={() => setChannelMode('browse')}
                    style={{
                      border: 'none',
                      borderRadius: 4,
                      padding: '2px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: channelMode === 'browse' ? 'var(--primary)' : 'transparent',
                      color: channelMode === 'browse' ? '#ffffff' : 'var(--text-muted)',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    Browse
                  </button>
                  <button
                    onClick={() => setChannelMode('manual')}
                    style={{
                      border: 'none',
                      borderRadius: 4,
                      padding: '2px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: channelMode === 'manual' ? 'var(--primary)' : 'transparent',
                      color: channelMode === 'manual' ? '#ffffff' : 'var(--text-muted)',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    Manual ID
                  </button>
                </div>
              </div>

              {channelMode === 'browse' && selectedGuildId && (
                <button
                  onClick={() => loadChannels(selectedGuildId)}
                  disabled={loadingChannels}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <RefreshCw size={11} className={loadingChannels ? 'spin-anim' : ''} />
                  <span>Refresh</span>
                </button>
              )}
            </div>

            {channelMode === 'browse' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {channels.length > 4 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'var(--bg-main)',
                      border: 'none',
                      boxShadow: 'var(--shadow-sm)',
                      borderRadius: 6,
                      padding: '0 8px',
                      height: 28,
                    }}
                  >
                    <Search size={12} style={{ color: 'var(--text-muted)', marginRight: 6 }} />
                    <input
                      type="text"
                      value={channelFilter}
                      onChange={(e) => setChannelFilter(e.target.value)}
                      placeholder="Filter voice channels..."
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        fontSize: 11.5,
                        color: 'var(--text-primary)',
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                )}

                {/* Channel List Container */}
                <div
                  style={{
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 6,
                    padding: '6px',
                    minHeight: 90,
                    maxHeight: 160,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  {!selectedGuildId ? (
                    <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                      <Server size={18} style={{ opacity: 0.35, marginBottom: 4 }} />
                      <div>Select a target server above to browse voice channels.</div>
                    </div>
                  ) : loadingChannels ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                      <RefreshCw size={14} className="spin-anim" style={{ marginBottom: 4 }} />
                      <div>Fetching voice channels...</div>
                    </div>
                  ) : channels.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                      No voice channels found for this server.
                    </div>
                  ) : (
                    channels
                      .filter((c) => !channelFilter.trim() || c.name.toLowerCase().includes(channelFilter.toLowerCase()) || c.id.includes(channelFilter.trim()))
                      .map((c) => {
                        const isSelected = selectedChannelId === c.id;
                        return (
                          <div
                            key={c.id}
                            onClick={() => onSelectChannel(c.id, c.name)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              borderRadius: 4,
                              background: isSelected ? 'rgba(88, 101, 242, 0.12)' : 'transparent',
                              color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                              cursor: 'pointer',
                              transition: 'all 0.1s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Volume2 size={13} style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }} />
                              <span style={{ fontSize: 12, fontWeight: isSelected ? 700 : 500 }}>{c.name}</span>
                              <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>({c.id})</span>
                            </div>
                            {isSelected && <Check size={13} style={{ color: 'var(--primary)' }} />}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            ) : (
              /* Manual Channel ID Mode */
              <div
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 6,
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={manualChannelId}
                    onChange={(e) => {
                      setManualChannelId(e.target.value);
                      setManualResolveStatus(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleResolveManualChannel();
                    }}
                    placeholder="Enter Voice Channel ID..."
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      background: 'var(--bg-card)',
                      border: 'none',
                      boxShadow: 'var(--shadow-sm)',
                      borderRadius: 4,
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      outline: 'none',
                      fontFamily: 'monospace',
                    }}
                  />

                  <button
                    onClick={handleResolveManualChannel}
                    disabled={!manualChannelId.trim() || resolvingChannel || !effectiveToken}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 4,
                      background: 'var(--bg-card)',
                      border: 'none',
                      boxShadow: 'var(--shadow-sm)',
                      color: 'var(--primary)',
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: !manualChannelId.trim() || resolvingChannel ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <RefreshCw size={11} className={resolvingChannel ? 'spin-anim' : ''} />
                    <span>Resolve</span>
                  </button>
                </div>

                {manualResolveStatus && (
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: manualResolveStatus.ok ? '#10b981' : 'var(--danger)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {manualResolveStatus.ok ? <Check size={12} /> : <X size={12} />}
                    <span>{manualResolveStatus.msg}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. Connect Action */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid var(--border-light)',
              paddingTop: 12,
              marginTop: 4,
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              {(channelMode === 'manual' ? manualChannelId.trim() : selectedChannelName) ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Target:
                  <strong style={{ color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Volume2 size={12} style={{ color: 'var(--primary)' }} />
                    {channelMode === 'manual' ? (selectedChannelName || `ID: ${manualChannelId.trim()}`) : selectedChannelName}
                  </strong>
                </span>
              ) : (
                <span>Choose channel above</span>
              )}
            </div>

            <button
              className="button-primary"
              disabled={
                channelMode === 'browse'
                  ? !selectedGuildId || !selectedChannelId || eligibleTokens.length === 0
                  : !manualChannelId.trim() || eligibleTokens.length === 0
              }
              onClick={handleJoin}
              style={{
                padding: '8px 18px',
                fontSize: 12.5,
                fontWeight: 700,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 8px var(--primary-glow)',
                opacity:
                  (channelMode === 'browse' ? !selectedGuildId || !selectedChannelId : !manualChannelId.trim()) ||
                  eligibleTokens.length === 0
                    ? 0.5
                    : 1,
                cursor:
                  (channelMode === 'browse' ? !selectedGuildId || !selectedChannelId : !manualChannelId.trim()) ||
                  eligibleTokens.length === 0
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              <Radio size={14} />
              <span>Connect {eligibleTokens.length > 1 ? `(${eligibleTokens.length} Accounts)` : ''}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Active Connections & Recents Deck */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Active Connections Card */}
          <div
            className="card"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-panel)',
              borderRadius: 10,
              padding: '18px 20px',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Active VC Sessions
                </h3>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: connected.size > 0 ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-main)',
                    color: connected.size > 0 ? 'var(--success)' : 'var(--text-muted)',
                  }}
                >
                  {connected.size}
                </span>
              </div>

              {/* Quick Bulk Action Buttons */}
              {connected.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    onClick={() => handleMuteAll(true)}
                    style={{
                      background: 'var(--bg-main)',
                      border: 'none',
                      boxShadow: 'var(--shadow-sm)',
                      borderRadius: 4,
                      padding: '3px 7px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                    title="Mute all"
                  >
                    <MicOff size={11} />
                    <span>Mute</span>
                  </button>

                  <button
                    onClick={() => handleDeafenAll(true)}
                    style={{
                      background: 'var(--bg-main)',
                      border: 'none',
                      boxShadow: 'var(--shadow-sm)',
                      borderRadius: 4,
                      padding: '3px 7px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                    title="Deafen all"
                  >
                    <VolumeX size={11} />
                    <span>Deaf</span>
                  </button>

                  <button
                    onClick={() => handleOpenScreenShareModal()}
                    style={{
                      background: 'rgba(88, 101, 242, 0.12)',
                      border: 'none',
                      borderRadius: 4,
                      padding: '3px 7px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                    title="Share screen"
                  >
                    <Monitor size={11} />
                    <span>Stream</span>
                  </button>
                </div>
              )}
            </div>

            {connected.size === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                <Radio size={22} style={{ opacity: 0.35, marginBottom: 6 }} />
                <p style={{ margin: 0 }}>No active voice sessions. Configure and connect on the left to start streaming.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '280px', overflowY: 'auto' }}>
                {Array.from(connected).map((tk) => {
                  const account = tokens.find((t) => t.token === tk);
                  const name = account ? displayName(account) : `${tk.slice(0, 10)}...`;
                  const state = voiceStates[tk] || { mute: false, deaf: false, isStreaming: false };

                  return (
                    <div
                      key={tk}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border-light)',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {name}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {tk.slice(0, 12)}…
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <button
                          onClick={() => handleToggleTokenMute(tk)}
                          style={{
                            padding: '3px 6px',
                            borderRadius: 4,
                            border: 'none',
                            background: state.mute ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-card)',
                            boxShadow: 'var(--shadow-sm)',
                            color: state.mute ? 'var(--danger)' : 'var(--text-primary)',
                            cursor: 'pointer',
                          }}
                          title={state.mute ? 'Unmute' : 'Mute'}
                        >
                          {state.mute ? <MicOff size={12} /> : <Mic size={12} />}
                        </button>

                        <button
                          onClick={() => handleToggleTokenDeaf(tk)}
                          style={{
                            padding: '3px 6px',
                            borderRadius: 4,
                            border: 'none',
                            background: state.deaf ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-card)',
                            boxShadow: 'var(--shadow-sm)',
                            color: state.deaf ? 'var(--warning)' : 'var(--text-primary)',
                            cursor: 'pointer',
                          }}
                          title={state.deaf ? 'Undeafen' : 'Deafen'}
                        >
                          {state.deaf ? <VolumeX size={12} /> : <Volume2 size={12} />}
                        </button>

                        <button
                          onClick={() => onLeave(tk)}
                          style={{
                            padding: '3px 6px',
                            borderRadius: 4,
                            border: 'none',
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                          }}
                          title="Disconnect"
                        >
                          <LogOut size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Recent Channels Card */}
          {recents.length > 0 && (
            <div
              className="card"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-panel)',
                borderRadius: 10,
                padding: '16px 18px',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px 0', color: 'var(--text-primary)' }}>
                Recent Voice Channels
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {recents.slice(0, 3).map((r, i) => (
                  <div
                    key={i}
                    onClick={() => onJoinRecent(r)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: 'var(--bg-main)',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <Volume2 size={12} style={{ color: 'var(--primary)' }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {r.channel_name || r.channel_id}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>in {r.guild_name}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>Join →</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SCREEN SHARE (GO LIVE) SELECTION MODAL                    */}
      {/* ========================================================= */}
      {screenShareModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
            boxSizing: 'border-box',
          }}
        >
          <div
            className="card fade-in"
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '90vh',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              borderRadius: 16,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 22px',
                borderBottom: '1px solid var(--border-medium)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'rgba(88, 101, 242, 0.15)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Tv size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    Share Your Screen (Go Live)
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Select a screen or application window to broadcast into the voice channel
                  </p>
                </div>
              </div>

              <button
                onClick={() => setScreenShareModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: Source Picker */}
            <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Quality & Token Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Stream Quality:</span>
                  <div style={{ display: 'flex', background: 'var(--bg-main)', padding: 3, borderRadius: 8, border: '1px solid var(--border-medium)' }}>
                    {(['720p', '1080p', 'source'] as const).map((q) => (
                      <button
                        key={q}
                        onClick={() => setStreamQuality(q)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: 'none',
                          background: streamQuality === q ? 'var(--primary)' : 'transparent',
                          color: streamQuality === q ? '#ffffff' : 'var(--text-secondary)',
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {q === 'source' ? 'Source (60fps)' : `${q} 30fps`}
                      </button>
                    ))}
                  </div>
                </div>

                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Broadcasting via <strong>{displayName(tokens.find((t) => t.token === targetScreenShareToken) || { name: 'Token' } as any)}</strong>
                </span>
              </div>

              {/* Sources Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 12,
                  maxHeight: 340,
                  overflowY: 'auto',
                  padding: 4,
                }}
              >
                {loadingSources ? (
                  <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="spin-anim" style={{ marginBottom: 8 }} />
                    <p style={{ margin: 0, fontSize: 13 }}>Detecting displays and windows...</p>
                  </div>
                ) : screenSources.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No display sources detected.
                  </div>
                ) : (
                  screenSources.map((src) => {
                    const isSelected = selectedSourceId === src.id;
                    return (
                      <div
                        key={src.id}
                        onClick={() => setSelectedSourceId(src.id)}
                        style={{
                          borderRadius: 10,
                          overflow: 'hidden',
                          background: 'var(--bg-main)',
                          border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-medium)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? '0 0 12px rgba(88, 101, 242, 0.3)' : 'none',
                        }}
                      >
                        <div style={{ position: 'relative', width: '100%', height: 110, background: '#000000', overflow: 'hidden' }}>
                          <img
                            src={src.thumbnail}
                            alt={src.name}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                          {isSelected && (
                            <div
                              style={{
                                position: 'absolute',
                                top: 6,
                                right: 6,
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: 'var(--primary)',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Check size={14} />
                            </div>
                          )}
                        </div>

                        <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {src.appIcon ? (
                            <img src={src.appIcon} alt="" style={{ width: 16, height: 16, borderRadius: 3 }} />
                          ) : (
                            <Monitor size={14} style={{ color: 'var(--text-muted)' }} />
                          )}
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {src.name}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 10,
                padding: '14px 22px',
                borderTop: '1px solid var(--border-medium)',
              }}
            >
              <button
                onClick={() => setScreenShareModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-secondary)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                className="button-primary"
                disabled={!selectedSourceId || loadingSources}
                onClick={handleStartScreenshare}
                style={{
                  padding: '8px 20px',
                  fontSize: 13,
                  borderRadius: 8,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Tv size={15} />
                <span>Go Live / Start Streaming</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* WATCH STREAM VIEWER & SELECTOR MODAL                       */}
      {/* ========================================================= */}
      {streamViewerOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: isFullscreen ? 0 : 20,
            boxSizing: 'border-box',
          }}
        >
          <div
            className="card fade-in"
            style={{
              width: isFullscreen ? '100vw' : '100%',
              maxWidth: isFullscreen ? '100vw' : 920,
              height: isFullscreen ? '100vh' : 'auto',
              maxHeight: isFullscreen ? '100vh' : '90vh',
              background: '#09090b',
              border: isFullscreen ? 'none' : '1px solid var(--border-medium)',
              borderRadius: isFullscreen ? 0 : 16,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
              overflow: 'hidden',
            }}
          >
            {/* Viewer Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                background: 'rgba(24, 24, 27, 0.95)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
                <span style={{ fontSize: 14.5, fontWeight: 700, color: '#f4f4f5' }}>
                  Watch Live Stream
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(88, 101, 242, 0.2)',
                    color: '#60a5fa',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Volume2 size={12} />
                  {selectedChannelName || 'Voice Channel'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                    padding: 6,
                    borderRadius: 6,
                  }}
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button
                  onClick={() => {
                    setStreamViewerOpen(false);
                    setStreamActionMessage(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                    padding: 6,
                    borderRadius: 6,
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Viewer Body: Streamer Selector & Live Player */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Active Watch Banner (If currently watching someone) */}
              {(() => {
                const currentWatchingState = voiceStates[activeWatchingToken];
                const isWatchingActive = currentWatchingState?.isWatching && currentWatchingState?.watchingUserId;
                if (!isWatchingActive) return null;

                return (
                  <div
                    style={{
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: 10,
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#f4f4f5' }}>
                          Currently Watching Stream: <span style={{ color: '#10b981' }}>{currentWatchingState.watchingUserId}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#a1a1aa', fontFamily: 'monospace' }}>
                          {currentWatchingState.watchingStreamKey || 'Stream Key Active'}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleStopWatchingStream}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 6,
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: 'var(--danger)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Stop Watching Stream
                    </button>
                  </div>
                );
              })()}

              {/* Multi-Token Watch Option */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, color: '#e4e4e7' }}>
                  <input
                    type="checkbox"
                    checked={watchAllTokens}
                    onChange={(e) => setWatchAllTokens(e.target.checked)}
                    style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <span>Watch with all connected tokens ({connected.size} tokens)</span>
                </label>

                {streamActionMessage && (
                  <span style={{ fontSize: 12, color: streamActionMessage.startsWith('✓') ? '#10b981' : '#60a5fa' }}>
                    {streamActionMessage}
                  </span>
                )}
              </div>

              {/* Section 1: Active Streamers in this Channel */}
              <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a1a1aa' }}>
                    Active Streamers in Voice Channel ({activeStreamers.length})
                  </div>
                  <button
                    onClick={() => refreshStreamers(activeWatchingToken)}
                    disabled={loadingStreamers}
                    style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: 11.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <RefreshCw size={11} className={loadingStreamers ? 'spin-anim' : ''} />
                    <span>Refresh</span>
                  </button>
                </div>

                {activeStreamers.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#71717a', fontSize: 12.5 }}>
                    No automated live screen-shares detected yet. You can search or type any user ID below to watch their stream.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                    {activeStreamers.map((s) => (
                      <div
                        key={s.userId}
                        style={{
                          background: '#18181b',
                          border: '1px solid #3f3f46',
                          borderRadius: 8,
                          padding: '10px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <img
                            src={s.avatarUrl}
                            alt=""
                            style={{ width: 32, height: 32, borderRadius: '50%', background: '#27272a', flexShrink: 0 }}
                          />
                          <div style={{ minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#f4f4f5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {s.globalName}
                            </div>
                            <div style={{ fontSize: 11, color: '#a1a1aa', fontFamily: 'monospace' }}>
                              @{s.username}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleWatchUserStream(s.userId, s.globalName)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: 6,
                            background: 'var(--primary)',
                            border: 'none',
                            color: '#ffffff',
                            fontSize: 11.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          Watch
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Search Member or Enter User ID */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
                {/* Search by Name */}
                <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a1a1aa', marginBottom: 8 }}>
                    Search Member by Name
                  </div>

                  <div style={{ position: 'relative', marginBottom: 10 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
                    <input
                      type="text"
                      value={streamerSearchQuery}
                      onChange={(e) => handleSearchStreamers(e.target.value)}
                      placeholder="Type member username or nickname..."
                      style={{
                        width: '100%',
                        padding: '8px 10px 8px 32px',
                        background: '#18181b',
                        border: '1px solid #3f3f46',
                        borderRadius: 6,
                        fontSize: 12.5,
                        color: '#f4f4f5',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Search Results List */}
                  <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {isSearchingMembers ? (
                      <div style={{ padding: '12px', textAlign: 'center', color: '#71717a', fontSize: 12 }}>
                        Searching guild members...
                      </div>
                    ) : streamerSearchResults.length === 0 ? (
                      <div style={{ padding: '12px', textAlign: 'center', color: '#52525b', fontSize: 11.5 }}>
                        {streamerSearchQuery ? 'No members found matching search' : 'Type a username to search'}
                      </div>
                    ) : (
                      streamerSearchResults.map((m) => (
                        <div
                          key={m.userId}
                          style={{
                            background: '#18181b',
                            border: '1px solid #27272a',
                            borderRadius: 6,
                            padding: '6px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <img src={m.avatarUrl} alt="" style={{ width: 26, height: 26, borderRadius: '50%', background: '#27272a' }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#f4f4f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {m.globalName}
                              </div>
                              <div style={{ fontSize: 10.5, color: '#a1a1aa' }}>@{m.username} · {m.userId}</div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleWatchUserStream(m.userId, m.globalName)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 5,
                              background: 'var(--primary)',
                              border: 'none',
                              color: '#ffffff',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          >
                            Watch
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Direct User ID Input */}
                <div style={{ background: '#121215', border: '1px solid #27272a', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a1a1aa', marginBottom: 8 }}>
                    Enter Discord User ID
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    <input
                      type="text"
                      value={manualStreamerId}
                      onChange={(e) => handleLookupManualUser(e.target.value)}
                      placeholder="Paste 17-20 digit User ID..."
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        background: '#18181b',
                        border: '1px solid #3f3f46',
                        borderRadius: 6,
                        fontSize: 12.5,
                        color: '#f4f4f5',
                        outline: 'none',
                        fontFamily: 'monospace',
                      }}
                    />
                    <button
                      onClick={() => handleWatchUserStream(manualStreamerId.trim())}
                      disabled={!manualStreamerId.trim()}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 6,
                        background: 'var(--primary)',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: !manualStreamerId.trim() ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Watch Stream
                    </button>
                  </div>

                  {/* Manual User Preview Card */}
                  {isLoadingUserPreview ? (
                    <div style={{ padding: '10px', textAlign: 'center', color: '#71717a', fontSize: 12 }}>
                      Fetching user info from Discord...
                    </div>
                  ) : manualUserPreview ? (
                    <div
                      style={{
                        background: '#18181b',
                        border: '1px solid rgba(88, 101, 242, 0.3)',
                        borderRadius: 8,
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <img src={manualUserPreview.avatarUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#f4f4f5' }}>{manualUserPreview.globalName}</div>
                          <div style={{ fontSize: 11, color: '#a1a1aa' }}>@{manualUserPreview.username}</div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleWatchUserStream(manualUserPreview.userId, manualUserPreview.globalName)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 5,
                          background: 'var(--primary)',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Watch Now
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11.5, color: '#71717a' }}>
                      Enter any Discord User ID (e.g. 1110487346194948198) to watch their voice channel broadcast directly.
                    </div>
                  )}
                </div>
              </div>

              {/* Video Player Display Screen */}
              <div
                style={{
                  position: 'relative',
                  minHeight: 220,
                  background: '#000000',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  border: '1px solid #27272a',
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />

                {/* Stream Overlay Info */}
                <div
                  style={{
                    position: 'absolute',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    color: '#71717a',
                    textAlign: 'center',
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#a1a1aa',
                    }}
                  >
                    <Tv size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#e4e4e7', marginBottom: 2 }}>
                      Discord Gateway Stream Watcher
                    </div>
                    <div style={{ fontSize: 11.5, color: '#a1a1aa' }}>
                      Token stream gateway registered for {selectedChannelName || 'Voice Channel'}.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Viewer Bottom Bar Controls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                background: 'rgba(24, 24, 27, 0.95)',
                borderTop: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Volume2 size={16} style={{ color: '#a1a1aa' }} />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={streamVolume}
                    onChange={(e) => setStreamVolume(Number(e.target.value))}
                    style={{ width: 100, accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 11, color: '#a1a1aa', width: 30 }}>{streamVolume}%</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setStreamViewerOpen(false)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#f4f4f5',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Close Viewer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};