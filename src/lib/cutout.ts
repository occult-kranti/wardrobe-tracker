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
 * There is no model download, no WASM blob, no network call.
 *
 * ── WHY THIS FILE WAS REWRITTEN ──────────────────────────────────────────────
 * The first version took the median colour of the frame's border, flooded
 * inward from every edge pixel, and reported success whenever between 6% and
 * 94% of the frame survived. Measured against forty real photographs it called
 * 36 of them good. Looked at, most of those were failures:
 *
 *   · A suit photographed against a pale wall, where the jacket ran off the
 *     right-hand edge. The border median landed between the wall and the navy,
 *     which put it near the white shirt — so the flood ate the shirt and kept
 *     the wall. The one thing a cutout must never do, it did.
 *   · A lehenga on a quilted bedspread came back at 0.931 covered: the cut had
 *     removed a hairline of frame and nothing else, and the 6–94% rule called
 *     that a success.
 *
 * Both have the same root: ONE global colour, seeded from EVERY edge pixel,
 * with no way to tell "this edge pixel is the wall" from "this edge pixel is
 * the garment running off the frame", and no measure of whether the resulting
 * outline lay on anything real.
 *
 * The four changes that answer it:
 *
 *   1. A PALETTE, CHOSEN BY RESULT. The border is clustered rather than
 *      averaged, and no rule decides which cluster is the wall — every one is
 *      flooded, every cut is scored, and the one that produces a believable
 *      garment wins. A cluster that was really the jacket floods the jacket,
 *      comes back with two percent of the frame surviving, and loses without
 *      ever having needed to be recognised. Two priors break the genuinely even
 *      cases: what was removed should be CALM (walls and sheets are flat, a
 *      jacket has lapels and a pinstripe) and the MIDDLE of the frame should be
 *      what was kept.
 *   2. AN EDGE-GUARDED FLOOD. A pixel joins the background if it is close to
 *      the pixel it spread FROM (so a wall that darkens across the frame is
 *      still one wall) and still recognisably one of the palette's colours (so
 *      the drift cannot walk into the garment). A step edge stops it dead, even
 *      when the two sides are near in colour. That is what keeps a white shirt
 *      on a white duvet.
 *   3. IT CHOOSES ITS OWN TOLERANCE, by running the cheap version of the whole
 *      pass at five settings and keeping the best-scoring one. Nobody should
 *      have to find the slider before the feature works once.
 *   4. IT KNOWS WHEN IT FAILED. `fit` measures how much of the cut's outline
 *      lies along a real edge in the photograph, against that photograph's own
 *      strong edges. A cut through flat fabric scores near zero however
 *      plausible its area. `trouble` says which way it went wrong, in words.
 *
 * And one thing the person can do that no automatic rule beats: DRAW A BOX
 * around the garment. Everything outside is background by fiat, the palette is
 * read from that outside, and the hardest case in the category — a garment
 * touching the frame — stops being a case at all.
 */

export interface Cutout {
  /** PNG data URL with a real alpha channel. */
  url: string;
  /** Share of the frame the garment occupies, 0–1. */
  covered: number;
  /**
   * How much of the cut's outline lies on an edge that is actually in the
   * photograph, 0–1, measured against this photograph's own strongest edges.
   * The number `covered` could never be: area says nothing about whether the
   * line went round the garment or through it.
   */
  fit: number;
  /**
   * How compactly the outline encloses what it kept, 0–1. Near zero is a result
   * that came back as scattered flakes rather than as a garment.
   */
  shape: number;
  /** Whether this is worth offering. */
  good: boolean;
  /** What went wrong, in a sentence, or null. */
  trouble: string | null;
  /** The tolerance this result was produced at — chosen, unless one was given. */
  tolerance: number;
  width: number;
  height: number;
}

/** A rectangle in fractions of the frame, as dragged over the photograph. */
export interface CutBox { x: number; y: number; w: number; h: number }

export interface CutRequest {
  /** 8–60. Omit, or null, to let the pass choose for itself. */
  tolerance?: number | null;
  /** The garment is inside here. Everything outside is background, no argument. */
  box?: CutBox | null;
  /** Places the person pointed at and called background, in frame fractions. */
  taps?: { x: number; y: number }[];
}

