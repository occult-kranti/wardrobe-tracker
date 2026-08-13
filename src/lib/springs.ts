/**
 * V2's physics: one small spring integrator, no dependencies.
 *
 * Every animated quantity in v2 is a damped spring driven toward a target on
 * requestAnimationFrame. The engine SLEEPS: when every spring is settled the
 * loop stops, so an idle page costs nothing. Under prefers-reduced-motion the
 * engine never animates — set() resolves instantly — which keeps v2 inside the
 * house's one motion law.
 */

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
  /** Below these, the spring is considered settled and goes to sleep. */
  restDelta: number;
  restSpeed: number;
}

/** Presets tuned by hand at 60fps. */
export const SPRINGS = {
  /** Button press: stiff and quick, no wobble. */
  press: { stiffness: 700, damping: 34, mass: 1, restDelta: 0.001, restSpeed: 0.001 },
  /** Card tilt: soft follow, slightly underdamped so glass feels suspended. */
  tilt: { stiffness: 160, damping: 20, mass: 1, restDelta: 0.01, restSpeed: 0.01 },
  /** Modal pop: one visible overshoot, then rest. */
  pop: { stiffness: 380, damping: 26, mass: 1, restDelta: 0.001, restSpeed: 0.001 },
  /** Parallax drift: heavy and slow, like depth. */
  drift: { stiffness: 60, damping: 18, mass: 1.4, restDelta: 0.05, restSpeed: 0.05 },
} satisfies Record<string, SpringConfig>;

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Spring {
  value: number;
  velocity: number;
  target: number;
  config: SpringConfig;
  onUpdate: (value: number) => void;
  sleeping: boolean;
}

const springs = new Set<Spring>();
let raf = 0;
let last = 0;

function tick(now: number) {
  // Cleared FIRST, not at the end.
  //
  // An onUpdate can push a target at another spring during this frame. While
  // `raf` still held the running frame's id, wake() saw the loop as already
  // running and scheduled nothing — so if every other spring happened to
  // settle this frame, the loop stopped with a spring awake and never touched
  // it again. The end-of-frame schedule below is now conditional on `raf`
  // still being 0, so a wake() during the frame wins.
  raf = 0;
  // Clamp the step: a background tab can hand us seconds of "elapsed" time,
  // and a spring integrated over that explodes.
  const dt = Math.min((now - last) / 1000, 1 / 30);
  last = now;
  let awake = 0;
  for (const s of springs) {
    if (s.sleeping) continue;
    const displacement = s.value - s.target;
    const springForce = -s.config.stiffness * displacement;
    const dampingForce = -s.config.damping * s.velocity;
    const acceleration = (springForce + dampingForce) / s.config.mass;
    s.velocity += acceleration * dt;
    s.value += s.velocity * dt;
    if (
      Math.abs(s.value - s.target) < s.config.restDelta &&
      Math.abs(s.velocity) < s.config.restSpeed
    ) {
      s.value = s.target;
      s.velocity = 0;
      s.sleeping = true;
    } else {
      awake += 1;
    }
    s.onUpdate(s.value);
  }
  if (awake > 0 && raf === 0) raf = requestAnimationFrame(tick);
}

function wake() {
  if (raf === 0) {
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
}

/**
 * A spring you push targets at. Returns [setTarget, dispose].
 * Under reduced motion, setTarget applies instantly — same API, no animation.
 */
export function createSpring(
  initial: number,
  config: SpringConfig,
  onUpdate: (value: number) => void
): [(target: number) => void, () => void] {
  const s: Spring = { value: initial, velocity: 0, target: initial, config, onUpdate, sleeping: true };
  springs.add(s);
  const set = (target: number) => {
    if (reduced()) {
      s.value = target;
      s.target = target;
      s.velocity = 0;
      s.sleeping = true;
      onUpdate(target);
      return;
    }
    s.target = target;
    if (s.sleeping) {
      s.sleeping = false;
      wake();
    }
  };
  const dispose = () => {
    springs.delete(s);
  };
  return [set, dispose];
}
