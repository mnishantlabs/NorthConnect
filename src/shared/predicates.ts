import type { Token, TokenCategory, TokenStatus, ViewFilter } from './types';

/** Derive the validity status of a token. */
export function status(t: { user_id?: string; error?: string; valid?: boolean }): TokenStatus {
  if (t.valid === false || (t.error && !t.valid)) {
    const err = (t.error || '').toUpperCase();
    if (err.includes('LOCK') || err.includes('FLAGGED') || t.error === 'LOCKED') return 'locked';
    return 'invalid';
  }
  if (t.user_id && t.valid !== false) return 'valid';
  return 'invalid';
}

/** Categorize a token into a display group (used for grouping/filters). */
export function categorize(t: Pick<Token, 'user_id' | 'error' | 'premium_type' | 'phone' | 'valid'>): TokenCategory {
  const s = status(t);
  if (s === 'locked') return 'locked';
  if (s === 'invalid') return 'invalid';
  if ((t.premium_type ?? 0) > 0) return 'nitro';
  if (t.phone) return 'phone';
  return 'valid';
}

/** True when the token survives the active list filter. */
export function passFilters(t: Pick<Token, 'user_id' | 'error' | 'valid'>, viewFilter: ViewFilter): boolean {
  if (viewFilter === 'all') return true;
  const valid = status(t) === 'valid';
  return valid ? viewFilter === 'valid' : viewFilter !== 'valid';
}

/** True when the token matches the free-text search query. */
export function matchSearch(t: Partial<Token>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const parts: string[] = [
    t.global_name || '',
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

/** Best display name: Global / Server Display Name, falling back to username. */
export function displayName(t: Pick<Token, 'username' | 'discriminator'> & { global_name?: string | null }): string {
  if (t.global_name) return t.global_name;
  if (!t.discriminator || t.discriminator === '0') return t.username || 'Unknown';
  return `${t.username || '?'}#${t.discriminator}`;
}