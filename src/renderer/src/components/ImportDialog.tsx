import React, { useState, useRef } from 'react';
import { X, Upload, RefreshCw } from 'lucide-react';

interface ImportDialogProps {
  onDone: () => void;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({ onDone }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const run = async () => {
    if (busy) return;
    const tokens = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (tokens.length === 0) return;
    setBusy(true);
    try {
      const added = await window.electronAPI!.importTokens(text);
      setMessage(added > 0 ? `Imported ${added} new token${added === 1 ? '' : 's'}` : 'No new tokens to import');
      setBusy(false);
      onDone();
      window.setTimeout(() => setMessage(''), 0);
    } catch (err: any) {
      setMessage(`Import failed: ${err?.message ?? err}`);
      setBusy(false);
    }
  };

  return (
    <div className="meta-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onDone(); }}>
      <div className="meta-modal nc-dialog">
        <div className="meta-modal-header">
          <div className="meta-modal-title">Import Tokens</div>
          <button className="meta-modal-close-btn" onClick={onDone}>
            <X size={18} />
          </button>
        </div>
        <div className="meta-modal-body">
          <div className="meta-grid-row">
            <span className="meta-grid-label">Paste tokens (one per line)</span>
            <textarea
              ref={ref}
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'token1\ntoken2\n…'}
              spellCheck={false}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
              {text.trim() ? `${text.trim().split(/\r?\n/).length} line(s)` : ''} — new tokens are validated automatically
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="nc-btn" onClick={onDone} disabled={busy}>Cancel</button>
              <button className="nc-btn primary" onClick={run} disabled={busy || !text.trim()}>
                {busy ? <RefreshCw size={14} className="animate-spin-custom" /> : <Upload size={14} />}
                {busy ? 'Validating…' : 'Import'}
              </button>
            </div>
          </div>
          {message && <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>{message}</span>}
          {busy && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
              <RefreshCw size={13} className="animate-spin-custom" /> Validating tokens against Discord…
            </div>
          )}
        </div>
      </div>
    </div>
  );
};