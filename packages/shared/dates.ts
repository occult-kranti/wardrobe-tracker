// Local-timezone date helpers. All wear-log dates are YYYY-MM-DD in the
// user's local timezone — using toISOString() would shift days for anyone
// west of UTC in the evening or east of UTC in the morning.

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayLocal(): string {
  return formatLocalDate(new Date());
}

export function isFutureDate(dateStr: string): boolean {
  return dateStr > todayLocal();
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

export function daysSince(dateStr: string): number {
  const then = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((now.getTime() - then.getTime()) / 86400000));
}