/** The size the full pass runs at. Beyond this the work is wasted. */
const MAX_EDGE = 1000;

/**
 * The size the tolerance SEARCH runs at. Five passes at full resolution is
 * three seconds of a frozen tab; at a quarter of the edge it is a fifth of the
 * work each, and the ranking between tolerances does not change — we are
 * choosing a setting, not producing a picture.
 */
const SEARCH_EDGE = 320;

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

/** The ladder the automatic choice searches. Coarse on purpose: the scores
    between neighbouring rungs differ by less than the noise. */
const LADDER = [12, 18, 26, 36, 48];

/** Where the slider sits when someone takes hold of it. */
export const DEFAULT_TOLERANCE = 26;

/**
 * How much a difference in BRIGHTNESS counts against a difference in COLOUR.
 *
 * Under one, which is what this is, a shadow falling across a white sheet stays
 * background — it is the same colour, dimmer — while a grey garment on that
 * same sheet does not become background just for being a similar grey, because
 * whatever colour it does have is counted at full weight. Photographs of
 * clothes on beds are mostly this problem.
 */
const LUMA_WEIGHT = 0.42;

/** Squared-distance budget for one unit of tolerance, given the weights above. */
const UNIT = LUMA_WEIGHT + 2;

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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That photograph would not open.'));
    img.src = src;
  });
}

interface Frame {
  /** The pixels as the canvas holds them — kept whole so they can be put back. */
  image: ImageData;
  data: Uint8ClampedArray;
  w: number;
  h: number;
  /** Brightness, and the two colour axes, softened by a 3×3 mean. */
  Y: Int16Array; Cb: Int16Array; Cr: Int16Array;
  /** How fast the picture changes at each pixel. */
  G: Float32Array;
  /** What counts as a strong edge IN THIS PHOTOGRAPH — its own 88th percentile,
      not a constant. A flatly-lit shirt on a sheet and a jacket against a window
      have nothing in common on an absolute scale. */
  strong: number;
}

/**
 * Draw the photograph at a working size and derive the planes every later stage
 * compares against.
 *
 * The blur is not cosmetic. JPEG noise on a plain wall is ±4 per channel, and
 * the flood's local test is deliberately strict enough that raw noise would
 * stop it at random — the picture would come back speckled. The blur is used
 * for DECIDING only; the pixels handed back are the ones that arrived.
 */
function frameOf(img: HTMLImageElement, maxEdge: number): Frame {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser will not open a drawing surface.');
  ctx.drawImage(img, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;

  const Y = new Int16Array(w * h);
  const Cb = new Int16Array(w * h);
  const Cr = new Int16Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = (yy * w + xx) * 4;
          r += data[j]; g += data[j + 1]; b += data[j + 2]; n++;
        }
      }
      r /= n; g /= n; b /= n;
      const at = y * w + x;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      Y[at] = Math.round(luma);
      Cb[at] = Math.round(b - luma);
      Cr[at] = Math.round(r - luma);
    }
  }

  const frame: Frame = { image, data, w, h, Y, Cb, Cr, G: new Float32Array(w * h), strong: 1 };
  const sample: number[] = [];
  const stride = Math.max(1, Math.floor(Math.min(w, h) / 140));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const at = y * w + x;
      const l = x > 0 ? at - 1 : at, r = x < w - 1 ? at + 1 : at;
      const u = y > 0 ? at - w : at, d = y < h - 1 ? at + w : at;
      const g = Math.sqrt(pixelGap(frame, l, r)) + Math.sqrt(pixelGap(frame, u, d));
      frame.G[at] = g;
      if (x % stride === 0 && y % stride === 0) sample.push(g);
    }
  }
  sample.sort((a, b) => a - b);
  // The 88th percentile, not the maximum: one blown highlight should not set the
  // bar for a whole photograph.
  frame.strong = sample[Math.floor(sample.length * 0.88)] || 1;
  return frame;
}

/** Weighted squared distance between two pixels of the same frame. */
function pixelGap(f: Frame, a: number, b: number): number {
  const dy = f.Y[a] - f.Y[b];
  const dcb = f.Cb[a] - f.Cb[b];
  const dcr = f.Cr[a] - f.Cr[b];
  return LUMA_WEIGHT * dy * dy + dcb * dcb + dcr * dcr;
}

