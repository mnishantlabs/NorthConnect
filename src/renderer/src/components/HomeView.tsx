import React, { useState, useMemo } from 'react';
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Server,
  Radio,
  Upload,
  RefreshCw,
  ArrowRight,
  Zap,
  Activity,
  CheckCircle2,
  Copy,
  Search,
  Volume2,
  Wrench,
  Gamepad2,
  Sliders,
  Sparkles,
} from 'lucide-react';
import type { Token } from '@shared/types';
import { status, displayName } from '@shared/predicates';

interface HomeViewProps {
  tokens: Token[];
  connectedCount: number;
  serverCount: number;
  validating: boolean;
  onImport: () => void;
  onRequestValidate: (tokens: Token[]) => void;
  onNavigate: (view: any) => void;
  onJoinVoice: (token: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  tokens,
  connectedCount,
  serverCount,
  validating,
  onImport,
  onRequestValidate,
  onNavigate,
  onJoinVoice,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  const validPct = tokens.length > 0 ? Math.round((counts.valid / tokens.length) * 100) : 0;

  const filteredTokens = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tokens.slice(0, 8);
    return tokens
      .filter((t) => {
        const name = displayName(t).toLowerCase();
        const id = (t.user_id ?? '').toLowerCase();
        const tk = t.token.toLowerCase();
        return name.includes(q) || id.includes(q) || tk.includes(q);
      })
      .slice(0, 8);
  }, [tokens, searchQuery]);

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200);
  };

  return (
    <div
      className="home-container fade-in"
      style={{
        padding: '24px 28px',
        overflow: 'hidden',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* 1. Header Bar: Title, Subtitle & Primary Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: '-0.025em',
              margin: 0,
              color: 'var(--text-primary)',
            }}
          >
            Overview
          </h1>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12.5,
              color: 'var(--text-muted)',
              marginTop: 4,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              <strong style={{ color: 'var(--text-secondary)' }}>{tokens.length}</strong> Accounts Loaded
            </span>
            <span>·</span>
            <span>
              <strong style={{ color: 'var(--text-secondary)' }}>{serverCount}</strong> Accessible Guilds
            </span>
            <span>·</span>
            <span style={{ color: connectedCount > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
              <strong style={{ color: connectedCount > 0 ? 'var(--primary)' : 'var(--text-secondary)' }}>
                {connectedCount}
              </strong>{' '}
              Voice Active
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="button-primary"
            onClick={onImport}
            style={{
              padding: '8px 16px',
              fontSize: 12.5,
              borderRadius: 6,
              boxShadow: '0 2px 8px var(--primary-glow)',
            }}
          >
            <Upload size={14} />
            <span>Import Tokens</span>
          </button>

          <button
            onClick={() => onRequestValidate(tokens)}
            disabled={validating || tokens.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 14px',
              fontSize: 12.5,
              fontWeight: 600,
              borderRadius: 6,
              background: 'var(--bg-card)',
              border: 'none',
              boxShadow: 'var(--shadow-sm)',
              color: 'var(--text-primary)',
              cursor: tokens.length === 0 || validating ? 'not-allowed' : 'pointer',
              opacity: tokens.length === 0 || validating ? 0.6 : 1,
              transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            <RefreshCw size={13} className={validating ? 'spin-anim' : ''} />
            <span>{validating ? 'Validating...' : 'Validate All'}</span>
          </button>
        </div>
      </div>

      {/* 2. Unified Metric Cards (Soft Shadow Elevation) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 14,
        }}
      >
        {/* Metric 1: Token Health */}
        <div
          className="card"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-panel)',
            borderRadius: 10,
            padding: '16px 18px',
            boxShadow: 'var(--shadow-card)',
            cursor: 'pointer',
            transition: 'box-shadow 0.15s ease, transform 0.15s ease',
          }}
          onClick={() => onNavigate('tokens')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Account Health</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: counts.invalid > 0 ? 'var(--danger)' : 'var(--success)',
                background: counts.invalid > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                padding: '1px 6px',
                borderRadius: 4,
              }}
            >
              {validPct}% Valid
            </span>
          </div>

          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {counts.valid}{' '}
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>/ {tokens.length}</span>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              height: 4,
              borderRadius: 2,
              background: 'var(--bg-main)',
              overflow: 'hidden',
              marginTop: 12,
              display: 'flex',
            }}
          >
            <div style={{ width: `${validPct}%`, background: '#10b981', transition: 'width 0.3s ease' }} />
            {counts.locked > 0 && (
              <div
                style={{
                  width: `${(counts.locked / tokens.length) * 100}%`,
                  background: '#f59e0b',
                }}
              />
            )}
            {counts.invalid > 0 && (
              <div
                style={{
                  width: `${(counts.invalid / tokens.length) * 100}%`,
                  background: '#ef4444',
                }}
              />
            )}
          </div>
        </div>

        {/* Metric 2: Accessible Servers */}
        <div
          className="card"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-panel)',
            borderRadius: 10,
            padding: '16px 18px',
            boxShadow: 'var(--shadow-card)',
            cursor: 'pointer',
            transition: 'box-shadow 0.15s ease, transform 0.15s ease',
          }}
          onClick={() => onNavigate('connect')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Guild Coverage</span>
            <Server size={14} style={{ color: 'var(--text-muted)' }} />
          </div>

          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {serverCount}
          </div>

          <div
            style={{
              fontSize: 11.5,
              color: 'var(--text-secondary)',
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Unique Discord Servers</span>
            <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
          </div>
        </div>

        {/* Metric 3: Voice Connections */}
        <div
          className="card"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-panel)',
            borderRadius: 10,
            padding: '16px 18px',
            boxShadow: 'var(--shadow-card)',
            cursor: 'pointer',
            transition: 'box-shadow 0.15s ease, transform 0.15s ease',
          }}
          onClick={() => onNavigate('connect')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Voice Engine</span>
            <Radio size={14} style={{ color: connectedCount > 0 ? 'var(--primary)' : 'var(--text-muted)' }} />
          </div>

          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {connectedCount}{' '}
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>active</span>
          </div>

          <div
            style={{
              fontSize: 11.5,
              color: connectedCount > 0 ? 'var(--primary)' : 'var(--text-secondary)',
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{connectedCount > 0 ? 'Streaming / Connected' : 'Engine Standby'}</span>
            <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
          </div>
        </div>
      </div>

      {/* 3. Main Dashboard Grid (2 Columns: Loaded Accounts List + Action Deck) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.6fr 1fr',
          gap: 16,
          alignItems: 'stretch',
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Left Column: Loaded Accounts Feed */}
        <div
          className="card"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-panel)',
            borderRadius: 10,
            padding: '16px 18px',
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            height: '100%',
            minHeight: 0,
            boxSizing: 'border-box',
          }}
        >
          {/* Header with Search and View All */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <h2 style={{ fontSize: 14.5, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Loaded Accounts
              </h2>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                Showing {filteredTokens.length} of {tokens.length} accounts
              </span>
            </div>

            <button
              onClick={() => onNavigate('tokens')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'transparent',
                border: 'none',
                color: 'var(--primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '2px 6px',
              }}
            >
              <span>View All</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* Quick Filter */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-main)',
              border: 'none',
              boxShadow: 'var(--shadow-sm)',
              borderRadius: 6,
              padding: '0 10px',
              height: 30,
              flexShrink: 0,
            }}
          >
            <Search size={13} style={{ color: 'var(--text-muted)', marginRight: 6 }} />
            <input
              type="text"
              placeholder="Filter loaded accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: 12,
                width: '100%',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Accounts List (Internally scrollable so page does not scroll away) */}
          {tokens.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 12.5,
              }}
            >
              No accounts loaded yet. Click <strong>Import Tokens</strong> to get started.
            </div>
          ) : filteredTokens.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No accounts match "{searchQuery}".
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                paddingRight: 4,
              }}
            >
              {filteredTokens.map((t) => {
                const s = status(t);
                const name = displayName(t);
                const isValid = s === 'valid';
                const avatar = (t as any).avatar_url;

                return (
                  <div
                    key={t.token}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: 'var(--bg-main)',
                      border: 'none',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'box-shadow 0.12s ease',
                      gap: 10,
                    }}
                  >
                    {/* Left: Avatar & Profile Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      {avatar ? (
                        <img
                          src={avatar}
                          alt=""
                          style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: isValid ? 'rgba(88, 101, 242, 0.12)' : 'var(--bg-card-hover)',
                            color: isValid ? 'var(--primary)' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {name.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              fontSize: 12.5,
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {name}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '1px 4px',
                              borderRadius: 3,
                              background: isValid
                                ? 'rgba(16, 185, 129, 0.12)'
                                : s === 'locked'
                                ? 'rgba(245, 158, 11, 0.12)'
                                : 'rgba(239, 68, 68, 0.12)',
                              color: isValid ? '#10b981' : s === 'locked' ? '#f59e0b' : '#ef4444',
                            }}
                          >
                            {s.toUpperCase()}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            fontFamily: 'monospace',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {t.token.slice(0, 16)}... · {t.servers?.length ?? 0} guilds
                        </div>
                      </div>
                    </div>

                    {/* Right: Copy & 1-Click Voice Action */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => copy(t.token, `home-${t.token}`)}
                        title="Copy Token"
                        style={{
                          background: 'var(--bg-card)',
                          border: 'none',
                          boxShadow: 'var(--shadow-sm)',
                          borderRadius: 4,
                          padding: '4px 6px',
                          color: copiedKey === `home-${t.token}` ? '#10b981' : 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {copiedKey === `home-${t.token}` ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                      </button>

                      {isValid && (
                        <button
                          onClick={() => onJoinVoice(t.token)}
                          title="Connect to Voice"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 8px',
                            borderRadius: 4,
                            background: 'rgba(88, 101, 242, 0.12)',
                            border: 'none',
                            color: 'var(--primary)',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-sm)',
                          }}
                        >
                          <Radio size={11} />
                          <span>Voice</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Quick Launch Deck */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Quick Hub Navigator */}
          <div
            className="card"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-panel)',
              borderRadius: 10,
              padding: '16px 18px',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 2 }}>
              Quick Launch
            </div>

            {/* Link 1: Connect Voice */}
            <div
              onClick={() => onNavigate('connect')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                borderRadius: 6,
                background: 'var(--bg-main)',
                border: 'none',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
                transition: 'transform 0.12s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ color: 'var(--primary)' }}>
                  <Radio size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>Voice Connect Hub</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Browse servers or enter Channel ID</div>
                </div>
              </div>
              <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
            </div>

            {/* Link 2: Token Manager */}
            <div
              onClick={() => onNavigate('tokens')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                borderRadius: 6,
                background: 'var(--bg-main)',
                border: 'none',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
                transition: 'transform 0.12s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ color: 'var(--text-primary)' }}>
                  <KeyRound size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>Token Accounts</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Export, replace & validate tokens</div>
                </div>
              </div>
              <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
            </div>

            {/* Link 3: Utilities & Server Leaver */}
            <div
              onClick={() => onNavigate('tools')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                borderRadius: 6,
                background: 'var(--bg-main)',
                border: 'none',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
                transition: 'transform 0.12s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ color: 'var(--text-primary)' }}>
                  <Wrench size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>Tools & Leave Server</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Clean up server lists with whitelist</div>
                </div>
              </div>
              <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
            </div>

            {/* Link 4: Soundboard & Play */}
            <div
              onClick={() => onNavigate('play')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                borderRadius: 6,
                background: 'var(--bg-main)',
                border: 'none',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
                transition: 'transform 0.12s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ color: 'var(--text-primary)' }}>
                  <Gamepad2 size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>Soundboard & Player</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stream audio into voice channels</div>
                </div>
              </div>
              <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
            </div>
          </div>

          {/* Engine Status Card */}
          <div
            className="card"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-panel)',
              borderRadius: 10,
              padding: '14px 16px',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Discord Gateway Active
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  WebSocket v10 & Voice RTC Protocol
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigate('settings')}
              title="Settings"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <Sliders size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
