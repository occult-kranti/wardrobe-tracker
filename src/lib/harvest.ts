import { cutOut } from './cutout';
import type { IntakeDraft } from './intake';

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
): Promise<string> {
  const img = await loadImage(src);
  const W = img.naturalWidth;
  const H = img.naturalHeight;

  const [bx, by, bw, bh] = box;
  const x = Math.max(0, Math.round((bx - BLEED) * W));
  const y = Math.max(0, Math.round((by - BLEED) * H));
  const w = Math.min(W - x, Math.round((bw + BLEED * 2) * W));
  const h = Math.min(H - y, Math.round((bh + BLEED * 2) * H));
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
      try {
        const cut = await cutOut(crop);
        if (cut.good) lifted = cut.url;
        else note = 'kept as photographed — the background would not lift cleanly';
      } catch {
        note = 'kept as photographed';
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