type Swatch = { y: number; cb: number; cr: number; weight: number; corners: number };

/** Weighted squared distance from a pixel to one of the palette's colours. */
function swatchGap(f: Frame, at: number, s: Swatch): number {
  const dy = f.Y[at] - s.y;
  const dcb = f.Cb[at] - s.cb;
  const dcr = f.Cr[at] - s.cr;
  return LUMA_WEIGHT * dy * dy + dcb * dcb + dcr * dcr;
}

/**
 * The nearest background colour to a pixel, back in plain red-green-blue.
 *
 * The pass works in brightness-and-colour because that is where a shadow can be
 * told from a stain; un-mixing a boundary pixel has to happen in the space the
 * photograph is actually stored in.
 */
function nearestSwatchRgb(f: Frame, palette: Swatch[]): (at: number) => [number, number, number] {
  const rgb = palette.map((s): [number, number, number] => {
    const b = s.y + s.cb;
    const r = s.y + s.cr;
    const g = (s.y - 0.299 * r - 0.114 * b) / 0.587;
    return [r, g, b];
  });
  return (at: number) => {
    let best = 0, bestGap = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const d = swatchGap(f, at, palette[i]);
      if (d < bestGap) { bestGap = d; best = i; }
    }
    return rgb[best] ?? [0, 0, 0];
  };
}

function nearestGap(f: Frame, at: number, palette: Swatch[]): number {
  let best = Infinity;
  for (const s of palette) {
    const d = swatchGap(f, at, s);
    if (d < best) best = d;
  }
  return best;
}

/**
 * WHAT COLOURS THE BORDER IS MADE OF — grouped, not averaged.
 *
 * The old median could be a colour that appears nowhere in the photograph: half
 * a pale wall and half a navy jacket average to a mid-grey that matches the
 * shirt between them. This gathers the border and groups it into the few
 * colours actually present, each with the share of the border it holds and
 * which quadrants it turned up in.
 *
 * It deliberately does NOT decide which of them is the background. That
 * question has no reliable local answer — a jacket filling the bottom of the
 * frame holds two corners as convincingly as a wall does. It is settled further
 * down, by trying each and keeping whichever produces a cut that survives
 * scoring.
 */
function borderSwatches(f: Frame, box: CutBox | null): Swatch[] {
  const { w, h } = f;
  const merge = 20 * 20 * UNIT;
  const found: Swatch[] = [];

  const add = (at: number, corner: number) => {
    for (const s of found) {
      if (swatchGap(f, at, s) <= merge) {
        // A running mean, so a swatch settles on what its members actually are
        // rather than on whichever pixel happened to arrive first.
        const total = s.weight + 1;
        s.y = (s.y * s.weight + f.Y[at]) / total;
        s.cb = (s.cb * s.weight + f.Cb[at]) / total;
        s.cr = (s.cr * s.weight + f.Cr[at]) / total;
        s.weight = total;
        s.corners |= corner;
        return;
      }
    }
    found.push({ y: f.Y[at], cb: f.Cb[at], cr: f.Cr[at], weight: 1, corners: corner });
  };

  // Which quadrant a sample came from. Four bits, so "turns up in two corners"
  // is a popcount.
  const quadrant = (x: number, y: number) => (x < w / 2 ? 1 : 2) << (y < h / 2 ? 0 : 2);

  if (box) {
    // With a box drawn, the background is everything outside it, and that is
    // the only place worth sampling.
    const bx0 = Math.round(box.x * w), by0 = Math.round(box.y * h);
    const bx1 = Math.round((box.x + box.w) * w), by1 = Math.round((box.y + box.h) * h);
    const step = Math.max(1, Math.floor(Math.min(w, h) / 90));
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        if (x >= bx0 && x < bx1 && y >= by0 && y < by1) continue;
        add(y * w + x, quadrant(x, y));
      }
    }
  } else {
    // A band rather than the one-pixel rim: a wall's colour ten pixels in is
    // the same wall, and three rows of it outvote a dust mote on the lens.
    const band = Math.max(1, Math.round(Math.min(w, h) * 0.03));
    const step = Math.max(1, Math.floor(Math.min(w, h) / 150));
    for (let d = 0; d < band; d += Math.max(1, Math.round(band / 3))) {
      for (let x = 0; x < w; x += step) {
        add(d * w + x, quadrant(x, d));
        add((h - 1 - d) * w + x, quadrant(x, h - 1 - d));
      }
      for (let y = 0; y < h; y += step) {
        add(y * w + d, quadrant(d, y));
        add(y * w + (w - 1 - d), quadrant(w - 1 - d, y));
      }
    }
  }

  const total = found.reduce((a, s) => a + s.weight, 0) || 1;
  return found
    .filter(s => s.weight / total >= 0.06)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4);
}

