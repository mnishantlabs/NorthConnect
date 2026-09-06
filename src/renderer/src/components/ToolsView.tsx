import React, { useState, useMemo } from 'react';
import {
  Wrench,
  LogOut,
  ShieldCheck,
  Search,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Server,
  User,
  CheckCircle2,
  Zap,
  PlusCircle,
  Radio,
  Sliders,
  Sparkles,
  ArrowRight,
  X,
  Layers,
  ChevronRight,
  Flame,
} from 'lucide-react';
import type { Token } from '@shared/types';
import { status, displayName } from '@shared/predicates';
import { CustomSelect, type SelectOption } from './CustomSelect';

interface ToolsViewProps {
  tokens: Token[];
  onRefresh: () => void;
}

interface ToolCardDef {
  id: string;
  title: string;
  description: string;
  category: 'guild' | 'token' | 'automation' | 'broadcast';
  icon: React.ComponentType<any>;
  iconColor: string;
  iconBg: string;
  status: 'active' | 'coming_soon';
  tags: string[];
}

export const ToolsView: React.FC<ToolsViewProps> = ({ tokens, onRefresh }) => {
  const valid = useMemo(() => tokens.filter((t) => status(t) === 'valid'), [tokens]);

  const [activeModalTool, setActiveModalTool] = useState<'leave-servers' | null>(null);
  const [toolsSearch, setToolsSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Leave Servers Tool State
  const [selectedTokenKey, setSelectedTokenKey] = useState<string>('all');
  const [excludedGuildIds, setExcludedGuildIds] = useState<Set<string>>(new Set());
  const [serverSearchQuery, setServerSearchQuery] = useState('');
  const [delay, setDelay] = useState<number>(0.5);
  const [running, setRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number; currentName: string }>({
    current: 0,
    total: 0,
    currentName: '',
  });
  const [runLogs, setRunLogs] = useState<Array<{ text: string; type: 'info' | 'success' | 'error' }>>([]);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Tool Definitions
  const toolCards: ToolCardDef[] = [
    {
      id: 'leave-servers',
      title: 'Mass Server Leaver',
      description: 'Leave unwanted Discord guilds across one or all tokens with whitelist protection and safety delays.',
      category: 'guild',
      icon: LogOut,
      iconColor: 'var(--danger)',
      iconBg: 'rgba(239, 68, 68, 0.12)',
      status: 'active',
      tags: ['Whitelist Protection', 'Multi-Token', 'Safety Delay'],
    },
    {
      id: 'join-servers',
      title: 'Mass Server Joiner',
      description: 'Join guilds or vanity invite links across multiple accounts simultaneously with proxy support.',
      category: 'guild',
      icon: PlusCircle,
      iconColor: 'var(--primary)',
      iconBg: 'rgba(88, 101, 242, 0.12)',
      status: 'coming_soon',
      tags: ['Invite Auto-Resolve', 'Proxy Routing', 'Multi-Account'],
    },
    {
      id: 'guild-cleaner',
      title: 'Guild & Token Cleaner',
      description: 'Audit unreachable channels, filter invalid or banned tokens, and prune ghost guild memberships.',
      category: 'token',
      icon: ShieldCheck,
      iconColor: 'var(--success)',
      iconBg: 'rgba(16, 185, 129, 0.12)',
      status: 'coming_soon',
      tags: ['Health Audit', 'Ghost Pruner', 'Auto-Filter'],
    },
    {
      id: 'mass-reactor',
      title: 'Mass Reaction & Spammer',
      description: 'Trigger bulk emoji reactions, text tests, and interaction pings across active channels.',
      category: 'automation',
      icon: Flame,
      iconColor: '#f97316',
      iconBg: 'rgba(249, 115, 22, 0.12)',
      status: 'coming_soon',
      tags: ['Custom Emojis', 'Channel Pings', 'Rate-Limiting'],
    },
    {
      id: 'webhook-hub',
      title: 'Webhook Broadcaster',
      description: 'Dispatch rich formatted embeds and announcements to multiple Discord webhook URLs in parallel.',
      category: 'broadcast',
      icon: Radio,
      iconColor: '#a855f7',
      iconBg: 'rgba(168, 85, 247, 0.12)',
      status: 'coming_soon',
      tags: ['Embed Builder', 'Batch Dispatch', 'Preset Templates'],
    },
    {
      id: 'token-formatter',
      title: 'Token Formatter & Extractor',
      description: 'Extract, clean, and format token lists from raw text, logs, combo files, and data dumps.',
      category: 'token',
      icon: Layers,
      iconColor: '#06b6d4',
      iconBg: 'rgba(6, 182, 212, 0.12)',
      status: 'coming_soon',
      tags: ['Regex Parser', 'Deduplication', 'Export TXT/JSON'],
    },
  ];

  // Account Options for CustomSelect
  const accountOptions: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = [
      {
        value: 'all',
        label: `All Valid Accounts (${valid.length})`,
        sublabel: 'Mass Leave Across All',
        icon: <User size={14} />,
      },
    ];
    for (const t of valid) {
      opts.push({
        value: t.token,
        label: displayName(t),
        sublabel: `${t.servers?.length ?? 0} servers`,
        icon: <User size={14} />,
      });
    }
    return opts;
  }, [valid]);

  // Determine active tokens for Leave Tool
  const targetTokens = useMemo(() => {
    if (selectedTokenKey === 'all') return valid;
    const found = valid.find((t) => t.token === selectedTokenKey);
    return found ? [found] : valid;
  }, [selectedTokenKey, valid]);

  // Extract all servers for the targeted tokens
  const targetServers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; memberTokens: string[] }>();
    for (const t of targetTokens) {
      for (const s of t.servers ?? []) {
        const existing = map.get(s.id);
        if (existing) {
          if (!existing.memberTokens.includes(t.token)) existing.memberTokens.push(t.token);
        } else {
          map.set(s.id, { id: s.id, name: s.name || s.id, memberTokens: [t.token] });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [targetTokens]);

  // Filtered servers based on search
  const filteredServers = useMemo(() => {
    if (!serverSearchQuery.trim()) return targetServers;
    const q = serverSearchQuery.toLowerCase().trim();
    return targetServers.filter((s) => s.name.toLowerCase().includes(q) || s.id.includes(q));
  }, [targetServers, serverSearchQuery]);

  // Servers that will be left (not in excluded set)
  const serversToLeave = useMemo(() => {
    return targetServers.filter((s) => !excludedGuildIds.has(s.id));
  }, [targetServers, excludedGuildIds]);

  const toggleExclude = (guildId: string) => {
    if (running) return;
    setExcludedGuildIds((prev) => {
      const next = new Set(prev);
      if (next.has(guildId)) next.delete(guildId);
      else next.add(guildId);
      return next;
    });
  };

  const excludeAll = () => {
    setExcludedGuildIds(new Set(targetServers.map((s) => s.id)));
  };

  const clearExclusions = () => {
    setExcludedGuildIds(new Set());
  };

  const invertExclusions = () => {
    const next = new Set<string>();
    for (const s of targetServers) {
      if (!excludedGuildIds.has(s.id)) next.add(s.id);
    }
    setExcludedGuildIds(next);
  };

  // Run leave server operation
  const handleStartLeave = async () => {
    setConfirmModalOpen(false);
    if (serversToLeave.length === 0 || targetTokens.length === 0 || running) return;

    setRunning(true);
    setRunLogs([]);
    const totalOps = serversToLeave.length * targetTokens.length;
    setProgress({ current: 0, total: totalOps, currentName: 'Starting...' });

    setRunLogs((prev) => [
      ...prev,
      { text: `Initiating leave routine for ${serversToLeave.length} servers across ${targetTokens.length} account(s)...`, type: 'info' },
    ]);

    try {
      if (window.electronAPI?.leaveServers) {
        let leftCount = 0;
        let opIndex = 0;

        for (const target of serversToLeave) {
          setProgress({ current: opIndex + 1, total: totalOps, currentName: target.name });

          for (const tok of targetTokens) {
            const tokInServer = (tok.servers ?? []).some((s: any) => String(s.id) === target.id);
            if (!tokInServer) continue;

            opIndex++;
            const res = await window.electronAPI.leaveServers({
              tokens: [tok.token],
              guildIds: [target.id],
              delay,
            });

            if (res.success && res.left > 0) {
              leftCount++;
              setRunLogs((prev) => [
                ...prev,
                { text: `[${displayName(tok)}] Successfully left "${target.name}" (${target.id})`, type: 'success' },
              ]);
            } else {
              const errMsg = res.errors?.[0] || 'Failed';
              setRunLogs((prev) => [
                ...prev,
                { text: `[${displayName(tok)}] Error leaving "${target.name}": ${errMsg}`, type: 'error' },
              ]);
            }
          }
        }

        setRunLogs((prev) => [
          ...prev,
          { text: `Finished! Successfully left ${leftCount} server(s).`, type: 'success' },
        ]);
      }
    } catch (err: any) {
      setRunLogs((prev) => [...prev, { text: `Execution failed: ${err?.message || err}`, type: 'error' }]);
    } finally {
      setRunning(false);
      onRefresh();
    }
  };

  // Filter tool cards
  const filteredToolCards = useMemo(() => {
    return toolCards.filter((card) => {
      if (categoryFilter !== 'all' && card.category !== categoryFilter) return false;
      if (toolsSearch.trim()) {
        const q = toolsSearch.toLowerCase().trim();
        return card.title.toLowerCase().includes(q) || card.description.toLowerCase().includes(q) || card.tags.some((t) => t.toLowerCase().includes(q));
      }
      return true;
    });
  }, [toolCards, categoryFilter, toolsSearch]);

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
      {/* 1. Header Bar (Matches Home) */}
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
            Tools & Automation
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
              <strong style={{ color: 'var(--text-secondary)' }}>{toolCards.length}</strong> Utilities Available
            </span>
            <span>·</span>
            <span>
              <strong style={{ color: 'var(--text-secondary)' }}>{valid.length}</strong> Target Accounts
            </span>
            <span>·</span>
            <span>
              <strong style={{ color: 'var(--text-secondary)' }}>{targetServers.length}</strong> Detected Servers
            </span>
          </div>
        </div>

        {/* Quick Search & Category Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-card)',
              border: 'none',
              boxShadow: 'var(--shadow-sm)',
              borderRadius: 6,
              padding: '0 10px',
              height: 34,
              width: 200,
            }}
          >
            <Search size={13} style={{ color: 'var(--text-muted)', marginRight: 6 }} />
            <input
              type="text"
              placeholder="Search tools..."
              value={toolsSearch}
              onChange={(e) => setToolsSearch(e.target.value)}
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

          <div
            style={{
              display: 'flex',
              background: 'var(--bg-main)',
              padding: 2,
              borderRadius: 6,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {[
              { id: 'all', label: 'All' },
              { id: 'guild', label: 'Guilds' },
              { id: 'token', label: 'Tokens' },
              { id: 'automation', label: 'Automation' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 4,
                  border: 'none',
                  background: categoryFilter === cat.id ? 'var(--primary)' : 'transparent',
                  color: categoryFilter === cat.id ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
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
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Utilities Library</span>
            <Wrench size={14} style={{ color: 'var(--primary)' }} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {toolCards.length}{' '}
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>tools</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 10 }}>
            <span>Bulk Discord actions & automation</span>
          </div>
        </div>

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
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Target Accounts</span>
            <User size={14} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {valid.length}{' '}
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>ready</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 10 }}>
            <span>Authenticated tokens available for execution</span>
          </div>
        </div>

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
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Safety Engine</span>
            <ShieldCheck size={14} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#10b981', lineHeight: 1 }}>
            Active
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 10 }}>
            <span>Whitelist protection & delay rate-limiting</span>
          </div>
        </div>
      </div>

      {/* 3. Modular Tools Grid (Card Design matching Home) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {filteredToolCards.map((tool) => {
          const Icon = tool.icon;
          const isAvailable = tool.status === 'active';

          return (
            <div
              key={tool.id}
              className="card"
              onClick={() => {
                if (isAvailable) {
                  setActiveModalTool(tool.id as any);
                }
              }}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-panel)',
                borderRadius: 10,
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: isAvailable ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
                position: 'relative',
                boxShadow: 'var(--shadow-card)',
                minHeight: 180,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: tool.iconBg,
                      color: tool.iconColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={18} />
                  </div>

                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: isAvailable ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-main)',
                      color: isAvailable ? '#10b981' : 'var(--text-muted)',
                      border: isAvailable ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border-light)',
                    }}
                  >
                    {isAvailable ? 'Ready to Use' : 'In Development'}
                  </span>
                </div>

                <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                  {tool.title}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px 0', lineHeight: 1.45 }}>
                  {tool.description}
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {tool.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        background: 'var(--bg-main)',
                        padding: '2px 7px',
                        borderRadius: 4,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-light)',
                  paddingTop: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: isAvailable ? 'var(--primary)' : 'var(--text-muted)',
                  }}
                >
                  {isAvailable ? 'Open Tool' : 'Coming Soon'}
                </div>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: isAvailable ? 'rgba(88, 101, 242, 0.12)' : 'var(--bg-main)',
                    color: isAvailable ? 'var(--primary)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ChevronRight size={16} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* MASS SERVER LEAVER MODAL DIALOG                           */}
      {/* ========================================================= */}
      {activeModalTool === 'leave-servers' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9000,
            padding: 24,
            boxSizing: 'border-box',
          }}
        >
          <div
            className="card fade-in"
            style={{
              width: '100%',
              maxWidth: 860,
              maxHeight: '92vh',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              borderRadius: 16,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-medium)',
                background: 'var(--bg-card)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: 'var(--danger)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <LogOut size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Mass Server Leaver
                  </h2>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Select target tokens, protect servers you want to keep, and execute bulk leave
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  if (!running) setActiveModalTool(null);
                }}
                disabled={running}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: running ? 'not-allowed' : 'pointer',
                  padding: 6,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content Body */}
            <div
              style={{
                padding: '20px 24px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                flex: 1,
              }}
            >
              {/* Step 1 & 2: Account Selector and Configuration Bar */}
              <div
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 12,
                  padding: '16px 18px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: 16,
                }}
              >
                {/* Target Account */}
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
                    1 · Target Account(s)
                  </label>
                  <CustomSelect
                    options={accountOptions}
                    value={selectedTokenKey}
                    onChange={(val) => {
                      setSelectedTokenKey(val);
                      setExcludedGuildIds(new Set());
                    }}
                    disabled={running}
                  />
                </div>

                {/* Delay & Safety Config */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                      2 · Leave Delay
                    </label>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{delay.toFixed(1)}s per server</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="range"
                      min="0.2"
                      max="3.0"
                      step="0.1"
                      value={delay}
                      onChange={(e) => setDelay(parseFloat(e.target.value))}
                      disabled={running}
                      style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 60 }}>
                      {delay < 0.5 ? 'Fast' : delay <= 1.0 ? 'Normal' : 'Safe'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 3: Server Protection Whitelist Grid */}
              <div
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 12,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 280,
                  flex: 1,
                }}
              >
                {/* Filter & Quick Whitelist Controls */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>Server Whitelist & Protection</span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: 'rgba(88, 101, 242, 0.12)',
                          color: 'var(--primary)',
                        }}
                      >
                        {targetServers.length} total
                      </span>
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                      Checkmark servers to <strong style={{ color: 'var(--success)' }}>KEEP & PROTECT</strong>. Unchecked servers will be left.
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 6,
                        padding: '4px 8px',
                        width: 170,
                      }}
                    >
                      <Search size={13} style={{ color: 'var(--text-muted)', marginRight: 6 }} />
                      <input
                        type="text"
                        placeholder="Filter servers..."
                        value={serverSearchQuery}
                        onChange={(e) => setServerSearchQuery(e.target.value)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: 'var(--text-primary)',
                          fontSize: 11.5,
                          width: '100%',
                        }}
                      />
                    </div>

                    <button
                      onClick={excludeAll}
                      disabled={running || targetServers.length === 0}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 6,
                        padding: '5px 10px',
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      Protect All
                    </button>

                    <button
                      onClick={clearExclusions}
                      disabled={running || excludedGuildIds.size === 0}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 6,
                        padding: '5px 10px',
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      Leave All
                    </button>

                    <button
                      onClick={invertExclusions}
                      disabled={running || targetServers.length === 0}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 6,
                        padding: '5px 10px',
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      Invert
                    </button>
                  </div>
                </div>

                {/* Status Summary Banner */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: serversToLeave.length > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                    border: serversToLeave.length > 0 ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
                    marginBottom: 10,
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {serversToLeave.length > 0 ? (
                      <AlertTriangle size={14} style={{ color: 'var(--danger)' }} />
                    ) : (
                      <ShieldCheck size={14} style={{ color: 'var(--success)' }} />
                    )}
                    <span>
                      <strong>{serversToLeave.length}</strong> server(s) will be left ·{' '}
                      <strong style={{ color: 'var(--success)' }}>{excludedGuildIds.size}</strong> server(s) protected
                    </span>
                  </div>
                </div>

                {/* Server Grid */}
                <div
                  style={{
                    flex: 1,
                    maxHeight: 240,
                    overflowY: 'auto',
                    border: '1px solid var(--border-light)',
                    borderRadius: 8,
                    padding: 6,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: 8,
                    alignContent: 'start',
                    background: 'var(--bg-card)',
                  }}
                >
                  {targetServers.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Server size={30} style={{ opacity: 0.35, marginBottom: 6 }} />
                      <p style={{ margin: 0, fontSize: 12.5 }}>No servers found for selected account(s).</p>
                    </div>
                  ) : filteredServers.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No servers match "{serverSearchQuery}".
                    </div>
                  ) : (
                    filteredServers.map((s) => {
                      const isExcluded = excludedGuildIds.has(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => toggleExclude(s.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '7px 10px',
                            borderRadius: 8,
                            background: isExcluded ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-main)',
                            border: isExcluded ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-light)',
                            cursor: running ? 'not-allowed' : 'pointer',
                            transition: 'all 0.12s ease',
                            gap: 8,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                            <input
                              type="checkbox"
                              checked={isExcluded}
                              onChange={() => toggleExclude(s.id)}
                              disabled={running}
                              onClick={(e) => e.stopPropagation()}
                              style={{ accentColor: '#10b981', cursor: 'pointer' }}
                            />

                            <div
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: '50%',
                                background: isExcluded ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.12)',
                                color: isExcluded ? 'var(--success)' : 'var(--danger)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10.5,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {s.name.slice(0, 2).toUpperCase()}
                            </div>

                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {s.name}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                {s.id}
                              </div>
                            </div>
                          </div>

                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              padding: '2px 5px',
                              borderRadius: 4,
                              background: isExcluded ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                              color: isExcluded ? 'var(--success)' : 'var(--danger)',
                              flexShrink: 0,
                            }}
                          >
                            {isExcluded ? 'PROTECTED' : 'LEAVE'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Progress & Live Console */}
              {(running || runLogs.length > 0) && (
                <div
                  style={{
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 10,
                    padding: '12px 16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {running ? <RefreshCw size={13} className="spin-anim" style={{ color: 'var(--primary)' }} /> : <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />}
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {running ? `Leaving servers (${progress.current}/${progress.total}): ${progress.currentName}` : 'Execution Completed'}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {progress.total > 0 ? `${Math.round((progress.current / progress.total) * 100)}%` : ''}
                    </span>
                  </div>

                  {running && (
                    <div style={{ height: 3, background: 'var(--bg-card)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
                      <div
                        style={{
                          height: '100%',
                          background: 'var(--primary)',
                          width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                          transition: 'width 0.2s ease',
                        }}
                      />
                    </div>
                  )}

                  <div
                    style={{
                      maxHeight: 90,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      fontFamily: 'monospace',
                      fontSize: 11,
                    }}
                  >
                    {runLogs.map((log, i) => (
                      <div
                        key={i}
                        style={{
                          color: log.type === 'success' ? 'var(--success)' : log.type === 'error' ? 'var(--danger)' : 'var(--text-secondary)',
                        }}
                      >
                        {log.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 24px',
                borderTop: '1px solid var(--border-medium)',
                background: 'var(--bg-card)',
              }}
            >
              <button
                onClick={() => {
                  if (!running) setActiveModalTool(null);
                }}
                disabled={running}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-secondary)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: running ? 'not-allowed' : 'pointer',
                }}
              >
                Close
              </button>

              <button
                className="button-primary"
                disabled={serversToLeave.length === 0 || running}
                onClick={() => setConfirmModalOpen(true)}
                style={{
                  background: 'var(--danger)',
                  border: 'none',
                  padding: '8px 20px',
                  fontSize: 13,
                  borderRadius: 8,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: serversToLeave.length === 0 || running ? 'not-allowed' : 'pointer',
                  opacity: serversToLeave.length === 0 || running ? 0.5 : 1,
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.35)',
                }}
              >
                <Trash2 size={14} />
                <span>Leave {serversToLeave.length} Server(s)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Sub-Modal */}
      {confirmModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className="card fade-in"
            style={{
              width: 440,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              borderRadius: 14,
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--danger)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Confirm Mass Server Leave
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  This action is permanent and will leave the selected servers.
                </p>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 18px 0' }}>
              You are about to leave <strong style={{ color: 'var(--danger)' }}>{serversToLeave.length} server(s)</strong> across{' '}
              <strong>{targetTokens.length} account(s)</strong>.
              <br />
              <strong style={{ color: 'var(--success)' }}>{excludedGuildIds.size} server(s)</strong> are protected in your whitelist and will NOT be left.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setConfirmModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-secondary)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleStartLeave}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  background: 'var(--danger)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <LogOut size={14} />
                <span>Yes, Leave {serversToLeave.length} Servers</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
