// Synthesizes the product film's score — a windchime-and-pad piece, ~130s,
// rendered straight to WAV with no dependencies and no randomness that isn't
// seeded. The brief (docs: film-plan §4): unhurried aeolian chimes over a soft
// pad at felt-60bpm, flat low dynamics through the walkthrough, ONE swell
// cresting at ~86s (the theme montage), thinning after, near-silence and a
// single final chime left to decay over the end card.
//
// Usage: node scripts/make-score.mjs <out.wav>
import { writeFileSync } from 'node:fs';

const SR = 44100;
const DUR = 130;
const N = SR * DUR;
const L = new Float64Array(N);
const R = new Float64Array(N);

// Seeded PRNG — the score is the same piece every render.
let seed = 0x5eed;
const rand = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};

/* ---------- the pad: A aeolian, chords crossfading every 16s ---------- */

const CHORDS = [
  [110.0, 164.81, 220.0],    // A
  [87.31, 130.81, 174.61],   // F
  [98.0, 146.83, 196.0],     // G
  [82.41, 123.47, 164.81],   // Em
];

function padGain(t) {
  // Master dynamics: flat and low, one swell 75→86s, settle, thin to the end.
  if (t < 4) return 0.5 * (t / 4);
  if (t < 75) return 0.5;
  if (t < 86) return 0.5 + 0.45 * ((t - 75) / 11);
  if (t < 95) return 0.95 - 0.4 * ((t - 86) / 9);
  if (t < 108) return 0.55 - 0.2 * ((t - 95) / 13);
  return Math.max(0, 0.35 * (1 - (t - 108) / 20));
}

for (let i = 0; i < N; i++) {
  const t = i / SR;
  const bar = t / 16;
  const idx = Math.floor(bar) % CHORDS.length;
  const next = (idx + 1) % CHORDS.length;
  const frac = bar - Math.floor(bar);
  // 2s crossfade at each chord turn.
  const x = frac > 0.875 ? (frac - 0.875) / 0.125 : 0;
  const lfo = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.05 * t);
  let s = 0;
  for (let v = 0; v < 3; v++) {
    const a = Math.sin(2 * Math.PI * CHORDS[idx][v] * t) * (1 - x);
    const b = Math.sin(2 * Math.PI * CHORDS[next][v] * t) * x;
    s += (a + b) * (v === 0 ? 1 : 0.6);
  }
  const g = 0.028 * lfo * padGain(t);
  L[i] += s * g;
  R[i] += s * g * 0.96;
}

/* ---------- the chimes: sparse, aeolian, panned, seeded ---------- */

const NOTES = [440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

/** Density per section: seconds between chimes (average). */
function gapAt(t) {
  if (t < 20) return 4.2;   // the open: sparse, setting the voice
  if (t < 70) return 5.0;   // the walkthrough: stays out of the way
  if (t < 90) return 2.2;   // the swell: the chimes gather
  if (t < 108) return 5.5;  // mobile: thinning
  return 99;                // end card: silence except the final chime
}

const events = [];
let t = 2.5;
while (t < 112) {
  events.push({ at: t, f: NOTES[Math.floor(rand() * NOTES.length)], pan: rand() * 2 - 1, g: 0.05 + rand() * 0.03 });
  t += gapAt(t) * (0.7 + rand() * 0.6);
}
// The last word: one chime at 117.5, louder, left to decay entirely.
events.push({ at: 117.5, f: 659.25, pan: 0, g: 0.085 });
events.push({ at: 117.53, f: 880.0, pan: 0.2, g: 0.045 });

for (const e of events) {
  const start = Math.floor(e.at * SR);
  const tail = Math.min(N - start, SR * 5);
  const lg = (1 - Math.max(0, e.pan)) * e.g;
  const rg = (1 + Math.min(0, e.pan)) * e.g;
  for (let i = 0; i < tail; i++) {
    const tt = i / SR;
    const env = Math.exp(-tt / 1.6) * Math.min(1, tt / 0.008);
    const s = (Math.sin(2 * Math.PI * e.f * tt) + 0.28 * Math.sin(2 * Math.PI * e.f * 2.01 * tt) + 0.1 * Math.sin(2 * Math.PI * e.f * 2.99 * tt)) * env;
    L[start + i] += s * lg;
    R[start + i] += s * rg;
  }
}

/* ---------- write 16-bit stereo WAV ---------- */

let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const norm = peak > 0 ? 0.82 / peak : 1;

const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(L[i] * norm * 32767), i * 4);
  data.writeInt16LE(Math.round(R[i] * norm * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);

const out = process.argv[2] ?? './score.wav';
writeFileSync(out, Buffer.concat([header, data]));
console.log('score written to', out, `(${DUR}s, ${events.length} chimes)`);
