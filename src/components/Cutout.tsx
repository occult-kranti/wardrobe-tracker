import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';
import { showToast } from './Toast';
import { cutOut, DEFAULT_TOLERANCE, type Cutout } from '../lib/cutout';

/**
 * The cutout bench.
 *
 * Two pictures and one slider, because the only question worth asking is
 * "is that better?" and the only way to answer it is to see both. The original
 * is never overwritten until the person says so, and "Keep the original" is a
 * full-weight option rather than a cancel — a drawn stand-in and an honest
 * photograph are both finished states in this app, and so is a photograph with
 * its bedspread still in it.
 *
 * Everything happens in this tab. Nothing is uploaded, because there is
 * nowhere to upload it to.
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
  const [tolerance, setTolerance] = useState(DEFAULT_TOLERANCE);
  const [result, setResult] = useState<Cutout | null>(null);
  const [working, setWorking] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  // The run in flight; a slider drag starts several and only the last matters.
  const run = useRef(0);

  useEffect(() => {
    const mine = ++run.current;
    setWorking(true);
    setFailed(null);
    // A beat of delay, so dragging the slider does not queue a full pass per
    // pixel of travel.
    const timer = setTimeout(() => {
      cutOut(source, tolerance)
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
  }, [source, tolerance]);

  return (
    <div className="rounded-[2px] bg-sunken plate-ink p-3 mt-3">
      <p className="type-ledger text-[11px] text-text-2">Lifting it off the background</p>

      <div className="flex gap-3 mt-3">
        <figure className="min-w-0 flex-1 m-0">
          <div className="aspect-[4/5] bg-mat rounded-[2px] overflow-hidden">
            <img src={source} alt="The photograph as taken" className="w-full h-full object-cover" />
          </div>
          <figcaption className="type-ledger text-[10px] text-text-2 mt-1.5">As taken</figcaption>
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
          <label htmlFor="cut-tol" className="type-ledger text-[10px] text-text-2 block mt-4">
            How much counts as background
          </label>
          <input
            id="cut-tol"
            type="range"
            min={8}
            max={60}
            step={2}
            value={tolerance}
            onChange={e => setTolerance(Number(e.target.value))}
            className="w-full mt-1.5 accent-[var(--color-accent)]"
          />
          <p className="text-[13px] text-text-2 mt-1 leading-snug">
            {result && !result.good
              ? 'This photograph is fighting it — the garment and what it is lying on are close in colour. Move the slider, or keep the original; a photograph with its bedspread still in it is a finished state too.'
              : 'A plain sheet or a bare floor lifts cleanly. Nothing here is uploaded — the cut happens in this browser.'}
          </p>
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
