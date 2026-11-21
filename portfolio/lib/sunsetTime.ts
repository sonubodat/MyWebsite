// Time of day for the /test hero: one number t in 0..1 drives the whole mood.
//   0     golden sunset   (the original look: amber horizon, copper water, golden sun path)
//   0.30  sunset          (sun touching the horizon, rose/apricot, indigo zenith)
//   0.55  blue hour       (thin afterglow, navy sky, moon up, first stars)
//   1     deep night      (near-black navy, full stars + Milky Way, cool moon path)
// Everything art-directed lives here: tune the keyframes, the constants below, or pass ?t= / ?tune=1 on /test.

// Night-only: the page sits at deep night and scrolling no longer moves the time of day.
// For the old sunset -> night scroll, set TIME_DEFAULT / SCROLL_T0 back to 0.48 (or pin any moment with ?t=).
export const TIME_DEFAULT = 1;
export const SCROLL_T0 = TIME_DEFAULT; // scroll progress 0 -> 1 runs t from here to SCROLL_T1
export const SCROLL_T1 = 1;

// Foreground silhouettes, shrunk a little and pushed to the outer edges so the middle of the scene is open.
// scale < 1 shrinks the layer toward its outer bottom corner (figure: bottom-left, tree: bottom-right); shift moves it further
// outward in canvas-width units (figure: negative = left, tree: positive = right).
export const FIGURE_LAYOUT = { scale: 0.86, shift: -0.025 };
export const TREE_LAYOUT = { scale: 0.82, shift: 0.02 };

export const MOON_SIZE = 0.03; // disc radius, canvas-height units
export const MOON_REST = { x: 0.8, y: 0.81 }; // where the moon ends up (canvas uv, y up): top right, clear of the headline
export const TEXT_DIM = 0.75; // how much stars / Milky Way are calmed behind the headline + nav (0 = none)
// Milky Way centre line in canvas uv (x right, y up), routed through the open right/centre sky, clear of the headline.
export const MW = { x0: 0.54, y0: 0.44, x1: 0.66, y1: 0.98, bow: 0.18, width: 0.04 };

// Live-tunable multipliers (the ?tune=1 overlay writes these).
export type SunsetParams = { stars: number; milkyWay: number; chop: number; foam: number; moon: number };
export const DEFAULT_PARAMS: SunsetParams = { stars: 1, milkyWay: 1, chop: 1, foam: 1, moon: 1 };

const hex = (s: string): [number, number, number] => {
  const n = parseInt(s.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

type Key = {
  t: number;
  // sky ramp: horizon haze, amber, cream (sun glow), apricot, mauve, taupe, slate, zenith
  pal: string[];
  trough: string; // water: dark trough, shaded face, lit face
  cop0: string;
  cop1: string;
  night: number; // 0 day .. 1 night: clouds, island, foam tint
  stars: number;
  mw: number;
  sunI: number;
  sunY: number; // sun height on the canvas (horizon is 0.42)
  moonI: number;
  warm: number; // backlit amber on grass tips / leaves
  fres: number; // cap on the reflected sky in the water
};

const KEYS: Key[] = [
  {
    t: 0,
    pal: ["#e89c5c", "#f2b36d", "#fff1d6", "#d97a46", "#8c564b", "#4a3b47", "#1c2f47", "#0f1c2e"],
    trough: "#0d131f", cop0: "#3d2c35", cop1: "#8c4a32",
    night: 0, stars: 0, mw: 0, sunI: 1, sunY: 0.455, moonI: 0, warm: 1, fres: 0.55,
  },
  {
    t: 0.3,
    pal: ["#e07a4a", "#e8764a", "#f7b27a", "#c4565a", "#6e3f5c", "#3a2f4e", "#1a2547", "#0c1730"],
    trough: "#0b1120", cop0: "#34273a", cop1: "#7a3f3a",
    night: 0.1, stars: 0, mw: 0, sunI: 0.9, sunY: 0.425, moonI: 0, warm: 0.7, fres: 0.55,
  },
  {
    t: 0.55,
    pal: ["#b8603f", "#c4694a", "#e8946a", "#7a4258", "#3d3358", "#232b55", "#141f40", "#0a1530"],
    trough: "#0a0f1e", cop0: "#1e2238", cop1: "#3d3048",
    night: 0.55, stars: 0.55, mw: 0.28, sunI: 0.25, sunY: 0.36, moonI: 0.9, warm: 0.2, fres: 0.65,
  },
  {
    t: 1,
    pal: ["#101a2e", "#141e36", "#18233d", "#111a32", "#0d1529", "#0a1124", "#070d1d", "#04080f"],
    trough: "#04070f", cop0: "#0a1020", cop1: "#1b2c48",
    night: 1, stars: 1, mw: 1, sunI: 0, sunY: 0.28, moonI: 1, warm: 0, fres: 0.8,
  },
];

const PAL = KEYS.map((k) => ({ ...k, rgb: k.pal.map(hex), tr: hex(k.trough), c0: hex(k.cop0), c1: hex(k.cop1) }));

export type TimeState = {
  pal: number[][]; // 8 x rgb
  trough: number[];
  cop0: number[];
  cop1: number[];
  night: number;
  stars: number;
  mw: number;
  sunI: number;
  sunY: number;
  moonI: number;
  moonX: number;
  moonY: number;
  warm: number;
  fres: number;
};

export const createTimeState = (): TimeState => ({
  pal: Array.from({ length: 8 }, () => [0, 0, 0]),
  trough: [0, 0, 0], cop0: [0, 0, 0], cop1: [0, 0, 0],
  night: 0, stars: 0, mw: 0, sunI: 1, sunY: 0.455, moonI: 0, moonX: 0.5, moonY: 0.4, warm: 1, fres: 0.55,
});

const mix = (a: number, b: number, w: number) => a + (b - a) * w;
const mix3 = (o: number[], a: number[], b: number[], w: number) => {
  o[0] = mix(a[0], b[0], w);
  o[1] = mix(a[1], b[1], w);
  o[2] = mix(a[2], b[2], w);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// Blend the two surrounding keyframes with a smoothstep, so every change eases in and out (no linear "slider" feel).
export function evalTime(tIn: number, o: TimeState): TimeState {
  const t = clamp01(tIn);
  let i = 0;
  while (i < PAL.length - 2 && t > PAL[i + 1].t) i++;
  const a = PAL[i];
  const b = PAL[i + 1];
  const x = clamp01((t - a.t) / (b.t - a.t));
  const w = x * x * (3 - 2 * x);
  for (let k = 0; k < 8; k++) mix3(o.pal[k], a.rgb[k], b.rgb[k], w);
  mix3(o.trough, a.tr, b.tr, w);
  mix3(o.cop0, a.c0, b.c0, w);
  mix3(o.cop1, a.c1, b.c1, w);
  o.night = mix(a.night, b.night, w);
  o.stars = mix(a.stars, b.stars, w);
  o.mw = mix(a.mw, b.mw, w);
  o.sunI = mix(a.sunI, b.sunI, w);
  o.sunY = mix(a.sunY, b.sunY, w);
  o.moonI = mix(a.moonI, b.moonI, w);
  o.warm = mix(a.warm, b.warm, w);
  o.fres = mix(a.fres, b.fres, w);
  // the moon climbs from the water to its resting place in the upper right, easing out as it rises
  const k = clamp01((t - 0.38) / 0.62);
  o.moonX = mix(0.72, MOON_REST.x, k);
  o.moonY = mix(0.4, MOON_REST.y, 1 - (1 - k) * (1 - k));
  return o;
}
