export interface ServerInfo {
  id: string;
  name: string;
}

export function serverInfoFromDict(data: any): ServerInfo {
  return { id: String(data?.id ?? ''), name: String(data?.name ?? '') };
}

export interface ChannelInfo {
  id: string;
  name: string;
  type: number;
}

export function channelInfoFromDict(data: any): ChannelInfo {
  return {
    id: String(data?.id ?? ''),
    name: String(data?.name ?? ''),
    type: Number(data?.type ?? 0) || 0,
  };
}

export interface VoiceTarget {
  guild_id: string;
  guild_name: string;
  channel_id: string;
  channel_name: string;
}

export function voiceTargetFromDict(data: any): VoiceTarget {
  return {
    guild_id: String(data?.guild_id ?? ''),
    guild_name: String(data?.guild_name ?? ''),
    channel_id: String(data?.channel_id ?? ''),
    channel_name: String(data?.channel_name ?? ''),
  };
}

export interface RawToken {
  token: string;
  username?: string;
  discriminator?: string;
  user_id?: string;
  email?: string | null;
  phone?: string | null;
  mfa_enabled?: boolean;
  is_bot?: boolean;
  is_verified?: boolean;
  premium_type?: number;
  flags?: string[];
  servers?: Array<{ id: string; name: string }>;
  error?: string;
  code?: string;
}

export interface Token {
  token: string;
  username: string;
  discriminator: string;
  user_id: string;
  email: string | null;
  phone: string | null;
  mfa_enabled: boolean;
  is_bot: boolean;
  is_verified: boolean;
  premium_type: number;
  flags: string[];
  servers: ServerInfo[];
  error: string;
  code: string;
}

export function tokenFromDict(token: string, data: any): Token {
  return {
    token,
    username: String(data?.username ?? 'Unknown'),
    discriminator: String(data?.discriminator ?? '0'),
    user_id: String(data?.user_id ?? ''),
    email: data?.email ?? null,
    phone: data?.phone ?? null,
    mfa_enabled: Boolean(data?.mfa_enabled ?? false),
    is_bot: Boolean(data?.is_bot ?? false),
    is_verified: Boolean(data?.verified ?? data?.is_verified ?? false),
    premium_type: Number(data?.premium_type ?? 0) || 0,
    flags: Array.isArray(data?.flags) ? data.flags : [],
    servers: Array.isArray(data?.servers) ? data.servers.map(serverInfoFromDict) : [],
    error: String(data?.error ?? ''),
    code: String(data?.code ?? ''),
  };
}

export function tokenToDict(t: Token): Record<string, unknown> {
  const d: Record<string, unknown> = {
    username: t.username,
    discriminator: t.discriminator,
    user_id: t.user_id,
    email: t.email,
    phone: t.phone,
    mfa_enabled: t.mfa_enabled,
    is_bot: t.is_bot,
    premium_type: t.premium_type,
    flags: t.flags,
    servers: t.servers.map((s) => ({ id: s.id, name: s.name })),
  };
  return d;
}

export type TokenStatus = 'valid' | 'invalid' | 'locked';

export type TokenCategory = 'invalid' | 'locked' | 'nitro' | 'phone' | 'valid';

export const CATEGORY_ORDER: TokenCategory[] = ['invalid', 'locked', 'nitro', 'phone', 'valid'];

export const CATEGORY_LABELS: Record<TokenCategory, string> = {
  invalid: 'Invalid',
  locked: 'Locked',
  nitro: 'Nitro',
  phone: 'Phone Verified',
  valid: 'Valid',
};

export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'rate';

export const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
  success: 'SUCCESS',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  rate: 'NETWORK',
};

export type SortMode = 'Server Count' | 'Name' | 'User ID';

export interface LogRecord {
  timestamp: number;
  message: string;
  level: LogLevel;
}

export type ViewFilter = 'all' | 'valid' | 'invalid';