import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, IconButton, Modal } from './ui';
import { IconClose } from './icons';
import { guideSeen, markGuideSeen, markTourDone, markWalkthroughSeen } from '../lib/tutorial';
import { guideFor, guideKeyFor } from '../lib/pageGuides';
import { tutorialFor, type StepTarget, type Tutorial as StepScript } from '../lib/tutorials';

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
    title: 'The daily log.',
    body: 'Today asks one question — what went on. A tap on "Log today\'s wear", then the outfit or the pieces themselves, and the day is on the record for good.',
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
  const script = tutorialFor(path);
  const [open, setOpen] = useState(false);
  // Read once per mount. Layout keys this by pathname, so walking to another
  // screen remounts it and the mark is re-read for the screen you arrived at.
  const [seen, setSeen] = useState(() => (key ? guideSeen(key) : true));
  // The walkthrough's whole lifecycle, inherited rather than written: this
  // component is mounted inside Layout's route-keyed div, so walking to another
  // screen remounts it and a walkthrough ends with the page it belonged to.
  const [walking, setWalking] = useState(false);

  if (!guide || !key) return null;

  // Opening IS reading, as far as the mark is concerned. Marking on close
  // instead would leave the dot standing for anyone who read the sheet and
  // then hit Escape, which is most people.
  const show = () => {
    markGuideSeen(key);
    setSeen(true);
    setOpen(true);
  };

  // Two doors deep, both pulled by the reader — the sheet never opens itself,
  // and this control inside it is the only way to the steps. Marked on START,
  // never on completion (docs/43 §5): a mark for finishing is a score.
  const walk = () => {
    markWalkthroughSeen(key);
    setOpen(false);
    setWalking(true);
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
        {/* The foot carries the second door where a screen has one. Tertiary,
            never a primary — the sheet already spends its one primary on
            Close, and brand rule 3 allows exactly one per view. A screen with
            no tutorial renders the shipped foot, unchanged, which is the
            additive proof for the seventeen guides that already ship. */}
        <div className={`flex items-center ${script ? 'justify-between' : 'justify-end'} gap-3 mt-6`}>
          {script ? (
            <Button tone="tertiary" onClick={walk}>
              Walk me through it
            </Button>
          ) : null}
          <Button onClick={() => setOpen(false)}>Close</Button>
        </div>
      </Modal>

      {walking && script ? (
        <Walkthrough script={script} onClose={() => setWalking(false)} />
      ) : null}
    </div>
  );
}

/* ==========================================================================
   THE WALKTHROUGH — a stepped card that points, and never holds the app.

   docs/43 is the spec. What it is, in one paragraph: a small non-modal card
   docked at the foot of the viewport above the mobile rail, carrying "2 of 4",
   one instruction, Back / Next (Done on the last) and a cross. No scrim, no
   focus trap, role="dialog" WITHOUT aria-modal — the page stays fully operable,
   because the point of a step is that you can DO it while reading it. A step
   that names a target gets one ring: an outline and a scroll, nothing more. No
   mask, no cutout, no clone, no pulse.

   z-[60] for the card and z-[55] for the ring: above the rail's z-50, below the
   Modal's z-[100], clear of <main>'s z-10.
   ========================================================================== */

/** The measured box of a target, in viewport coordinates. */
interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * The role vocabulary, as selectors. Deliberately small: five roles cover every
 * control any tutorial in this house has ever wanted to point at, and a sixth
 * should be argued for rather than assumed.
 */
const ROLE_SELECTORS: Record<StepTarget['role'], string> = {
  button:
    'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]',
  link: 'a[href], [role="link"]',
  textbox:
    'input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="number"], input[type="password"], textarea, [role="textbox"]',
  tab: '[role="tab"]',
  checkbox: 'input[type="checkbox"], [role="checkbox"]',
};

/** Case-folded, whitespace-collapsed — the two normalisations a name survives. */
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * The accessible name, computed far enough for this job and no further.
 *
 * aria-label, then aria-labelledby, then — for a field — its <label> and only
 * then its placeholder, then the text, then title. The label-before-placeholder
 * order is not decoration: the Closet's search input carries an sr-only <label>
 * AND a placeholder saying different words, and a computation that read the
 * placeholder first would ring the right box for the wrong reason and then
 * drift the day the label changed.
 */
function accessibleName(el: HTMLElement): string {
  const label = el.getAttribute('aria-label');
  if (label && norm(label)) return norm(label);

  const by = el.getAttribute('aria-labelledby');
  if (by) {
    const joined = by
      .split(/\s+/)
      .map(id => document.getElementById(id)?.textContent ?? '')
      .join(' ');
    if (norm(joined)) return norm(joined);
  }

  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    const labels = el.labels;
    if (labels && labels.length) {
      const text = Array.from(labels)
        .map(l => l.textContent ?? '')
        .join(' ');
      if (norm(text)) return norm(text);
    }
    const placeholder = el.getAttribute('placeholder');
    if (placeholder && norm(placeholder)) return norm(placeholder);
    return norm(el.getAttribute('title') ?? '');
  }

  const text = norm(el.textContent ?? '');
  if (text) return text;
  return norm(el.getAttribute('title') ?? '');
}

