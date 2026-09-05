export const API_BASE = 'https://discord.com/api/v9';
export const GATEWAY_URL = 'wss://gateway.discord.gg/?v=9&encoding=json';

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

export const HEADERS: Record<string, string> = { 'User-Agent': USER_AGENT };

export const FLAG_NAMES: Record<number, string> = {
  1: 'Staff',
  2: 'Partner',
  4: 'Hypesquad',
  8: 'Bug Hunter',
  16384: 'Bug Hunter Level 2',
  131072: 'Verified Developer',
  262144: 'Moderator Programs',
  [1 << 18]: 'Active Developer',
};

export const LOG_BUFFER_SIZE = 1000;
export const RECENT_VOICE_MAX = 8;
export const RECENT_VOICE_SHOWN = 3;
export const USER_ID_SNIPPET = 14;
export const FLAGS_SNIPPET = 6;

export const TYPE_CATEGORY = 4;
export const TYPE_GUILD_TEXT = 0;
export const TYPE_GUILD_VOICE = 2;