/** A colour the person pointed at and called background. */
function tapSwatches(f: Frame, taps: { x: number; y: number }[]): Swatch[] {
  return taps.map(tap => {
    const x = Math.min(f.w - 1, Math.max(0, Math.round(tap.x * f.w)));
    const y = Math.min(f.h - 1, Math.max(0, Math.round(tap.y * f.h)));
    const at = y * f.w + x;
    return { y: f.Y[at], cb: f.Cb[at], cr: f.Cr[at], weight: 1, corners: 15 };
  });
}

/**
 * THE PALETTES WORTH TRYING.
 *
 * Every border colour on its own, and all of them together. Which is the wall
 * is not decided here and is not decided by a rule: each is flooded, each cut
 * is scored, and the one that produces a believable garment wins. A palette
 * that was really the jacket floods the jacket, comes back with two percent of
 * the frame surviving, and scores nothing — so it loses without ever having
 * needed to be recognised.
 *
 * A tapped colour is in every palette. Being pointed at outranks any of this.
 */
function paletteOptions(swatches: Swatch[], tapped: Swatch[]): Swatch[][] {
  const options: Swatch[][] = [];
  if (tapped.length) options.push(tapped);
  if (swatches.length > 1) options.push([...swatches, ...tapped]);
  for (const s of swatches) options.push([s, ...tapped]);
  return options;
}

/**
 * FLOOD THE BACKGROUND INWARD — with a guard against crossing an edge.
 *
 * Two tests, and a pixel must pass both:
 *
 *   local  — it is close to the pixel it spread FROM. A wall that darkens
 *            across the frame passes, one step at a time. A hem passes nothing:
 *            a step edge stops the flood even where the colours either side are
 *            near, which is the white-shirt-on-white-duvet case that no global
 *            threshold has ever solved.
 *   global — it is still recognisably one of the palette's colours, at a looser
 *            budget. This is the leash on the local test: without it, a long
 *            enough gradient walks anywhere at all.
 *
 * Seeds are border pixels that MATCH the palette. An edge run that does not —
 * a jacket leaving the frame — is never seeded, so it is never eaten.
 */
function floodBackground(
  f: Frame,
  pal: Swatch[],
  tolerance: number,
  box: CutBox | null,
): Uint8Array {
  const { w, h } = f;
  const local = tolerance * tolerance * UNIT;
  const global = (tolerance * 2.4) * (tolerance * 2.4) * UNIT;

  const mask = new Uint8Array(w * h); // 1 = background
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;

  const seed = (at: number) => {
    if (mask[at]) return;
    if (nearestGap(f, at, pal) > global) return;
    mask[at] = 1;
    queue[tail++] = at;
  };

  if (box) {
    // Outside the box is background by fiat — no test, no argument. That is the
    // whole value of having drawn one.
    const bx0 = Math.round(box.x * w), by0 = Math.round(box.y * h);
    const bx1 = Math.round((box.x + box.w) * w), by1 = Math.round((box.y + box.h) * h);
    for (let y = 0; y < h; y++) {
      const inRows = y >= by0 && y < by1;
      for (let x = 0; x < w; x++) {
        if (inRows && x >= bx0 && x < bx1) continue;
        const at = y * w + x;
        mask[at] = 1;
        queue[tail++] = at;
      }
    }
  } else {
    for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  }

  while (head < tail) {
    const at = queue[head++];
    const x = at % w;
    const y = (at - x) / w;
    for (let k = 0; k < 4; k++) {
      const nx = x + (k === 0 ? -1 : k === 1 ? 1 : 0);
      const ny = y + (k === 2 ? -1 : k === 3 ? 1 : 0);
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const to = ny * w + nx;
      if (mask[to]) continue;
      if (pixelGap(f, to, at) > local) continue;
      if (nearestGap(f, to, pal) > global) continue;
      mask[to] = 1;
      queue[tail++] = to;
    }
  }
  return mask;
}