/**
 * Is this control actually on the screen for somebody?
 *
 * The 2px floor is the zero-box rule with a margin: an sr-only control is a
 * 1x1 clipped box, present to a screen reader and meaningless to a ring, and a
 * ring drawn around one would sit in the corner pointing at nothing.
 */
function onScreen(el: HTMLElement): boolean {
  // The walkthrough's own card and ring can never be a target — it must not be
  // possible for a tutorial to point at itself.
  if (el.closest('[hidden], [aria-hidden="true"], [data-walkthrough]')) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const style = window.getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') {
    return false;
  }
  return true;
}

/**
 * The two scopes (docs/43 §1.3).
 *
 * 'main' is the page's own column. 'chrome' is the shell's persistent controls,
 * which live in <header> on a phone and <aside> on a desktop, one visible at a
 * time (`lg:hidden` against `hidden lg:flex`) — so visibility does the viewport
 * work for free and a chrome anchor never matches twice.
 *
 * The <header> the Masthead primitive renders is INSIDE <main>, so it is
 * filtered out of the chrome scope: a page title is the page's, not the shell's.
 */
function scopeRoots(scope: 'main' | 'chrome'): Element[] {
  const main = document.querySelector('main');
  if (scope === 'chrome') {
    return Array.from(document.querySelectorAll('header, aside, nav')).filter(
      el => !main || !main.contains(el)
    );
  }
  return main ? [main] : [];
}

/**
 * A target to an element, or null.
 *
 * The hint is checked first where present, then the names in the order the step
 * lists them — the first alternative that has a visible match wins, and within
 * one name the first visible match in document order.
 */
export function resolveTarget(target: StepTarget): HTMLElement | null {
  const roots = scopeRoots(target.scope ?? 'main');

  if (target.hint) {
    for (const root of roots) {
      const found = Array.from(
        root.querySelectorAll<HTMLElement>('[data-tutorial]')
      ).find(el => el.getAttribute('data-tutorial') === target.hint && onScreen(el));
      if (found) return found;
    }
  }

  const candidates: HTMLElement[] = [];
  for (const root of roots) {
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(ROLE_SELECTORS[target.role]))) {
      if (onScreen(el)) candidates.push(el);
    }
  }

  const names = (Array.isArray(target.name) ? target.name : [target.name]).map(norm);
  for (const name of names) {
    const hit = candidates.find(el => accessibleName(el) === name);
    if (hit) return hit;
  }
  return null;
}

/** Do two viewport boxes touch at all? The flip rule's whole arithmetic. */
function overlaps(a: Box, b: DOMRect): boolean {
  return (
    a.left < b.right && a.left + a.width > b.left && a.top < b.bottom && a.top + a.height > b.top
  );
}

