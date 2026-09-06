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
  KeyRound,
  AlertCircle,
  X,
  Server,
  ShieldCheck,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import type { Token } from '@shared/types';
import { categorize, matchSearch, passFilters, status, displayName } from '@shared/predicates';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('Server Count');
  const [sortDesc, setSortDesc] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ x: number; y: number; token: Token } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [replacingToken, setReplacingToken] = useState<Token | null>(null);
  const [newTokenInput, setNewTokenInput] = useState('');
  const [isReplacing, setIsReplacing] = useState(false);
  const [justCopied, setJustCopied] = useState<string | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    const c: Record<ViewFilter, number> = { all: tokens.length, valid: 0, invalid: 0 };
    for (const t of tokens) c[status(t) === 'valid' ? 'valid' : 'invalid']++;
    return c;
  }, [tokens]);

  const validPct = tokens.length > 0 ? Math.round((counts.valid / tokens.length) * 100) : 0;

  const serverCount = useMemo(() => {
    const ids = new Set<string>();
    for (const t of tokens) for (const s of t.servers ?? []) ids.add(s.id);
    return ids.size;
  }, [tokens]);

  const rows = useMemo(() => {
    let list = tokens.filter((t) => passFilters(t, filter));
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((t) => {
        const name = displayName(t).toLowerCase();
        const id = (t.user_id ?? '').toLowerCase();
        const tk = t.token.toLowerCase();
        const em = (t.email ?? '').toLowerCase();
        return name.includes(q) || id.includes(q) || tk.includes(q) || em.includes(q);
      });
    }

    list.sort((a, b) => {
      let r = 0;
      if (sort === 'Server Count') r = (a.servers?.length ?? 0) - (b.servers?.length ?? 0);
      else if (sort === 'Name') r = (a.global_name || a.username).localeCompare(b.global_name || b.username);
      else r = a.user_id.localeCompare(b.user_id);
      return sortDesc ? -r : r;
    });
    return list;
  }, [tokens, filter, searchQuery, sort, sortDesc]);

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

  const handleConfirmReplace = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!replacingToken || !newTokenInput.trim() || !window.electronAPI) return;
    setIsReplacing(true);
    try {
      await window.electronAPI.replaceToken(replacingToken.token, newTokenInput.trim());
      setReplacingToken(null);
      setNewTokenInput('');
    } catch (err) {
      console.error('Failed to replace token:', err);
    } finally {
      setIsReplacing(false);
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
      label: 'Replace token',
      icon: <KeyRound size={14} />,
      onClick: () => {
        setReplacingToken(t);
        setNewTokenInput('');
      },
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
        setRenameValue(t.global_name || (t.username === 'Unknown' ? '' : t.username));
      },
    },
    {
      label: 'Join voice',
      icon: <Mic size={14} />,
      onClick: () => onJoinVoice(t.token),
      disabled: !t.user_id || status(t) !== 'valid',
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
    else if (s === 'invalid') out.push(<span key="invalid" className="nc-badge" style={{ background: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.25)' }}><AlertCircle size={10} /> Invalid Token</span>);
    if (cat === 'nitro') out.push(<span key="nitro" className="nc-badge nitro">NITRO</span>);
    if (t.phone) out.push(<span key="phone" className="nc-badge phone"><Phone size={10} /> Phone</span>);
    if (t.is_bot) out.push(<span key="bot" className="nc-badge bot"><Bot size={10} /> Bot</span>);
    for (const f of (t.flags ?? []).slice(0, 2)) out.push(<span key={f} className="nc-badge flag">{f}</span>);
    return out;
  };

  return (
    <div
      className="fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '24px 28px',
        boxSizing: 'border-box',
        overflowY: 'auto',
        gap: '20px',
      }}
    >
      {/* 1. Header Bar: Title, Subtitle & Primary Actions (Matches Home) */}
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
            Token Accounts
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
            <span>
              <strong style={{ color: 'var(--text-secondary)' }}>{counts.valid}</strong> Valid Credentials
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {selectedArr.length > 0 && (
            <button
              onClick={() => onDelete(selectedArr.map((t) => t.token))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                fontSize: 12.5,
                fontWeight: 600,
                borderRadius: 6,
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: 'var(--danger)',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={13} />
              <span>Delete ({selectedArr.length})</span>
            </button>
          )}

          <button
            onClick={() => onRequestValidate(selectedArr.length > 0 ? selectedArr : tokens)}
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
            <RotateCcw size={13} className={validating ? 'spin-anim' : ''} />
            <span>{validating ? 'Validating...' : selectedArr.length > 0 ? `Validate (${selectedArr.length})` : 'Validate All'}</span>
          </button>

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
        </div>
      </div>

      {/* 2. Top Metric Cards (Matches Home) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 14,
        }}
      >
        {/* Metric 1: Account Health */}
        <div
          className="card"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-panel)',
            borderRadius: 10,
            padding: '16px 18px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Token Health</span>
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
            {counts.invalid > 0 && (
              <div style={{ width: `${(counts.invalid / (tokens.length || 1)) * 100}%`, background: '#ef4444' }} />
            )}
          </div>
        </div>

        {/* Metric 2: Accessible Guilds */}
        <div
          className="card"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-panel)',
            borderRadius: 10,
            padding: '16px 18px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Accessible Guilds</span>
            <Server size={14} style={{ color: 'var(--text-muted)' }} />
          </div>

          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {serverCount}
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 10 }}>
            <span>Available servers across accounts</span>
          </div>
        </div>

        {/* Metric 3: Active Selection */}
        <div
          className="card"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-panel)',
            borderRadius: 10,
            padding: '16px 18px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Selection & Filter</span>
            <CheckCircle2 size={14} style={{ color: selected.size > 0 ? 'var(--primary)' : 'var(--text-muted)' }} />
          </div>

          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {selected.size}{' '}
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>selected</span>
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 10 }}>
            <span>{rows.length} accounts displayed</span>
          </div>
        </div>
      </div>

      {/* 3. Main Account Card Feed (Card Container matching Home) */}
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
          gap: 14,
          flex: 1,
        }}
      >
        {/* Search & Filter Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {/* Quick Search Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-main)',
              border: 'none',
              boxShadow: 'var(--shadow-sm)',
              borderRadius: 6,
              padding: '0 10px',
              height: 32,
              flex: 1,
              maxWidth: 340,
            }}
          >
            <Search size={13} style={{ color: 'var(--text-muted)', marginRight: 6 }} />
            <input
              type="text"
              placeholder="Search accounts by name, user ID, email..."
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

          {/* Right Controls: Filter Pills & Sort Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-main)',
                padding: 2,
                borderRadius: 6,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {(['all', 'valid', 'invalid'] as ViewFilter[]).map((f) => {
                const active = filter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 4,
                      border: 'none',
                      background: active ? 'var(--primary)' : 'transparent',
                      color: active ? '#ffffff' : 'var(--text-secondary)',
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'background-color 0.12s ease',
                    }}
                  >
                    {f === 'all' ? 'All' : f === 'valid' ? 'Valid' : 'Invalid'} ({counts[f]})
                  </button>
                );
              })}
            </div>

            <div style={{ width: 150 }}>
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
                width: 32,
                height: 32,
                borderRadius: 6,
                background: 'var(--bg-main)',
                border: 'none',
                boxShadow: 'var(--shadow-sm)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {sortDesc ? <SortDesc size={14} /> : <SortAsc size={14} />}
            </button>
          </div>
        </div>

        {/* Select All Bar */}
        {rows.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 8px',
              fontSize: 11.5,
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--border-light)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
        )}

        {/* Accounts Card List */}
        {rows.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Search size={28} style={{ opacity: 0.35, marginBottom: 10 }} />
            <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
              {tokens.length === 0 ? 'No accounts loaded' : 'No matching accounts'}
            </h3>
            <p style={{ fontSize: 12, margin: 0 }}>
              {tokens.length === 0
                ? 'Import your Discord tokens to begin validating, managing, and connecting.'
                : 'No accounts match the current filter or search criteria.'}
            </p>
            {tokens.length === 0 && (
              <button className="button-primary" onClick={onImport} style={{ marginTop: 12, fontSize: 12, borderRadius: 6 }}>
                Import Tokens
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
            {rows.map((t) => {
              const s = status(t);
              const isSelected = selected.has(t.token);
              const nameToShow = t.global_name || t.username;

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
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: isSelected ? 'rgba(88, 101, 242, 0.08)' : 'var(--bg-main)',
                    border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
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

                  {/* Avatar Picture */}
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: s === 'valid' ? 'rgba(16, 185, 129, 0.12)' : s === 'locked' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      border: `1.5px solid ${s === 'valid' ? '#10b981' : s === 'locked' ? '#f59e0b' : '#ef4444'}`,
                      color: s === 'valid' ? 'var(--text-primary)' : 'var(--danger)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {t.avatar_url ? (
                      <img
                        src={t.avatar_url}
                        alt={nameToShow}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          (e.target as any).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span>{(nameToShow || '?').slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>

                  {/* Account Name & Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
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
                              onRename(t.token, renameValue.trim() || nameToShow);
                              setRenaming(null);
                            }
                            if (e.key === 'Escape') setRenaming(null);
                          }}
                          onBlur={() => setRenaming(null)}
                          style={{
                            height: 22,
                            border: '1px solid var(--primary)',
                            borderRadius: 4,
                            background: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: 13,
                            fontWeight: 600,
                            padding: '0 5px',
                            outline: 'none',
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {nameToShow}
                        </span>
                      )}

                      {t.username && t.username !== 'Unknown' && (
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>
                          @{t.username}
                        </span>
                      )}

                      <div style={{ display: 'inline-flex', gap: 4 }}>{badge(t)}</div>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span>{t.token.slice(0, 16)}…{t.token.slice(-6)}</span>
                      {t.user_id && <span>· ID: {t.user_id}</span>}
                      {t.email && <span>· {t.email}</span>}
                      {justCopied === `tk-${t.token}` && <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ token copied</span>}
                    </div>
                  </div>

                  {/* Actions & Servers */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {s === 'invalid' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReplacingToken(t);
                          setNewTokenInput('');
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 8px',
                          borderRadius: 6,
                          background: 'rgba(88, 101, 242, 0.12)',
                          border: '1px solid rgba(88, 101, 242, 0.3)',
                          color: 'var(--primary)',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        title="Paste a new token for this account"
                      >
                        <KeyRound size={11} />
                        <span>Replace</span>
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copy(t.token, `tk-${t.token}`);
                      }}
                      title="Copy Token"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 4,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Copy size={13} />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onJoinVoice(t.token);
                      }}
                      disabled={s !== 'valid'}
                      title="Connect to Voice"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        borderRadius: 6,
                        background: 'var(--bg-card)',
                        border: 'none',
                        boxShadow: 'var(--shadow-sm)',
                        color: s === 'valid' ? 'var(--primary)' : 'var(--text-muted)',
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: s === 'valid' ? 'pointer' : 'not-allowed',
                      }}
                    >
                      <Mic size={12} />
                      <span>Voice</span>
                    </button>

                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        background: 'var(--bg-card)',
                        boxShadow: 'var(--shadow-sm)',
                        padding: '3px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {t.servers?.length ?? 0} servers
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Replace Token Modal Dialog */}
      {replacingToken && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={() => setReplacingToken(null)}
        >
          <div
            className="nc-card fade-in"
            style={{
              width: '100%',
              maxWidth: 460,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              borderRadius: 10,
              padding: 22,
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRound size={16} color="var(--primary)" />
                <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Replace Token for {replacingToken.global_name || replacingToken.username}
                </h3>
              </div>
              <button
                onClick={() => setReplacingToken(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Paste the new Discord token for account <strong>{replacingToken.global_name || replacingToken.username}</strong> ({replacingToken.user_id ? `ID: ${replacingToken.user_id}` : ''}).
            </p>

            <form onSubmit={handleConfirmReplace} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                autoFocus
                placeholder="Paste new Discord token here..."
                value={newTokenInput}
                onChange={(e) => setNewTokenInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  fontSize: 12.5,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setReplacingToken(null)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: 'transparent',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTokenInput.trim() || isReplacing}
                  className="button-primary"
                  style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}
                >
                  {isReplacing ? 'Saving...' : 'Confirm Replace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.token)} onClose={() => setMenu(null)} />}
    </div>
  );
};