/**
 * Keep the garment, and anything else large enough to be part of it.
 *
 * The first version kept only the single largest island, which threw away the
 * dupatta lying beside a lehenga and one shoe of a pair. Anything at least a
 * seventh of the largest island is part of what was photographed; below that it
 * is a shadow in a corner or a flood that leaked through a pinhole.
 */
function keepIslands(background: Uint8Array, w: number, h: number): Uint8Array {
  const label = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  const stack = new Int32Array(w * h);

  for (let start = 0; start < background.length; start++) {
    if (background[start] || label[start] >= 0) continue;
    const id = sizes.length;
    let size = 0, top = 0;
    stack[top++] = start;
    label[start] = id;
    while (top > 0) {
      const at = stack[--top];
      size++;
      const x = at % w;
      const y = (at - x) / w;
      if (x > 0 && !background[at - 1] && label[at - 1] < 0) { label[at - 1] = id; stack[top++] = at - 1; }
      if (x < w - 1 && !background[at + 1] && label[at + 1] < 0) { label[at + 1] = id; stack[top++] = at + 1; }
      if (y > 0 && !background[at - w] && label[at - w] < 0) { label[at - w] = id; stack[top++] = at - w; }
      if (y < h - 1 && !background[at + w] && label[at + w] < 0) { label[at + w] = id; stack[top++] = at + w; }
    }
    sizes.push(size);
  }

  const biggest = Math.max(0, ...sizes);
  const floor = biggest / 7;
  const keep = new Uint8Array(w * h);
  for (let at = 0; at < keep.length; at++) {
    const id = label[at];
    if (id >= 0 && sizes[id] >= floor) keep[at] = 1;
  }
  return keep;
}

/**
 * Open, then close.
 *
 * Opening first is the change that matters: a flood that leaked through a
 * two-pixel gap between a sleeve and the frame leaves a thread of foreground
 * bridging two regions, and closing alone would set it in place. Erode, and the
 * thread parts. Then dilate twice and erode once, which restores the silhouette
 * and fills the pinholes the flood left where fabric matched the sheet.
 */
function tidy(keep: Uint8Array, w: number, h: number): Uint8Array {
  const pass = (src: Uint8Array, dilate: boolean) => {
    const out = new Uint8Array(src.length);
    const want = dilate ? 1 : 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const at = y * w + x;
        let hit = src[at] === want;
        if (!hit && x > 0) hit = src[at - 1] === want;
        if (!hit && x < w - 1) hit = src[at + 1] === want;
        if (!hit && y > 0) hit = src[at - w] === want;
        if (!hit && y < h - 1) hit = src[at + w] === want;
        out[at] = hit ? want : (dilate ? 0 : 1);
      }
    }
    return out;
  };
  return pass(pass(pass(pass(keep, false), true), true), false);
}

/**
 * DID THE LINE GO ROUND THE GARMENT, OR THROUGH IT?
 *
 * Area cannot answer that, which is how the old version came to call a cut that
 * removed a hairline of frame a success. This walks the outline and asks how
 * much the photograph itself changes across it, measured against how much that
 * photograph changes at its own strongest edges. A cut along a hem sits where
 * the picture already had a line. A cut through the middle of a skirt sits
 * where it had none, and scores near zero however sensible its area.
 */
