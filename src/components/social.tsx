import { Link } from 'react-router-dom';
import type { Account, SharedLook, SharedPiece } from '../types';
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
    <Link to={`/profile/${account.id}`} className="flex items-center gap-2.5 min-h-11 group">
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
          <img src={look.imageUrl} alt={look.name} className="w-full h-full object-cover" />
        ) : (
          <GarmentPlate categoryId="dresses" />
        )}
      </span>
      <div className={compact ? 'py-2 pr-3 min-w-0' : 'p-3'}>
        <p className={`text-text leading-snug ${compact ? 'text-[14px] truncate' : 'text-[15px]'}`}>
          {look.name}
        </p>
        {look.occasion ? (
          <p className="type-ledger text-[11px] text-text-2 mt-1 line-clamp-1">{look.occasion}</p>
        ) : null}
        {!compact && look.pieces.length > 0 ? (
          <p className="type-ledger text-[11px] text-text-2 mt-2 leading-relaxed">
            {look.pieces.join(' · ')}
          </p>
        ) : null}
      </div>
    </div>
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
        <span className="block text-[14px] text-text truncate">{piece.name}</span>
        {piece.category ? (
          <span className="type-ledger text-[11px] text-text-2 block mt-0.5">{piece.category}</span>
        ) : null}
      </span>
    </div>
  );
}

/** 'YYYY-MM-DD' → 'Aug 9'. Local, never parsed as UTC. */
export function shortDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
