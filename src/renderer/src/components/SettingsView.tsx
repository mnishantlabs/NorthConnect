import React, { useEffect, useState } from 'react';

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
    <div style={{ width: '100%', maxWidth: 680 }}>
      <div className="nc-settings-title" style={{ fontSize: 18, marginBottom: 18 }}>Settings</div>

      <div className="nc-settings-section">
        <div className="nc-settings-title">Discord API</div>
        <div className="nc-card" style={{ padding: '4px 16px' }}>
          <div className="nc-field">
            <span className="nc-field-label">Validation concurrency</span>
            <input className="nc-field-input" type="number" min={1} max={40} value={settings.concurrency}
              onChange={(e) => num('concurrency', e.target.value)} />
          </div>
          <div className="nc-field">
            <span className="nc-field-label">API timeout (seconds)</span>
            <input className="nc-field-input" type="number" min={1} max={60} value={settings.api_timeout}
              onChange={(e) => num('api_timeout', e.target.value)} />
          </div>
          <div className="nc-field">
            <span className="nc-field-label">429 retry delay (seconds)</span>
            <input className="nc-field-input" type="number" min={0} max={30} value={settings.retry_delay}
              onChange={(e) => num('retry_delay', e.target.value)} />
          </div>
          <div className="nc-field" style={{ borderBottom: 'none' }}>
            <span className="nc-field-label">Proxy (optional)</span>
            <input className="nc-field-input wide" value={settings.proxy} placeholder="http://host:port"
              onChange={(e) => onSave({ proxy: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="nc-settings-section">
        <div className="nc-settings-title">Voice</div>
        <div className="nc-card" style={{ padding: '4px 16px' }}>
          <div className="nc-field" style={{ borderBottom: 'none' }}>
            <span className="nc-field-label">Join delay per account (seconds)</span>
            <input className="nc-field-input" type="number" min={0} step={0.1} value={settings.delay}
              onChange={(e) => num('delay', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="nc-settings-section">
        <div className="nc-settings-title">Appearance & display</div>
        <div className="nc-card" style={{ padding: '4px 16px' }}>
          <div className="nc-field">
            <span className="nc-field-label">Show account badges (Nitro, Phone, flags)</span>
            <label className="nc-switch">
              <input type="checkbox" checked={settings.show_badges} onChange={(e) => onSave({ show_badges: e.target.checked })} />
              <span className="nc-switch-slider" />
            </label>
          </div>
          <div className="nc-field">
            <span className="nc-field-label">Show user IDs inline</span>
            <label className="nc-switch">
              <input type="checkbox" checked={settings.show_ids} onChange={(e) => onSave({ show_ids: e.target.checked })} />
              <span className="nc-switch-slider" />
            </label>
          </div>
          <div className="nc-field" style={{ borderBottom: 'none' }}>
            <span className="nc-field-label">Auto-validate on startup</span>
            <label className="nc-switch">
              <input type="checkbox" checked={settings.auto_validate} onChange={(e) => onSave({ auto_validate: e.target.checked })} />
              <span className="nc-switch-slider" />
            </label>
          </div>
        </div>
      </div>

      <div className="nc-settings-section">
        <div className="nc-settings-title">Extension Bridge</div>
        <div className="nc-card" style={{ padding: '4px 16px' }}>
          <div className="nc-field">
            <span className="nc-field-label">Sync tokens from the browser extension</span>
            <span className="nc-field-label" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              When the extension saves or detects a token, it is added here in tokens.json.
            </span>
            <label className="nc-switch">
              <input type="checkbox" checked={!!settings.bridge_enabled} onChange={(e) => onSave({ bridge_enabled: e.target.checked })} />
              <span className="nc-switch-slider" />
            </label>
          </div>
          <div className="nc-field">
            <span className="nc-field-label">Bridge port</span>
            <input className="nc-field-input" type="number" min={1024} max={65535} value={settings.bridge_port ?? 47474}
              onChange={(e) => num('bridge_port', e.target.value)} />
          </div>
          <div className="nc-field">
            <span className="nc-field-label" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              Status: {bridge?.enabled ? (bridge.running ? `listening on http://${bridge.host}:${bridge.port}` : 'stopped') : 'disabled'}
              {bridge ? ` · ${bridge.count} token(s) stored` : ' · checking…'}
            </span>
          </div>
          <div className="nc-field">
            <span className="nc-field-label">Bridge key (paste into the extension's Settings)</span>
            <span className="nc-field-row" style={{ display: 'flex', gap: 8 }}>
              <input className="nc-field-input" readOnly value={bridge?.secret ?? ''} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
              <button className="nc-btn" onClick={copySecret}>Copy</button>
              <button className="nc-btn" onClick={regenerateSecret}>Regenerate</button>
            </span>
          </div>
        </div>
      </div>

      <div className="nc-settings-section">
        <div className="nc-settings-title">Data</div>
        <div className="nc-card" style={{ padding: '4px 16px' }}>
          <div className="nc-field" style={{ borderBottom: 'none' }}>
            <span className="nc-field-label">Token storage</span>
            <span className="nc-field-label" style={{ color: 'var(--text-muted)', fontSize: 12 }}>Plaintext tokens.json in the app data folder (same schema as the original tool)</span>
          </div>
        </div>
      </div>
    </div>
  );
};