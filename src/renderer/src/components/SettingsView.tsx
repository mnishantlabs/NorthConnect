import React, { useEffect, useState } from 'react';
import {
  Sliders,
  Shield,
  Radio,
  Eye,
  Globe,
  Copy,
  RefreshCw,
  CheckCircle2,
  HardDrive,
  Check,
} from 'lucide-react';

export interface SettingsShape {
  theme?: string;
  concurrency: number;
  retry_delay: number;
  proxy: string;
  api_timeout: number;
  delay: number;
  show_badges: boolean;
  show_ids: boolean;
  auto_validate: boolean;
  bridge_enabled?: boolean;
  bridge_port?: number;
}

interface BridgeStatus {
  enabled: boolean;
  running: boolean;
  host: string;
  port: number;
  secret: string;
  version: string;
  count: number;
}

interface SettingsViewProps {
  settings: SettingsShape;
  onSave: (patch: Partial<SettingsShape>) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSave }) => {
  const [bridge, setBridge] = useState<BridgeStatus | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    let alive = true;
    (window.electronAPI?.getBridgeStatus?.() ?? Promise.resolve(null)).then((b) => {
      if (alive) setBridge(b);
    });
    return () => {
      alive = false;
    };
  }, [settings.bridge_enabled, settings.bridge_port]);

  const num = (key: keyof SettingsShape, v: string) => {
    const n = Number(v);
    if (!isNaN(n)) onSave({ [key]: n } as Partial<SettingsShape>);
  };

  const copySecret = async () => {
    if (!bridge?.secret) return;
    try {
      await navigator.clipboard.writeText(bridge.secret);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const regenerateSecret = async () => {
    const s = (await window.electronAPI?.regenerateBridgeSecret?.()) ?? '';
    if (s) {
      const st = await window.electronAPI?.getBridgeStatus?.();
      if (st) setBridge(st as BridgeStatus);
    }
  };

  return (
    <div
      className="settings-container fade-in"
      style={{
        padding: '24px 28px',
        overflowY: 'auto',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        maxWidth: 820,
      }}
    >
      {/* 1. Header */}
      <div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: '-0.025em',
            margin: '0 0 4px 0',
            color: 'var(--text-primary)',
          }}
        >
          Preferences & Configuration
        </h1>
        <p
          style={{
            fontSize: 12.5,
            color: 'var(--text-muted)',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>System tuning</span>
          <span>·</span>
          <span>Discord API rate limits</span>
          <span>·</span>
          <span>Extension bridge sync</span>
        </p>
      </div>

      {/* 2. Discord API Engine Card */}
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
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-light)', paddingBottom: 10 }}>
          <Shield size={16} style={{ color: 'var(--primary)' }} />
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Discord API & Validation
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Row 1: Concurrency */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Validation Concurrency</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Simultaneous account verification requests (1-40)</div>
            </div>
            <input
              type="number"
              min={1}
              max={40}
              value={settings.concurrency}
              onChange={(e) => num('concurrency', e.target.value)}
              style={{
                width: 70,
                padding: '6px 10px',
                borderRadius: 6,
                background: 'var(--bg-main)',
                border: 'none',
                boxShadow: 'var(--shadow-sm)',
                color: 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 600,
                textAlign: 'center',
                outline: 'none',
              }}
            />
          </div>

          {/* Row 2: API Timeout */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>API Timeout</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Request timeout threshold in seconds</div>
            </div>
            <input
              type="number"
              min={1}
              max={60}
              value={settings.api_timeout}
              onChange={(e) => num('api_timeout', e.target.value)}
              style={{
                width: 70,
                padding: '6px 10px',
                borderRadius: 6,
                background: 'var(--bg-main)',
                border: 'none',
                boxShadow: 'var(--shadow-sm)',
                color: 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 600,
                textAlign: 'center',
                outline: 'none',
              }}
            />
          </div>

          {/* Row 3: 429 Retry Delay */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Rate Limit (429) Delay</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Backoff wait interval before retrying rate-limited calls (seconds)</div>
            </div>
            <input
              type="number"
              min={0}
              max={30}
              value={settings.retry_delay}
              onChange={(e) => num('retry_delay', e.target.value)}
              style={{
                width: 70,
                padding: '6px 10px',
                borderRadius: 6,
                background: 'var(--bg-main)',
                border: 'none',
                boxShadow: 'var(--shadow-sm)',
                color: 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 600,
                textAlign: 'center',
                outline: 'none',
              }}
            />
          </div>

          {/* Row 4: Proxy */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Custom HTTP/SOCKS Proxy</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Route REST and Gateway traffic through a custom proxy</div>
            </div>
            <input
              type="text"
              placeholder="http://host:port or socks5://..."
              value={settings.proxy || ''}
              onChange={(e) => onSave({ proxy: e.target.value })}
              style={{
                flex: 1,
                maxWidth: 220,
                padding: '6px 10px',
                borderRadius: 6,
                background: 'var(--bg-main)',
                border: 'none',
                boxShadow: 'var(--shadow-sm)',
                color: 'var(--text-primary)',
                fontSize: 12,
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* 3. Voice Engine Settings */}
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
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-light)', paddingBottom: 10 }}>
          <Radio size={16} style={{ color: 'var(--primary)' }} />
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Voice Dispatch & Delays
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Join Delay per Account</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Staggered interval between sequential token VC joins (seconds)</div>
          </div>
          <input
            type="number"
            min={0}
            step={0.1}
            value={settings.delay}
            onChange={(e) => num('delay', e.target.value)}
            style={{
              width: 70,
              padding: '6px 10px',
              borderRadius: 6,
              background: 'var(--bg-main)',
              border: 'none',
              boxShadow: 'var(--shadow-sm)',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'center',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* 4. Visual Display & Appearance */}
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
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-light)', paddingBottom: 10 }}>
          <Eye size={16} style={{ color: 'var(--primary)' }} />
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Appearance & Interface Badges
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Toggle 1: Badges */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Account Badges</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Display Nitro, Phone, and User Flags on account rows</div>
            </div>
            <input
              type="checkbox"
              checked={settings.show_badges}
              onChange={(e) => onSave({ show_badges: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </div>

          {/* Toggle 2: User IDs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Inline User IDs</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Render Discord Snowflake IDs directly beneath user names</div>
            </div>
            <input
              type="checkbox"
              checked={settings.show_ids}
              onChange={(e) => onSave({ show_ids: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </div>

          {/* Toggle 3: Auto-validate on startup */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Auto-validate on Startup</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Automatically trigger health validation when app opens</div>
            </div>
            <input
              type="checkbox"
              checked={settings.auto_validate}
              onChange={(e) => onSave({ auto_validate: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </div>
        </div>
      </div>

      {/* 5. Extension Bridge Sync */}
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
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Globe size={16} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Browser Extension Bridge
            </h2>
          </div>

          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 4,
              background: bridge?.enabled && bridge.running ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-main)',
              color: bridge?.enabled && bridge.running ? 'var(--success)' : 'var(--text-muted)',
            }}
          >
            {bridge?.enabled ? (bridge.running ? `Listening on :${bridge.port}` : 'Bridge Stopped') : 'Disabled'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Sync toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Sync Tokens from Extension</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Automatically capture and sync tokens detected in browser sessions</div>
            </div>
            <input
              type="checkbox"
              checked={!!settings.bridge_enabled}
              onChange={(e) => onSave({ bridge_enabled: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </div>

          {/* Port */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Bridge WebSocket Port</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Local communication port for the Chrome/Firefox extension</div>
            </div>
            <input
              type="number"
              min={1024}
              max={65535}
              value={settings.bridge_port ?? 47474}
              onChange={(e) => num('bridge_port', e.target.value)}
              style={{
                width: 80,
                padding: '6px 10px',
                borderRadius: 6,
                background: 'var(--bg-main)',
                border: 'none',
                boxShadow: 'var(--shadow-sm)',
                color: 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 600,
                textAlign: 'center',
                outline: 'none',
              }}
            />
          </div>

          {/* Secret Key with Copy */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              Bridge Authentication Key (Paste into browser extension options)
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                readOnly
                value={bridge?.secret ?? ''}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  borderRadius: 6,
                  background: 'var(--bg-main)',
                  border: 'none',
                  boxShadow: 'var(--shadow-sm)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
              <button
                onClick={copySecret}
                style={{
                  padding: '7px 12px',
                  borderRadius: 6,
                  background: 'var(--bg-main)',
                  border: 'none',
                  boxShadow: 'var(--shadow-sm)',
                  color: copiedKey ? 'var(--success)' : 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {copiedKey ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedKey ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={regenerateSecret}
                style={{
                  padding: '7px 12px',
                  borderRadius: 6,
                  background: 'var(--bg-main)',
                  border: 'none',
                  boxShadow: 'var(--shadow-sm)',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <RefreshCw size={13} />
                <span>Regenerate</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Persistent Local Data */}
      <div
        className="card"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-panel)',
          borderRadius: 10,
          padding: '16px 20px',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <HardDrive size={18} style={{ color: 'var(--text-muted)' }} />
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
            Local Storage & Assets
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            Tokens, custom soundboard presets, and imported media are automatically stored in the local AppData directory.
          </div>
        </div>
      </div>
    </div>
  );
};