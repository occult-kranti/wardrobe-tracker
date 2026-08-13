/**
 * CUTTING THE BACKGROUND OUT OF A GARMENT PHOTOGRAPH — on this device.
 *
 * Every serious rival in the category does this, and every one of them does it
 * on their servers: you hand a company a photograph of your clothes and they
 * hand back a cutout. Whering's Google Play declaration says it shares "photos
 * and videos" with third parties. Its own reviewers put the accuracy at "about
 * 50% of the time".
 *
 * So the bar is not high, and the position available to us is better than
 * parity: the same feature, with the photograph never leaving the browser.
 * There is no model download, no WASM blob, no network call — a garment on a
 * bed, a floor or a hanger is a foreground object against a background that
 * touches the frame's edge, and that is a problem classical vision solves.
 *
 * The method:
 *   1. Sample the border to learn what the background looks like.
 *   2. Flood from the border inward, taking every pixel close enough to it.
 *      Flooding rather than thresholding is what keeps a white shirt on a white
 *      duvet: the shirt does not touch the edge, so the flood stops at its hem.
 *   3. Keep only the largest surviving island, so a shadow in a far corner is
 *      not mistaken for a second garment.
 *   4. Close the pinholes a flood leaves in fabric that happens to match, then
 *      feather one pixel so the edge is a cut and not a staircase.
 *
 * It is honest about failing. `confidence` reports how much of the frame
 * survived, and a result that kept nearly everything or nearly nothing is
 * reported as poor so the interface can offer the original instead of
 * pretending.
 */

export interface Cutout {
  /** PNG data URL with a real alpha channel. */
  url: string;
  /** Share of the frame the garment occupies, 0–1. */
  covered: number;
  /** Whether this is worth offering. A cut that took everything, or nothing, is not. */
  good: boolean;
  width: number;
  height: number;
}

/** The size the pass runs at. Beyond this the work is wasted. */
const MAX_EDGE = 1000;

/**
 * The longest edge of what we hand back.
 *
 * This is a storage decision, not a visual one. A cut-out has to be a PNG —
 * it is the only format here that carries an alpha channel — and PNG does not
 * compress a photograph. The first version returned the full 1000px frame at
 * 1.2MB, and localStorage gives a browser about five megabytes for everything,
 * so four pieces would have filled the wardrobe and the fifth would have hit
 * the quota toast. Cropped to the garment and capped here it lands near 200KB,
 * which is the same order as the JPEG it came from.
 */
const OUT_EDGE = 512;

/**
 * PNG spends most of its bytes on photographic noise it cannot model. Dropping
 * the bottom three bits of each channel is invisible on cloth and roughly
 * halves the file, which is the difference between a wardrobe that fits in
 * localStorage and one that does not.
 */
function quantize(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    data[i] &= 0xf8;
    data[i + 1] &= 0xf8;
    data[i + 2] &= 0xf8;
  }
}

/** How close to the background a pixel must be, as a squared RGB distance. */
export const DEFAULT_TOLERANCE = 26;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That photograph would not open.'));
    img.src = src;
  });
}

/**
 * The colours the frame's edge is made of.
 *
 * A median rather than a mean, per channel, so one dark corner or a hand
 * holding the hanger cannot drag the whole model toward itself.
 */
function borderModel(data: Uint8ClampedArray, w: number, h: number) {
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  const take = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]);
  };
  const step = Math.max(1, Math.floor(Math.min(w, h) / 220));
  for (let x = 0; x < w; x += step) { take(x, 0); take(x, h - 1); }
  for (let y = 0; y < h; y += step) { take(0, y); take(w - 1, y); }
  const mid = (xs: number[]) => {
    xs.sort((a, b) => a - b);
    return xs[Math.floor(xs.length / 2)] ?? 0;
  };
  return { r: mid(rs), g: mid(gs), b: mid(bs) };
}

/**
 * Flood the background inward from every edge pixel.
 *
 * A scanline fill, not a per-pixel queue: on a 1100px frame the naive version
 * pushes a million entries and the tab stops answering.
 */
function floodBackground(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  bg: { r: number; g: number; b: number },
  tolerance: number,
): Uint8Array {
  const limit = tolerance * tolerance * 3;
  const isBg = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    const dr = data[i] - bg.r, dg = data[i + 1] - bg.g, db = data[i + 2] - bg.b;
    return dr * dr + dg * dg + db * db <= limit;
  };

  const mask = new Uint8Array(w * h); // 1 = background
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    if (mask[y * w + x]) return;
    if (!isBg(x, y)) return;
    stack.push(x, y);
  };

  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }

  while (stack.length) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    const row = y * w;
    if (mask[row + x]) continue;

    let left = x;
    while (left > 0 && !mask[row + left - 1] && isBg(left - 1, y)) left--;
    let right = x;
    while (right < w - 1 && !mask[row + right + 1] && isBg(right + 1, y)) right++;

    for (let i = left; i <= right; i++) {
      mask[row + i] = 1;
      if (y > 0) push(i, y - 1);
      if (y < h - 1) push(i, y + 1);
    }
  }
  return mask;
}

