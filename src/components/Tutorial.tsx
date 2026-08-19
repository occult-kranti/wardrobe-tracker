import { useState } from 'react';
import { Button, Modal } from './ui';
import { markTourDone } from '../lib/tutorial';

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
    body: 'Everything lives on this device — no account, no sync, no copy anywhere else. Settings exports the whole record as one file, worth keeping somewhere safe. This tour waits there too, under "Replay the tour".',
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
