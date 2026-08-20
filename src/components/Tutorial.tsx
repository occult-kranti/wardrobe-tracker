import { useState } from 'react';
import { Button, Modal } from './ui';
import { guideSeen, markGuideSeen, markTourDone } from '../lib/tutorial';
import { guideFor, guideKeyFor } from '../lib/pageGuides';

/**
 * THE SHORT TOUR — four cards, shown once, on a new wardrobe's first Today.
 *
 * A quiet sheet, not a wizard: one card at a time, one primary button per card,
 * a factual "1 of 4" instead of dots, and nothing that celebrates. Every beat
 * is skippable four ways — the cross, Escape, the scrim, "Not now" — and all of
 * them write the same flag, so the tour never asks twice. The Modal supplies
 * the bottom sheet on a handset, the focus trap, and the reduced-motion
 * collapse; there is nothing here to animate on top of it.
 */

interface Beat {
  title: string;
  body: string;
}

const BEATS: Beat[] = [
  {
    title: 'Begin with one piece.',
    body: 'A photograph is welcome but never asked for. A piece without one is drawn as a flat, so a closet with no photographs still looks intentional. A name is enough to start.',
  },
  {
    title: 'The two-tap log.',
    body: 'Today asks one question — what went on. One tap on "Log today\'s wear", one on the pieces, and the day is on the record for good.',
  },
  {
    title: 'Before you buy.',
    body: 'Tempted by something in a shop? This page holds it against what the closet already has that comes close. It shows the facts and stops talking — the conclusion is yours.',
  },
  {
    title: 'The record is yours.',
    // This card used to read "no account, no sync, no copy anywhere else",
    // which the door had already contradicted four screens earlier: it offers
    // an account, and the start form offers a wardrobe synced to it. PLAN.md
    // non-negotiable #1 as amended 2026-08-18 admits both. A false privacy
    // line is the most expensive sentence this app can print, so the card now
    // says the true thing, which is still the better promise.
    body: 'The record lives in this browser. An account is optional, and it does one job — it keeps a copy of a wardrobe you have switched sync on for, so a second device can open it. Nothing else leaves. Settings exports the whole record as one file, worth keeping somewhere safe, and this tour waits there too, under "Replay the tour".',
  },
];

export default function Tutorial({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [beat, setBeat] = useState(0);
  const current = BEATS[beat];
  const last = beat === BEATS.length - 1;

  // Every exit is the same exit: dismissed is dismissed, whether it came from
  // the cross, Escape, the scrim, "Not now", or the last card's "Done".
  const close = () => {
    markTourDone();
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title={current.title}>
      <p className="type-ledger text-[11px] text-text-2">
        {beat + 1} of {BEATS.length}
      </p>
      <p className="text-[15px] text-text leading-relaxed mt-3">{current.body}</p>
      <div className="flex items-center justify-between gap-3 mt-6">
        <Button tone="tertiary" onClick={close}>
          Not now
        </Button>
        <Button tone="primary" onClick={() => (last ? close() : setBeat(beat + 1))}>
          {last ? 'Done' : 'Next'}
        </Button>
      </div>
    </Modal>
  );
}

/**
 * THE PAGE GUIDE — one quiet control at the foot of every guided screen.
 *
 * The tour above is once-only by design, so everything it does not have room
 * for had to go somewhere that never asks. This is that somewhere: a real
 * button reading "What is this page?", in the same place on every screen, that
 * opens the guide for the address you are actually at.
 *
 * Three rules it keeps, in order of how expensive breaking them would be:
 *
 *   It never opens itself. Not on a first visit, not on a returning one. An
 *   unopened guide waits; it does not ask. That is the difference between a
 *   guide and the coach-mark overlay every other app in this category ships.
 *
 *   It never blocks. It sits after the page's own content, below a hairline,
 *   so nothing is ever covered and nothing is pushed off the fold.
 *
 *   It sits in the same place on every screen. Discoverability here is a
 *   learned location, not a flashing badge — you find it once and then you
 *   know where it lives, which is why it is rendered by the layout rather than
 *   by each page.
 *
 * The one visible use of the remembered state is a small mark beside the label
 * while a screen's guide has never been opened. It is the same 4px accent dot
 * the mobile rail uses, it goes out for good on the first open, and it counts
 * nothing — it is a "not read yet", not a score. Screens with no guide (the
 * project lead portal, a wrong address) render no control at all rather than
 * an empty one.
 *
 * Mounted from Layout, keyed on the route, so no page file has to know it
 * exists and adding a screen means adding one entry to src/lib/pageGuides.ts.
 */
export function PageGuide({ path }: { path: string }) {
  const guide = guideFor(path);
  const key = guideKeyFor(path);
  const [open, setOpen] = useState(false);
  // Read once per mount. Layout keys this by pathname, so walking to another
  // screen remounts it and the mark is re-read for the screen you arrived at.
  const [seen, setSeen] = useState(() => (key ? guideSeen(key) : true));

  if (!guide || !key) return null;

  // Opening IS reading, as far as the mark is concerned. Marking on close
  // instead would leave the dot standing for anyone who read the sheet and
  // then hit Escape, which is most people.
  const show = () => {
    markGuideSeen(key);
    setSeen(true);
    setOpen(true);
  };

  return (
    <div className="mt-10 pt-4 border-t border-border">
      <button
        type="button"
        onClick={show}
        className="type-label text-[13px] min-h-11 inline-flex items-center gap-2 text-text-2 hover:text-text transition-colors duration-150"
      >
        What is this page?
        {seen ? null : (
          <>
            <span aria-hidden="true" className="w-1 h-1 rounded-full bg-accent" />
            <span className="sr-only">Not opened yet</span>
          </>
        )}
      </button>

      {/* The Modal primitive brings the focus trap, Escape, the restored focus
          on close, and the reduced-motion collapse — the same sheet the tour
          and every other overlay in the house uses. */}
      <Modal open={open} onClose={() => setOpen(false)} title={guide.title}>
        <p className="text-[15px] text-text leading-relaxed">{guide.lede}</p>
        <ol className="mt-5 space-y-3">
          {guide.doing.map((line, i) => (
            <li key={line} className="flex gap-3">
              <span className="type-ledger text-[11px] text-text-2 tabular shrink-0 w-4 pt-1">
                {i + 1}
              </span>
              <span className="text-[14px] text-text leading-relaxed">{line}</span>
            </li>
          ))}
        </ol>
        {guide.term ? (
          // The house word, set apart under a rule — the one thing on this
          // sheet a reader may have come specifically to look up.
          <p className="mt-5 pt-4 border-t border-border text-[13px] text-text-2 leading-relaxed">
            <span className="type-label text-text">{guide.term.word}</span> — {guide.term.meaning}
          </p>
        ) : null}
        <div className="flex justify-end mt-6">
          <Button onClick={() => setOpen(false)}>Close</Button>
        </div>
      </Modal>
    </div>
  );
}
