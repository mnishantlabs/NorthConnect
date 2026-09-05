import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ScrollText, Trash2 } from 'lucide-react';

export interface LogEntry {
  timestamp: string;
  message: string;
  level: string;
}

interface ActivityViewProps {
  logs: LogEntry[];
  onClear: () => void;
}

const LEVELS = ['all', 'success', 'info', 'warn', 'error', 'rate'] as const;

export const ActivityView: React.FC<ActivityViewProps> = ({ logs, onClear }) => {
  const [filter, setFilter] = useState<(typeof LEVELS)[number]>('all');
  const bottomRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => (filter === 'all' ? logs : logs.filter((l) => l.level === filter)), [logs, filter]);
  const reversed = useMemo(() => [...rows].reverse(), [rows]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [rows.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="nc-toolbar">
        <div className="nc-seg">
          {LEVELS.map((l) => (
            <button key={l} className={filter === l ? 'active' : ''} onClick={() => setFilter(l)}>
              {l === 'all' ? 'All' : l}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button className="nc-btn danger" onClick={onClear} disabled={logs.length === 0}>
          <Trash2 size={14} /> Clear
        </button>
      </div>

      <div className="nc-card" style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
        {reversed.length === 0 ? (
          <div className="nc-empty">
            <ScrollText size={28} />
            <h3>No activity yet</h3>
            <p>Validations, voice joins, and imports are logged here in a live stream.</p>
          </div>
        ) : (
          <div className="nc-log-list">
            {reversed.map((l, i) => (
              <div key={i} className="nc-log-row">
                <span className="nc-log-time">{l.timestamp}</span>
                <span className={`nc-log-level ${l.level}`}>{l.level.toUpperCase()}</span>
                <span className="nc-log-message">{l.message}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
};