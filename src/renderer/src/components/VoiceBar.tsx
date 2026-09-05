import React from 'react';
import { Mic, LogOut, Volume2 } from 'lucide-react';

interface VoiceBarProps {
  connectedCount: number;
  tokenCount: number;
  onLeaveAll: () => void;
  onOpenVoice: () => void;
}

export const VoiceBar: React.FC<VoiceBarProps> = ({ connectedCount, tokenCount, onLeaveAll, onOpenVoice }) => {
  return (
    <div className="nc-voicebar">
      <Mic size={16} style={{ color: connectedCount > 0 ? 'var(--success)' : 'var(--player-btn-color)' }} />
      <span className="nc-voicebar-label">Voice</span>
      {connectedCount > 0 ? (
        <span className="nc-voicebar-pill live">
          <Volume2 size={12} /> {connectedCount} connected
        </span>
      ) : (
        <span className="nc-voicebar-pill" style={{ color: 'var(--player-btn-color)', background: 'rgba(0,0,0,0)', borderColor: 'transparent' }}>
          idle
        </span>
      )}
      <div className="nc-voicebar-spacer" />
      <span className="nc-voicebar-label" style={{ fontSize: 12 }}>{tokenCount} accounts</span>
      {connectedCount > 0 ? (
        <button className="nc-btn small danger" onClick={onLeaveAll}>
          <LogOut size={13} /> Leave all
        </button>
      ) : (
        <button className="nc-btn small" onClick={onOpenVoice}>
          Open voice
        </button>
      )}
    </div>
  );
};