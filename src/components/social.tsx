import { Link } from 'react-router-dom';
import { DEFAULT_CATEGORIES, type Account, type SharedLook, type SharedPiece } from '../types';
import { formatLocalDate } from '../lib/dates';
import { GarmentPlate, TagPortrait } from './art';

/**
 * The pieces every social surface shares, so a look shown in the feed, in a
 * chat, on a profile and against an event all read as the same object.
 */

/** A garment tag bearing a monogram, or the wardrobe's portrait. Never a face. */
export function AccountMark({ account, size = 36 }: { account: Account; size?: number }) {
  if (account.portrait) {
    return (
      <span
        className="block shrink-0 bg-mat overflow-hidden rounded-[2px]"
        style={{ width: size, height: size * 1.25 }}
      >
        <img src={account.portrait} alt="" className="w-full h-full object-cover" />
      </span>
    );
  }
  return <TagPortrait monogram={account.monogram} color={account.color} size={size} />;
}

export function AccountLine({ account, meta }: { account: Account; meta?: string }) {
  return (
    // min-w-0 on the link itself: without it a long wardrobe name shoves the
    // row's right-hand controls off a 390px screen instead of truncating.
    <Link to={`/profile/${account.id}`} className="flex items-center gap-2.5 min-h-11 min-w-0 group">
      <AccountMark account={account} size={26} />
      <span className="min-w-0">
        <span className="block text-[14px] text-text group-hover:underline underline-offset-[3px] truncate">
          {account.name}
        </span>
        <span className="type-ledger text-[11px] text-text-2 block tabular">
          {account.handle}
          {meta ? ` · ${meta}` : ''}
        </span>
      </span>
    </Link>
  );
}

/**
 * A shared look. The photograph and piece names are a SNAPSHOT taken when it was
 * shared — the viewer's app cannot reach into someone else's closet, and a look
 * someone already saw should not silently change under them.
 */
export function LookCard({ look, compact }: { look: SharedLook; compact?: boolean }) {
  // A snapshot with no piece list threw on `.length` during render and blanked
  // the ENTIRE app — feed, navigation, no way out. A missing field in someone
  // else's record must never be able to do that.
  const pieces = look.pieces ?? [];
  const name = look.name || 'A look';
  return (
    <div className={`border border-border rounded-[2px] overflow-hidden ${compact ? 'flex gap-3' : ''}`}>
      {/* Capped: uncapped w-full inside the max-w-5xl column rendered each post
          ~950×1267px, and eleven posts made a 16,000px page. The photograph is
          a feed entry, not a hero. */}
      <span
        className={`block bg-mat overflow-hidden shrink-0 ${compact ? 'w-16' : 'w-full max-w-[380px] mx-auto'}`}
        style={{ aspectRatio: '4 / 5' }}
      >
        {look.imageUrl ? (
          <img src={look.imageUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <GarmentPlate categoryId="dresses" />
        )}
      </span>
      <div className={compact ? 'py-2 pr-3 min-w-0' : 'p-3'}>
        <p className={`text-text leading-snug ${compact ? 'text-[14px] truncate' : 'text-[15px]'}`}>
          {name}
        </p>
        {look.occasion ? (
          <p className="type-ledger text-[11px] text-text-2 mt-1 line-clamp-1">{look.occasion}</p>
        ) : null}
        {!compact && pieces.length > 0 ? (
          <p className="type-ledger text-[11px] text-text-2 mt-2 leading-relaxed">
            {pieces.join(' · ')}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The 4:5 tile the feed and the profile grid share — the photograph of the
 * look, or the drawn flat when there is none. Flat mat behind it either way;
 * nothing decorative goes behind a photo.
 */
export function LookThumb({ look, alt }: { look: SharedLook; alt?: string }) {
  return (
    <span className="block w-full bg-mat overflow-hidden" style={{ aspectRatio: '4 / 5' }}>
      {look.imageUrl ? (
        <img src={look.imageUrl} alt={alt ?? look.name} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <GarmentPlate categoryId="dresses" />
      )}
    </span>
  );
}

export function PieceCard({ piece }: { piece: SharedPiece }) {
  return (
    <div className="border border-border rounded-[2px] flex gap-3 items-center overflow-hidden">
      <span className="block w-14 bg-mat overflow-hidden shrink-0" style={{ aspectRatio: '4 / 5' }}>
        {piece.imageUrl ? (
          <img src={piece.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <GarmentPlate categoryId={piece.category ?? 'accessories'} color={piece.color} name={piece.name} />
        )}
      </span>
      <span className="py-2 pr-3 min-w-0">
        <span className="block text-[14px] text-text truncate">{piece.name || 'A piece'}</span>
        {piece.category ? (
          <span className="type-ledger text-[11px] text-text-2 block mt-0.5">
            {sharedCategoryLabel(piece.category)}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/**
 * The name of a category on someone else's piece.
 *
 * Read from the house defaults, never from the reader's own settings — the
 * piece belongs to another wardrobe, and a reader who renamed 'dresses' has
 * not renamed it for them. An id we do not know passes through verbatim.
 * This used to print the raw id: 'dresses' where 'One-pieces' was meant.
 */
export function sharedCategoryLabel(id: string): string {
  return DEFAULT_CATEGORIES.find(c => c.id === id)?.label ?? id;
}

/** 'YYYY-MM-DD' → 'Aug 9'. Local, never parsed as UTC. */
export function shortDate(date: string | undefined): string {
  if (!date) return '';
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * 'YYYY-MM-DDTHH:MM:SS', local — the sub-day stamp a post's or message's `at`
 * carries. Local like every date in the app: toISOString is UTC, which reads
 * as tomorrow for half the evening west of Greenwich and scrambles same-day
 * order for everyone else.
 */
export function nowLocalStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${formatLocalDate(d)}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * Comparators that tolerate a record with no date.
 *
 * An undated row used to be enough to throw inside the sort and blank the page
 * it was on. Undated sorts last, and the id breaks every tie so the order is
 * stable between renders.
 *
 * `at` (sub-day time, stamped when a row is written) leads `date`: two posts
 * or messages from the same day used to fall through to the id tiebreak, which
 * for user content is a random UUID — same-day order reshuffled by chance.
 * Rows written before `at` existed carry only a date and sort behind the timed
 * rows of their day, which is the honest reading of "sometime that day".
 */
export function newestFirst<T extends { date?: string; at?: string; id: string }>(a: T, b: T): number {
  const t = (b.at ?? '').localeCompare(a.at ?? '');
  if (t !== 0) return t;
  const d = (b.date ?? '').localeCompare(a.date ?? '');
  return d !== 0 ? d : a.id.localeCompare(b.id);
}

export function oldestFirst<T extends { date?: string; at?: string; id: string }>(a: T, b: T): number {
  const t = (a.at ?? '').localeCompare(b.at ?? '');
  if (t !== 0) return t;
  const d = (a.date ?? '').localeCompare(b.date ?? '');
  return d !== 0 ? d : a.id.localeCompare(b.id);
}