function outlineFit(f: Frame, keep: Uint8Array, area: number) {
  const { w, h } = f;
  const onEdge: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const at = y * w + x;
      if (!keep[at]) continue;
      if (keep[at - 1] && keep[at + 1] && keep[at - w] && keep[at + w]) continue;
      onEdge.push(f.G[at]);
    }
  }
  if (onEdge.length < 24) return { fit: 0, shape: 0 };
  onEdge.sort((a, b) => a - b);
  // The median of the outline, so that a cut which follows the hem for a third
  // of its length and crosses open fabric for the rest is not flattered by its
  // good third.
  const fit = Math.max(0, Math.min(1, onEdge[Math.floor(onEdge.length / 2)] / f.strong));

  // COMPACTNESS — how much outline it took to enclose that much garment.
  //
  // The measure that catches the failure `fit` cannot: a cut that came back as
  // forty scattered flakes has a wonderful outline, because every flake's edge
  // is a real edge. It is still not a photograph of a camisole. A dress, a
  // shoe, a bag — anything a person would photograph on its own — encloses its
  // area with a short perimeter. Confetti does not.
  const perimeter = onEdge.length;
  const shape = Math.min(1, (4 * Math.PI * area) / (perimeter * perimeter));
  return { fit, shape };
}

/** How believable an area is, before anything is known about the outline. */
function plausible(covered: number): number {
  if (covered < 0.02 || covered > 0.94) return 0;
  if (covered < 0.06) return (covered - 0.02) / 0.04;
  if (covered > 0.80) return Math.max(0, (0.94 - covered) / 0.14);
  return 1;
}

/**
 * IS WHAT WAS REMOVED CALM ENOUGH TO HAVE BEEN A BACKGROUND?
 *
 * A wall, a sheet, a floor and a door are flat. A jacket has lapels, a pocket
 * square and a pinstripe. This is the term that stops the pass handing back a
 * photograph of a suit with the suit taken out of it — a close-up where the
 * garment fills half the frame and touches three corners is otherwise a
 * genuinely even argument, and every other measure here scores the inversion
 * exactly as well as the answer.
 */
function calmness(f: Frame, keep: Uint8Array): number {
  let sum = 0, n = 0;
  for (let i = 0; i < keep.length; i++) {
    if (keep[i]) continue;
    sum += f.G[i];
    n++;
  }
  if (n === 0) return 0;
  return 1 - Math.min(1, sum / n / f.strong);
}

/**
 * Is the middle of the picture the thing we kept?
 *
 * The second guard against handing back a photograph of a suit with the suit
 * taken out of it, and the cheaper of the two. Nobody photographs a garment and
 * leaves the middle of the frame for the wall. When the flood inverts, this
 * collapses.
 */
function centreHeld(f: Frame, keep: Uint8Array): number {
  const x0 = Math.round(f.w * 0.35), x1 = Math.round(f.w * 0.65);
  const y0 = Math.round(f.h * 0.35), y1 = Math.round(f.h * 0.65);
  let on = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) { on += keep[y * f.w + x]; n++; }
  }
  return n === 0 ? 0 : on / n;
}

/** One whole decision, at whatever size the frame arrived at. */
function attempt(f: Frame, pal: Swatch[], tolerance: number, box: CutBox | null) {
  const background = floodBackground(f, pal, tolerance, box);
  const keep = tidy(keepIslands(background, f.w, f.h), f.w, f.h);
  let kept = 0;
  for (let i = 0; i < keep.length; i++) kept += keep[i];
  const covered = kept / (f.w * f.h);
  const { fit, shape } = outlineFit(f, keep, kept);
  const calm = calmness(f, keep);
  const centre = centreHeld(f, keep);
  return {
    keep, covered, fit, shape, centre,
    score:
      fit * plausible(covered)
      * (0.45 + 0.55 * calm)
      * (0.35 + 0.65 * Math.min(1, centre / 0.6))
      * Math.min(1, shape / 0.18),
  };
}

/**
 * Cut the background out of a photograph.
 *
 * With no tolerance given it finds its own, by running the whole decision small
 * at five settings and keeping the best-scoring. Somebody who then disagrees
 * has the slider; nobody should need it to see the feature work once.
 */
