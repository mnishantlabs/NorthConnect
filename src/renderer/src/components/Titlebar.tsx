import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  KeyRound,
  Server,
  Radio,
  Gamepad2,
  Settings,
  Home,
  ShieldCheck,
  ShieldAlert,
  Upload,
  RefreshCw,
  Sun,
  Moon,
  VolumeX,
  Command,
  Wrench,
  LogOut,
} from 'lucide-react';
import { WindowControls } from './WindowControls';
import { AppIcon } from './AppIcon';
import { status, displayName } from '../../../shared/predicates';
import type { Token } from '../../../shared/types';
import type { ViewId } from './Sidebar';

interface TitlebarProps {
  tokens: Token[];
  validating: boolean;
  onNavigate: (view: ViewId) => void;
  onImport?: () => void;
  onValidateAll?: () => void;
  onDisconnectAll?: () => void;
  onSelectToken?: (token: string) => void;
  onToggleTheme?: () => void;
  theme?: 'dark' | 'light';
}

export const Titlebar: React.FC<TitlebarProps> = ({
  tokens,
  validating,
  onNavigate,
  onImport,
  onValidateAll,
  onDisconnectAll,
  onSelectToken,
  onToggleTheme,
  theme,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate live counts
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

  // Extract unique servers
  const allServers = useMemo(() => {
    const serverMap = new Map<string, { id: string; name: string; tokenCount: number }>();
    for (const t of tokens) {
      for (const s of t.servers ?? []) {
        const existing = serverMap.get(s.id);
        if (existing) {
          existing.tokenCount++;
        } else {
          serverMap.set(s.id, { id: s.id, name: s.name, tokenCount: 1 });
        }
      }
    }
    return Array.from(serverMap.values());
  }, [tokens]);

  // Global search results across views, actions, tokens, and servers
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const results: Array<{
      category: string;
      id: string;
      title: string;
      subtitle?: string;
      icon: React.ComponentType<any>;
      action: () => void;
      badge?: string;
    }> = [];

    // 1. Navigation Pages
    const pages = [
      { id: 'nav-home', title: 'Home Dashboard', subtitle: 'Overview, stats & quick actions', view: 'home' as ViewId, icon: Home },
      { id: 'nav-tokens', title: 'Token Manager', subtitle: 'Manage Discord accounts & tokens', view: 'tokens' as ViewId, icon: KeyRound },
      { id: 'nav-connect', title: 'Connect Hub', subtitle: 'Voice channels & server connection', view: 'connect' as ViewId, icon: Radio },
      { id: 'nav-tools', title: 'Tools & Utilities', subtitle: 'Leave servers with whitelisting, mass operations', view: 'tools' as ViewId, icon: Wrench },
      { id: 'nav-play', title: 'Play Center', subtitle: 'Soundboard & music streamer [WIP]', view: 'play' as ViewId, icon: Gamepad2 },
      { id: 'nav-settings', title: 'Settings', subtitle: 'Concurrency, delay & proxy config', view: 'settings' as ViewId, icon: Settings },
    ];

    for (const p of pages) {
      if (!q || p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q) || p.view.includes(q)) {
        results.push({
          category: 'Navigation',
          id: p.id,
          title: p.title,
          subtitle: p.subtitle,
          icon: p.icon,
          action: () => {
            onNavigate(p.view);
            setIsOpen(false);
            setSearchQuery('');
          },
        });
      }
    }

    // 2. Quick Actions
    const actions = [
      {
        id: 'act-import',
        title: 'Import Tokens',
        subtitle: 'Paste new Discord tokens or credentials',
        icon: Upload,
        show: !!onImport,
        action: () => {
          onImport?.();
          setIsOpen(false);
          setSearchQuery('');
        },
      },
      {
        id: 'act-validate',
        title: 'Validate All Tokens',
        subtitle: 'Check authentication status for all accounts',
        icon: RefreshCw,
        show: !!onValidateAll && tokens.length > 0,
        action: () => {
          onValidateAll?.();
          setIsOpen(false);
          setSearchQuery('');
        },
      },
      {
        id: 'act-disconnect',
        title: 'Disconnect All Voice Channels',
        subtitle: 'Leave all currently active voice sessions',
        icon: VolumeX,
        show: !!onDisconnectAll,
        action: () => {
          onDisconnectAll?.();
          setIsOpen(false);
          setSearchQuery('');
        },
      },
      {
        id: 'act-theme',
        title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
        subtitle: 'Toggle interface visual theme',
        icon: theme === 'dark' ? Sun : Moon,
        show: !!onToggleTheme,
        action: () => {
          onToggleTheme?.();
          setIsOpen(false);
          setSearchQuery('');
        },
      },
    ];

    for (const a of actions) {
      if (a.show && (!q || a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q))) {
        results.push({
          category: 'Actions',
          id: a.id,
          title: a.title,
          subtitle: a.subtitle,
          icon: a.icon,
          action: a.action,
        });
      }
    }

    // 3. Tokens / Accounts
    if (q) {
      const matchedTokens = tokens.filter((t) => {
        const name = displayName(t).toLowerCase();
        const id = (t.user_id ?? '').toLowerCase();
        const tk = t.token.toLowerCase();
        return name.includes(q) || id.includes(q) || tk.includes(q);
      });

      for (const t of matchedTokens.slice(0, 8)) {
        const s = status(t);
        results.push({
          category: 'Accounts',
          id: `token-${t.token}`,
          title: displayName(t),
          subtitle: `${t.token.slice(0, 16)}... • ${t.servers?.length ?? 0} guilds`,
          icon: s === 'valid' ? ShieldCheck : ShieldAlert,
          badge: s.toUpperCase(),
          action: () => {
            onNavigate('tokens');
            onSelectToken?.(t.token);
            setIsOpen(false);
            setSearchQuery('');
          },
        });
      }

      // 4. Servers / Guilds
      const matchedServers = allServers.filter((s) => s.name.toLowerCase().includes(q) || s.id.includes(q));
      for (const s of matchedServers.slice(0, 6)) {
        results.push({
          category: 'Guilds',
          id: `guild-${s.id}`,
          title: s.name,
          subtitle: `Guild ID: ${s.id} • ${s.tokenCount} accounts`,
          icon: Server,
          action: () => {
            onNavigate('connect');
            setIsOpen(false);
            setSearchQuery('');
          },
        });
      }
    }

    return results;
  }, [searchQuery, tokens, allServers, onNavigate, onImport, onValidateAll, onDisconnectAll, onToggleTheme, onSelectToken, theme]);

  // Global Keyboard Shortcut (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Handle outside clicks to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, searchResults.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + searchResults.length) % Math.max(1, searchResults.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[selectedIndex]) {
        searchResults[selectedIndex].action();
      }
    }
  };

  return (
    <header
      className="nc-titlebar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '52px',
        padding: '0 0 0 16px',
        background: 'var(--bg-titlebar)',
        borderBottom: '1px solid var(--border-medium)',
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: 50,
        WebkitAppRegion: 'drag',
      }}
    >
      {/* Left: App Logo, Name & Refined Minimalist Status Pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, WebkitAppRegion: 'no-drag' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}
          onClick={() => onNavigate('home')}
          title="NorthConnect Home"
        >
          <AppIcon size={26} />
          <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            NorthConnect
          </span>
        </div>

        {/* Clean, Unified Status Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            borderRadius: '20px',
            padding: '3px 12px',
            fontSize: '11.5px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
            <span style={{ color: 'var(--text-primary)' }}>{counts.valid}</span>
            <span style={{ color: 'var(--text-muted)' }}>valid</span>
          </div>

          <div style={{ width: 1, height: 10, background: 'var(--border-medium)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: counts.invalid > 0 ? '#ef4444' : 'var(--text-muted)' }} />
            <span style={{ color: counts.invalid > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{counts.invalid}</span>
            <span style={{ color: 'var(--text-muted)' }}>invalid</span>
          </div>

          {counts.locked > 0 && (
            <>
              <div style={{ width: 1, height: 10, background: 'var(--border-medium)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
                <span style={{ color: 'var(--text-primary)' }}>{counts.locked}</span>
                <span style={{ color: 'var(--text-muted)' }}>locked</span>
              </div>
            </>
          )}

          {validating && (
            <>
              <div style={{ width: 1, height: 10, background: 'var(--border-medium)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--primary)' }}>
                <RefreshCw size={11} className="spin-anim" />
                <span>validating...</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '480px',
          margin: '0 20px',
          WebkitAppRegion: 'no-drag',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '34px',
            background: 'var(--bg-card)',
            border: isOpen ? '1px solid var(--primary)' : '1px solid var(--border-medium)',
            borderRadius: '8px',
            padding: '0 12px',
            boxShadow: isOpen ? '0 0 0 2px var(--primary-glow)' : 'none',
            transition: 'all 0.15s ease',
          }}
          onClick={() => {
            inputRef.current?.focus();
            setIsOpen(true);
          }}
        >
          <Search size={14} style={{ color: 'var(--text-muted)', marginRight: 8, flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search anything... (Home, Token, Connect, Play, Settings)"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
              setSelectedIndex(0);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleInputKeyDown}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '12.5px',
              fontFamily: 'inherit',
              minWidth: 0,
            }}
          />
          {searchQuery ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSearchQuery('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={13} />
            </button>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                background: 'var(--bg-main)',
                border: '1px solid var(--border-light)',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: '10.5px',
                color: 'var(--text-muted)',
                fontWeight: 600,
                pointerEvents: 'none',
              }}
            >
              <Command size={10} />
              <span>K</span>
            </div>
          )}
        </div>

        {/* Global Search Dropdown */}
        {isOpen && (
          <div
            className="fade-in"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              borderRadius: '10px',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
              maxHeight: '380px',
              overflowY: 'auto',
              zIndex: 1000,
              padding: '6px',
            }}
          >
            {searchResults.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
                No results found for "{searchQuery}"
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {searchResults.map((item, index) => {
                  const Icon = item.icon;
                  const isSelected = index === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(index)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: isSelected ? 'rgba(59, 130, 246, 0.14)' : 'transparent',
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'background-color 0.1s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            background: isSelected ? 'var(--primary)' : 'var(--bg-main)',
                            color: isSelected ? '#ffffff' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={14} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.title}
                          </div>
                          {item.subtitle && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {item.badge && (
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: item.badge === 'VALID' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: item.badge === 'VALID' ? 'var(--success)' : 'var(--danger)',
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {item.category}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Window Controls */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', WebkitAppRegion: 'no-drag' }}>
        <WindowControls />
      </div>
    </header>
  );
};