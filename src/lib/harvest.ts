import { cutOut } from './cutout';
import type { IntakeDraft } from '@almari/shared/intake';

/**
 * FROM ONE PHOTOGRAPH TO A ROW OF PIECES — all of it on the device.
 *
 * The model gave back coordinates. This is the part that turns coordinates
 * into the pictures that end up in the closet: crop along the box, lift the
 * crop off its background, and hand back a thumbnail per piece.
 *
 * Doing it here rather than asking for cropped images back is not a
 * workaround. It means the photograph makes exactly one journey, and every
 * pixel that ends up stored was cut on this machine.
 */

/** A crop with a breath of margin — a box drawn tight can clip a sleeve. */
const BLEED = 0.02;

/**
 * The margin used when the crop is about to have its background lifted.
 *
 * Six times the ordinary bleed, and the reason is the pass that comes next: it
 * learns what the background is by looking at the frame's border. A crop drawn
 * tight to the garment HAS no border that is background — it is garment to the
 * edge — so the cut had nothing to read and the batch path was quietly the
 * worst place in the app to attempt one. The wider crop is thrown away
 * afterwards; only the cut-out is kept.
 */
const LIFT_BLEED = 0.12;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That photograph would not open.'));
    img.src = src;
  });
}

/**
 * The longest edge of a crop that is KEPT.
 *
 * This is a storage decision, and it was the one path that had never made it.
 * Every other stored picture in the house caps: the feed and gallery crops at
 * 520 (`src/pages/Intake.tsx`), the cut-out at 512 (`src/lib/cutout.ts`). A
 * crop taken here from the 1400px frame that was sent had no ceiling at all,
 * so whenever the lift was judged bad and the plain crop was the one kept, a
 * single piece could arrive at three to six times what its neighbours cost —
 * for a picture that is only ever a tile and a detail sheet, never a print.
 */
const KEEP_EDGE = 520;

/**
 * The longest edge of the roomier crop that exists only to be lifted.
 *
 * That crop is thrown away and only the cut-out is kept, so it is capped where
 * the lift itself stops looking (cutout's own MAX_EDGE): every pixel above
 * that line is decoded, drawn, and discarded.
 */
const LIFT_EDGE = 1000;

/** Crop a fractional box out of an image, returning a JPEG data URL. */
export async function cropBox(
  src: string,
  box: [number, number, number, number],
  bleed: number = BLEED,
  maxEdge: number = KEEP_EDGE,
): Promise<string> {
  const img = await loadImage(src);
  const W = img.naturalWidth;
  const H = img.naturalHeight;

  const [bx, by, bw, bh] = box;
  const x = Math.max(0, Math.round((bx - bleed) * W));
  const y = Math.max(0, Math.round((by - bleed) * H));
  const w = Math.min(W - x, Math.round((bw + bleed * 2) * W));
  const h = Math.min(H - y, Math.round((bh + bleed * 2) * H));
  if (w < 8 || h < 8) throw new Error('That box is too small to crop.');

  // Cut at the box, hand back at the cap. Drawing straight from source pixels
  // to the smaller surface is one resample, not two.
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser will not open a drawing surface.');
  ctx.drawImage(img, x, y, w, h, 0, 0, cw, ch);
  return canvas.toDataURL('image/jpeg', 0.88);
}

/**
 * WHY NOTHING HERE IS FILED IN THE PHOTOGRAPH STORE.
 *
 * Every picture below is a data URL held in memory, and it stays one. The
 * store (src/lib/photoStore.ts) is written to at exactly one moment on this
 * path — when the bench COMMITS, in src/pages/Intake.tsx — and the reason is
 * that harvesting and keeping are different acts. A dozen crops are cut here;
 * the person then unticks half of them, because the model found a cushion and
 * called it a jumper. Filing at cut time would leave a picture on the device
 * for every row that was never written, and a store that fills up with pieces
 * nobody has is worse than the purse it was built to empty.
 *
 * So: cut here, decide there, and only what is decided is filed.
 */
export interface Harvested {
  ref: string;
  /** The plain crop, always produced. */
  crop: string;
  /** The crop with its background lifted, when the lift was worth keeping. */
  lifted?: string;
  /** What the closet should show — lifted if good, otherwise the honest crop. */
  picture: string;
  /** Said out loud in the bench, so nothing is silently second-best. */
  note?: string;
}

/**
 * Crop and cut every draft that came back with a box.
 *
 * A failure on one piece is that piece's failure, never the batch's: the row
 * keeps its crop, or keeps no picture at all and says so, and the other
 * eleven pieces still arrive. `onProgress` exists because this is seconds of
 * work on a phone and a silent wait reads as a hang.
 */
export async function harvest(
  photo: string,
  drafts: IntakeDraft[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, Harvested>> {
  const out = new Map<string, Harvested>();
  const boxed = drafts.filter(d => d.box);
  let done = 0;

  for (const draft of boxed) {
    try {
      const crop = await cropBox(photo, draft.box!);
      let lifted: string | undefined;
      let note: string | undefined;

      /**
       * The model was asked what the piece is lying on, and the answer decides
       * whether we attempt the cut at all.
       *
       * This is the cheap half of the problem solved by the expensive half.
       * A flood fill cannot tell a grey shirt from a grey duvet; a model
       * looking at the photograph can, and says so in one word. Attempting a
       * lift the model already called 'busy' costs a second of work and takes
       * a sleeve off with the sheet — and the person then has to notice.
       * 'none' means it arrived already cut out, so there is nothing to do.
       */
      if (draft.background === 'busy') {
        note = 'kept as photographed — the model read the background as busy, so a lift would have cut into the piece';
      } else if (draft.background === 'none') {
        note = undefined;
      } else {
        try {
          // Cut from a roomier crop, then keep the result — which is already
          // trimmed back to the garment's own bounds by the pass itself.
          const roomy = await cropBox(photo, draft.box!, LIFT_BLEED, LIFT_EDGE);
          const cut = await cutOut(roomy);
          if (cut.good) lifted = cut.url;
          else note = 'kept as photographed — the background would not lift cleanly';
        } catch {
          note = 'kept as photographed';
        }
      }
      out.set(draft.ref, { ref: draft.ref, crop, lifted, picture: lifted ?? crop, note });
    } catch {
      // No picture for this row. The piece still arrives; the closet draws it.
    }
    done++;
    onProgress?.(done, boxed.length);
  }
  return out;
}