export async function cutOut(src: string, req: CutRequest | number = {}): Promise<Cutout> {
  // The old signature took a bare tolerance. Callers that still pass one keep
  // working rather than silently cutting at the default.
  const ask: CutRequest = typeof req === 'number' ? { tolerance: req } : req;
  const box = ask.box ?? null;
  const taps = ask.taps ?? [];

  const img = await loadImage(src);

  // The search runs small. Colours are the same at any resolution, so the
  // palette it settles on is carried straight over to the full-size pass.
  const small = frameOf(img, SEARCH_EDGE);
  const options = paletteOptions(borderSwatches(small, box), tapSwatches(small, taps));

  let tolerance = ask.tolerance ?? 0;
  let pal: Swatch[] = options[0] ?? [];
  let best = 0;
  const bits = (n: number) => (n & 1) + ((n >> 1) & 1) + ((n >> 2) & 1) + ((n >> 3) & 1);
  for (const option of options) {
    // A palette that holds more of the corners is the likelier wall, so it wins
    // a tie. It never wins an argument: the cut still has to score.
    const corners = Math.max(0, ...option.map(s => bits(s.corners)));
    for (const rung of ask.tolerance ? [ask.tolerance] : LADDER) {
      const { score } = attempt(small, option, rung, box);
      const weighted = score * (1 + 0.05 * corners);
      if (weighted > best) { best = weighted; pal = option; tolerance = rung; }
    }
  }
  // Nothing scored at all. Cut at the middle of the ladder with the biggest
  // border colour anyway, and let `trouble` say what happened — silence would
  // leave the person staring at a blank pane wondering whether it was still
  // working.
  if (!tolerance) tolerance = DEFAULT_TOLERANCE;

  const f = frameOf(img, MAX_EDGE);
  const { keep, covered, fit, shape } = attempt(f, pal, tolerance, box);
  const { w, h } = f;

  // THE MATTE, AND THE HALO.
  //
  // A boundary pixel takes an alpha from how far its own colour sits from the
  // nearest background swatch — a real edge rather than the staircase a hard
  // mask leaves, and rather than the box blur the first version used, which
  // softened the hem and the sleeve by the same amount whatever either was
  // against.
  //
  // Then the part that decides whether the result looks cut or looks pasted. A
  // pixel on the edge of a shirt is not shirt-coloured: it is part shirt and
  // part bedsheet, and dropping its alpha leaves the bedsheet's colour ringing
  // the garment against every background it is later shown on. But the
  // photograph gives us the mixture, the pass gives us the alpha, and the
  // palette gives us what it was mixed WITH — so the garment's own colour is
  // simply the third side of that sum, and can be solved for rather than
  // guessed at.
  const soft = tolerance * tolerance * UNIT * 4;
  const ground = nearestSwatchRgb(f, pal);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const at = y * w + x;
      const on = keep[at] === 1;
      if (on) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      let alpha = on ? 255 : 0;
      const border =
        (x > 0 && keep[at - 1] !== keep[at]) || (x < w - 1 && keep[at + 1] !== keep[at]) ||
        (y > 0 && keep[at - w] !== keep[at]) || (y < h - 1 && keep[at + w] !== keep[at]);
      if (border) {
        const away = Math.min(1, nearestGap(f, at, pal) / soft);
        alpha = Math.round(on ? 80 + 175 * away : 175 * away);
        if (alpha > 24 && alpha < 250) {
          const a = alpha / 255;
          const bg = ground(at);
          for (let c = 0; c < 3; c++) {
            const mixed = f.data[at * 4 + c];
            f.data[at * 4 + c] = Math.max(0, Math.min(255, (mixed - (1 - a) * bg[c]) / a));
          }
        }
      }
      f.data[at * 4 + 3] = alpha;
    }
  }

  // Every fully transparent pixel is given one flat colour. It is invisible —
  // nothing is drawn through an alpha of zero — and it turns most of a cutout
  // into a single flat region, which is the one thing PNG compresses well. It
  // is worth the same order as the 5-bit quantise below, in the same currency:
  // how many pieces fit in localStorage before the quota toast.
  for (let at = 0; at < keep.length; at++) {
    if (f.data[at * 4 + 3] !== 0) continue;
    f.data[at * 4] = 0;
    f.data[at * 4 + 1] = 0;
    f.data[at * 4 + 2] = 0;
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser will not open a drawing surface.');
  ctx.putImageData(f.image, 0, 0);

  const trouble =
    covered <= 0.02
      ? 'That took the whole picture. The garment and whatever it is lying on are too close in colour for this to find the line between them — draw a box round the piece and it will only look inside it.'
      : covered >= 0.92
        ? 'That found almost no background to remove. A plainer surface behind the piece, or a box drawn round it, gives this something to work with.'
        : shape < 0.05
          ? 'That came back in pieces rather than as one garment. Usually it means there is more than one thing in the photograph — draw a box round the piece you meant.'
          : fit < 0.16
            ? 'The line it cut does not follow anything in the photograph — it has gone through the garment rather than round it. Draw a box round the piece, or point at the background, and it will start again from there.'
            : null;

  const good = trouble === null;

  if (maxX < 0) {
    return {
      url: canvas.toDataURL('image/png'),
      covered: 0, fit: 0, shape: 0, good: false, tolerance,
      trouble: trouble ?? 'Nothing survived that cut.',
      width: w, height: h,
    };
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
  const octx = out.getContext('2d', { willReadFrequently: true });
  if (!octx) throw new Error('This browser will not open a drawing surface.');
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(canvas, cx, cy, cw, ch, 0, 0, ow, oh);

  const shrunk = octx.getImageData(0, 0, ow, oh);
  quantize(shrunk.data);
  octx.putImageData(shrunk, 0, 0);

  return {
    url: out.toDataURL('image/png'),
    covered,
    fit,
    shape,
    good,
    trouble,
    tolerance,
    width: ow,
    height: oh,
  };
}

/* ---------- the automatic single-image variant, for batch crops ---------- */

/**
 * Is there a line to find at all?
 *
 * The background pass learns its palette from the frame's border. A
 * near-uniform frame — a flat fill, a blur, an accidental pocket photograph —
 * has no palette and no edge: every flood consumes the whole picture and
 * every score is noise. That is not a failure to report, it is nothing to
 * attempt. Pure (no DOM), so the guard rails are testable without a browser.
 *
 * The measure is the largest per-channel standard deviation over a sampled
 * grid. JPEG noise on a plain wall runs to a few points per channel; a real
 * garment photograph is tens. Four sits between them.
 */
export function frameIsUniform(data: Uint8ClampedArray | number[], width: number, height: number): boolean {
  if (width < 2 || height < 2 || data.length < width * height * 4) return true;
  const stepX = Math.max(1, Math.floor(width / 64));
  const stepY = Math.max(1, Math.floor(height / 64));
  let n = 0;
  let s0 = 0, s1 = 0, s2 = 0, q0 = 0, q1 = 0, q2 = 0;
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const at = (y * width + x) * 4;
      const r = data[at], g = data[at + 1], b = data[at + 2];
      s0 += r; s1 += g; s2 += b;
      q0 += r * r; q1 += g * g; q2 += b * b;
      n++;
    }
  }
  if (n < 4) return true;
  const sd = (s: number, q: number) => Math.sqrt(Math.max(0, q / n - (s / n) * (s / n)));
  return Math.max(sd(s0, q0), sd(s1, q1), sd(s2, q2)) < 4;
}

