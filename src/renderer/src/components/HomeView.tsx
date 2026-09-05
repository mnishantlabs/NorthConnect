import React, { useState } from 'react';
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Server,
  Radio,
  Upload,
  RefreshCw,
  ArrowRight,
  Sparkles,
  Zap,
  Activity,
  CheckCircle2,
  Copy,
  ExternalLink,
  X,
  Minus,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Info,
} from 'lucide-react';
import type { Token } from '../../../shared/types';
import { status, displayName } from '../../../shared/predicates';

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
  const counts = { valid: 0, invalid: 0, locked: 0 };
  for (const t of tokens) {
    const s = status(t);
    if (s === 'valid') counts.valid++;
    else if (s === 'locked') counts.locked++;
    else counts.invalid++;
  }

  const validPct = tokens.length > 0 ? Math.round((counts.valid / tokens.length) * 100) : 0;
  const recentTokens = tokens.slice(0, 5);

  const [dismissedWelcome, setDismissedWelcome] = useState<boolean>(() => {
    return localStorage.getItem('northconnect-welcome-dismissed') === 'true';
  });

  const [minimizedWelcome, setMinimizedWelcome] = useState<boolean>(() => {
    return localStorage.getItem('northconnect-welcome-minimized') === 'true';
  });

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200);
  };

  const handleDismiss = () => {
    setDismissedWelcome(true);
    localStorage.setItem('northconnect-welcome-dismissed', 'true');
  };

  const handleToggleMinimize = () => {
    const next = !minimizedWelcome;
    setMinimizedWelcome(next);
    localStorage.setItem('northconnect-welcome-minimized', String(next));
  };

  const handleRestoreWelcome = () => {
    setDismissedWelcome(false);
    setMinimizedWelcome(false);
    localStorage.removeItem('northconnect-welcome-dismissed');
    localStorage.removeItem('northconnect-welcome-minimized');
  };

  return (
    <div className="home-container fade-in" style={{ padding: '24px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      {/* Minimized / Collapsed Welcome Banner */}
      {!dismissedWelcome && minimizedWelcome && (
        <div
          className="card fade-in"
          style={{
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(59, 130, 246, 0.04) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: 10,
            padding: '10px 16px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={16} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              Welcome to NorthConnect
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              · Discord Token & Voice Manager
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={onImport}
              style={{
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: 6,
                padding: '4px 10px',
                color: 'var(--primary)',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Upload size={12} />
              <span>Import</span>
            </button>

            {/* Expand button */}
            <button
              onClick={handleToggleMinimize}
              title="Expand welcome banner"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-medium)',
                borderRadius: 6,
                padding: '4px 8px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11.5,
              }}
            >
              <ChevronDown size={13} />
              <span>Expand</span>
            </button>

            {/* Close / Dismiss button */}
            <button
              onClick={handleDismiss}
              title="Close welcome banner"
              style={{
                background: 'transparent',
                border: 'none',
                borderRadius: 4,
                padding: '4px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Full Expanded Welcome Banner */}
      {!dismissedWelcome && !minimizedWelcome && (
        <div
          className="home-hero card fade-in"
          style={{
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(59, 130, 246, 0.05) 50%, var(--bg-card) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: 14,
            padding: '24px 28px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Header Controls: Minimize and Close Buttons */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              zIndex: 2,
            }}
          >
            <button
              onClick={handleToggleMinimize}
              title="Minimize welcome screen"
              style={{
                background: 'rgba(0, 0, 0, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: 26,
                height: 26,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
              }}
            >
              <Minus size={13} />
            </button>

            <button
              onClick={handleDismiss}
              title="Close welcome screen"
              style={{
                background: 'rgba(0, 0, 0, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: 26,
                height: 26,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
              }}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ position: 'relative', zIndex: 1, maxWidth: '600px', paddingRight: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '3px 9px',
                  borderRadius: 20,
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: 'var(--primary)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                Discord Token Manager
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>v1.0.0</span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 8px 0' }}>
              Welcome to <span style={{ color: 'var(--primary)' }}>NorthConnect</span>
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Manage Discord accounts, validate authentication tokens, inspect accessible guilds, and mass-connect to voice channels seamlessly with ultra-low latency.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, position: 'relative', zIndex: 1 }}>
            <button
              className="button-primary"
              onClick={onImport}
              style={{ padding: '10px 18px', fontSize: 13, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Upload size={16} />
              <span>Import Tokens</span>
            </button>
            <button
              className="button-secondary"
              onClick={() => onRequestValidate(tokens)}
              disabled={validating || tokens.length === 0}
              style={{
                padding: '10px 18px',
                fontSize: 13,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-card-hover)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                cursor: tokens.length === 0 || validating ? 'not-allowed' : 'pointer',
                opacity: tokens.length === 0 || validating ? 0.6 : 1,
              }}
            >
              <RefreshCw size={16} className={validating ? 'spin-anim' : ''} />
              <span>{validating ? 'Validating...' : 'Validate All'}</span>
            </button>
          </div>
        </div>
      )}

      {/* When completely dismissed, show a subtle option to bring it back */}
      {dismissedWelcome && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button
            onClick={handleRestoreWelcome}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 11.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Info size={12} />
            <span>Show Welcome Banner</span>
          </button>
        </div>
      )}

      {/* Metrics Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Metric 1: Total Tokens */}
        <div
          className="card"
          style={{
            padding: '18px 20px',
            cursor: 'pointer',
            border: '1px solid var(--border-medium)',
            borderRadius: 12,
            transition: 'transform 0.15s, border-color 0.15s',
          }}
          onClick={() => onNavigate('tokens')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Total Accounts</span>
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(59, 130, 246, 0.12)', color: 'var(--primary)' }}>
              <KeyRound size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{tokens.length}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>Click to manage tokens</span>
            <ArrowRight size={12} />
          </div>
        </div>

        {/* Metric 2: Valid Tokens */}
        <div
          className="card"
          style={{
            padding: '18px 20px',
            border: '1px solid var(--border-medium)',
            borderRadius: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Valid Accounts</span>
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)' }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--success)', lineHeight: 1 }}>{counts.valid}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
            {tokens.length > 0 ? `${validPct}% healthy` : 'No accounts added'}
          </div>
        </div>

        {/* Metric 3: Total Servers */}
        <div
          className="card"
          style={{
            padding: '18px 20px',
            cursor: 'pointer',
            border: '1px solid var(--border-medium)',
            borderRadius: 12,
          }}
          onClick={() => onNavigate('connect')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Accessible Guilds</span>
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7' }}>
              <Server size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{serverCount}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>Explore server channels</span>
            <ArrowRight size={12} />
          </div>
        </div>

        {/* Metric 4: Active Voice Connections */}
        <div
          className="card"
          style={{
            padding: '18px 20px',
            cursor: 'pointer',
            border: '1px solid var(--border-medium)',
            borderRadius: 12,
          }}
          onClick={() => onNavigate('connect')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Voice Connections</span>
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' }}>
              <Radio size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#38bdf8', lineHeight: 1 }}>{connectedCount}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>{connectedCount > 0 ? 'Active in voice room' : 'Ready to connect'}</span>
            <ArrowRight size={12} />
          </div>
        </div>
      </div>

      {/* Two Column Layout: Token Health & Quick Navigation */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }}>
        {/* Left Column: Recent Accounts & Token Health */}
        <div className="card" style={{ padding: '20px', borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Recent Accounts</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Latest loaded tokens and status overview
              </p>
            </div>
            <button
              onClick={() => onNavigate('tokens')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>View all ({tokens.length})</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* Health Bar */}
          {tokens.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 6 }}>
                <span>Token Validity Distribution</span>
                <span>{counts.valid} valid / {counts.invalid + counts.locked} invalid or locked</span>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: 'var(--bg-card-hover)', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${validPct}%`, background: 'var(--success)', transition: 'width 0.3s ease' }} />
                <div style={{ width: `${100 - validPct}%`, background: 'var(--danger)', transition: 'width 0.3s ease' }} />
              </div>
            </div>
          )}

          {/* Account Rows */}
          {recentTokens.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <KeyRound size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
              <p style={{ fontSize: 13, margin: 0 }}>No Discord accounts loaded yet.</p>
              <button
                className="button-primary"
                onClick={onImport}
                style={{ marginTop: 12, fontSize: 12, padding: '6px 14px' }}
              >
                Import your first token
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentTokens.map((t) => {
                const s = status(t);
                const isValid = s === 'valid';
                const name = displayName(t);
                return (
                  <div
                    key={t.token}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: isValid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: isValid ? 'var(--success)' : 'var(--danger)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {name.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {name}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 10,
                              background: isValid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                              color: isValid ? 'var(--success)' : 'var(--danger)',
                            }}
                          >
                            {isValid ? 'VALID' : s.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {t.token.slice(0, 18)}... • {t.servers?.length ?? 0} servers
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        title="Copy token"
                        onClick={() => copy(t.token, `home-tk-${t.token}`)}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border-light)',
                          borderRadius: 6,
                          padding: '5px 8px',
                          color: copiedKey === `home-tk-${t.token}` ? 'var(--success)' : 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        {copiedKey === `home-tk-${t.token}` ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                      </button>
                      {isValid && (
                        <button
                          title="Join Voice"
                          onClick={() => onJoinVoice(t.token)}
                          style={{
                            background: 'rgba(59, 130, 246, 0.12)',
                            border: '1px solid rgba(59, 130, 246, 0.25)',
                            borderRadius: 6,
                            padding: '5px 10px',
                            color: 'var(--primary)',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Radio size={12} />
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

        {/* Right Column: Quick Navigation & Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Quick Shortcuts */}
          <div className="card" style={{ padding: '20px', borderRadius: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px 0' }}>Quick Hub</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                onClick={() => onNavigate('tokens')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-light)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ padding: 6, borderRadius: 6, background: 'rgba(59, 130, 246, 0.12)', color: 'var(--primary)' }}>
                    <KeyRound size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Token Manager</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Manage, filter, import, and export</div>
                  </div>
                </div>
                <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
              </div>

              <div
                onClick={() => onNavigate('connect')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-light)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ padding: 6, borderRadius: 6, background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' }}>
                    <Radio size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Connect Hub</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Voice channels & guild explorer</div>
                  </div>
                </div>
                <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
              </div>

              <div
                onClick={() => onNavigate('tools')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-light)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ padding: 6, borderRadius: 6, background: 'rgba(59, 130, 246, 0.12)', color: 'var(--primary)' }}>
                    <Activity size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Tools & Utilities</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Leave servers with whitelisting</div>
                  </div>
                </div>
                <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
              </div>

              <div
                onClick={() => onNavigate('play')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-light)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ padding: 6, borderRadius: 6, background: 'rgba(234, 179, 8, 0.12)', color: 'var(--warning)' }}>
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Play Center</span>
                      <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(234, 179, 8, 0.18)', color: 'var(--warning)' }}>WIP</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Soundboard & audio player</div>
                  </div>
                </div>
                <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
          </div>

          {/* System Status Pill */}
          <div
            className="card"
            style={{
              padding: '16px 20px',
              borderRadius: 12,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>Discord Gateway Ready</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>WebSocket & Voice protocol v10 active</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
