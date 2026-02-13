const TIME_REGEX = /^(\d+)\s*(m|min|mins|minutes?|h|hrs?|hours?|d|days?|w|weeks?)$/i;

const UNITS: Record<string, number> = {
  m: 60,
  min: 60,
  mins: 60,
  minute: 60,
  minutes: 60,
  h: 3600,
  hr: 3600,
  hrs: 3600,
  hour: 3600,
  hours: 3600,
  d: 86400,
  day: 86400,
  days: 86400,
  w: 604800,
  week: 604800,
  weeks: 604800,
};

/**
 * Parse a human-readable duration string (e.g. "1d", "2h", "30m", "1w") into seconds.
 * Returns null if the string is not a valid duration.
 */
export function parseDuration(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  const match = trimmed.match(TIME_REGEX);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multiplier = UNITS[unit];

  if (!multiplier || value <= 0) return null;
  return value * multiplier;
}

/**
 * Format seconds into a human-readable duration string.
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";

  const weeks = Math.floor(seconds / 604800);
  seconds %= 604800;
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  const parts: string[] = [];
  if (weeks > 0) parts.push(`${weeks}w`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}
