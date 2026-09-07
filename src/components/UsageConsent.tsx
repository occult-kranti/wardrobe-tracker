import { useEffect, useState } from 'react';
import { Button, Modal } from './ui';
import { EVENT_NAMES, pendingPayload, setConsent, shouldAsk } from '../lib/usage';

/**
 * THE ASK — the one sheet that stands between a tester and the alpha usage
 * record, and the only screen in this app whose whole job is to be refusable.
 *
 * PLAN.md non-negotiable #1 said "no telemetry". It was amended by owner
 * direction on 2026-08-28 to admit an OPT-IN usage record for the alpha, and
 * src/lib/usage.ts carries the four rules that keep the amendment honest. This
 * file is the amendment's face: if the sheet is crooked, nothing the library
 * does underneath it matters.
 *
 * THE RULES THIS SHEET KEEPS, EACH ONE WRITTEN BECAUSE THE OPPOSITE IS THE
 * INDUSTRY DEFAULT:
 *
 *  1. IT ARRIVES AFTER THE WARDROBE, NEVER BEFORE IT. It is mounted inside the
 *     signed-in tree in App.tsx, so it cannot appear on the door. A consent
 *     panel at a cold arrival asks somebody to rule on a thing they have not
 *     seen yet, which is not consent — it is an obstacle wearing consent's
 *     clothes.
 *
 *  2. THE BOX ARRIVES UNTICKED. A pre-ticked box is named as a deceptive
 *     pattern by the EDPB, and an alpha is not an exception to that. An alpha
 *     is where the habit gets set.
 *
 *  3. TWO EXITS OF EQUAL WEIGHT. "Not this time" and "Save" are the same
 *     component, the same tone and the same height. This house already does
 *     two-equal-exits in Before You Buy. The asymmetric version — one filled
 *     button beside a grey text link — measures 22 to 23 points of extra
 *     acceptance, and a layout that moves a decision by twenty points is
 *     making the decision rather than asking for it.
 *
 *  4. IT SHOWS THE REAL PAYLOAD, NOT A DESCRIPTION OF ONE. The control below
 *     renders `pendingPayload()` — the actual bytes this device would send.
 *     Before consent there are none, because nothing is buffered before
 *     consent, so the sheet says exactly that and shows the SHAPE instead.
 *     Anything else here would be a promise about the code rather than the
 *     code.
 *
 *  5. IT NEVER ASKS TWICE. Every way out writes a decision: Save writes the
 *     box, "Not this time" writes a refusal, and Escape or the scrim write a
 *     refusal too. Silence is not consent, and a sheet that returns until it is
 *     answered is a nag with a checkbox on it. The one way back is Settings,
 *     asked for by name.
 */

/**
 * The build a report is tied to.
 *
 * A literal, because this repo has no build-stamping step and inventing one to
 * fill a string would be a build system nobody asked for. When there is a real
 * version to name, this is the single line that changes — App.tsx and Settings
 * both read it from here rather than each writing their own.
 */
export const USAGE_BUILD = 'alpha';

/**
 * The shape, for the ordinary case where there is nothing yet to show.
 *
 * Written out rather than generated, because generating an example needs a fake
 * event to generate it from, and a fake event in the buffer is precisely what
 * rule 2 in usage.ts forbids. Every field below is real: the `UsagePayload`
 * envelope and four entries from `EventProps`, copied by hand — which makes
 * them the only strings in this file a reviewer has to check against the
 * contract.
 */
const SHAPE = `{
  "installId": "a fresh id, minted the moment you allow it",
  "sentAt": "2026-08-28T09:14:02.118Z",
  "build": "alpha",
  "events": [
    { "name": "screen_viewed", "at": 1756370042118, "props": { "screen": "closet", "ms": 4210 } },
    { "name": "wear_logged",   "at": 1756370051884, "props": { "pieces": 3, "viaOutfit": true } },
    { "name": "piece_added",   "at": 1756370094003, "props": { "via": "photo", "hasPhoto": true, "tier": "mid" } },
    { "name": "write_refused", "at": 1756370120557, "props": { "size": "1-3mb" } }
  ]
}`;

/**
 * What this device would send, read once at mount.
 *
 * Once at mount and not on every render: the block is a snapshot of a moment,
 * and it names its own moment in `sentAt`. A block that re-read on every render
 * would tick its timestamp under the reader's eyes and invite them to wonder
 * what else was moving while they watched.
 *
 * Shared with the Settings card, so the panel and the page can never drift into
 * giving two different accounts of the same buffer.
 */
