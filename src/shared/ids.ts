export const SNOWFLAKE_EPOCH = 1420070400000;

/** True if the value looks like a Discord snowflake. */
export function isValidSnowflake(value: unknown): boolean {
  if (typeof value === 'boolean') return false;
  try {
    return parseInt(String(value), 10) > 0;
  } catch {
    return false;
  }
}

/** UTC creation time (ms) of a Discord snowflake, or null when unparsable. */
export function snowflakeTimeMs(userId: unknown): number | null {
  try {
    return Number((BigInt(String(userId)) >> 22n) + BigInt(SNOWFLAKE_EPOCH));
  } catch {
    return null;
  }
}

/** 'YYYY-MM-DD' string for a snowflake, or '?' when unparsable. */
export function createdFromId(userId: unknown): string {
  const ms = snowflakeTimeMs(userId);
  if (ms === null) return '?';
  const date = new Date(Number(ms));
  if (isNaN(date.getTime())) return '?';
  return date.toISOString().slice(0, 10);
}