/** What a successful lift hands back — a PNG with a real alpha channel. */
export interface Lifted {
  url: string;
  /** Share of the frame the garment occupies, 0–1. */
  covered: number;
  /** How much of the cut's outline lies on a real edge in the photograph, 0–1. */
  fit: number;
  /** The tolerance the pass chose for itself. */
  tolerance: number;
}

/**
 * Lift a garment crop off its background, automatically, on this device.
 *
 * This is the batch path's door into the same pass the cutout bench drives by
 * hand: edge-anchored background estimation (the border's colour clusters),
 * an edge-guarded flood, and a cut that knows when it failed. The crop should
 * be a ROOMY one — a box drawn tight to the garment leaves no border of
 * background to read.
 *
 * The honest fallback is `null`: a degenerate frame (nothing to estimate),
 * or a cut the pass itself scored as a failure. Either way the caller keeps
 * the clean crop and says nothing was lifted — a second-best cutout is worse
 * than none.
 */
export async function liftBackground(canvas: HTMLCanvasElement): Promise<Lifted | null> {
  const w = canvas.width;
  const h = canvas.height;
  if (w < 8 || h < 8) return null;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }
  if (frameIsUniform(data, w, h)) return null;
  const cut = await cutOut(canvas.toDataURL('image/png'));
  return cut.good
    ? { url: cut.url, covered: cut.covered, fit: cut.fit, tolerance: cut.tolerance }
    : null;
}
