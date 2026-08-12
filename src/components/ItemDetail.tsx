import { useMemo, useState } from 'react';
import { useWardrobe } from '../context/WardrobeContext';
import {
  LAUNDRY_LABELS,
  RETIRE_REASONS,
  SEASON_LABELS,
  SOURCE_LABELS,
  categoryLabel,
  displayTag,
  isBenched,
  type ClothingItem,
  type LaundryStatus,
} from '../types';
import { daysSince } from '../lib/dates';
import { costPerWear, formatMoney, formatPerWear } from '../lib/cost';
import { findSimilarItems, wearContext } from '../lib/similarity';
import { Button, Chip, IconButton, Modal, SectionTitle, Stat, inputClass, selectClass } from './ui';
import { Basting, GarmentPlate } from './art';
import { IconPin } from './icons';
import { showToast } from './Toast';

/**
 * ONE PIECE — its record.
 *
 * The headline change (docs/06-focus-group-requirements.md §1 row 4, §3): a piece
 * leaves the closet by being RETIRED, keeping every wear it ever earned. Hard
 * delete still exists, but it is demoted to what it actually is — an undo for
 * something added by mistake — and it lives inside the retire step, in small type.
 *
 * Everything else here is a ledger: totals stated like a bank balance, no report
 * card, no alarm colours. Low wear reads as quiet, never as a verdict.
 */

const LAUNDRY_ORDER: LaundryStatus[] = ['clean', 'worn', 'washing', 'needs-repair', 'at-tailor'];

/** Wear-log dates are local YYYY-MM-DD; older records may carry a full ISO string. */
function longDate(dateStr: string): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function shortDate(dateStr: string): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Photo tile, or the drawn flat. The no-photo state is first-class, not broken. */
function Thumb({ item, className = '' }: { item: ClothingItem; className?: string }) {
  return (
    <div className={`bg-mat rounded-[2px] overflow-hidden ${className}`}>
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.name}
         
          className="w-full h-full object-cover"
        />
      ) : (
        <GarmentPlate categoryId={item.category} color={item.color} />
      )}
    </div>
  );
}

interface Props {
  itemId: string;
  onClose: () => void;
  /** Opens the intake form prefilled on this piece — amend, not re-enter. */
  onAmend: () => void;
}

