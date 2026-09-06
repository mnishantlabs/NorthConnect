import React, { useState, useMemo } from 'react';
import { Radio, Server, VolumeX, LogOut } from 'lucide-react';
import { VoiceView } from './VoiceView';
import { ServersView } from './ServersView';
import type { Token } from '@shared/types';
import { status } from '@shared/predicates';

interface ConnectViewProps {
  tokens: Token[];
  connected: Set<string>;
  selectedToken: string | null;
  onChangeSelectedToken: (token: string | null) => void;
  selectedGuildId: string;
  selectedGuildName: string;
  onSelectServer: (guildId: string, guildName: string) => void;
  selectedChannelId: string;
  selectedChannelName: string;
  onSelectChannel: (channelId: string, channelName: string) => void;
  onJoin: (tokens: string[], payload: { guildId: string; guildName: string; channelId: string; channelName: string; mute: boolean; deaf: boolean }) => void;
  onLeave: (token: string) => void;
  onJoinRecent: (target: { guild_id: string; guild_name: string; channel_id: string; channel_name: string }) => void;
  recents: Array<{ guild_id: string; guild_name: string; channel_id: string; channel_name: string }>;
  delay: number;
}

export const ConnectView: React.FC<ConnectViewProps> = (props) => {
  const [tab, setTab] = useState<'voice' | 'servers'>('voice');

  const valid = useMemo(() => props.tokens.filter((t) => status(t) === 'valid'), [props.tokens]);

  const serverCount = useMemo(() => {
    const ids = new Set<string>();
    for (const t of props.tokens) for (const s of t.servers ?? []) ids.add(s.id);
    return ids.size;
  }, [props.tokens]);

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
            Voice Connect Hub
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
              <strong style={{ color: 'var(--text-secondary)' }}>{valid.length}</strong> Accounts Ready
            </span>
            <span>·</span>
            <span>
              <strong style={{ color: 'var(--text-secondary)' }}>{serverCount}</strong> Accessible Guilds
            </span>
            <span>·</span>
            <span style={{ color: props.connected.size > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
              <strong style={{ color: props.connected.size > 0 ? 'var(--primary)' : 'var(--text-secondary)' }}>
                {props.connected.size}
              </strong>{' '}
              Voice Active
            </span>
          </div>
        </div>

        {/* Tab switcher & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-main)',
              padding: 2,
              borderRadius: 6,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <button
              onClick={() => setTab('voice')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderRadius: 4,
                border: 'none',
                background: tab === 'voice' ? 'var(--primary)' : 'transparent',
                color: tab === 'voice' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
            >
              <Radio size={13} />
              <span>Voice Joiner</span>
              {props.connected.size > 0 && (
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: 10,
                    background: tab === 'voice' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(88, 101, 242, 0.2)',
                    color: tab === 'voice' ? '#ffffff' : 'var(--primary)',
                  }}
                >
                  {props.connected.size}
                </span>
              )}
            </button>

            <button
              onClick={() => setTab('servers')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderRadius: 4,
                border: 'none',
                background: tab === 'servers' ? 'var(--primary)' : 'transparent',
                color: tab === 'servers' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
            >
              <Server size={13} />
              <span>Guilds & Channels</span>
            </button>
          </div>

          {props.connected.size > 0 && (
            <button
              onClick={() => props.onLeave('')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: 'var(--danger)',
                cursor: 'pointer',
              }}
            >
              <LogOut size={12} />
              <span>Leave All ({props.connected.size})</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === 'voice' ? <VoiceView {...props} /> : <ServersView tokens={props.tokens} connected={props.connected} />}
      </div>
    </div>
  );
};