function Walkthrough({ script, onClose }: { script: StepScript; onClose: () => void }) {
  const [at, setAt] = useState(0);
  const [ring, setRing] = useState<Box | null>(null);
  const [dock, setDock] = useState<'bottom' | 'top'>('bottom');
  const cardRef = useRef<HTMLDivElement>(null);
  /** The card's measured box at each dock, learned as we go, cleared per step. */
  const bands = useRef<{ bottom: DOMRect | null; top: DOMRect | null }>({ bottom: null, top: null });
  const lastStep = useRef(-1);

  const step = script.steps[at];
  const last = at === script.steps.length - 1;

  // Escape ends it, like every other overlay in the house. Focus is never
  // trapped and never moved, so this listens on the document rather than on
  // anything the card owns.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Bring the target into view on a step change — and only on a step change,
  // so a reader who scrolls away is not dragged back.
  //
  // A TARGET ALREADY ON SCREEN IS NEVER SCROLLED TO. Two reasons, and the
  // second is the one that was measured: pointless motion is motion, and
  // scrollIntoView on a position:fixed element is nonsense the browser answers
  // with nonsense. The Closet's step 2 points at the masthead's "Add a piece",
  // which is fixed and therefore cannot be centred by scrolling — Chromium
  // obliged by throwing the page to y=10256 of an 11307px document, and the
  // next step then had a ten-thousand-pixel smooth scroll to unwind. Every
  // chrome-scoped step in the house has this shape.
  useEffect(() => {
    const el = step.target ? resolveTarget(step.target) : null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const showing =
      r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth;
    if (showing) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
    // step.target is read through `at`; the target of a given step never changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  // ONE rAF-throttled listener for the ring, re-measured on scroll and resize.
  // The dock decision rides along, because both answers come from the same two
  // rectangles and measuring them twice is how they end up disagreeing.
  useEffect(() => {
    if (lastStep.current !== at) {
      lastStep.current = at;
      bands.current = { bottom: null, top: null };
    }

    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = step.target ? resolveTarget(step.target) : null;
      if (!el) {
        setRing(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const box: Box = { top: r.top, left: r.left, width: r.width, height: r.height };
      setRing(box);

      const card = cardRef.current?.getBoundingClientRect();
      if (card) bands.current[dock] = card;

      // THE FLIP RULE (docs/43 §1.6, asserted in §7 check 8). The bottom is
      // preferred always; the top is the alternative, taken only when the
      // bottom would cover the very thing the step is pointing at. Converges
      // in at most two extra renders — each dock is measured once — and never
      // oscillates, because a dock is only left for one known to be clear.
      const below = bands.current.bottom;
      const above = bands.current.top;
      let want: 'bottom' | 'top' = 'bottom';
      if (below && overlaps(box, below)) {
        want = above && overlaps(box, above) ? dock : 'top';
      }
      if (want !== dock) setDock(want);
    };

    measure();
    const onMove = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', onMove, { passive: true, capture: true });
    window.addEventListener('resize', onMove);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onMove, { capture: true });
      window.removeEventListener('resize', onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, dock]);

  return createPortal(
    <>
      {ring ? (
        // pointer-events: none, so the ring never intercepts the tap the step
        // is asking for. An outline rather than a border: an outline is drawn
        // outside the box and moves nothing. It never pulses.
        <div
          data-walkthrough="ring"
          aria-hidden="true"
          className="z-[55] pointer-events-none rounded-[2px]"
          style={{
            // Stated here rather than through the `fixed` utility for the same
            // reason as the card below — see the note on its style prop.
            position: 'fixed',
            top: `${ring.top}px`,
            left: `${ring.left}px`,
            width: `${ring.width}px`,
            height: `${ring.height}px`,
            outline: '2px solid var(--color-accent)',
            outlineOffset: '2px',
          }}
        />
      ) : null}

      <div
        ref={cardRef}
        data-walkthrough="card"
        role="dialog"
        aria-label="Walking through this page"
        // No aria-modal, and no focus trap: the page underneath stays live.
        // .above-rail-toast is the toast's own docking — rail height, its
        // hairline, the safe-area inset and a 12px breath, stated once in
        // index.css so this cannot drift from the rail it sits on.
        className={`z-[60] left-3 right-3 lg:left-auto lg:right-6 lg:w-[360px] bg-surface plate rounded-[2px] p-4 animate-fade ${
          dock === 'top' ? '' : 'above-rail-toast'
        }`}
        // POSITION IS STATED HERE, NOT THROUGH THE `fixed` UTILITY, and this is
        // load-bearing: src/v2.css:39 declares `.v2 .plate { position: relative }`
        // to root the glass sheen's ::after, and `.v2 .plate` (0,2,0) outranks
        // Tailwind's `.fixed` (0,1,0). Measured before this line: the card laid
        // itself out in normal flow at the foot of <body> and read y=9168 on an
        // 844px viewport, and the ring went with it. Every other .plate in the
        // house is a static-flow Card, which is why nothing caught it earlier.
        style={
          dock === 'top'
            ? { position: 'fixed', top: 'calc(var(--masthead-total) + 0.75rem)' }
            : { position: 'fixed' }
        }
      >
        <div className="flex items-start justify-between gap-3">
          {/* A position in a short list, never a score: 11px mono, and it
              leaves with the card (docs/43 §4.3). */}
          <p className="type-ledger text-[11px] text-text-2 tabular pt-2">
            {at + 1} of {script.steps.length}
          </p>
          <IconButton label="Close the walkthrough" onClick={onClose} className="-mr-2 -mt-2">
            <IconClose size={16} />
          </IconButton>
        </div>

        {/* Announced without stealing focus — the reader keeps the caret and
            the scroll position they had. */}
        <p aria-live="polite" className="text-[15px] text-text leading-relaxed mt-1">
          {step.say}
        </p>

        <div className="flex items-center justify-between gap-3 mt-4">
          <Button tone="tertiary" onClick={() => setAt(a => Math.max(0, a - 1))} disabled={at === 0}>
            Back
          </Button>
          {/* Secondary, not primary. The page underneath usually already spends
              its one primary — the sidebar's "Add a piece", Today's hero — and
              the hero fill stays reserved for log-wear, always. */}
          <Button onClick={() => (last ? onClose() : setAt(a => a + 1))}>
            {last ? 'Done' : 'Next'}
          </Button>
        </div>
      </div>
    </>,
    document.body
  );
}
