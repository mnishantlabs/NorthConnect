import type { Token, TokenCategory, TokenStatus, ViewFilter } from './types';

/** Derive the validity status of a token. */
export function status(t: Pick<Token, 'user_id' | 'error'>): TokenStatus {
  if (t.user_id) return 'valid';
  const err = (t.error || '').toUpperCase();
  if (err.includes('LOCK') || err.includes('FLAGGED')) return 'locked';
  return 'invalid';
}

/** Categorize a token into a display group (used for grouping/filters). */
export function categorize(t: Pick<Token, 'user_id' | 'error' | 'premium_type' | 'phone'>): TokenCategory {
  if (!t.user_id) return 'invalid';
  if (status({ user_id: t.user_id, error: t.error }) === 'locked') return 'locked';
  if ((t.premium_type ?? 0) > 0) return 'nitro';
  if (t.phone) return 'phone';
  return 'valid';
}

/** True when the token survives the active list filter. */
export function passFilters(t: Pick<Token, 'user_id' | 'error'>, viewFilter: ViewFilter): boolean {
  if (viewFilter === 'all') return true;
  const valid = status(t) === 'valid';
  return valid ? viewFilter === 'valid' : viewFilter !== 'valid';
}

/** True when the token matches the free-text search query. */
export function matchSearch(t: Pick<Token, 'username' | 'user_id' | 'email' | 'phone' | 'servers'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const parts: string[] = [
    t.username || '',
    t.user_id || '',
    String(t.email ?? ''),
    String(t.phone ?? ''),
  ];
  for (const server of t.servers || []) {
    parts.push(server.name || '', server.id || '');
  }
  return parts.join(' ').toLowerCase().includes(q);
}

/** Legacy display name username#discriminator. */
export function displayName(t: Pick<Token, 'username' | 'discriminator'>): string {
  return `${t.username || '?'}#${t.discriminator || '0'}`;
}