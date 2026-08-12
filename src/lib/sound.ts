/**
 * V2's voice — synthesized, dependency-free, and quiet about it.
 *
 * Three sounds only: a felt tick when a control is pressed, a small windchime
 * when the house confirms something, and a low thock when a sheet lands.
 * Everything is built from oscillators at run time; no audio files, nothing
 * fetched. The context can only start on a user gesture (autoplay law), which
 * every entry point here already is. One switch governs the layer, stored per
 * device beside the theme.
 */

const KEY = 'toile-sound';

let ctx: AudioContext | null = null;
let enabled = (() => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{"on":true}').on !== false;
  } catch {
    return true;
  }
})();

export function soundOn(): boolean {
  return enabled;
}

export function setSound(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, JSON.stringify({ on }));
  } catch {
    /* private mode: the switch just lives for the session */
  }
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** The press: a felt-hammer tick, ~40ms, more thump than snap. */
export function tick() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1700, t);
  osc.frequency.exponentialRampToValueAtTime(620, t + 0.03);
  gain.gain.setValueAtTime(0.026, t);
  gain.gain.exponentialRampToValueAtTime(0.0004, t + 0.045);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.05);
}

/**
 * The chime: root, a scale neighbour a breath later, and a faint octave — a
 * two-note windchime, ~1.2s of decay through a lowpass. The note walks a fixed
 * pentatonic cycle rather than rolling dice, so repeated confirmations play a
 * slow melody instead of a slot machine.
 */
const SCALE = [880, 1046.5, 1174.7, 1318.5, 1568]; // A5 C6 D6 E6 G6
let step = 0;

export function chime() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const root = SCALE[step % SCALE.length];
  const second = SCALE[(step + 2) % SCALE.length];
  const detune = 1 + ((step % 3) - 1) * 0.0008;
  step += 1;
  const partials: Array<[number, number, number]> = [
    [root, 0, 0.045],
    [second, 0.09, 0.03],
    [root * 2, 0.16, 0.012],
  ];
  for (const [f, delay, g] of partials) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const lp = c.createBiquadFilter();
    osc.type = 'triangle';
    osc.frequency.value = f * detune;
    lp.type = 'lowpass';
    lp.frequency.value = 4200;
    gain.gain.setValueAtTime(0.0001, t + delay);
    gain.gain.exponentialRampToValueAtTime(g, t + delay + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0004, t + delay + 1.15);
    osc.connect(gain).connect(lp).connect(c.destination);
    osc.start(t + delay);
    osc.stop(t + delay + 1.2);
  }
}

/** The sheet landing: one low, soft thock. */
export function thock() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(290, t);
  osc.frequency.exponentialRampToValueAtTime(175, t + 0.07);
  gain.gain.setValueAtTime(0.045, t);
  gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.14);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.15);
}
