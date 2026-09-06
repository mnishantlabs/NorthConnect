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

  // Add sound to soundboard
  const handleAddSoundboardSound = useCallback(async () => {
    if (!window.electronAPI) return;
    const added = await window.electronAPI.audioSelectFiles();
    if (added?.length) {
      const existing = new Set(presets.map((p) => p.filePath));
      const filtered = added.filter((t) => !existing.has(t.filePath));
      if (filtered.length > 0) {
        const newPresets: SoundboardPreset[] = filtered.map((f, i) => ({
          id: `sfx_${Date.now()}_${i}`,
          name: f.title || f.fileName,
          category: 'Custom SFX',
          icon: 'Flame',
          duration: f.duration ? `${Math.floor(f.duration / 60)}:${Math.floor(f.duration % 60).toString().padStart(2, '0')}` : '0:05',
          filePath: f.filePath,
        }));
        const next = [...presets, ...newPresets];
        setPresets(next);
        window.electronAPI.audioSavePresets(next);
        showNotification(`Added ${newPresets.length} sound(s) to Soundboard!`, 'success');
      }
    }
  }, [presets]);

  // Remove sound from soundboard
  const handleRemoveSoundboardSound = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const next = presets.filter((p) => p.id !== id);
      setPresets(next);
      window.electronAPI?.audioSavePresets(next);
      showNotification('Sound removed from Soundboard', 'info');
    },
    [presets]
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
        padding: '20px 24px',
        overflow: 'hidden',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
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
            top: 20,
            right: 24,
            zIndex: 9999,
            padding: '8px 16px',
            borderRadius: 6,
            background:
              notification.type === 'success'
                ? 'rgba(16, 185, 129, 0.95)'
                : notification.type === 'error'
                ? 'rgba(239, 68, 68, 0.95)'
                : 'rgba(88, 101, 242, 0.95)',
            color: '#fff',
            fontSize: 12.5,
            fontWeight: 600,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {notification.type === 'success' ? <CheckCircle2 size={15} /> : <Radio size={15} />}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Overview Header (Fixed at top) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, flexShrink: 0 }}>
        <div>
          <h1
            style={{
              fontSize: '20px',
              fontWeight: 800,
              margin: '0 0 2px 0',
              color: 'var(--text-primary)',
              letterSpacing: '-0.025em',
            }}
          >
            Soundboard & Media Player
          </h1>
          <p
            style={{
              fontSize: '11.5px',
              color: 'var(--text-muted)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>High-fidelity audio stream</span>
            <span>·</span>
            <span>Low-latency Opus encoder</span>
            <span>·</span>
            <span>Multi-channel broadcast</span>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {connected.size === 0 && onNavigate && (
            <button
              className="button-primary"
              onClick={() => onNavigate('connect')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 11.5,
                fontWeight: 700,
                borderRadius: 6,
                boxShadow: '0 2px 8px var(--primary-glow)',
                cursor: 'pointer',
              }}
            >
              <span>Connect Voice</span>
              <ArrowRight size={12} />
            </button>
          )}

          {connected.size > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--bg-card)',
                padding: '4px 10px',
                borderRadius: 6,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Target:</span>
              <select
                value={playerState.targetToken}
                onChange={(e) => handleTargetChange(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 11.5,
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="all" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                  All Connected Accounts ({connected.size})
                </option>
                {connectedList.map((t) => (
                  <option key={t.token} value={t.token} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                    {t.username || `${t.token.slice(0, 8)}...`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Master Player Deck (Fixed at top) */}
      <div
        className="card"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-panel)',
          borderRadius: 10,
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          boxShadow: 'var(--shadow-card)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            {/* Album / Track Art Preview */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 6,
                background: playerState.thumbnail
                  ? `url(${playerState.thumbnail}) center/cover no-repeat`
                  : playerState.isPlaying && !playerState.isPaused
                  ? 'var(--primary)'
                  : 'var(--bg-main)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
                position: 'relative',
                border: '1px solid var(--border-light)',
              }}
            >
              {!playerState.thumbnail && (
                <Disc3
                  size={20}
                  style={{
                    animation: playerState.isPlaying && !playerState.isPaused ? 'spin 3s linear infinite' : 'none',
                  }}
                />
              )}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <h3
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    margin: 0,
                    color: playerState.trackName ? 'var(--text-primary)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 380,
                  }}
                >
                  {playerState.trackName || 'No track playing'}
                </h3>

                {/* Source Badge */}
                {playerState.sourceType === 'spotify' && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: 'rgba(34, 197, 94, 0.15)',
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
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                      textTransform: 'uppercase',
                    }}
                  >
                    YouTube
                  </span>
                )}

                {playerState.isPlaying && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: playerState.isPaused ? 'rgba(234, 179, 8, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: playerState.isPaused ? 'var(--warning)' : 'var(--success)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {playerState.isPaused ? 'Paused' : 'Playing'}
                  </span>
                )}
              </div>

              <p style={{ margin: '1px 0 0 0', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {playerState.author ? `${playerState.author} • ` : ''}
                {playerState.isPlaying
                  ? `Broadcasting via ${playerState.targetToken === 'all' ? `All Accounts (${connected.size})` : `Selected Account`}`
                  : 'Search YouTube Music or Spotify below or add local files to begin streaming.'}
              </p>
            </div>
          </div>

          {/* Controls: Play/Pause, Stop, Loop, Volume */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={handleTogglePlayPause}
                className="button-primary"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title={playerState.isPlaying && !playerState.isPaused ? 'Pause' : 'Play'}
              >
                {playerState.isPlaying && !playerState.isPaused ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: 1 }} />}
              </button>

              <button
                onClick={handleStop}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--bg-main)',
                  border: 'none',
                  boxShadow: 'var(--shadow-sm)',
                  color: 'var(--text-primary)',
                  cursor: !playerState.isPlaying ? 'not-allowed' : 'pointer',
                  opacity: !playerState.isPlaying ? 0.5 : 1,
                }}
                disabled={!playerState.isPlaying}
                title="Stop"
              >
                <Square size={12} />
              </button>

              <button
                onClick={handleToggleLoop}
                style={{
                  background: playerState.loop ? 'rgba(88, 101, 242, 0.15)' : 'var(--bg-main)',
                  border: 'none',
                  boxShadow: 'var(--shadow-sm)',
                  color: playerState.loop ? 'var(--primary)' : 'var(--text-muted)',
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title={playerState.loop ? 'Loop Enabled' : 'Loop Disabled'}
              >
                <Repeat size={13} />
              </button>
            </div>

            {/* Volume Slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 140 }}>
              {playerState.volume === 0 ? (
                <VolumeX size={14} style={{ color: 'var(--text-muted)' }} />
              ) : (
                <Volume2 size={14} style={{ color: 'var(--primary)' }} />
              )}
              <input
                type="range"
                min={0}
                max={200}
                value={playerState.volume}
                onChange={handleVolumeChange}
                style={{
                  flex: 1,
                  accentColor: 'var(--primary)',
                  height: 4,
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', minWidth: 30 }}>
                {playerState.volume}%
              </span>
            </div>
          </div>
        </div>

        {/* Progress Scrub Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--text-muted)', minWidth: 30 }}>
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
              accentColor: 'var(--primary)',
              height: 4,
            }}
          />
          <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--text-muted)', minWidth: 30, textAlign: 'right' }}>
            {formatTime(playerState.duration)}
          </span>
        </div>
      </div>

      {/* Segmented Navigation Tabs (Fixed at top) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-card)',
            border: 'none',
            boxShadow: 'var(--shadow-sm)',
            borderRadius: 6,
            padding: 3,
            gap: 2,
          }}
        >
          <button
            onClick={() => setActiveTab('online')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'online' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'online' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              transition: 'background-color 0.12s ease',
            }}
          >
            <Globe size={13} />
            <span>YouTube & Spotify</span>
          </button>

          <button
            onClick={() => setActiveTab('playlist')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'playlist' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'playlist' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              transition: 'background-color 0.12s ease',
            }}
          >
            <ListMusic size={13} />
            <span>Playlist & PC Files ({library.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('soundboard')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'soundboard' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'soundboard' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              transition: 'background-color 0.12s ease',
            }}
          >
            <Sparkles size={13} />
            <span>Soundboard ({presets.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: YOUTUBE & SPOTIFY ONLINE MUSIC SEARCH             */}
      {/* ========================================================= */}
      {activeTab === 'online' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
          {/* Quick Direct URL Box & Search Bar (Fixed) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 12,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-panel)',
              borderRadius: 10,
              padding: '10px 14px',
              boxShadow: 'var(--shadow-card)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Search size={12} style={{ color: 'var(--primary)' }} />
                Search YouTube Music or Spotify
              </span>
              <form onSubmit={handleSearchOnline} style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  placeholder="Song name or artist (e.g. Alan Walker, Weeknd)..."
                  value={onlineQuery}
                  onChange={(e) => setOnlineQuery(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    background: 'var(--bg-main)',
                    border: 'none',
                    boxShadow: 'var(--shadow-sm)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  className="button-primary"
                  disabled={isSearching}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: 12, fontWeight: 700, borderRadius: 6 }}
                >
                  {isSearching ? <Loader2 size={13} className="spin-icon" /> : <Search size={13} />}
                  <span>Search</span>
                </button>
              </form>
            </div>

            {/* Direct URL Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderLeft: '1px solid var(--border-light)', paddingLeft: 12, minWidth: 260 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Link size={12} style={{ color: '#ef4444' }} />
                Paste URL
              </span>
              <form onSubmit={handlePlayDirectUrl} style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  placeholder="https://music.youtube.com/..."
                  value={directUrlInput}
                  onChange={(e) => setDirectUrlInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    background: 'var(--bg-main)',
                    border: 'none',
                    boxShadow: 'var(--shadow-sm)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: 11.5,
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  className="button-primary"
                  disabled={isDirectLoading || !directUrlInput.trim()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 10px',
                    fontSize: 11.5,
                    fontWeight: 700,
                    borderRadius: 6,
                  }}
                >
                  {isDirectLoading ? <Loader2 size={12} className="spin-icon" /> : <Play size={12} />}
                  <span>Play</span>
                </button>
              </form>
            </div>
          </div>

          {/* Source Filter Pills (Fixed) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setOnlineSourceFilter('all')}
                style={{
                  padding: '3px 9px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: onlineSourceFilter === 'all' ? 'var(--primary)' : 'var(--bg-card)',
                  color: onlineSourceFilter === 'all' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                All Sources
              </button>
              <button
                onClick={() => setOnlineSourceFilter('youtube')}
                style={{
                  padding: '3px 9px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: onlineSourceFilter === 'youtube' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-card)',
                  color: onlineSourceFilter === 'youtube' ? '#ef4444' : 'var(--text-secondary)',
                  border: 'none',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                YouTube
              </button>
              <button
                onClick={() => setOnlineSourceFilter('spotify')}
                style={{
                  padding: '3px 9px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: onlineSourceFilter === 'spotify' ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-card)',
                  color: onlineSourceFilter === 'spotify' ? '#22c55e' : 'var(--text-secondary)',
                  border: 'none',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                Spotify
              </button>
            </div>

            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {filteredOnlineResults.length} tracks found
            </span>
          </div>

          {/* Results Grid (ONLY THIS SCROLLS!) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              paddingRight: 4,
            }}
          >
            {isSearching ? (
              <div style={{ padding: '48px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <Loader2 size={26} className="spin-icon" style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 500 }}>Searching tracks...</span>
              </div>
            ) : filteredOnlineResults.length === 0 ? (
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-panel)',
                  borderRadius: 10,
                  padding: '32px 20px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Music size={26} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                <h4 style={{ margin: 0, fontSize: 13.5, color: 'var(--text-primary)' }}>No search results</h4>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)' }}>
                  Type a song name in the search box above or paste any YouTube / Spotify URL.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 10,
                }}
              >
                {filteredOnlineResults.map((track) => {
                  const isCurrent = playerState.trackPath === track.url && playerState.isPlaying;

                  return (
                    <div
                      key={track.id}
                      style={{
                        background: 'var(--bg-card)',
                        border: isCurrent ? '1px solid var(--primary)' : '1px solid var(--border-panel)',
                        borderRadius: 8,
                        padding: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        boxShadow: 'var(--shadow-card)',
                      }}
                    >
                      {/* Top image & badge */}
                      <div
                        style={{
                          position: 'relative',
                          height: 100,
                          borderRadius: 6,
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
                            bottom: 4,
                            right: 4,
                            padding: '1px 4px',
                            borderRadius: 3,
                            background: 'rgba(0, 0, 0, 0.8)',
                            color: '#fff',
                            fontSize: 9.5,
                            fontFamily: 'monospace',
                            fontWeight: 600,
                          }}
                        >
                          {track.durationFormatted}
                        </span>

                        {/* Source tag */}
                        <span
                          style={{
                            position: 'absolute',
                            top: 4,
                            left: 4,
                            padding: '1px 5px',
                            borderRadius: 3,
                            background: track.source === 'spotify' ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
                            color: '#fff',
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}
                        >
                          {track.source === 'spotify' ? 'Spotify' : 'YouTube'}
                        </span>
                      </div>

                      {/* Meta info */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: isCurrent ? 'var(--primary)' : 'var(--text-primary)',
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
                            fontSize: 10.5,
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
                        <button
                          onClick={() => handlePlayOnlineTrack(track)}
                          style={{
                            flex: 1,
                            background: isCurrent ? 'var(--primary)' : 'rgba(16, 185, 129, 0.12)',
                            color: isCurrent ? '#fff' : 'var(--success)',
                            border: 'none',
                            padding: '5px 8px',
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: 4,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            cursor: 'pointer',
                          }}
                        >
                          <Play size={11} />
                          <span>{isCurrent ? 'Playing' : 'Play VC'}</span>
                        </button>

                        <button
                          onClick={() => handleAddOnlineToPlaylist(track)}
                          style={{
                            background: 'var(--bg-main)',
                            border: 'none',
                            boxShadow: 'var(--shadow-sm)',
                            color: 'var(--text-muted)',
                            padding: '5px 8px',
                            borderRadius: 4,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                          title="Save to Playlist"
                        >
                          <BookmarkPlus size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: PLAYLIST & LOCAL MUSIC                            */}
      {/* ========================================================= */}
      {activeTab === 'playlist' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
          {/* Controls Bar (Fixed) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={handleAddFiles}
                className="button-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, borderRadius: 6 }}
              >
                <Upload size={13} />
                <span>Add Files from PC</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Local Search Input */}
              <div style={{ position: 'relative', minWidth: 180 }}>
                <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter tracks..."
                  value={localSearchQuery}
                  onChange={(e) => setLocalSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 8px 5px 24px',
                    background: 'var(--bg-card)',
                    border: 'none',
                    boxShadow: 'var(--shadow-sm)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: 11.5,
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
                  background: 'var(--bg-card)',
                  boxShadow: 'var(--shadow-sm)',
                  borderRadius: 6,
                  padding: 2,
                }}
              >
                <button
                  onClick={() => setPlaylistViewMode('grid')}
                  style={{
                    border: 'none',
                    borderRadius: 4,
                    padding: '3px 6px',
                    background: playlistViewMode === 'grid' ? 'var(--primary)' : 'transparent',
                    color: playlistViewMode === 'grid' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <LayoutGrid size={13} />
                </button>
                <button
                  onClick={() => setPlaylistViewMode('table')}
                  style={{
                    border: 'none',
                    borderRadius: 4,
                    padding: '3px 6px',
                    background: playlistViewMode === 'table' ? 'var(--primary)' : 'transparent',
                    color: playlistViewMode === 'table' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <List size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Playlist Content (ONLY THIS SCROLLS!) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              paddingRight: 4,
            }}
          >
            {library.length === 0 ? (
              <div
                onClick={handleAddFiles}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-panel)',
                  borderRadius: 10,
                  padding: '36px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <FolderOpen size={26} style={{ color: 'var(--primary)', opacity: 0.8 }} />
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  No Tracks in Library Yet
                </h3>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0, maxWidth: 380 }}>
                  Click here or drag audio files from your PC into this window. Files are automatically saved into permanent app storage.
                </p>
              </div>
            ) : playlistViewMode === 'grid' ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 10,
                }}
              >
                {filteredLibrary.map((track, idx) => {
                  const isCurrent = playerState.trackPath === track.filePath && playerState.isPlaying;
                  const isPreviewing = localAudioPreview?.path === track.filePath && localAudioPreview.isPlaying;

                  return (
                    <div
                      key={track.id || idx}
                      style={{
                        background: 'var(--bg-card)',
                        border: isCurrent ? '1px solid var(--primary)' : '1px solid var(--border-panel)',
                        borderRadius: 8,
                        padding: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        boxShadow: 'var(--shadow-card)',
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          height: 80,
                          borderRadius: 6,
                          overflow: 'hidden',
                          background: track.thumbnail ? '#0a0a0a' : 'var(--bg-main)',
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
                          <FileAudio size={20} style={{ color: 'var(--primary)' }} />
                        )}

                        {track.duration > 0 && (
                          <span
                            style={{
                              position: 'absolute',
                              bottom: 4,
                              right: 4,
                              padding: '1px 4px',
                              borderRadius: 3,
                              background: 'rgba(0, 0, 0, 0.8)',
                              color: '#fff',
                              fontSize: 9,
                              fontFamily: 'monospace',
                              fontWeight: 600,
                            }}
                          >
                            {formatTime(track.duration)}
                          </span>
                        )}

                        <span
                          style={{
                            position: 'absolute',
                            top: 4,
                            left: 4,
                            padding: '1px 4px',
                            borderRadius: 3,
                            background:
                              track.ext === 'SPOTIFY'
                                ? 'rgba(34, 197, 94, 0.9)'
                                : track.ext === 'YT-MUSIC'
                                ? 'rgba(239, 68, 68, 0.9)'
                                : 'rgba(88, 101, 242, 0.85)',
                            color: '#fff',
                            fontSize: 8,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}
                        >
                          {track.ext || 'AUDIO'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: isCurrent ? 'var(--primary)' : 'var(--text-primary)',
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

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 'auto' }}>
                        <button
                          onClick={() => handlePlayTrack(track)}
                          style={{
                            flex: 1,
                            background: isCurrent ? 'var(--primary)' : 'rgba(16, 185, 129, 0.12)',
                            color: isCurrent ? '#fff' : 'var(--success)',
                            border: 'none',
                            padding: '4px 6px',
                            fontSize: 10.5,
                            fontWeight: 700,
                            borderRadius: 4,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 3,
                            cursor: 'pointer',
                          }}
                        >
                          <Play size={10} />
                          <span>{isCurrent ? 'Playing' : 'Play VC'}</span>
                        </button>

                        {!track.filePath.startsWith('http') && (
                          <button
                            onClick={() => handleTogglePreview(track.filePath)}
                            style={{
                              background: isPreviewing ? 'rgba(88, 101, 242, 0.15)' : 'var(--bg-main)',
                              color: isPreviewing ? 'var(--primary)' : 'var(--text-muted)',
                              border: 'none',
                              boxShadow: 'var(--shadow-sm)',
                              padding: '4px 6px',
                              borderRadius: 4,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title={isPreviewing ? 'Stop Local Preview' : 'Preview on PC Speakers'}
                          >
                            <Headphones size={11} />
                          </button>
                        )}

                        <button
                          onClick={() => handleRemoveTrack(track.id)}
                          style={{
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            border: 'none',
                            padding: '4px 4px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title="Remove Track"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-panel)',
                  borderRadius: 10,
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr 90px 70px 130px',
                    padding: '8px 14px',
                    background: 'var(--bg-main)',
                    borderBottom: '1px solid var(--border-light)',
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--text-muted)',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span style={{ width: 24, textAlign: 'center' }}>#</span>
                  <span>Title</span>
                  <span>Size</span>
                  <span>Duration</span>
                  <span style={{ textAlign: 'right' }}>Actions</span>
                </div>

                <div>
                  {filteredLibrary.map((track, idx) => {
                    const isCurrent = playerState.trackPath === track.filePath && playerState.isPlaying;
                    const isPreviewing = localAudioPreview?.path === track.filePath && localAudioPreview.isPlaying;

                    return (
                      <div
                        key={track.id || idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr 90px 70px 130px',
                          padding: '8px 14px',
                          borderBottom: '1px solid var(--border-light)',
                          fontSize: 12,
                          color: 'var(--text-primary)',
                          alignItems: 'center',
                          gap: 10,
                          background: isCurrent ? 'rgba(88, 101, 242, 0.06)' : 'transparent',
                        }}
                      >
                        <span style={{ width: 24, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                          {idx + 1}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <FileAudio size={14} style={{ color: isCurrent ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }} />
                          <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 600, color: isCurrent ? 'var(--primary)' : 'var(--text-primary)' }}>
                              {track.title}
                            </div>
                            <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                              {track.author || track.fileName}
                            </div>
                          </div>
                        </div>

                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {track.sizeBytes > 0 ? formatSize(track.sizeBytes) : 'Online'}
                        </span>

                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {formatTime(track.duration)}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            onClick={() => handlePlayTrack(track)}
                            style={{
                              background: isCurrent ? 'var(--primary)' : 'rgba(16, 185, 129, 0.12)',
                              color: isCurrent ? '#fff' : 'var(--success)',
                              border: 'none',
                              padding: '3px 8px',
                              fontSize: 11,
                              fontWeight: 700,
                              borderRadius: 4,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              cursor: 'pointer',
                            }}
                          >
                            <Play size={10} />
                            <span>{isCurrent ? 'Playing' : 'Play VC'}</span>
                          </button>

                          {!track.filePath.startsWith('http') && (
                            <button
                              onClick={() => handleTogglePreview(track.filePath)}
                              style={{
                                background: isPreviewing ? 'rgba(88, 101, 242, 0.15)' : 'var(--bg-main)',
                                color: isPreviewing ? 'var(--primary)' : 'var(--text-muted)',
                                border: 'none',
                                boxShadow: 'var(--shadow-sm)',
                                padding: '3px 6px',
                                borderRadius: 4,
                                cursor: 'pointer',
                              }}
                              title={isPreviewing ? 'Stop Local Preview' : 'Preview on PC Speakers'}
                            >
                              <Headphones size={11} />
                            </button>
                          )}

                          <button
                            onClick={() => handleRemoveTrack(track.id)}
                            style={{
                              background: 'transparent',
                              color: 'var(--text-muted)',
                              border: 'none',
                              padding: '3px 5px',
                              borderRadius: 4,
                              cursor: 'pointer',
                            }}
                            title="Remove Track"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: SOUNDBOARD CONTENT (0 Files default, User can add) */}
      {/* ========================================================= */}
      {activeTab === 'soundboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
          {/* Header Bar with Add Sound Button & Categories */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={handleAddSoundboardSound}
                className="button-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Plus size={13} />
                <span>Add Sound to Soundboard</span>
              </button>

              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '3px 9px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: selectedCategory === cat ? 'var(--primary)' : 'var(--bg-card)',
                    color: selectedCategory === cat ? '#fff' : 'var(--text-secondary)',
                    border: 'none',
                    boxShadow: 'var(--shadow-sm)',
                    textTransform: 'capitalize',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {presets.length} active soundpad button(s)
            </span>
          </div>

          {/* Soundboard Cards Grid (ONLY THIS SCROLLS!) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              paddingRight: 4,
            }}
          >
            {presets.length === 0 ? (
              <div
                onClick={handleAddSoundboardSound}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-panel)',
                  borderRadius: 10,
                  padding: '36px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <Sparkles size={26} style={{ color: 'var(--primary)', opacity: 0.8 }} />
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Soundpad is Empty (0 Sounds)
                </h3>
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0, maxWidth: 380 }}>
                  Click here or the "Add Sound" button above to add custom SFX, meme audios, or sound effects from your PC into your soundboard.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 10,
                }}
              >
                {filteredPresets.map((preset) => {
                  const isPlaying = playerState.trackPath === preset.filePath && playerState.isPlaying;

                  return (
                    <div
                      key={preset.id}
                      onClick={() => handlePlayTrack(preset)}
                      style={{
                        background: isPlaying ? 'rgba(88, 101, 242, 0.08)' : 'var(--bg-card)',
                        border: isPlaying ? '1px solid var(--primary)' : '1px solid var(--border-panel)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        boxShadow: 'var(--shadow-card)',
                      }}
                      className="soundboard-card"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            background: 'var(--bg-main)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            color: 'var(--primary)',
                          }}
                        >
                          {getPresetIcon(preset.icon)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {preset.name}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            {preset.category} • {preset.duration}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 4,
                            background: isPlaying ? 'var(--primary)' : 'var(--bg-main)',
                            color: isPlaying ? '#fff' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Play size={11} style={{ marginLeft: 1 }} />
                        </div>

                        <button
                          onClick={(e) => handleRemoveSoundboardSound(preset.id, e)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: 3,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title="Remove from Soundboard"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
