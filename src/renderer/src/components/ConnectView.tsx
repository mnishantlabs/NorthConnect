import React, { useState } from 'react';
import { Radio, Server, Mic, Users, Flame } from 'lucide-react';
import { VoiceView } from './VoiceView';
import { ServersView } from './ServersView';
import type { Token } from '../../../shared/types';

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Sub-tab switcher */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          borderBottom: '1px solid var(--border-medium)',
          background: 'var(--bg-titlebar)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setTab('voice')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: tab === 'voice' ? 'var(--primary)' : 'transparent',
              color: tab === 'voice' ? '#ffffff' : 'var(--text-secondary)',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Radio size={14} />
            <span>Voice Joiner</span>
            {props.connected.size > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: tab === 'voice' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(59, 130, 246, 0.2)',
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
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: tab === 'servers' ? 'var(--primary)' : 'transparent',
              color: tab === 'servers' ? '#ffffff' : 'var(--text-secondary)',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Server size={14} />
            <span>Guilds & Channels</span>
          </button>
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
          {tab === 'voice' ? `${props.connected.size} active voice session${props.connected.size === 1 ? '' : 's'}` : 'Browse guild memberships'}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, minHeight: 0, padding: tab === 'servers' ? '12px 16px' : '0' }}>
        {tab === 'voice' ? <VoiceView {...props} /> : <ServersView tokens={props.tokens} connected={props.connected} />}
      </div>
    </div>
  );
};
