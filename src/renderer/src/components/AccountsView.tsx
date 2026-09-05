import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Upload,
  RefreshCw,
  Search,
  Copy,
  User,
  Trash2,
  Mic,
  RotateCcw,
  ShieldAlert,
  Phone,
  Bot,
  SortAsc,
  SortDesc,
  Check,
} from 'lucide-react';
import type { Token } from '../../../shared/types';
import { categorize, matchSearch, passFilters, status, displayName } from '../../../shared/predicates';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { CustomSelect, type SelectOption } from './CustomSelect';

export type ViewFilter = 'all' | 'valid' | 'invalid';
export type SortMode = 'Server Count' | 'Name' | 'User ID';

interface AccountsViewProps {
  tokens: Token[];
  validating: boolean;
  validatingSet: Set<string>;
  onImport: () => void;
  onRequestValidate: (tokens: Token[]) => void;
  onDelete: (tokens: string[]) => void;
  onRename: (token: string, name: string) => void;
  onJoinVoice: (token: string) => void;
}

const SORT_OPTIONS: SelectOption[] = [
  { value: 'Server Count', label: 'Sort: Server Count' },
  { value: 'Name', label: 'Sort: Name' },
  { value: 'User ID', label: 'Sort: User ID' },
];

export const AccountsView: React.FC<AccountsViewProps> = ({
  tokens,
  validating,
  validatingSet,
  onImport,
  onRequestValidate,
  onDelete,
  onRename,
  onJoinVoice,
}) => {
  const [filter, setFilter] = useState<ViewFilter>('all');
  const [sort, setSort] = useState<SortMode>('Server Count');
  const [sortDesc, setSortDesc] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ x: number; y: number; token: Token } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [justCopied, setJustCopied] = useState<string | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    const c: Record<ViewFilter, number> = { all: tokens.length, valid: 0, invalid: 0 };
    for (const t of tokens) c[status(t) === 'valid' ? 'valid' : 'invalid']++;
    return c;
  }, [tokens]);

  const rows = useMemo(() => {
    const list = tokens.filter((t) => passFilters(t, filter));
    list.sort((a, b) => {
      let r = 0;
      if (sort === 'Server Count') r = (a.servers?.length ?? 0) - (b.servers?.length ?? 0);
      else if (sort === 'Name') r = a.username.localeCompare(b.username);
      else r = a.user_id.localeCompare(b.user_id);
      return sortDesc ? -r : r;
    });
    return list;
  }, [tokens, filter, sort, sortDesc]);

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setJustCopied(key);
    window.setTimeout(() => setJustCopied((k) => (k === key ? null : k)), 1200);
  };

  const toggleSelect = (token: string, additive: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (additive) {
        if (next.has(token)) next.delete(token);
        else next.add(token);
      } else {
        next.clear();
        next.add(token);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === rows.length && rows.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.token)));
    }
  };

  const selectedArr = tokens.filter((t) => selected.has(t.token));

  const menuItems = (t: Token): MenuItem[] => [
    {
      label: 'Validate',
      icon: <RotateCcw size={14} />,
      onClick: () => onRequestValidate([t]),
      disabled: validating,
    },
    {
      label: 'Copy token',
      icon: <Copy size={14} />,
      onClick: () => copy(t.token, `tk-${t.token}`),
    },
    {
      label: 'Copy user ID',
      icon: <Copy size={14} />,
      onClick: () => copy(t.user_id, `id-${t.token}`),
      disabled: !t.user_id,
    },
    {
      label: 'Copy username',
      icon: <Copy size={14} />,
      onClick: () => copy(displayName(t), `un-${t.token}`),
      disabled: !t.username || t.username === 'Unknown',
    },
    { divider: true },
    {
      label: 'Rename',
      icon: <User size={14} />,
      onClick: () => {
        setRenaming(t.token);
        setRenameValue(t.username === 'Unknown' ? '' : t.username);
      },
    },
    {
      label: 'Join voice',
      icon: <Mic size={14} />,
      onClick: () => onJoinVoice(t.token),
      disabled: !t.user_id,
    },
    { divider: true },
    {
      label: 'Delete',
      icon: <Trash2 size={14} />,
      danger: true,
      onClick: () => onDelete([t.token]),
    },
  ];

  useEffect(() => {
    if (renaming) renameRef.current?.select();
  }, [renaming]);

  const badge = (t: Token) => {
    const cat = categorize(t);
    const s = status(t);
    const out: React.ReactNode[] = [];
    if (s === 'locked') out.push(<span key="locked" className="nc-badge locked"><ShieldAlert size={10} /> Locked</span>);
    if (cat === 'nitro') out.push(<span key="nitro" className="nc-badge nitro">NITRO</span>);
    if (t.phone) out.push(<span key="phone" className="nc-badge phone"><Phone size={10} /> Phone</span>);
    if (t.is_bot) out.push(<span key="bot" className="nc-badge bot"><Bot size={10} /> Bot</span>);
    for (const f of (t.flags ?? []).slice(0, 2)) out.push(<span key={f} className="nc-badge flag">{f}</span>);
    return out;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 20px', boxSizing: 'border-box', overflowY: 'auto' }}>
      {/* Clean, Non-Duplicated Toolbar */}
      <div
        className="nc-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '8px 12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-medium)',
          borderRadius: 10,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        {/* Left Side: Filter Segmentation Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="nc-seg" style={{ display: 'flex', background: 'var(--bg-main)', padding: 3, borderRadius: 8, border: '1px solid var(--border-light)' }}>
            {(['all', 'valid', 'invalid'] as ViewFilter[]).map((f) => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  className={active ? 'active' : ''}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: active ? 'var(--primary)' : 'transparent',
                    color: active ? '#ffffff' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {f === 'all' ? 'All' : f === 'valid' ? 'Valid' : 'Invalid'} ({counts[f]})
                </button>
              );
            })}
          </div>

          {/* Sort Selector using CustomSelect */}
          <div style={{ width: 165 }}>
            <CustomSelect
              options={SORT_OPTIONS}
              value={sort}
              onChange={(val) => setSort(val as SortMode)}
            />
          </div>

          <button
            onClick={() => setSortDesc((d) => !d)}
            title={sortDesc ? 'Descending' : 'Ascending'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 10px',
              borderRadius: 8,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {sortDesc ? <SortDesc size={15} /> : <SortAsc size={15} />}
          </button>
        </div>

        {/* Right Side: Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selectedArr.length > 0 && (
            <button
              className="button-secondary"
              onClick={() => onDelete(selectedArr.map((t) => t.token))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: 'var(--danger)',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Trash2 size={13} />
              <span>Delete ({selectedArr.length})</span>
            </button>
          )}

          <button
            className="button-secondary"
            disabled={validating || (selectedArr.length === 0 && tokens.length === 0)}
            onClick={() => onRequestValidate(selectedArr.length > 0 ? selectedArr : tokens)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 8,
              background: 'var(--bg-main)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: validating ? 'not-allowed' : 'pointer',
              opacity: validating ? 0.6 : 1,
            }}
          >
            <RotateCcw size={13} className={validating ? 'spin-anim' : ''} />
            <span>Validate {selectedArr.length > 0 ? `(${selectedArr.length})` : `(${tokens.length})`}</span>
          </button>

          <button
            className="button-primary"
            onClick={onImport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            <Upload size={14} />
            <span>Import Tokens</span>
          </button>
        </div>
      </div>

      {/* Account Cards / Rows List */}
      <div
        className="nc-card"
        style={{
          padding: 8,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-medium)',
          borderRadius: 12,
          flex: 1,
          overflowY: 'auto',
        }}
      >
        {rows.length === 0 ? (
          <div className="nc-empty" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Search size={32} style={{ opacity: 0.4, marginBottom: 12 }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
              {tokens.length === 0 ? 'No accounts loaded' : 'No matching accounts'}
            </h3>
            <p style={{ fontSize: 13, margin: 0 }}>
              {tokens.length === 0
                ? 'Import your Discord tokens to begin validating, managing, and connecting.'
                : 'No accounts match the current filter criteria.'}
            </p>
            {tokens.length === 0 && (
              <button className="button-primary" onClick={onImport} style={{ marginTop: 14, fontSize: 12.5 }}>
                Import Tokens
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Header select all bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                fontSize: 11.5,
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border-light)',
                marginBottom: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={selected.size === rows.length && rows.length > 0}
                  onChange={selectAll}
                  style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <span>Select All ({rows.length})</span>
              </div>
              <span>{selected.size} selected</span>
            </div>

            {rows.map((t) => {
              const s = status(t);
              const isSelected = selected.has(t.token);
              return (
                <div
                  key={t.token}
                  className={`nc-token-row ${isSelected ? 'selected' : ''}`}
                  onClick={(e) => toggleSelect(t.token, e.ctrlKey || e.metaKey || e.shiftKey)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (!isSelected) setSelected(new Set([t.token]));
                    setMenu({ x: e.clientX, y: e.clientY, token: t });
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: isSelected ? 'rgba(59, 130, 246, 0.09)' : 'var(--bg-main)',
                    border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    gap: 12,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(t.token, true)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />

                  <div
                    className="nc-avatar"
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: s === 'valid' ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)',
                      color: s === 'valid' ? 'var(--success)' : 'var(--danger)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12.5,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {(t.username || '?').slice(0, 2).toUpperCase()}
                  </div>

                  <div className="nc-token-main" style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      {validatingSet.has(t.token) ? (
                        <RefreshCw size={12} className="spin-anim" style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      ) : (
                        <span className={`nc-status-dot ${s}`} />
                      )}
                      {renaming === t.token ? (
                        <input
                          ref={renameRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onRename(t.token, renameValue.trim() || t.username);
                              setRenaming(null);
                            }
                            if (e.key === 'Escape') setRenaming(null);
                          }}
                          onBlur={() => setRenaming(null)}
                          style={{
                            height: 24,
                            border: '1px solid var(--primary)',
                            borderRadius: 6,
                            background: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: 13.5,
                            fontWeight: 700,
                            padding: '0 6px',
                            outline: 'none',
                          }}
                        />
                      ) : (
                        <span className="nc-token-name" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {t.username}
                        </span>
                      )}
                      {t.discriminator && t.discriminator !== '0' && (
                        <span style={{ fontWeight: 500, color: 'var(--text-secondary)', fontSize: 12 }}>#{t.discriminator}</span>
                      )}
                      <div className="nc-token-meta">{badge(t)}</div>
                    </div>
                    <div className="nc-token-sub" style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'monospace' }}>
                      {t.token.slice(0, 24)}…{t.token.slice(-8)}
                      {t.user_id && <span style={{ color: 'var(--text-muted)' }}>  ·  {t.user_id}</span>}
                      {t.email && <span style={{ color: 'var(--text-muted)' }}>  ·  {t.email}</span>}
                      {justCopied === `tk-${t.token}` && <span style={{ color: 'var(--success)', fontWeight: 600 }}>  ✓ copied</span>}
                      {justCopied === `id-${t.token}` && <span style={{ color: 'var(--success)', fontWeight: 600 }}>  ✓ id copied</span>}
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-card-hover)',
                      padding: '3px 8px',
                      borderRadius: 6,
                      flexShrink: 0,
                    }}
                  >
                    {t.servers?.length ?? 0} servers
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.token)} onClose={() => setMenu(null)} />}
    </div>
  );
};