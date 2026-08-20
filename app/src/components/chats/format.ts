/**
 * The little grammar every chat surface shares — dates, order, labels.
 *
 * SOURCE OF TRUTH, mirrored by reading and never by importing (the app
 * imports no web files): src/components/social.tsx (shortDate,
 * nowLocalStamp, oldestFirst, sharedCategoryLabel) and src/pages/Chats.tsx
 * (STATUS_LABELS). The date arithmetic itself comes from @almari/shared —
 * nothing here re-derives a formula, these are display conventions.
 */
import { formatLocalDate } from '@almari/shared/dates';
import { DEFAULT_CATEGORIES, type BorrowStatus } from '@almari/shared/types';

/**
 * The words a borrow request wears — ports src/pages/Chats.tsx. A declined
 * request is a neutral fact: "Staying home", never an alarm.
 */
export const STATUS_LABELS: Record<BorrowStatus, string> = {
  asked: 'Asked',
  lent: 'Lent',
  declined: 'Staying home',
  returned: 'Home again',
};

/**
 * 'YYYY-MM-DD' → '9 Aug'. Local, never parsed as UTC — and en-IN, the house
 * locale (owner decision 2026-08-19). Ports social.tsx shortDate.
 */
export function shortDate(date: string | undefined): string {
  if (!date) return '';
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * 'YYYY-MM-DDTHH:MM:SS', local — the sub-day stamp a message's `at` carries.
 * Ports social.tsx nowLocalStamp; toISOString is UTC and scrambles same-day
 * order for everyone east or west of Greenwich.
 */
export function nowLocalStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${formatLocalDate(d)}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * Comparators that tolerate a record with no date — ports social.tsx.
 * `at` (sub-day) leads `date`; the id breaks every tie so the order is
 * stable between renders.
 */
export function oldestFirst<T extends { date?: string; at?: string; id: string }>(
  a: T,
  b: T,
): number {
  const t = (a.at ?? '').localeCompare(b.at ?? '');
  if (t !== 0) return t;
  const d = (a.date ?? '').localeCompare(b.date ?? '');
  return d !== 0 ? d : a.id.localeCompare(b.id);
}

export function newestFirst<T extends { date?: string; at?: string; id: string }>(
  a: T,
  b: T,
): number {
  const t = (b.at ?? '').localeCompare(a.at ?? '');
  if (t !== 0) return t;
  const d = (b.date ?? '').localeCompare(a.date ?? '');
  return d !== 0 ? d : a.id.localeCompare(b.id);
}

/**
 * The name of a category on someone else's piece — read from the house
 * defaults, never the reader's own settings (the piece belongs to another
 * wardrobe). Ports social.tsx sharedCategoryLabel.
 */
export function sharedCategoryLabel(id: string): string {
  return DEFAULT_CATEGORIES.find(c => c.id === id)?.label ?? id;
}
