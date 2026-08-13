import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';
import { showToast } from './Toast';
import { cutOut, type Cutout, type CutBox } from '../lib/cutout';

/**
 * The cutout bench.
 *
 * Two pictures, because the only question worth asking is "is that better?" and
 * the only way to answer it is to see both. The original is never overwritten
 * until the person says so, and "Keep the original" is a full-weight option
 * rather than a cancel — a drawn stand-in and an honest photograph are both
 * finished states in this app, and so is a photograph with its bedspread still
 * in it.
 *
 * ── WHAT THE PERSON CAN DO WHEN IT GETS IT WRONG ─────────────────────────────
 * The old bench had one control, a tolerance slider, and it was the wrong
 * control: it asks somebody to tune a number they have no way to reason about,
 * to fix a mistake they can see and could simply point at. So the slider is now
 * last, and two direct instructions come first, both given ON the photograph:
 *
 *   DRAW A BOX round the piece. Everything outside it is background, no
 *   argument, and the colours are read from out there. This is the answer to
 *   the commonest failure in the category — a garment touching the frame — and
 *   to every photograph with two things in it.
 *
 *   TAP THE BACKGROUND. One tap adds that colour to what counts as background.
 *   Two taps handle a floor and a rug.
 *
 * Everything happens in this tab. Nothing is uploaded, because there is nowhere
 * to upload it to.
 */
