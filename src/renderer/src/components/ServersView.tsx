import React, { useMemo, useState } from 'react';
import { Server, Users, Search, Copy } from 'lucide-react';
import type { Token } from '../../../shared/types';
import { status } from '../../../shared/predicates';

interface ServersViewProps {
  tokens: Token[];
  connected: Set<string>;
}

export const ServersView: React.FC<ServersViewProps> = ({ tokens, connected }) => {
  const [search, setSearch] = useState('');
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const serverMap = useMemo(() => {
    const map = new Map<string, { id: string; members: Token[] }>();
    for (const t of tokens) {
      if (status(t) !== 'valid') continue;
      for (const s of t.servers ?? []) {
        const name = s.name || s.id;
        const entry = map.get(name);
        if (entry) {
          if (!entry.members.some((m) => m.token === t.token)) entry.members.push(t);
        } else {
          map.set(name, { id: s.id, members: [t] });
        }
      }
    }
    return map;
  }, [tokens]);

  const servers = useMemo(() => {
    const list = [...serverMap.entries()].map(([name, entry]) => ({
      name,
      id: entry.id,
      members: entry.members,
    }));
    list.sort((a, b) => b.members.length - a.members.length);
    const q = search.trim().toLowerCase();
    return q ? list.filter((s) => s.name.toLowerCase().includes(q)) : list;
  }, [serverMap, search]);

  const selected = servers.find((s) => s.id === selectedServer) ?? null;

  const copy = (token: string) => {
    navigator.clipboard?.writeText(token).catch(() => {});
    setCopied(token);
    window.setTimeout(() => setCopied((c) => (c === token ? null : c)), 1000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 14 }}>
      <div className="nc-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <Search size={15} style={{ color: 'var(--text-muted)' }} />
          <input className="nc-toolbar-search" placeholder="Filter servers…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, maxWidth: 300 }} />
        </div>
        <span className="nc-token-count">{servers.length} servers · {servers.reduce((n, s) => n + s.members.length, 0)} member slots</span>
      </div>

      <div style={{ display: 'flex', gap: 14, flex: 1, minHeight: 0 }}>
        <div className="nc-card" style={{ flex: 1, overflowY: 'auto', padding: 6, minWidth: 260 }}>
          {servers.length === 0 ? (
            <div className="nc-empty">
              <Server size={28} />
              <h3>No servers found</h3>
              <p>Validated tokens populate their servers here. Validate your accounts or join more servers to grow this list.</p>
            </div>
          ) : (
            servers.map((s) => (
              <div
                key={s.id}
                className={`nc-server-row ${selectedServer === s.id ? 'active' : ''}`}
                onClick={() => setSelectedServer(s.id)}
              >
                <div className="nc-server-icon">{s.name.slice(0, 2).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{s.id}</div>
                </div>
                <span className="nc-token-count">{s.members.length}</span>
              </div>
            ))
          )}
        </div>

        <div className="nc-card" style={{ flex: 2, overflowY: 'auto', padding: '16px 20px' }}>
          {!selected ? (
            <div className="nc-empty">
              <Users size={28} />
              <h3>Select a server</h3>
              <p>View the accounts that are members of each server, with one-click token access.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div className="nc-server-icon" style={{ width: 44, height: 44, fontSize: 15 }}>{selected.name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{selected.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>ID {selected.id}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {selected.members.map((t) => {
                  const connectedTile = connected.has(t.token);
                  return (
                    <div key={t.token} className={`nc-member-chip ${connectedTile ? 'connected' : ''}`} onClick={() => copy(t.token)} title={connectedTile ? 'In voice — click to copy token' : 'Click to copy token'}>
                      <Users size={11} />
                      {t.username}
                      {t.discriminator && t.discriminator !== '0' && <span style={{ opacity: 0.6 }}>#{t.discriminator}</span>}
                      {copied === t.token && <span style={{ color: 'var(--success)' }}><Copy size={11} /></span>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};