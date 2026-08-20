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

/** Crop a fractional box out of an image, returning a JPEG data URL. */
export async function cropBox(
  src: string,
  box: [number, number, number, number],
  bleed: number = BLEED,
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

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser will not open a drawing surface.');
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.9);
}

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
          const roomy = await cropBox(photo, draft.box!, LIFT_BLEED);
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