export function CutoutBench({
  source,
  onUse,
  onClose,
}: {
  source: string;
  onUse: (url: string) => void;
  onClose: () => void;
}) {
  // Null means "let the pass choose", which is what it does until somebody
  // takes hold of the slider. Nobody should have to find a control before the
  // feature works once.
  const [tolerance, setTolerance] = useState<number | null>(null);
  const [box, setBox] = useState<CutBox | null>(null);
  const [taps, setTaps] = useState<{ x: number; y: number }[]>([]);
  const [dragging, setDragging] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [result, setResult] = useState<Cutout | null>(null);
  const [working, setWorking] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  // The run in flight; a slider drag starts several and only the last matters.
  const run = useRef(0);

  useEffect(() => {
    const mine = ++run.current;
    setWorking(true);
    setFailed(null);
    // A beat of delay, so dragging the slider does not queue a full pass per
    // pixel of travel.
    const timer = setTimeout(() => {
      cutOut(source, { tolerance, box, taps })
        .then(next => {
          if (run.current !== mine) return;
          setResult(next);
          setWorking(false);
        })
        .catch((e: Error) => {
          if (run.current !== mine) return;
          setFailed(e.message);
          setWorking(false);
        });
    }, 160);
    return () => clearTimeout(timer);
  }, [source, tolerance, box, taps]);

  /** Where in the photograph a pointer is, as fractions of it. */
  const at = (e: React.PointerEvent) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const settle = () => {
    if (!dragging) return;
    const w = Math.abs(dragging.x1 - dragging.x0);
    const h = Math.abs(dragging.y1 - dragging.y0);
    setDragging(null);
    // A short drag is a tap, and a tap means "this is background". One gesture
    // does both jobs and neither needs a mode switch.
    if (w < 0.06 || h < 0.06) {
      setTaps(t => [...t.slice(-3), { x: dragging.x1, y: dragging.y1 }]);
      return;
    }
    setBox({
      x: Math.min(dragging.x0, dragging.x1),
      y: Math.min(dragging.y0, dragging.y1),
      w, h,
    });
  };

  const live = dragging && {
    left: `${Math.min(dragging.x0, dragging.x1) * 100}%`,
    top: `${Math.min(dragging.y0, dragging.y1) * 100}%`,
    width: `${Math.abs(dragging.x1 - dragging.x0) * 100}%`,
    height: `${Math.abs(dragging.y1 - dragging.y0) * 100}%`,
  };

  return (
    <div className="rounded-[2px] bg-sunken plate-ink p-3 mt-3">
      <p className="type-ledger text-[11px] text-text-2">Lifting it off the background</p>

      <div className="flex gap-3 mt-3">
        <figure className="min-w-0 flex-1 m-0">
          <div
            ref={frameRef}
            className="aspect-[4/5] bg-mat rounded-[2px] overflow-hidden relative touch-none cursor-crosshair"
            onPointerDown={e => {
              (e.target as Element).setPointerCapture?.(e.pointerId);
              const p = at(e);
              setDragging({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
            }}
            onPointerMove={e => {
              if (!dragging) return;
              const p = at(e);
              setDragging(d => (d ? { ...d, x1: p.x, y1: p.y } : d));
            }}
            onPointerUp={settle}
            onPointerCancel={() => setDragging(null)}
          >
            <img
              src={source}
              alt="The photograph as taken"
              draggable={false}
              className="w-full h-full object-cover pointer-events-none"
            />
            {box && !dragging ? (
              <span
                className="absolute border-2 border-dashed border-accent pointer-events-none"
                style={{
                  left: `${box.x * 100}%`, top: `${box.y * 100}%`,
                  width: `${box.w * 100}%`, height: `${box.h * 100}%`,
                }}
              />
            ) : null}
            {live ? (
              <span className="absolute border-2 border-dashed border-accent pointer-events-none" style={live} />
            ) : null}
            {taps.map((tap, i) => (
              <span
                key={`${tap.x}-${tap.y}-${i}`}
                className="absolute w-3 h-3 -ml-1.5 -mt-1.5 border-2 border-accent rounded-[2px] pointer-events-none"
                style={{ left: `${tap.x * 100}%`, top: `${tap.y * 100}%` }}
              />
            ))}
          </div>
          <figcaption className="type-ledger text-[10px] text-text-2 mt-1.5">
            As taken — drag a box, or tap the background
          </figcaption>
        </figure>
        <figure className="min-w-0 flex-1 m-0">
          <div className="aspect-[4/5] bg-mat rounded-[2px] overflow-hidden relative">
            {result ? (
              <img src={result.url} alt="The garment, lifted off its background" className="w-full h-full object-contain" />
            ) : null}
            {working ? (
              <span className="absolute inset-0 flex items-center justify-center type-ledger text-[10px] text-text-2 bg-mat/70">
                Working
              </span>
            ) : null}
          </div>
          <figcaption className="type-ledger text-[10px] text-text-2 mt-1.5">Lifted</figcaption>
        </figure>
      </div>

      {failed ? (
        <p className="text-[13px] text-text-2 mt-3 leading-snug">{failed}</p>
      ) : (
        <>
          {/* The pass says what went wrong in its own words, and each sentence
              names the gesture that fixes it. */}
          <p className="text-[13px] text-text-2 mt-3 leading-snug">
            {result?.trouble
              ?? (box
                ? 'Only what is inside the box was kept. Drag again to move it.'
                : 'A plain sheet or a bare floor lifts cleanly. If it takes the wrong thing, drag a box round the piece you meant. Nothing here is uploaded — the cut happens in this browser.')}
          </p>

          {box || taps.length ? (
            <Button
              type="button"
              compact
              tone="tertiary"
              className="mt-2"
              onClick={() => { setBox(null); setTaps([]); setTolerance(null); }}
            >
              Start the photograph again
            </Button>
          ) : null}

          <label htmlFor="cut-tol" className="type-ledger text-[10px] text-text-2 block mt-4">
            How much counts as background
            {tolerance === null ? ' — chosen for this photograph' : ''}
          </label>
          <input
            id="cut-tol"
            type="range"
            min={8}
            max={60}
            step={2}
            value={tolerance ?? result?.tolerance ?? 26}
            onChange={e => setTolerance(Number(e.target.value))}
            className="w-full mt-1.5 accent-[var(--color-accent)]"
          />
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Button
          type="button"
          compact
          tone="primary"
          disabled={!result || working}
          onClick={() => {
            if (!result) return;
            onUse(result.url);
            showToast('Lifted. The photograph never left this device.', 'success');
          }}
        >
          Use the lifted one
        </Button>
        <Button type="button" compact onClick={onClose}>Keep the original</Button>
      </div>
    </div>
  );
}