/** Keep the biggest island of foreground; everything smaller is noise. */
function largestIsland(mask: Uint8Array, w: number, h: number): Uint8Array {
  const seen = new Uint8Array(w * h);
  const best = new Uint8Array(w * h);
  let bestSize = 0;

  for (let start = 0; start < mask.length; start++) {
    if (mask[start] || seen[start]) continue;
    const island: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const at = stack.pop()!;
      island.push(at);
      const x = at % w, y = (at - x) / w;
      const neighbours = [
        x > 0 ? at - 1 : -1,
        x < w - 1 ? at + 1 : -1,
        y > 0 ? at - w : -1,
        y < h - 1 ? at + w : -1,
      ];
      for (const n of neighbours) {
        if (n < 0 || seen[n] || mask[n]) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if (island.length > bestSize) {
      bestSize = island.length;
      best.fill(0);
      for (const at of island) best[at] = 1;
    }
  }
  return best; // 1 = keep
}

/**
 * Close the pinholes a flood leaves where fabric happens to match the sheet.
 *
 * One dilation of the keep-mask, then one erosion — a morphological close,
 * which fills small gaps without growing the silhouette.
 */
function close(keep: Uint8Array, w: number, h: number): Uint8Array {
  const grow = (src: Uint8Array, on: number) => {
    const out = new Uint8Array(src.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const at = y * w + x;
        let hit = src[at] === on;
        if (!hit && x > 0) hit = src[at - 1] === on;
        if (!hit && x < w - 1) hit = src[at + 1] === on;
        if (!hit && y > 0) hit = src[at - w] === on;
        if (!hit && y < h - 1) hit = src[at + w] === on;
        out[at] = hit ? on : (on ? 0 : 1);
      }
    }
    return out;
  };
  return grow(grow(keep, 1), 0);
}

/**
 * Cut the background out of a photograph.
 *
 * `tolerance` is the one control worth exposing: a garment shot on a busy
 * bedspread needs a smaller number than one on a plain wall, and no automatic
 * choice is right for both.
 */
export async function cutOut(src: string, tolerance = DEFAULT_TOLERANCE): Promise<Cutout> {
  const img = await loadImage(src);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser will not open a drawing surface.');
  ctx.drawImage(img, 0, 0, w, h);

  const frame = ctx.getImageData(0, 0, w, h);
  const bg = borderModel(frame.data, w, h);
  const background = floodBackground(frame.data, w, h, bg, tolerance);
  const keep = close(largestIsland(background, w, h), w, h);

  // Feather: a pixel on the boundary takes the average of its neighbours, so
  // the edge reads as a cut rather than a staircase. The garment's bounds are
  // collected in the same pass — a second one over a megapixel is a whole
  // frame of jank for a number we already have in hand.
  let kept = 0;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const at = y * w + x;
      const on = keep[at];
      if (on) {
        kept++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      let sum = on ? 255 : 0;
      let n = 1;
      const around = [
        x > 0 ? at - 1 : -1, x < w - 1 ? at + 1 : -1,
        y > 0 ? at - w : -1, y < h - 1 ? at + w : -1,
      ];
      for (const p of around) {
        if (p < 0) continue;
        sum += keep[p] ? 255 : 0;
        n++;
      }
      frame.data[at * 4 + 3] = Math.round(sum / n);
    }
  }
  ctx.putImageData(frame, 0, 0);

  const covered = kept / (w * h);
  if (maxX < 0) {
    // Nothing survived. Hand back the frame as it is and say so, rather than
    // returning a crop of nothing.
    return { url: canvas.toDataURL('image/png'), covered: 0, good: false, width: w, height: h };
  }

  // Crop to the garment with a breath of margin, then scale to the size we are
  // willing to keep. The empty sheet around a shirt is most of the picture and
  // none of the information.
  const pad = Math.round(Math.min(w, h) * 0.02);
  const cx = Math.max(0, minX - pad);
  const cy = Math.max(0, minY - pad);
  const cw = Math.min(w, maxX + pad + 1) - cx;
  const ch = Math.min(h, maxY + pad + 1) - cy;
  const shrink = Math.min(1, OUT_EDGE / Math.max(cw, ch));
  const ow = Math.max(1, Math.round(cw * shrink));
  const oh = Math.max(1, Math.round(ch * shrink));

  const out = document.createElement('canvas');
  out.width = ow;
  out.height = oh;
  const octx = out.getContext('2d');
  if (!octx) throw new Error('This browser will not open a drawing surface.');
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(canvas, cx, cy, cw, ch, 0, 0, ow, oh);

  const shrunk = octx.getImageData(0, 0, ow, oh);
  quantize(shrunk.data);
  octx.putImageData(shrunk, 0, 0);

  return {
    url: out.toDataURL('image/png'),
    covered,
    // A cut that kept 97% of the frame did nothing; one that kept 4% ate the
    // garment. Between those it is worth showing, and the person decides.
    good: covered > 0.06 && covered < 0.94,
    width: ow,
    height: oh,
  };
}
