import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Volume1,
  Repeat,
  Music,
  Upload,
  Plus,
  Trash2,
  Radio,
  Sparkles,
  Flame,
  Trophy,
  Bell,
  Zap,
  ThumbsUp,
  Gamepad2,
  Search,
  FolderOpen,
  Headphones,
  CheckCircle2,
  ArrowRight,
  Disc3,
  Sliders,
  FileAudio,
  Wrench,
  Globe,
  Link,
  Loader2,
  BookmarkPlus,
  ListMusic,
  LayoutGrid,
  List,
} from 'lucide-react';
import type { ViewId } from './Sidebar';

interface PlayViewProps {
  tokens: any[];
  connected: Set<string>;
  onNavigate?: (view: ViewId) => void;
}

export const PlayView: React.FC<PlayViewProps> = ({ tokens, connected, onNavigate }) => {
  const [playerState, setPlayerState] = useState<AudioPlayerState>({
    isPlaying: false,
    isPaused: false,
    currentTime: 0,
    duration: 0,
    volume: 100,
    loop: false,
    trackName: '',
    trackPath: '',
    thumbnail: '',
    author: '',
    sourceType: 'local',
    targetToken: 'all',
  });

  const [library, setLibrary] = useState<AudioTrack[]>([]);
  const [presets, setPresets] = useState<SoundboardPreset[]>([]);
  const [activeTab, setActiveTab] = useState<'online' | 'playlist' | 'soundboard'>('playlist');
  const [playlistViewMode, setPlaylistViewMode] = useState<'grid' | 'table'>('grid');

  // Search & Online Stream State
  const [onlineQuery, setOnlineQuery] = useState('');
  const [onlineResults, setOnlineResults] = useState<OnlineTrackResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [onlineSourceFilter, setOnlineSourceFilter] = useState<'all' | 'youtube' | 'spotify'>('all');
  const [directUrlInput, setDirectUrlInput] = useState('');
  const [isDirectLoading, setIsDirectLoading] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'info' | 'success' | 'error' } | null>(null);

  // Local files search & soundboard
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [localAudioPreview, setLocalAudioPreview] = useState<{ path: string; isPlaying: boolean } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const showNotification = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Load state and library on mount
  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.audioGetState().then((st) => {
      if (st) setPlayerState(st);
    });

    window.electronAPI.audioGetLibrary().then((lib) => {
      if (lib) setLibrary(lib);
    });

    window.electronAPI.audioGetPresets().then((pre) => {
      if (pre) setPresets(pre);
    });

    // Default trending recommendations on mount
    window.electronAPI.audioSearchOnline('Top Gaming Hits 2026', 10).then((res) => {
      if (res && res.length) setOnlineResults(res);
    }).catch(() => {});

    const offAudio = window.electronAPI.onAudioStateChanged((st) => {
      setPlayerState(st);
    });

    return () => {
      offAudio();
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
    };
  }, []);

  // Save library when changed
  const saveLibrary = useCallback((newLib: AudioTrack[]) => {
    setLibrary(newLib);
    window.electronAPI?.audioSaveLibrary(newLib);
  }, []);

  // Handle Online Music Search
  const handleSearchOnline = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = onlineQuery.trim();
    if (!q || !window.electronAPI) return;

    setActiveTab('online');
    setIsSearching(true);
    try {
      const results = await window.electronAPI.audioSearchOnline(q, 18);
      setOnlineResults(results || []);
      if (!results || results.length === 0) {
        showNotification('No songs found. Try a different search term or URL.', 'info');
      }
    } catch (err: any) {
      showNotification('Search failed: ' + err.message, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // Play Online Track
  const handlePlayOnlineTrack = async (track: OnlineTrackResult) => {
    if (!window.electronAPI) return;
    showNotification(`Streaming: ${track.title}`, 'info');
    const res = await window.electronAPI.audioPlay({
      filePath: track.url,
      title: track.title,
      author: track.author,
      thumbnail: track.thumbnail,
      duration: track.duration,
      sourceType: track.source,
      targetToken: playerState.targetToken,
      volume: playerState.volume,
      loop: playerState.loop,
    });
    if (res?.error) {
      showNotification('Failed to play: ' + res.error, 'error');
    }
  };

  // Play Direct URL (YouTube / YouTube Music / Spotify)
  const handlePlayDirectUrl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const url = directUrlInput.trim();
    if (!url || !window.electronAPI) return;

    setIsDirectLoading(true);
    showNotification('Resolving stream URL...', 'info');
    try {
      const found = await window.electronAPI.audioSearchOnline(url, 1);
      if (found && found.length > 0) {
        await handlePlayOnlineTrack(found[0]);
        setDirectUrlInput('');
      } else {
        const res = await window.electronAPI.audioPlay({
          filePath: url,
          title: 'Direct Stream URL',
          sourceType: url.includes('spotify') ? 'spotify' : 'youtube',
          targetToken: playerState.targetToken,
          volume: playerState.volume,
          loop: playerState.loop,
        });
        if (res?.error) {
          showNotification('Playback error: ' + res.error, 'error');
        } else {
          setDirectUrlInput('');
        }
      }
    } catch (err: any) {
      showNotification('Failed to stream URL: ' + err.message, 'error');
    } finally {
      setIsDirectLoading(false);
    }
  };

  // Add Online Track to Playlist
  const handleAddOnlineToPlaylist = (track: OnlineTrackResult) => {
    const existing = library.find((t) => t.filePath === track.url);
    if (existing) {
      showNotification('Track is already in your playlist', 'info');
      return;
    }
    const item: AudioTrack = {
      id: track.id || Buffer.from(track.url).toString('base64'),
      title: track.title,
      filePath: track.url,
      fileName: track.author,
      sizeBytes: 0,
      duration: track.duration,
      ext: track.source === 'spotify' ? 'SPOTIFY' : 'YT-MUSIC',
      thumbnail: track.thumbnail,
      author: track.author,
      sourceType: track.source,
    };
    saveLibrary([item, ...library]);
    showNotification('Added to playlist!', 'success');
  };

  // Select files from native dialog
  const handleAddFiles = useCallback(async () => {
    if (!window.electronAPI) return;
    const added = await window.electronAPI.audioSelectFiles();
    if (added?.length) {
      const existingPaths = new Set(library.map((t) => t.filePath));
      const filtered = added.filter((t) => !existingPaths.has(t.filePath));
      if (filtered.length > 0) {
        const next = [...library, ...filtered];
        saveLibrary(next);
        showNotification(`Added ${filtered.length} track(s) from PC`, 'success');
      }
    }
  }, [library, saveLibrary]);

  // Remove track from library
  const handleRemoveTrack = useCallback(
    (id: string) => {
      const next = library.filter((t) => t.id !== id);
      saveLibrary(next);
      if (playerState.trackPath === library.find((t) => t.id === id)?.filePath) {
        window.electronAPI?.audioStop();
      }
    },
    [library, playerState.trackPath, saveLibrary]
  );

  // Play a track into VC
  const handlePlayTrack = useCallback(
    async (track: AudioTrack | SoundboardPreset) => {
      if (!window.electronAPI) return;
      await window.electronAPI.audioPlay({
        filePath: track.filePath,
        title: track.name || (track as AudioTrack).title,
        thumbnail: (track as AudioTrack).thumbnail,
        author: (track as AudioTrack).author,
        duration: (track as AudioTrack).duration,
        sourceType: (track as AudioTrack).sourceType,
        targetToken: playerState.targetToken,
        volume: playerState.volume,
        loop: playerState.loop,
      });
    },
    [playerState.targetToken, playerState.volume, playerState.loop]
  );

  // Toggle Pause/Resume
  const handleTogglePlayPause = useCallback(async () => {
    if (!window.electronAPI) return;
    if (playerState.isPlaying) {
      if (playerState.isPaused) {
        await window.electronAPI.audioResume();
      } else {
        await window.electronAPI.audioPause();
      }
    } else if (library.length > 0) {
      handlePlayTrack(library[0]);
    }
  }, [playerState.isPlaying, playerState.isPaused, library, handlePlayTrack]);

  // Stop playback
  const handleStop = useCallback(async () => {
    await window.electronAPI?.audioStop();
  }, []);

  // Seek
  const handleSeek = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const sec = Number(e.target.value);
    await window.electronAPI?.audioSeek(sec);
  }, []);

  // Change Volume
  const handleVolumeChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    await window.electronAPI?.audioSetVolume(vol);
  }, []);

  // Toggle Loop
  const handleToggleLoop = useCallback(async () => {
    await window.electronAPI?.audioSetLoop(!playerState.loop);
  }, [playerState.loop]);

  // Change Target Token
  const handleTargetChange = useCallback(async (target: string) => {
    await window.electronAPI?.audioSetTarget(target);
  }, []);

  // Local PC Preview
  const handleTogglePreview = useCallback((filePath: string) => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }

    if (localAudioPreview?.path === filePath && localAudioPreview.isPlaying) {
      setLocalAudioPreview(null);
      return;
    }

    const audio = new Audio(`file://${filePath.replace(/\\/g, '/')}`);
    audio.onended = () => setLocalAudioPreview(null);
    audio.onerror = () => setLocalAudioPreview(null);
    audio.play().catch(() => setLocalAudioPreview(null));
    previewAudioRef.current = audio;
    setLocalAudioPreview({ path: filePath, isPlaying: true });
  }, [localAudioPreview]);

  // Drag & drop files handling
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!window.electronAPI) return;

    const paths: string[] = [];
    if (e.dataTransfer.files) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        if (file.path) paths.push(file.path);
      }
    }

    if (paths.length > 0) {
      const added = await window.electronAPI.audioParseDroppedFiles(paths);
      if (added?.length) {
        const existing = new Set(library.map((t) => t.filePath));
        const filtered = added.filter((t) => !existing.has(t.filePath));
        if (filtered.length > 0) {
          saveLibrary([...library, ...filtered]);
        }
      }
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getPresetIcon = (iconName: string) => {
    switch (iconName) {
      case 'Flame': return <Flame size={18} className="text-orange-400" />;
      case 'Trophy': return <Trophy size={18} className="text-yellow-400" />;
      case 'Bell': return <Bell size={18} className="text-blue-400" />;
      case 'Sparkles': return <Sparkles size={18} className="text-purple-400" />;
      case 'Zap': return <Zap size={18} className="text-amber-400" />;
      case 'Radio': return <Radio size={18} className="text-emerald-400" />;
      case 'ThumbsUp': return <ThumbsUp size={18} className="text-pink-400" />;
      case 'Gamepad2': return <Gamepad2 size={18} className="text-indigo-400" />;
      default: return <Sparkles size={18} className="text-blue-400" />;
    }
  };

  const connectedList = tokens.filter((t) => connected.has(t.token));

  const filteredOnlineResults = onlineResults.filter((r) => {
    if (onlineSourceFilter === 'all') return true;
    return r.source === onlineSourceFilter;
  });

  const filteredLibrary = library.filter((t) =>
    t.title.toLowerCase().includes(localSearchQuery.toLowerCase()) ||
    t.fileName.toLowerCase().includes(localSearchQuery.toLowerCase())
  );

  const filteredPresets = presets.filter((p) => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (localSearchQuery && !p.name.toLowerCase().includes(localSearchQuery.toLowerCase())) return false;
    return true;
  });

  const categories = ['all', ...Array.from(new Set(presets.map((p) => p.category)))];

  return (
    <div
      className="play-container fade-in"
      style={{
        padding: '24px 28px',
        overflowY: 'auto',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Floating Notification */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 28,
            zIndex: 9999,
            padding: '10px 18px',
            borderRadius: 10,
            background:
              notification.type === 'success'
                ? 'rgba(16, 185, 129, 0.95)'
                : notification.type === 'error'
                ? 'rgba(239, 68, 68, 0.95)'
                : 'rgba(59, 130, 246, 0.95)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <Radio size={16} />}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Top Banner & VC Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '16px 20px',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: connected.size > 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(234, 179, 8, 0.15)',
              border: `1px solid ${connected.size > 0 ? 'rgba(59, 130, 246, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
              color: connected.size > 0 ? 'var(--accent)' : 'var(--warning)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {connected.size > 0 ? <Radio size={22} className="pulse-icon" /> : <Headphones size={22} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                {connected.size > 0 ? 'Voice Audio Streamer & Soundboard' : 'Voice Disconnected'}
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: connected.size > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: connected.size > 0 ? 'var(--success)' : 'var(--danger)',
                  border: `1px solid ${connected.size > 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                }}
              >
                {connected.size} Connected in VC
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              {connected.size > 0
                ? 'Stream YouTube Music, Spotify tracks, and local audio directly into your active voice channels.'
                : 'Connect your tokens to a voice channel in the Connect tab to begin broadcasting audio into Discord.'}
            </p>
          </div>
        </div>

        {connected.size === 0 && onNavigate && (
          <button
            className="btn btn-primary"
            onClick={() => onNavigate('connect')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 13 }}
          >
            <span>Go to Connect</span>
            <ArrowRight size={14} />
          </button>
        )}

        {connected.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Broadcast Target:</span>
            <select
              value={playerState.targetToken}
              onChange={(e) => handleTargetChange(e.target.value)}
              className="select-input"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: 'var(--text-main)',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">🔊 All Connected Tokens ({connected.size})</option>
              {connectedList.map((t) => (
                <option key={t.token} value={t.token}>
                  👤 {t.username || `${t.token.slice(0, 8)}...`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Master Player Deck */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, var(--bg-card) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: 16,
          padding: '20px 24px',
          boxShadow: '0 8px 24px -8px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: 1 }}>
            {/* Album / Track Art Preview */}
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 12,
                background: playerState.thumbnail
                  ? `url(${playerState.thumbnail}) center/cover no-repeat`
                  : playerState.isPlaying && !playerState.isPaused
                  ? 'linear-gradient(135deg, var(--accent) 0%, #2563eb 100%)'
                  : 'rgba(255, 255, 255, 0.06)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: playerState.isPlaying && !playerState.isPaused
                  ? '0 0 20px rgba(59, 130, 246, 0.45)'
                  : 'none',
                flexShrink: 0,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {!playerState.thumbnail && (
                <Disc3
                  size={28}
                  style={{
                    animation: playerState.isPlaying && !playerState.isPaused ? 'spin 3s linear infinite' : 'none',
                  }}
                />
              )}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    margin: 0,
                    color: playerState.trackName ? 'var(--text-main)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 380,
                  }}
                >
                  {playerState.trackName || 'No track streaming'}
                </h3>

                {/* Source Badge */}
                {playerState.sourceType === 'spotify' && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 6,
                      background: 'rgba(34, 197, 94, 0.2)',
                      color: '#22c55e',
                      textTransform: 'uppercase',
                    }}
                  >
                    Spotify
                  </span>
                )}
                {playerState.sourceType === 'youtube' && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 6,
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#ef4444',
                      textTransform: 'uppercase',
                    }}
                  >
                    YouTube Music
                  </span>
                )}

                {playerState.isPlaying && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 6,
                      background: playerState.isPaused ? 'rgba(234, 179, 8, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                      color: playerState.isPaused ? 'var(--warning)' : 'var(--success)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {playerState.isPaused ? 'Paused' : 'Streaming in VC'}
                  </span>
                )}
              </div>

              <p style={{ margin: '3px 0 0 0', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {playerState.author ? `${playerState.author} • ` : ''}
                {playerState.isPlaying
                  ? `Broadcasting via ${playerState.targetToken === 'all' ? `All Connected Tokens (${connected.size})` : `Token ${playerState.targetToken.slice(0, 8)}...`}`
                  : 'Search YouTube Music or Spotify below or paste any music link to start streaming.'}
              </p>
            </div>
          </div>

          {/* Visualizer Wave Bars */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 26 }}>
            {[40, 70, 90, 60, 100, 50, 80, 45, 95, 65, 35, 75].map((h, i) => (
              <div
                key={i}
                style={{
                  width: 3,
                  height: playerState.isPlaying && !playerState.isPaused ? `${h}%` : '15%',
                  background: playerState.isPlaying && !playerState.isPaused ? 'var(--accent)' : 'var(--border)',
                  borderRadius: 2,
                  transition: 'height 0.2s ease',
                  animation: playerState.isPlaying && !playerState.isPaused ? `pulseWave 0.8s ease-in-out infinite alternate ${i * 0.08}s` : 'none',
                }}
              />
            ))}
          </div>
        </div>

        {/* Progress Scrub Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)', minWidth: 38 }}>
              {formatTime(playerState.currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={playerState.duration || 100}
              value={playerState.currentTime}
              onChange={handleSeek}
              disabled={!playerState.isPlaying}
              style={{
                flex: 1,
                cursor: playerState.isPlaying ? 'pointer' : 'default',
                accentColor: 'var(--accent)',
                height: 5,
              }}
            />
            <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)', minWidth: 38, textAlign: 'right' }}>
              {formatTime(playerState.duration)}
            </span>
          </div>
        </div>

        {/* Player Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleTogglePlayPause}
              className="btn btn-primary"
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
              }}
              title={playerState.isPlaying && !playerState.isPaused ? 'Pause' : 'Play'}
            >
              {playerState.isPlaying && !playerState.isPaused ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
            </button>

            <button
              onClick={handleStop}
              className="btn btn-secondary"
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              disabled={!playerState.isPlaying}
              title="Stop"
            >
              <Square size={16} />
            </button>

            <button
              onClick={handleToggleLoop}
              className="btn"
              style={{
                background: playerState.loop ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-input)',
                border: `1px solid ${playerState.loop ? 'var(--accent)' : 'var(--border)'}`,
                color: playerState.loop ? 'var(--accent)' : 'var(--text-muted)',
                width: 38,
                height: 38,
                borderRadius: '50%',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={playerState.loop ? 'Loop Enabled' : 'Loop Disabled'}
            >
              <Repeat size={16} />
            </button>
          </div>

          {/* Volume Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
            {playerState.volume === 0 ? (
              <VolumeX size={18} style={{ color: 'var(--text-muted)' }} />
            ) : playerState.volume > 100 ? (
              <Volume2 size={18} style={{ color: 'var(--accent)' }} />
            ) : (
              <Volume1 size={18} style={{ color: 'var(--text-muted)' }} />
            )}
            <input
              type="range"
              min={0}
              max={200}
              value={playerState.volume}
              onChange={handleVolumeChange}
              style={{
                flex: 1,
                accentColor: 'var(--accent)',
                height: 5,
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', minWidth: 38 }}>
              {playerState.volume}%
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('online')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'online' ? 'var(--accent)' : 'var(--bg-input)',
              color: activeTab === 'online' ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${activeTab === 'online' ? 'var(--accent)' : 'var(--border)'}`,
              transition: 'all 0.2s ease',
            }}
          >
            <Globe size={16} />
            <span>YouTube & Spotify Music</span>
          </button>

          <button
            onClick={() => setActiveTab('playlist')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'playlist' ? 'var(--accent)' : 'var(--bg-input)',
              color: activeTab === 'playlist' ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${activeTab === 'playlist' ? 'var(--accent)' : 'var(--border)'}`,
              transition: 'all 0.2s ease',
            }}
          >
            <ListMusic size={16} />
            <span>Playlist & PC Tracks ({library.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('soundboard')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'soundboard' ? 'var(--accent)' : 'var(--bg-input)',
              color: activeTab === 'soundboard' ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${activeTab === 'soundboard' ? 'var(--accent)' : 'var(--border)'}`,
              transition: 'all 0.2s ease',
            }}
          >
            <Sparkles size={16} />
            <span>Soundboard ({presets.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: YOUTUBE & SPOTIFY ONLINE MUSIC SEARCH */}
      {activeTab === 'online' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Quick Direct URL Box & Search Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 12,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '16px 20px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Search size={14} color="var(--accent)" />
                Search Songs or Artists on YouTube Music / Spotify
              </span>
              <form onSubmit={handleSearchOnline} style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Enter track name, artist (e.g. Alan Walker - Faded, Weeknd, Lo-Fi beats)..."
                  value={onlineQuery}
                  onChange={(e) => setOnlineQuery(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '9px 14px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-main)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSearching}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', fontSize: 13, fontWeight: 700 }}
                >
                  {isSearching ? <Loader2 size={16} className="spin-icon" /> : <Search size={16} />}
                  <span>Search</span>
                </button>
              </form>
            </div>

            {/* Direct URL Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderLeft: '1px solid var(--border)', paddingLeft: 16, minWidth: 320 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Link size={14} color="#ef4444" />
                Paste YouTube / Spotify URL
              </span>
              <form onSubmit={handlePlayDirectUrl} style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="https://music.youtube.com/... or spotify.com/..."
                  value={directUrlInput}
                  onChange={(e) => setDirectUrlInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-main)',
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  className="btn"
                  disabled={isDirectLoading || !directUrlInput.trim()}
                  style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '9px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 8,
                  }}
                >
                  {isDirectLoading ? <Loader2 size={14} className="spin-icon" /> : <Play size={14} />}
                  <span>Play URL</span>
                </button>
              </form>
            </div>
          </div>

          {/* Quick Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setOnlineSourceFilter('all')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 16,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: onlineSourceFilter === 'all' ? 'var(--accent)' : 'var(--bg-card)',
                  color: onlineSourceFilter === 'all' ? '#fff' : 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}
              >
                All Sources
              </button>
              <button
                onClick={() => setOnlineSourceFilter('youtube')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 16,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: onlineSourceFilter === 'youtube' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-card)',
                  color: onlineSourceFilter === 'youtube' ? '#ef4444' : 'var(--text-muted)',
                  border: `1px solid ${onlineSourceFilter === 'youtube' ? '#ef4444' : 'var(--border)'}`,
                }}
              >
                🔴 YouTube Music
              </button>
              <button
                onClick={() => setOnlineSourceFilter('spotify')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 16,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: onlineSourceFilter === 'spotify' ? 'rgba(34, 197, 94, 0.2)' : 'var(--bg-card)',
                  color: onlineSourceFilter === 'spotify' ? '#22c55e' : 'var(--text-muted)',
                  border: `1px solid ${onlineSourceFilter === 'spotify' ? '#22c55e' : 'var(--border)'}`,
                }}
              >
                🟢 Spotify
              </button>
            </div>

            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Showing {filteredOnlineResults.length} track results
            </span>
          </div>

          {/* Results Grid */}
          {isSearching ? (
            <div style={{ padding: '60px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Loader2 size={36} className="spin-icon" style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>Searching YouTube Music & Spotify...</span>
            </div>
          ) : filteredOnlineResults.length === 0 ? (
            <div
              style={{
                border: '1px dashed var(--border)',
                background: 'var(--bg-card)',
                borderRadius: 14,
                padding: '40px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Music size={32} color="var(--text-muted)" />
              <h4 style={{ margin: 0, fontSize: 15, color: 'var(--text-main)' }}>No search results</h4>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                Type a song name in the search box above or paste any YouTube / Spotify URL.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 14,
              }}
            >
              {filteredOnlineResults.map((track) => {
                const isCurrent = playerState.trackPath === track.url && playerState.isPlaying;

                return (
                  <div
                    key={track.id}
                    style={{
                      background: isCurrent ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                      border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 14,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      boxShadow: isCurrent ? '0 0 16px rgba(59, 130, 246, 0.25)' : 'none',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                    }}
                    className="hover-glow"
                  >
                    {/* Top image & badge */}
                    <div
                      style={{
                        position: 'relative',
                        height: 130,
                        borderRadius: 10,
                        overflow: 'hidden',
                        background: '#0a0a0a',
                      }}
                    >
                      <img
                        src={track.thumbnail}
                        alt={track.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          (e.target as any).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23111" width="100" height="100"/></svg>';
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 8,
                          right: 8,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'rgba(0, 0, 0, 0.8)',
                          color: '#fff',
                          fontSize: 11,
                          fontFamily: 'monospace',
                          fontWeight: 700,
                        }}
                      >
                        {track.durationFormatted}
                      </span>

                      {/* Source tag */}
                      <span
                        style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: track.source === 'spotify' ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                        }}
                      >
                        {track.source === 'spotify' ? 'Spotify' : 'YouTube'}
                      </span>
                    </div>

                    {/* Meta info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: isCurrent ? 'var(--accent)' : 'var(--text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={track.title}
                      >
                        {track.title}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {track.author} {track.ago ? `• ${track.ago}` : ''}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
                      <button
                        onClick={() => handlePlayOnlineTrack(track)}
                        className="btn"
                        style={{
                          flex: 1,
                          background: isCurrent ? 'var(--accent)' : 'rgba(16, 185, 129, 0.15)',
                          color: isCurrent ? '#fff' : 'var(--success)',
                          border: `1px solid ${isCurrent ? 'var(--accent)' : 'rgba(16, 185, 129, 0.3)'}`,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 8,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          cursor: 'pointer',
                        }}
                      >
                        <Play size={13} />
                        <span>{isCurrent ? 'Playing' : 'Play to VC'}</span>
                      </button>

                      <button
                        onClick={() => handleAddOnlineToPlaylist(track)}
                        className="btn"
                        style={{
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                          padding: '6px 10px',
                          borderRadius: 8,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        title="Save to Playlist"
                      >
                        <BookmarkPlus size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PLAYLIST & LOCAL MUSIC */}
      {activeTab === 'playlist' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={handleAddFiles}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700 }}
              >
                <Upload size={16} />
                <span>Add Music / Videos from PC</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Local Search Input */}
              <div style={{ position: 'relative', minWidth: 220 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter saved files..."
                  value={localSearchQuery}
                  onChange={(e) => setLocalSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 12px 7px 30px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-main)',
                    fontSize: 12,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* View Toggle: Grid / Table */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 2,
                }}
              >
                <button
                  onClick={() => setPlaylistViewMode('grid')}
                  style={{
                    background: playlistViewMode === 'grid' ? 'var(--accent)' : 'transparent',
                    color: playlistViewMode === 'grid' ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: 6,
                    padding: '5px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Grid View (Compact)"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  onClick={() => setPlaylistViewMode('table')}
                  style={{
                    background: playlistViewMode === 'table' ? 'var(--accent)' : 'transparent',
                    color: playlistViewMode === 'table' ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: 6,
                    padding: '5px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="List / Table View"
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Drag and Drop Zone / Empty State */}
          {library.length === 0 ? (
            <div
              onClick={handleAddFiles}
              style={{
                border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
                background: isDragging ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
                borderRadius: 16,
                padding: '48px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FolderOpen size={28} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                No Audio or Video Tracks Saved Yet
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, maxWidth: 420 }}>
                Click here or drag audio/video files from your PC into this window, or search and bookmark tracks from YouTube & Spotify.
              </p>
            </div>
          ) : playlistViewMode === 'grid' ? (
            /* COMPACT GRID FORMAT (DEFAULT) */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                gap: 12,
              }}
            >
              {filteredLibrary.map((track, idx) => {
                const isCurrent = playerState.trackPath === track.filePath && playerState.isPlaying;
                const isPreviewing = localAudioPreview?.path === track.filePath && localAudioPreview.isPlaying;

                return (
                  <div
                    key={track.id || idx}
                    style={{
                      background: isCurrent ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                      border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 12,
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      boxShadow: isCurrent ? '0 0 14px rgba(59, 130, 246, 0.25)' : 'none',
                      transition: 'all 0.18s ease',
                      position: 'relative',
                    }}
                    className="hover-glow"
                  >
                    {/* Thumbnail / Header Box */}
                    <div
                      style={{
                        position: 'relative',
                        height: 96,
                        borderRadius: 8,
                        overflow: 'hidden',
                        background: track.thumbnail
                          ? '#0a0a0a'
                          : 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(147, 51, 234, 0.2) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {track.thumbnail ? (
                        <img
                          src={track.thumbnail}
                          alt={track.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.target as any).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--accent)' }}>
                          <FileAudio size={28} />
                        </div>
                      )}

                      {/* Duration Tag */}
                      {track.duration > 0 && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: 6,
                            right: 6,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: 'rgba(0, 0, 0, 0.8)',
                            color: '#fff',
                            fontSize: 10,
                            fontFamily: 'monospace',
                            fontWeight: 700,
                          }}
                        >
                          {formatTime(track.duration)}
                        </span>
                      )}

                      {/* Format Badge */}
                      <span
                        style={{
                          position: 'absolute',
                          top: 6,
                          left: 6,
                          padding: '1px 5px',
                          borderRadius: 4,
                          background:
                            track.ext === 'SPOTIFY'
                              ? 'rgba(34, 197, 94, 0.9)'
                              : track.ext === 'YT-MUSIC'
                              ? 'rgba(239, 68, 68, 0.9)'
                              : 'rgba(59, 130, 246, 0.85)',
                          color: '#fff',
                          fontSize: 9,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                        }}
                      >
                        {track.ext || 'AUDIO'}
                      </span>
                    </div>

                    {/* Meta info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: isCurrent ? 'var(--accent)' : 'var(--text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={track.title}
                      >
                        {track.title}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {track.author || track.fileName || (track.sizeBytes > 0 ? formatSize(track.sizeBytes) : '')}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
                      <button
                        onClick={() => handlePlayTrack(track)}
                        className="btn"
                        style={{
                          flex: 1,
                          background: isCurrent ? 'var(--accent)' : 'rgba(16, 185, 129, 0.15)',
                          color: isCurrent ? '#fff' : 'var(--success)',
                          border: `1px solid ${isCurrent ? 'var(--accent)' : 'rgba(16, 185, 129, 0.3)'}`,
                          padding: '5px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                          borderRadius: 6,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          cursor: 'pointer',
                        }}
                        title="Stream to Discord Voice"
                      >
                        <Play size={12} />
                        <span>{isCurrent ? 'Playing' : 'Play VC'}</span>
                      </button>

                      {/* Local PC Preview */}
                      {!track.filePath.startsWith('http') && (
                        <button
                          onClick={() => handleTogglePreview(track.filePath)}
                          className="btn"
                          style={{
                            background: isPreviewing ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-input)',
                            color: isPreviewing ? 'var(--accent)' : 'var(--text-muted)',
                            border: '1px solid var(--border)',
                            padding: '5px 6px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title={isPreviewing ? 'Stop Local Preview' : 'Preview on PC Speakers'}
                        >
                          <Headphones size={12} />
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => handleRemoveTrack(track.id)}
                        className="btn"
                        style={{
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          border: 'none',
                          padding: '5px 6px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Remove Track"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* TABLE / LIST VIEW */
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr 100px 80px 140px',
                  padding: '10px 18px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-muted)',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span style={{ width: 28, textAlign: 'center' }}>#</span>
                <span>Title</span>
                <span>Size</span>
                <span>Duration</span>
                <span style={{ textAlign: 'right' }}>Actions</span>
              </div>

              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {filteredLibrary.map((track, idx) => {
                  const isCurrent = playerState.trackPath === track.filePath && playerState.isPlaying;
                  const isPreviewing = localAudioPreview?.path === track.filePath && localAudioPreview.isPlaying;

                  return (
                    <div
                      key={track.id || idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr 100px 80px 140px',
                        padding: '12px 18px',
                        borderBottom: '1px solid var(--border)',
                        fontSize: 13,
                        color: 'var(--text-main)',
                        alignItems: 'center',
                        gap: 12,
                        background: isCurrent ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <span style={{ width: 28, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                        {idx + 1}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: isCurrent ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-input)',
                            color: isCurrent ? 'var(--accent)' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <FileAudio size={16} />
                        </div>
                        <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, color: isCurrent ? 'var(--accent)' : 'var(--text-main)' }}>
                            {track.title}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {track.author || track.fileName}
                          </div>
                        </div>
                      </div>

                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {track.sizeBytes > 0 ? formatSize(track.sizeBytes) : 'Online'}
                      </span>

                      <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {formatTime(track.duration)}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        {/* Play into VC */}
                        <button
                          onClick={() => handlePlayTrack(track)}
                          className="btn"
                          style={{
                            background: isCurrent ? 'var(--accent)' : 'rgba(16, 185, 129, 0.15)',
                            color: isCurrent ? '#fff' : 'var(--success)',
                            border: `1px solid ${isCurrent ? 'var(--accent)' : 'rgba(16, 185, 129, 0.3)'}`,
                            padding: '4px 10px',
                            fontSize: 12,
                            fontWeight: 700,
                            borderRadius: 6,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title="Stream to Voice Channel"
                        >
                          <Play size={12} />
                          <span>{isCurrent ? 'Playing' : 'Play VC'}</span>
                        </button>

                        {/* Local PC Preview */}
                        {!track.filePath.startsWith('http') && (
                          <button
                            onClick={() => handleTogglePreview(track.filePath)}
                            className="btn"
                            style={{
                              background: isPreviewing ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-input)',
                              color: isPreviewing ? 'var(--accent)' : 'var(--text-muted)',
                              border: '1px solid var(--border)',
                              padding: '4px 8px',
                              borderRadius: 6,
                            }}
                            title={isPreviewing ? 'Stop Local Preview' : 'Preview on PC Speakers'}
                          >
                            <Headphones size={13} />
                          </button>
                        )}

                        {/* Remove */}
                        <button
                          onClick={() => handleRemoveTrack(track.id)}
                          className="btn"
                          style={{
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            border: 'none',
                            padding: '4px 6px',
                            borderRadius: 6,
                            cursor: 'pointer',
                          }}
                          title="Remove Track"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Soundboard Content */}
      {activeTab === 'soundboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: selectedCategory === cat ? 'var(--accent)' : 'var(--bg-input)',
                  color: selectedCategory === cat ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${selectedCategory === cat ? 'var(--accent)' : 'var(--border)'}`,
                  textTransform: 'capitalize',
                  transition: 'all 0.15s ease',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Soundboard Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 14,
            }}
          >
            {filteredPresets.map((preset) => {
              const isPlaying = playerState.trackPath === preset.filePath && playerState.isPlaying;

              return (
                <div
                  key={preset.id}
                  onClick={() => handlePlayTrack(preset)}
                  style={{
                    background: isPlaying ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                    border: `1px solid ${isPlaying ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 14,
                    padding: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    boxShadow: isPlaying ? '0 0 16px rgba(59, 130, 246, 0.25)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                  className="soundboard-card hover-glow"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: 'var(--bg-input)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {getPresetIcon(preset.icon)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {preset.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {preset.category} • {preset.duration}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: isPlaying ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
                      color: isPlaying ? '#fff' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Play size={14} style={{ marginLeft: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
