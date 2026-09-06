import React from 'react';
import { Mic, LogOut, Volume2, RefreshCw } from 'lucide-react';

interface VoiceBarProps {
  connectedCount: number;
  tokenCount: number;
  counts?: { valid: number; invalid: number; locked: number };
  validating?: boolean;
  onLeaveAll: () => void;
  onOpenVoice: () => void;
}

export const VoiceBar: React.FC<VoiceBarProps> = ({
  connectedCount,
  tokenCount,
  counts = { valid: 0, invalid: 0, locked: 0 },
  validating = false,
  onLeaveAll,
  onOpenVoice,
}) => {
  return (
    <div
      className="nc-voicebar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '44px',
        padding: '0 16px',
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border-medium)',
        boxSizing: 'border-box',
        width: '100%',
        flexShrink: 0,
        zIndex: 40,
      }}
    >
      {/* Left side: Voice Connection Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Mic size={15} style={{ color: connectedCount > 0 ? 'var(--success)' : 'var(--text-muted)' }} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Voice</span>
        {connectedCount > 0 ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.12)',
              color: 'var(--success)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            <Volume2 size={11} /> {connectedCount} connected
          </span>
        ) : (
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            idle
          </span>
        )}
      </div>

      {/* Right side: Live Valid / Invalid / Locked Status & Action Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Live Token Status Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--bg-main)',
            border: '1px solid var(--border-light)',
            borderRadius: '14px',
            padding: '3px 10px',
            fontSize: '11px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{counts.valid}</span>
            <span style={{ color: 'var(--text-muted)' }}>valid</span>
          </div>

          <div style={{ width: 1, height: 10, background: 'var(--border-medium)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: counts.invalid > 0 ? '#ef4444' : 'var(--text-muted)' }} />
            <span style={{ color: counts.invalid > 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600 }}>{counts.invalid}</span>
            <span style={{ color: 'var(--text-muted)' }}>invalid</span>
          </div>

          {counts.locked > 0 && (
            <>
              <div style={{ width: 1, height: 10, background: 'var(--border-medium)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{counts.locked}</span>
                <span style={{ color: 'var(--text-muted)' }}>locked</span>
              </div>
            </>
          )}

          {validating && (
            <>
              <div style={{ width: 1, height: 10, background: 'var(--border-medium)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary)' }}>
                <RefreshCw size={10} className="spin-anim" />
                <span>validating...</span>
              </div>
            </>
          )}
        </div>

        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{tokenCount} accounts</span>

        {connectedCount > 0 ? (
          <button
            onClick={onLeaveAll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              fontSize: '11.5px',
              fontWeight: 600,
              borderRadius: '6px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: 'var(--danger)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <LogOut size={12} />
            <span>Leave all</span>
          </button>
        ) : (
          <button
            onClick={onOpenVoice}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              fontSize: '11.5px',
              fontWeight: 600,
              borderRadius: '6px',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Open voice
          </button>
        )}
      </div>
    </div>
  );
};