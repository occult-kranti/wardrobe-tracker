// Synthesizes the product film's score — windchimes over a soft pad, rendered
// straight to WAV, no dependencies, seeded (same piece every render).
//
// v2, the glass score: a felt 55Hz pulse under the pad (dropped for the V1
// provenance cameo so the score itself states the handover), struck-GLASS
// chime partials (slightly inharmonic overtones), one swell cresting where
// the film looks without speaking, near-silence and a final chime at the end.
//
// Usage: node scripts/make-score.mjs <out.wav> [durS] [crestS] [dropStartS] [dropEndS]
//   defaults: 100s, crest 82s, pulse-drop 85..91 (the widescreen v3 cut)
//   vertical: node scripts/make-score.mjs vert.wav 52 40 99 99
import { writeFileSync } from 'node:fs';

const SR = 44100;
const DUR = Number(process.argv[3] ?? 100);
const CREST = Number(process.argv[4] ?? 82);
const DROP0 = Number(process.argv[5] ?? 85);
const DROP1 = Number(process.argv[6] ?? 91);
// The calm tempo: longer chord bars, sparser chimes, a gentler crest.
const BAR = Number(process.argv[7] ?? 16);
const SWELL = Number(process.argv[8] ?? 0.95);
const GAPX = Number(process.argv[9] ?? 1);
const N = Math.round(SR * DUR);
const L = new Float64Array(N);
const R = new Float64Array(N);

let seed = 0x5eed;
const rand = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};

/* ---------- master dynamics ---------- */

function master(t) {
  if (t < 3) return 0.5 * (t / 3);
  if (t < CREST - 10) return 0.5;
  if (t < CREST) return 0.5 + (SWELL - 0.5) * ((t - (CREST - 10)) / 10);
  if (t < CREST + 8) return SWELL - (SWELL - 0.53) * ((t - CREST) / 8);
  const tail = DUR - 8;
  if (t < tail) return 0.5 - 0.15 * ((t - (CREST + 8)) / Math.max(1, tail - CREST - 8));
  return Math.max(0, 0.35 * (1 - (t - tail) / 8));
}

/* ---------- the pad: A aeolian, chords crossfading every 16s ---------- */

const CHORDS = [
  [110.0, 164.81, 220.0],
  [87.31, 130.81, 174.61],
  [98.0, 146.83, 196.0],
  [82.41, 123.47, 164.81],
];

for (let i = 0; i < N; i++) {
  const t = i / SR;
  const bar = t / BAR;
  const idx = Math.floor(bar) % CHORDS.length;
  const next = (idx + 1) % CHORDS.length;
  const frac = bar - Math.floor(bar);
  const x = frac > 0.875 ? (frac - 0.875) / 0.125 : 0;
  const lfo = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.05 * t);
  let s = 0;
  for (let v = 0; v < 3; v++) {
    s +=
      (Math.sin(2 * Math.PI * CHORDS[idx][v] * t) * (1 - x) +
        Math.sin(2 * Math.PI * CHORDS[next][v] * t) * x) *
      (v === 0 ? 1 : 0.6);
  }
  const g = 0.026 * lfo * master(t);
  // The felt pulse: 55Hz breathing at 0.5Hz under everything — the glass has
  // a floor. It leaves the room entirely during the provenance cameo.
  const inDrop = t >= DROP0 && t < DROP1;
  const edge = inDrop ? 0 : Math.min(1, Math.abs(t - DROP0) / 1.2, Math.abs(t - DROP1) / 1.2);
  const pulse = Math.sin(2 * Math.PI * 55 * t) * (0.55 + 0.45 * Math.sin(2 * Math.PI * 0.5 * t)) * 0.018 * master(t) * edge;
  L[i] += s * g + pulse;
  R[i] += s * g * 0.96 + pulse;
}

/* ---------- the chimes: struck glass, sparse, panned, seeded ---------- */

const NOTES = [440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

function gapAt(t) {
  const base =
    t < 14 ? 4.0 :
    t < CREST - 12 ? 5.0 :
    t < CREST + 4 ? 2.0 :
    t < DUR - 12 ? 5.5 : 99;
  return base * GAPX;
}

const events = [];
let t = 2.2;
while (t < DUR - 10) {
  events.push({ at: t, f: NOTES[Math.floor(rand() * NOTES.length)], pan: rand() * 2 - 1, g: 0.05 + rand() * 0.028 });
  t += gapAt(t) * (0.7 + rand() * 0.6);
}
events.push({ at: DUR - 8.5, f: 659.25, pan: 0, g: 0.085 });
events.push({ at: DUR - 8.46, f: 880.0, pan: 0.2, g: 0.045 });

for (const e of events) {
  const start = Math.floor(e.at * SR);
  const tail = Math.min(N - start, SR * 5);
  const lg = (1 - Math.max(0, e.pan)) * e.g;
  const rg = (1 + Math.min(0, e.pan)) * e.g;
  for (let i = 0; i < tail; i++) {
    const tt = i / SR;
    const env = Math.exp(-tt / 1.7) * Math.min(1, tt / 0.006);
    // Struck glass: slightly inharmonic overtones (x2.32, x3.76) where the
    // old score rang harmonically — the difference between wood and glass.
    const s =
      (Math.sin(2 * Math.PI * e.f * tt) +
        0.24 * Math.sin(2 * Math.PI * e.f * 2.32 * tt) +
        0.09 * Math.sin(2 * Math.PI * e.f * 3.76 * tt)) *
      env;
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
console.log('score written to', out, `(${DUR}s, crest ${CREST}s, bar ${BAR}s, ${events.length} chimes)`);
