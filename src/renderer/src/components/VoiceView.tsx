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
import type { Token } from '../../../shared/types';
import { status, displayName } from '../../../shared/predicates';
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
  const [mute, setMute] = useState(false);
  const [deaf, setDeaf] = useState(false);

  // Dynamic voice states per token: { mute, deaf, isStreaming, guildId, channelId }
  const [voiceStates, setVoiceStates] = useState<Record<string, { mute: boolean; deaf: boolean; isStreaming?: boolean }>>({});

  // Screen Share Modal State
  const [screenShareModalOpen, setScreenShareModalOpen] = useState(false);
  const [screenSources, setScreenSources] = useState<ScreenSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [targetScreenShareToken, setTargetScreenShareToken] = useState<string>('');
  const [streamQuality, setStreamQuality] = useState<'720p' | '1080p' | 'source'>('720p');

  // Watch Stream Viewer Modal State
  const [streamViewerOpen, setStreamViewerOpen] = useState(false);
  const [activeWatchingToken, setActiveWatchingToken] = useState<string>('');
  const [streamVolume, setStreamVolume] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
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

  useEffect(() => {
    refreshVoiceStates();
    if (!window.electronAPI) return;

    const offState = window.electronAPI.onVoiceStateUpdate(() => {
      refreshVoiceStates();
    });
    const offVoice = window.electronAPI.onVoiceState(() => {
      refreshVoiceStates();
    });

    return () => {
      offState();
      offVoice();
    };
  }, [refreshVoiceStates]);

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

  // Server Map from valid tokens
  const servers = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of valid) for (const s of t.servers ?? []) map.set(s.id, s.name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [valid]);

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
    : valid[0]?.token ?? null;

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
    if (val === 'all') {
      onChangeSelectedToken(null);
    } else {
      onChangeSelectedToken(val);
    }
  };

  const pickTokens = selectedToken && selectedToken !== 'all'
    ? [selectedToken]
    : valid.map((t) => t.token);

  const handleJoin = () => {
    if (!selectedGuildId || !selectedChannelId || pickTokens.length === 0) return;
    onJoin(pickTokens, {
      guildId: selectedGuildId,
      guildName: selectedGuildName || selectedGuildId,
      channelId: selectedChannelId,
      channelName: selectedChannelName || selectedChannelId,
      mute,
      deaf,
    });
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflowY: 'auto', padding: '16px 20px', boxSizing: 'border-box' }}>
      {/* Top Config Card */}
      <div
        className="card"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-medium)',
          borderRadius: 12,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {/* 1. Target Account */}
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
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
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
              2 · Target Server
            </label>
            <CustomSelect
              options={serverOptions}
              value={selectedGuildId}
              onChange={handleServerChange}
              placeholder="Select a target server..."
              searchable
              disabled={servers.length === 0}
            />
          </div>
        </div>

        {/* 3. Voice Channels Selection */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              3 · Voice Channel
            </label>
            {selectedGuildId && (
              <button
                onClick={() => loadChannels(selectedGuildId)}
                disabled={loadingChannels}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <RefreshCw size={12} className={loadingChannels ? 'spin-anim' : ''} />
                <span>Refresh Channels</span>
              </button>
            )}
          </div>

          {/* Channel List Container */}
          <div
            style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border-medium)',
              borderRadius: 8,
              padding: '8px',
              minHeight: 100,
              maxHeight: 180,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {!selectedGuildId ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <Server size={22} style={{ opacity: 0.35, marginBottom: 6 }} />
                <div>Please select a target server above to view and connect to voice channels.</div>
              </div>
            ) : loadingChannels ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
                <RefreshCw size={16} className="spin-anim" style={{ marginBottom: 6 }} />
                <div>Fetching voice channels from Discord...</div>
              </div>
            ) : channels.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
                No voice channels found for this server or account lacks permissions.
              </div>
            ) : (
              channels.map((c) => {
                const isSelected = selectedChannelId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => onSelectChannel(c.id, c.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: isSelected ? 'rgba(59, 130, 246, 0.14)' : 'transparent',
                      color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                      border: isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Volume2 size={15} style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }} />
                      <span style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500 }}>{c.name}</span>
                    </div>
                    {isSelected && <Check size={14} style={{ color: 'var(--primary)' }} />}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 4. Controls: Mute, Deafen, and Connect Action */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--border-light)',
            paddingTop: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Initial Mute Toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={mute}
                onChange={(e) => setMute(e.target.checked)}
                style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {mute ? <MicOff size={14} style={{ color: 'var(--danger)' }} /> : <Mic size={14} />}
                <span>Join Muted</span>
              </span>
            </label>

            {/* Initial Deafen Toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={deaf}
                onChange={(e) => setDeaf(e.target.checked)}
                style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {deaf ? <VolumeX size={14} style={{ color: 'var(--danger)' }} /> : <Volume2 size={14} />}
                <span>Join Deafened</span>
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="button-primary"
              disabled={!selectedGuildId || !selectedChannelId || pickTokens.length === 0}
              onClick={handleJoin}
              style={{
                padding: '10px 22px',
                fontSize: 13,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: !selectedGuildId || !selectedChannelId || pickTokens.length === 0 ? 0.5 : 1,
                cursor: !selectedGuildId || !selectedChannelId || pickTokens.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <Radio size={15} />
              <span>Connect {pickTokens.length > 1 ? `(${pickTokens.length} Accounts)` : ''}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Connections Section */}
      <div
        className="card"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-medium)',
          borderRadius: 12,
          padding: '18px 20px',
          flex: 1,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Active VC Connections</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '1px 7px',
                  borderRadius: 10,
                  background: connected.size > 0 ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-card-hover)',
                  color: connected.size > 0 ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                {connected.size}
              </span>
            </h3>

            {/* Quick Bulk Action Buttons */}
            {connected.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
                <button
                  onClick={() => handleMuteAll(true)}
                  style={{
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="Mute all connected tokens"
                >
                  <MicOff size={12} />
                  <span>Mute All</span>
                </button>

                <button
                  onClick={() => handleDeafenAll(true)}
                  style={{
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="Deafen all connected tokens"
                >
                  <VolumeX size={12} />
                  <span>Deaf All</span>
                </button>

                <button
                  onClick={() => handleOpenScreenShareModal()}
                  style={{
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="Share screen into the voice channel"
                >
                  <Monitor size={12} />
                  <span>Share Screen</span>
                </button>
              </div>
            )}
          </div>

          {connected.size > 0 && (
            <button
              onClick={() => onLeave('')}
              style={{
                background: 'rgba(239, 68, 68, 0.14)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 6,
                padding: '5px 12px',
                color: 'var(--danger)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Force disconnect and recall all tokens from any voice channels"
            >
              <LogOut size={13} />
              <span>Recall All Tokens</span>
            </button>
          )}
        </div>

        {connected.size === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <Radio size={28} style={{ opacity: 0.35, marginBottom: 8 }} />
            <p style={{ margin: 0 }}>No active voice connections. Select a target server and voice channel above to connect.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-light)',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  {/* Account Name and Status Indicators */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{name}</span>
                        {state.isStreaming && (
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 800,
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: '#ef4444',
                              color: '#ffffff',
                              letterSpacing: '0.04em',
                            }}
                          >
                            LIVE
                          </span>
                        )}
                        {state.mute && (
                          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)' }}>
                            MUTED
                          </span>
                        )}
                        {state.deaf && (
                          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(234, 179, 8, 0.15)', color: 'var(--warning)' }}>
                            DEAF
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{tk.slice(0, 16)}...</span>
                    </div>
                  </div>

                  {/* Interactive Dynamic Action Controls per Token */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {/* Mute Toggle Button */}
                    <button
                      onClick={() => handleToggleTokenMute(tk)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border-medium)',
                        background: state.mute ? 'rgba(239, 68, 68, 0.14)' : 'var(--bg-card)',
                        color: state.mute ? 'var(--danger)' : 'var(--text-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                      title={state.mute ? 'Unmute microphone on Discord' : 'Mute microphone on Discord'}
                    >
                      {state.mute ? <MicOff size={14} style={{ color: 'var(--danger)' }} /> : <Mic size={14} />}
                      <span>{state.mute ? 'Unmute' : 'Mute'}</span>
                    </button>

                    {/* Deafen Toggle Button */}
                    <button
                      onClick={() => handleToggleTokenDeaf(tk)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border-medium)',
                        background: state.deaf ? 'rgba(234, 179, 8, 0.14)' : 'var(--bg-card)',
                        color: state.deaf ? 'var(--warning)' : 'var(--text-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                      title={state.deaf ? 'Undeafen audio on Discord' : 'Deafen audio on Discord'}
                    >
                      {state.deaf ? <VolumeX size={14} style={{ color: 'var(--warning)' }} /> : <Volume2 size={14} />}
                      <span>{state.deaf ? 'Undeafen' : 'Deafen'}</span>
                    </button>

                    {/* Screen Share / Go Live Button */}
                    {state.isStreaming ? (
                      <button
                        onClick={() => handleStopScreenshare(tk)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                        title="Stop sharing screen"
                      >
                        <Square size={13} />
                        <span>Stop Stream</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenScreenShareModal(tk)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--border-medium)',
                          background: 'var(--bg-card)',
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                        title="Share your screen or a specific window in the voice channel"
                      >
                        <Monitor size={14} />
                        <span>Share Screen</span>
                      </button>
                    )}

                    {/* Watch Stream Button */}
                    <button
                      onClick={() => handleOpenStreamViewer(tk)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border-medium)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                      title="Open stream viewer to watch channel broadcasts"
                    >
                      <Eye size={14} />
                      <span>Watch</span>
                    </button>

                    {/* Leave Button */}
                    <button
                      onClick={() => onLeave(tk)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: 6,
                        padding: '6px 12px',
                        color: 'var(--danger)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Leave
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
                    background: 'rgba(59, 130, 246, 0.15)',
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
                          boxShadow: isSelected ? '0 0 12px rgba(59, 130, 246, 0.3)' : 'none',
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
      {/* WATCH STREAM VIEWER MODAL                                 */}
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
              maxWidth: isFullscreen ? '100vw' : 880,
              height: isFullscreen ? '100vh' : 'auto',
              maxHeight: isFullscreen ? '100vh' : '88vh',
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
                padding: '12px 18px',
                background: 'rgba(24, 24, 27, 0.95)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#f4f4f5' }}>
                  Live Channel Stream
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 4,
                    background: 'rgba(59, 130, 246, 0.2)',
                    color: '#60a5fa',
                  }}
                >
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
                  onClick={() => setStreamViewerOpen(false)}
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

            {/* Video Player Display Screen */}
            <div
              style={{
                position: 'relative',
                flex: 1,
                minHeight: 380,
                background: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />

              {/* Stream Overlay Info / Placeholder */}
              <div
                style={{
                  position: 'absolute',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  color: '#71717a',
                  textAlign: 'center',
                  padding: 24,
                }}
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#a1a1aa',
                  }}
                >
                  <Tv size={26} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e4e4e7', marginBottom: 4 }}>
                    Connected to Discord Voice Stream
                  </div>
                  <div style={{ fontSize: 12, color: '#a1a1aa' }}>
                    Receiving WebRTC video frames from active streamers in {selectedChannelName || 'this channel'}
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