export default function ItemDetail({ itemId, onClose, onAmend }: Props) {
  const {
    getItem,
    activeItems,
    wearLogs,
    settings,
    toggleFavoriteItem,
    setLaundryStatus,
    logWear,
    retireItem,
    unretireItem,
    deleteItem,
  } = useWardrobe();

  const item = getItem(itemId);

  const [step, setStep] = useState<'none' | 'retire'>('none');
  const [reasonChoice, setReasonChoice] = useState('');
  const [reasonNote, setReasonNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // "Do I already own something like this?" — asked of a piece already on the
  // rail. Facts only; the comparison never recommends anything.
  const similar = useMemo(
    () =>
      item
        ? findSimilarItems(
            activeItems,
            { ...item, occasions: item.occasion, excludeId: item.id },
            3
          )
        : [],
    [activeItems, item]
  );

  const history = useMemo(
    () => (item ? wearLogs.filter(l => l.itemIds.includes(item.id)) : []),
    [wearLogs, item]
  );

  if (!item) return null;

  const days = item.lastWorn ? daysSince(item.lastWorn.slice(0, 10)) : null;
  const cpw = costPerWear(item);
  const recent = [...history].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  const benched = isBenched(item);

  const wearToday = () => {
    const next = item.wearCount + 1;
    logWear([item.id]);
    showToast(`Logged. Worn ${next} ${next === 1 ? 'time' : 'times'}.`, 'seal');
  };

  const confirmRetire = () => {
    const reason = [reasonChoice, reasonNote.trim()].filter(Boolean).join(' — ');
    retireItem(item.id, reason || undefined);
    showToast('Retired. Its history stays on the books.', 'info');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={item.name} wide>
      <div className="space-y-6">
        {/* ---------- the piece itself ---------- */}
        <div className="grid sm:grid-cols-[minmax(0,190px)_1fr] gap-5">
          <div>
            <Thumb item={item} className="w-full aspect-[4/5]" />
            <div className="flex items-center gap-1 mt-1">
              <IconButton
                label={item.favorite ? 'Unpin this piece' : 'Pin this piece'}
                aria-pressed={item.favorite}
                active={item.favorite}
                onClick={() => toggleFavoriteItem(item.id)}
              >
                <IconPin size={18} />
              </IconButton>
              <span className="type-ledger text-[11px] text-text-2">
                {item.favorite ? 'Pinned' : 'Pin'}
              </span>
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Chip as="span">{categoryLabel(settings, item.category)}</Chip>
              <span className="inline-flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded-[2px] border border-border inline-block"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
                <span className="type-ledger text-[11px] text-text-2">{item.color}</span>
              </span>
              {item.pattern ? <Chip as="span">{item.pattern}</Chip> : null}
              {item.material ? <Chip as="span">{item.material}</Chip> : null}
            </div>

            {/* brand · source, stated flatly — every origin at the same weight */}
            {item.brand || item.source ? (
              <dl className="space-y-2">
                {item.brand ? (
                  <div className="flex gap-3">
                    <dt className="type-ledger text-[11px] text-text-2 w-[92px] shrink-0">Brand</dt>
                    <dd className="text-[15px] text-text">{item.brand}</dd>
                  </div>
                ) : null}
                {item.source ? (
                  <div className="flex gap-3">
                    <dt className="type-ledger text-[11px] text-text-2 w-[92px] shrink-0">Came to you</dt>
                    <dd className="text-[15px] text-text">{SOURCE_LABELS[item.source]}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}

            {item.fitsLike ? (
              <p className="type-editorial text-[20px] text-text leading-snug text-balance">
                “{item.fitsLike}”
              </p>
            ) : null}

            {benched ? (
              <p className="text-[13px] text-text-2 leading-snug">
                Benched — out of rotation until it comes back from the bench. The generator
                leaves it alone in the meantime.
              </p>
            ) : null}
          </div>
        </div>

        <Basting />

        {/* ---------- the ledger ---------- */}
        <div className="grid grid-cols-3 gap-4">
          <Stat value={item.wearCount} label="wears recorded" />
          {days !== null ? (
            <Stat value={days} label="days since worn" />
          ) : (
            <Stat value="—" label="no first wear yet" />
          )}
          {cpw.reason === 'ok' ? (
            <Stat value={formatPerWear(cpw.value)} label="per wear" />
          ) : cpw.reason === 'free' ? (
            // A recorded 0 is an answer, not a gap — this piece was inherited,
            // gifted or swapped. "$0.00 per wear" would read as a rendering bug.
            <Stat value="—" label="no purchase price" />
          ) : cpw.reason === 'no-wears' && cpw.basis !== undefined && cpw.basis > 0 ? (
            <Stat value={formatMoney(cpw.basis)} label="paid, resting so far" />
          ) : (
            <Stat value="—" label="no cost recorded" />
          )}
        </div>
        {days !== null && days >= 60 ? (
          <p className="type-editorial text-[18px] text-text-2 leading-snug">
            Quiet lately — last out {longDate(item.lastWorn ?? '')}.
          </p>
        ) : null}

        {/* ---------- what you can do with it today ---------- */}
        {item.retired ? (
          <div className="bg-sunken rounded-[2px] p-4">
            <p className="type-ledger text-[11px] text-text-2">
              Retired {longDate(item.retired.date)}
            </p>
            {item.retired.reason ? (
              <p className="type-editorial text-[18px] text-text mt-1.5 leading-snug">
                {item.retired.reason}
              </p>
            ) : (
              <p className="type-editorial text-[18px] text-text mt-1.5 leading-snug">
                This piece did its work.
              </p>
            )}
            <Button
              className="mt-3"
              compact
              onClick={() => {
                unretireItem(item.id);
                showToast('Back on the rail.', 'success');
              }}
            >
              Bring it back
            </Button>
          </div>
        ) : (
          <>
            <Basting />
            <div className="space-y-4">
              {/* The one carmine action in this view. */}
              <Button tone="hero" onClick={wearToday}>
                Wear today
              </Button>

              <fieldset className="border-0 p-0 m-0 space-y-1.5">
                <legend className="type-ledger text-[11px] text-text-2">Where it is</legend>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {LAUNDRY_ORDER.map(status => (
                    <Chip
                      key={status}
                      selected={item.laundryStatus === status}
                      onClick={() => setLaundryStatus(item.id, status)}
                    >
                      {LAUNDRY_LABELS[status]}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            </div>
          </>
        )}

        <Basting />

        {/* ---------- tags ---------- */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="type-ledger text-[11px] text-text-2">Seasons</p>
            <div className="flex flex-wrap gap-1.5">
              {item.season.length > 0 ? (
                item.season.map(s => (
                  <Chip key={s} as="span">
                    {SEASON_LABELS[s]}
                  </Chip>
                ))
              ) : (
                <span className="text-[13px] text-text-2">All year, as far as the record says.</span>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="type-ledger text-[11px] text-text-2">Occasions</p>
            <div className="flex flex-wrap gap-1.5">
              {item.occasion.length > 0 ? (
                item.occasion.map(o => (
                  <Chip key={o} as="span">
                    {displayTag(o)}
                  </Chip>
                ))
              ) : (
                <span className="text-[13px] text-text-2">No tags yet.</span>
              )}
            </div>
          </div>
        </div>

        {/* ---------- wear history ---------- */}
        {recent.length > 0 ? (
          <>
            <Basting />
            <div>
              <SectionTitle aside={`${history.length} recorded`}>Wear history</SectionTitle>
              <ul className="space-y-0">
                {recent.map(log => (
                  <li
                    key={log.id}
                    className="flex items-baseline justify-between gap-3 py-2 border-b border-border last:border-0"
                  >
                    <span className="text-[14px] text-text">{shortDate(log.date)}</span>
                    <span className="type-ledger text-[11px] text-text-2">
                      {log.outfitId ? 'with an outfit' : 'on its own'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}

        {/* ---------- notes ---------- */}
        {item.notes ? (
          <>
            <Basting />
            <div>
              <SectionTitle>Notes</SectionTitle>
              <p className="text-[14px] text-text-2 leading-relaxed whitespace-pre-line">
                {item.notes}
              </p>
            </div>
          </>
        ) : null}

        {/* ---------- similar pieces you own ---------- */}
        {similar.length > 0 ? (
          <>
            <Basting />
            <div>
              <SectionTitle aside={`${similar.length} close by`}>
                Similar pieces you own
              </SectionTitle>
              <ul className="grid grid-cols-3 gap-3">
                {similar.map(match => (
                  <li key={match.item.id}>
                    <Thumb item={match.item} className="w-full aspect-[4/5]" />
                    <p className="text-[13px] text-text mt-1.5 leading-tight">{match.item.name}</p>
                    <p className="type-ledger text-[11px] text-text-2 tabular mt-0.5">
                      {wearContext(match.item)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}

        {/* ---------- retire, don't delete ---------- */}
        {!item.retired ? (
          <>
            <Basting />
            {step === 'none' ? (
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* The add form has promised "fill it in later" since it
                      shipped; this is the later. Name, photo, cost, all of it —
                      the wear history stays untouched. */}
                  <Button onClick={onAmend}>Amend the record</Button>
                  <Button onClick={() => setStep('retire')}>Retire this piece</Button>
                </div>
                <p className="text-[13px] text-text-2 mt-2.5 leading-snug">
                  Amending edits what the record says; retiring takes it out of browsing,
                  outfits and comparisons, and keeps every wear it earned.
                </p>
              </div>
            ) : (
              <div className="bg-sunken rounded-[2px] p-4 space-y-4">
                <p className="type-editorial text-[20px] text-text leading-snug">
                  This piece did its work.
                </p>

                <div className="space-y-1.5">
                  <label
                    htmlFor="retire-reason"
                    className="type-ledger text-[11px] text-text-2 block"
                  >
                    Where it went
                  </label>
                  <select
                    id="retire-reason"
                    value={reasonChoice}
                    onChange={e => setReasonChoice(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Not saying</option>
                    {RETIRE_REASONS.map(reason => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="retire-note"
                    className="type-ledger text-[11px] text-text-2 block"
                  >
                    In your words
                  </label>
                  <input
                    id="retire-note"
                    type="text"
                    value={reasonNote}
                    onChange={e => setReasonNote(e.target.value)}
                    placeholder="Went to Sam, who wears it better"
                    autoComplete="off"
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={confirmRetire}>Retire it</Button>
                  <Button
                    tone="tertiary"
                    onClick={() => {
                      setStep('none');
                      setConfirmDelete(false);
                    }}
                  >
                    Keep it in the closet
                  </Button>
                </div>

                {/* Hard delete, demoted to what it actually is. */}
                <div className="pt-1">
                  {confirmDelete ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[13px] text-text-2">
                        Deleting drops the piece and its {item.wearCount}{' '}
                        {item.wearCount === 1 ? 'wear' : 'wears'} for good.
                      </span>
                      <Button
                        compact
                        tone="destructive"
                        onClick={() => {
                          deleteItem(item.id);
                          showToast('Deleted. Nothing kept.', 'info');
                          onClose();
                        }}
                      >
                        Delete anyway
                      </Button>
                      <Button compact tone="tertiary" onClick={() => setConfirmDelete(false)}>
                        Never mind
                      </Button>
                    </div>
                  ) : (
                    <Button tone="tertiary" onClick={() => setConfirmDelete(true)}>
                      Added by mistake? Delete instead
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </Modal>
  );
}