export function PendingPayload() {
  const [payload] = useState(() => pendingPayload(USAGE_BUILD));

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[13px] text-text-2 leading-snug">
        {payload
          ? 'This is the note as it stands on this device, at the moment you opened this.'
          : 'Nothing has been written down, because nothing is written down before you allow it. This is the shape it would take.'}
      </p>
      {/* Not a TagRail or a TableRail. Those hide their scrollbar and fade their
          edges, which is right for a row of chips and wrong for a block whose
          whole point is that you can reach all of it and check it. A plain
          scrolling region, reachable by keyboard, named for a screen reader. */}
      <pre
        role="region"
        aria-label="What would be sent"
        tabIndex={0}
        className="bg-sunken border border-border rounded-[2px] p-3 max-h-64 overflow-auto font-mono text-[12px] leading-relaxed text-text whitespace-pre"
      >
        {payload ? JSON.stringify(payload, null, 2) : SHAPE}
      </pre>
      <p className="text-[13px] text-text-2 leading-snug">
        The list of things it can say is closed, and it is {EVENT_NAMES.length} names long:{' '}
        <span className="font-mono">{EVENT_NAMES.join(', ')}</span>. A property is a number, a yes
        or no, or one word from a fixed list. There is no field that can hold what you typed.
      </p>
    </div>
  );
}

export default function UsageConsent() {
  const [open, setOpen] = useState(false);
  const [allow, setAllow] = useState(false);
  const [showing, setShowing] = useState(false);

  /**
   * WHEN A SHEET LETS ITSELF IN, IT WAITS FOR THE FLOOR TO CLEAR.
   *
   * Three things in this app open themselves on a first arrival: the short tour
   * on Today, the first-visit page guide on every guided screen, and now this.
   * All three are the house Modal, all three trap focus, and two of them on
   * screen at once is two focus traps arguing over one Tab key. So this one
   * yields — it waits a beat, and while any dialog is standing it waits again.
   * It is the newest of the three and the least urgent: the record of how the
   * app is used is worth nothing measured against the first minute of using it.
   *
   * `shouldAsk()` is re-read on every look rather than only at mount, because
   * the Settings card can settle this in another tab, and a sheet that opened
   * anyway would be asking a question that has already been answered.
   */
  useEffect(() => {
    if (!shouldAsk()) return;
    let live = true;
    let timer = 0;

    function look() {
      if (!live || !shouldAsk()) return;
      if (document.querySelector('[role="dialog"]')) {
        timer = window.setTimeout(look, 900);
        return;
      }
      setOpen(true);
    }

    timer = window.setTimeout(look, 1200);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, []);

  /** Every exit writes an answer. See rule 5 in this file's header. */
  const decide = (granted: boolean) => {
    setConsent(granted);
    setOpen(false);
  };

  if (!open) return null;

  return (
    /* `quiet`, for the same reason the page guide passes it: the thock is the
       sound of a sheet somebody landed, and this one landed itself. */
    <Modal open onClose={() => decide(false)} title="Help with the alpha" quiet>
      <div className="space-y-5">
        <p className="type-ledger text-[11px] text-text-2">optional · off unless you say so</p>

        <p className="type-editorial text-[20px] leading-snug text-balance">
          Almari is in alpha, and the record of how it is used is how it gets fixed.
        </p>

        <p className="text-[14px] text-text-2 leading-relaxed">
          If you allow it, this device sends a usage note: which screens were opened, how long a
          photograph took to catalogue, when a write was refused, how often a wear was logged. It
          never sends a garment, a brand, a note, a photograph, or anything you typed. There is no
          path for those to reach it, and a test proves that on every build.
        </p>

        <p className="text-[14px] text-text-2 leading-relaxed">
          The alpha is small, so a count of three is three people. That is not anonymous, and
          calling it anonymous would be untrue.
        </p>

        {/* Unticked, and it stays unticked until a finger moves it. The 44px
            floor comes from the label's min-height, so the whole line is the
            target rather than the 16px box. */}
        <label className="flex items-start gap-2.5 min-h-11 py-1 cursor-pointer">
          <input
            type="checkbox"
            checked={allow}
            onChange={e => setAllow(e.target.checked)}
            className="w-4 h-4 mt-1 shrink-0 accent-[var(--color-accent)]"
          />
          <span className="text-[15px] text-text leading-snug">
            Send a usage note while the alpha runs
          </span>
        </label>

        <div>
          <button
            type="button"
            onClick={() => setShowing(v => !v)}
            aria-expanded={showing}
            className="type-label text-accent underline underline-offset-[3px] decoration-1 hover:decoration-2 h-11 inline-flex items-center"
          >
            {showing ? 'Hide what would be sent' : 'Show what would be sent'}
          </button>
          {showing ? <PendingPayload /> : null}
        </div>

        <p className="text-[14px] text-text-2 leading-relaxed">
          This can be changed at any time in Settings. Switching it off empties what was gathered on
          this device and asks the service to drop what it holds.
        </p>

        {/* The two exits. Same component, same tone, same height — see rule 3.
            Neither is the primary, and this sheet deliberately has none. */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => decide(false)}>Not this time</Button>
          <Button onClick={() => decide(allow)}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
