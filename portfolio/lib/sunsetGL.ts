// Sunset hero: a 2.5D scene in four depth planes, back to front. A single time of day t (0 sunset .. 1 night, see
// lib/sunsetTime.ts) drives the palette, sun, moon, stars, Milky Way and water; scroll moves t, ?t= pins it.
//   1. sky      procedural dusk-to-night gradient, low sun, clouds, stars, Milky Way, moon, haze, far hills (minimal parallax)
//   2. ocean    perspective 160x160 mesh: layered directional swells + FBM chop, finite-difference normals, fine ripples
//               that fade with distance, sun / moon glitter paths, mirrored Milky Way, haze matched to the sky horizon
//   3. ridge    ridge-subject.png: grassy ridge with the person and cat (mid parallax)
//   4. tree     tree-front.png: windswept tree + front cliff edge (strongest parallax, leaf sway)
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  LinearFilter,
  MathUtils,
  Mesh,
  NoColorSpace,
  OrthographicCamera,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Points,
  Raycaster,
  Scene,
  ShaderMaterial,
  TextureLoader,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
  type Texture,
} from "three";
import { createTimeState, DEFAULT_PARAMS, evalTime, FIGURE_LAYOUT, MOON_SIZE, MW, SCROLL_T0, SCROLL_T1, TEXT_DIM, TIME_DEFAULT, TREE_LAYOUT, type SunsetParams } from "./sunsetTime";

const ASPECT = 16 / 9; // the layers are authored on a 1920x1080 canvas
const HORIZON = 0.42; // horizon height (y up) on the canvas
const SUN_UV = new Vector2(0.62, 0.455); // low sun, clear of the tree
const SUBJECT_X = 0.28;
const TREE_X = 0.855;
const FOV = 38;
const CAM_Y = 3.5;
const DAMP = 0.04; // heavily damped pointer lerp

const f = (n: number) => n.toFixed(4);

// Shared twilight palette (sky + ocean reflection sample the same ramp).
// s = 0 at the horizon .. 1 at the zenith; g = 1 under the sun, 0 far from it.
const HORIZON_COL = /* glsl */ `
// The ramp's eight colours come from lib/sunsetTime.ts (keyframed by time of day); at t = 0 they are the original golden-hour hexes:
// [0] #e89c5c haze  [1] #f2b36d amber  [2] #fff1d6 cream  [3] #d97a46 apricot  [4] #8c564b mauve  [5] #4a3b47 taupe  [6] #1c2f47 slate  [7] #0f1c2e zenith
uniform vec3 uPal[8];
vec3 skyPal(float s, float g){
  vec3 c = mix(uPal[0], mix(uPal[1], uPal[2], g), g * 0.9 + 0.1);
  c = mix(c, uPal[3], smoothstep(0.02, 0.09, s) * (0.55 + 0.45 * (1.0 - g)));
  c = mix(c, uPal[4], smoothstep(0.08, 0.20, s));
  c = mix(c, uPal[5], smoothstep(0.18, 0.32, s));
  c = mix(c, uPal[6], smoothstep(0.30, 0.55, s));
  c = mix(c, uPal[7], smoothstep(0.55, 1.0, s));
  return c;
}
vec3 horizonCol(float g){ return skyPal(0.0, g); }
// the sky's colour exactly at the horizon (palette + the haze band the sky shader adds there): the ocean fog uses it too, so no seam
vec3 horizonSky(float g){ return mix(skyPal(0.0, g), uPal[0] * (0.9 + 0.3 * g), 0.55); }
// filmic ACES (Narkowicz) + sub-LSB triangular dither / film grain: no banding in the sky gradient
vec3 grade(vec3 c, float t){
  c *= 0.92;
  c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
  vec2 fc = gl_FragCoord.xy;
  float n1 = fract(sin(dot(fc + fract(t) * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
  float n2 = fract(sin(dot(fc + fract(t * 1.37) * 37.0, vec2(39.346, 11.135))) * 24634.6345);
  return c + (n1 + n2 - 1.0) * (1.6 / 255.0);
}
`;

// Hover reveal, same falloff as the original hero: solid to 36% of the radius, 55% at 62%, gone at 100%.
const APERTURE = /* glsl */ `
uniform vec3 uAp;          // pointer in screen uv (xy) + radius in screen-height units (z)
uniform float uReveal, uScrAspect;
float apertureD(vec2 suv){ return length((suv - uAp.xy) * vec2(uScrAspect, 1.0)) / max(uAp.z, 0.0001); }
float apertureM(float d){ return d < 0.36 ? 1.0 : (d < 0.62 ? mix(1.0, 0.55, (d - 0.36) / 0.26) : mix(0.55, 0.0, clamp((d - 0.62) / 0.38, 0.0, 1.0))); }
// true colour through the aperture, with a warm amber -> rose gradient lighting it
vec3 revealColor(vec3 base, vec4 col, float d, float m){
  vec3 tint = mix(vec3(1.0, 0.66, 0.32), vec3(0.96, 0.42, 0.55), clamp(d, 0.0, 1.0));
  vec3 lit = col.rgb + tint * 0.14 * m;
  return mix(base, lit, m * uReveal * col.a);
}
`;

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// ---------------------------------------------------------------- plane 1: sky
// Shared by the sky quad and the ocean's reflection: canvas constants, noise, and the Milky Way band (screen-space, cheap).
const mwDx = (MW.x1 - MW.x0) * ASPECT;
const mwDy = MW.y1 - MW.y0;
const mwLen = Math.hypot(mwDx, mwDy);
const SKY_COMMON = /* glsl */ `
const float HZ = ${f(HORIZON)};
const float AR = ${f(ASPECT)};
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vn(p); p *= 2.03; a *= 0.5; } return v; }
// Milky Way: a thin, gently bowed band (p = canvas uv with x * AR). It is built from fine detail, never soft puffs:
//   mwShape  = band density along the centre line (slight meander), a razor-thin dust rift, and a core weight
//   milkyWay = the faint unresolved glow: silver-indigo, warmer toward the core, very low contrast
// The sky shader adds a dense layer of 1px micro-stars on top of mwShape, which is what actually draws the band.
const vec2 MW_A = vec2(${f(MW.x0 * ASPECT)}, ${f(MW.y0)});
const vec2 MW_DIR = vec2(${f(mwDx / mwLen)}, ${f(mwDy / mwLen)});
const vec2 MW_N = vec2(${f(mwDy / mwLen)}, ${f(-mwDx / mwLen)});
vec3 mwShape(vec2 p){
  vec2 r = p - MW_A;
  float u = dot(r, MW_DIR) / ${f(mwLen)};                    // 0 at the horizon end .. 1 at the top end
  float v = dot(r, MW_N) + ${f(MW.bow)} * (u - 0.5) * (u - 0.5);   // gentle arc
  v += (vn(p * 7.0 + 3.0) - 0.5) * ${f(MW.width * 0.35)};     // a slight meander so it is not a ruler-straight stripe
  float cu = (u - 0.45) / 0.32;
  float core = exp(-cu * cu);
  float w = ${f(MW.width)} * (0.6 + 0.7 * core);
  float band = exp(-(v * v) / (w * w) * 1.6);
  float lv = (v + (vn(p * 11.0 + 7.0) - 0.5) * w * 0.3) / (w * 0.12);
  float rift = exp(-lv * lv) * smoothstep(0.0, 0.3, u) * (0.5 + 0.5 * vn(p * 17.0 + 5.0));
  return vec3(band, rift, core);
}
vec4 milkyWay(vec2 p){
  vec3 m = mwShape(p);
  float dens = m.x * (0.75 + 0.5 * vn(p * 22.0 + 11.0)) * (1.0 - 0.6 * m.y);   // fine granular modulation, not blobs
  vec3 col = mix(vec3(0.50, 0.56, 0.86), vec3(1.0, 0.88, 0.72), m.z * 0.55);
  return vec4(col, dens);
}
`;

const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uS, uFocus, uPtr, uSun, uMoon;
uniform float uTime, uFade, uMotion, uAng;
uniform float uNight, uStars, uStarDens, uMW, uSunI, uMoonI, uMoonR, uPxUv, uTextDim;
${HORIZON_COL}
${SKY_COMMON}
vec4 hash42(vec2 p){
  vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099));
  p4 += dot(p4, p4.wzxy + 33.33);
  return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}
// One layer of stars: a jittered cell grid (no regular pattern, so no moire). Each star gets its own size, colour
// temperature (cool blue-white .. warm white .. soft gold) and twinkle phase. The radius is never smaller than ~0.8 px and
// brightness is compensated for it, so faint stars stay crisp and simply dim instead of aliasing.
vec3 starLayer(vec2 p, float cell, float dens, float r0, float gain, float seed, float boost){
  vec2 id = floor(p / cell);
  vec4 h = hash42(id + seed);
  float dn = min(dens * uStarDens * (1.0 + boost), 1.0);
  if (h.x > dn) return vec3(0.0);
  float u = h.x / dn;
  vec2 sp = (id + 0.22 + 0.56 * h.yz) * cell;
  float rr = r0 * (0.7 + 0.6 * h.w);
  float r = max(rr, 0.85 * uPxUv);
  float d = length(p - sp);
  float amp = min(1.0, (rr * rr) / (r * r));
  float tw = 1.0 + 0.16 * uMotion * sin(uTime * (1.4 + 3.2 * h.z) + h.y * 40.0);
  vec3 tc = mix(mix(vec3(0.66, 0.78, 1.0), vec3(1.0, 0.99, 0.97), smoothstep(0.0, 0.35, u)), vec3(1.0, 0.84, 0.56), smoothstep(0.78, 1.0, u));   // pale blue .. pure white .. warm gold
  return tc * exp(-2.0 * d * d / (r * r)) * (0.25 + 0.75 * h.w * h.w) * amp * tw * gain;
}

void main(){
  vec2 uv0 = uFocus + (vUv - 0.5) * uS;
  vec2 q = uv0 - uPtr * vec2(0.003, 0.0);               // sky + far hills barely move
  float s = clamp((q.y - HZ) / (1.0 - HZ), 0.0, 1.0);   // 0 at the horizon, 1 at the top
  float g = exp(-pow((q.x - uSun.x) * uAng / 0.55, 2.0)); // glow weight by angle from the sun
  vec2 sd = (q - uSun) * vec2(AR, 1.0);
  float d = length(sd);
  float tm = uTime * uMotion;

  // Rayleigh/Mie twilight ramp: slate zenith -> dusty mauve -> apricot/amber/cream horizon (keyframed by time of day)
  vec3 c = skyPal(pow(s, 0.85), g);

  // layered clouds, foreshortened toward the horizon (perspective: depth ~ 1 / height above horizon)
  float depth = 1.0 / (s * 1.6 + 0.10);
  vec2 cp = vec2((q.x - 0.5) * depth * 1.5 + tm * 0.010, depth * 0.55 - tm * 0.004);
  vec2 warp = vec2(fbm(cp * 0.7 + 3.1), fbm(cp * 0.7 + 8.7)) - 0.5;
  vec2 cw = cp + warp * 1.1;
  float dens = fbm(cw * vec2(0.8, 1.9));
  float band = smoothstep(0.015, 0.09, s) * (1.0 - smoothstep(0.38, 0.62, s));
  float cov = smoothstep(0.46, 0.74, dens) * band;
  // shadow-side probe toward the sun: thick cloud shades itself, thin edges and undersides catch light
  float dens2 = fbm((cw + vec2(0.0, -0.18)) * vec2(0.8, 1.9));
  float lit = clamp(0.55 + (dens - dens2) * 3.2 - (dens - 0.5) * 0.9, 0.0, 1.0);
  float sunNear = exp(-d * 2.6) * uSunI;                          // radial falloff from the sun (gone once it has set)
  vec3 shade = mix(vec3(0.20, 0.17, 0.28), vec3(0.35, 0.25, 0.32), sunNear);   // slate-violet, higher/farther clouds
  vec3 warm = mix(vec3(0.95, 0.52, 0.34), vec3(1.0, 0.80, 0.52), sunNear);     // peach -> gold near the sun
  vec3 cc = mix(shade, warm, clamp(lit * (0.35 + 0.9 * sunNear) + sunNear * 0.35, 0.0, 1.0));
  cc = mix(cc, skyPal(s * 0.6, g) * 1.05, smoothstep(0.0, 0.10, 0.10 - s) * 0.6);      // the lowest clouds melt into the horizon haze
  cc = mix(cc, c * 0.55 + vec3(0.004, 0.008, 0.02), uNight);                              // at night they turn into faint dark wisps
  cov *= 1.0 - 0.95 * uNight;                                                                // no cloud or fog over the night sky
  c = mix(c, cc, cov * 0.85);
  // high thin cirrus streaks
  float ci = smoothstep(0.55, 0.85, fbm(vec2(q.x * 1.6 + tm * 0.004, q.y * 9.0) + warp));
  c = mix(c, mix(vec3(0.30, 0.24, 0.34), vec3(0.95, 0.60, 0.42), sunNear), ci * smoothstep(0.10, 0.3, s) * (1.0 - smoothstep(0.45, 0.8, s)) * 0.22 * (1.0 - uNight));

  // moon geometry (also used to keep stars and the Milky Way calm around it)
  vec2 md = (q - uMoon) * vec2(AR, 1.0);
  float mdist = length(md);

  // stars + Milky Way: emerge from the top of the sky first, never sit on the horizon haze, and stay calm behind the headline + nav
  if (uStars + uMW > 0.003) {
    vec2 p = vec2(q.x * AR, q.y);
    float lum = dot(c, vec3(0.30, 0.59, 0.11));
    vec2 a1 = (vUv - vec2(0.22, 0.76)) / vec2(0.30, 0.20);
    vec2 a2 = (vUv - vec2(0.30, 0.955)) / vec2(0.36, 0.05);
    float calm = 1.0 - uTextDim * clamp(exp(-dot(a1, a1)) + exp(-dot(a2, a2)), 0.0, 1.0);
    float moonCalm = mix(1.0, smoothstep(uMoonR * 1.2, uMoonR * 9.0, mdist), uMoonI * 0.85);
    float lowS = mix(0.55, 0.04, uNight);
    float vis = smoothstep(lowS, lowS + 0.28, s) * (1.0 - smoothstep(0.06, 0.28, lum)) * (1.0 - cov * 0.9) * calm * moonCalm;
    vec3 ms = mwShape(p);
    float bandS = ms.x * (1.0 - 0.6 * ms.y);
    vec4 mw = milkyWay(p);
    // three layers of pinpoint stars, plus a dense layer of 1px micro-stars whose density follows the band (the dust rift thins them)
    vec3 st = starLayer(p, 0.012, 0.20, 0.0007, 0.45, 17.0, 0.0)
            + starLayer(p, 0.030, 0.22, 0.0010, 0.85, 53.0, 0.0)
            + starLayer(p, 0.085, 0.32, 0.0016, 1.40, 91.0, 0.0);
    vec3 micro = starLayer(p, 0.0042, 0.012, 0.0005, 0.6, 7.0, bandS * 80.0);
    float mwVis = smoothstep(0.0, 0.2, s) * (1.0 - cov * 0.8) * calm * mix(1.0, 0.6, uMoonI * exp(-mdist * mdist / 0.06));
    c += st * uStars * vis * 1.1;
    c += micro * uMW * mwVis * 1.4;
    c += mw.rgb * mw.a * 0.10 * uMW * mwVis;
  }

  // moon: soft disc with faint maria and a gibbous phase, wide cool halo
  if (uMoonI > 0.003) {
    vec2 ud = md / uMoonR;
    float r2 = dot(ud, ud);
    c += vec3(0.50, 0.64, 1.0) * (0.45 * exp(-r2 / 5.0) + 0.05 * exp(-sqrt(r2) / 5.0)) * uMoonI * 0.22 * (1.0 - cov * 0.6);
    if (r2 < 1.4) {
      float disc = 1.0 - smoothstep(uMoonR - uPxUv, uMoonR + uPxUv, mdist);
      float zz = sqrt(max(1.0 - r2, 0.0));
      float lt = smoothstep(-0.08, 0.18, dot(vec3(ud, zz), normalize(vec3(0.55, 0.25, 0.8))));
      float mar = smoothstep(0.38, 0.68, fbm(ud * 1.7 + 5.0));
      vec3 mc = vec3(0.98, 0.96, 0.88) * (0.90 + 0.10 * mar) * (0.88 + 0.12 * zz) * (0.06 + 0.94 * lt);
      c = mix(c, mc * 1.3, disc * uMoonI * (1.0 - cov * 0.7));
    }
  }

  // sun: wide Mie bloom, mid halo, soft hot core (no hard disc) and a hazy horizon band; fades as it sets
  float cs = cos(min(d * 1.35, 1.5));
  c += uSunI * (vec3(1.0, 0.62, 0.30) * pow(max(cs, 0.0), 8.0) * 0.30
    + vec3(1.0, 0.70, 0.38) * pow(max(cs, 0.0), 90.0) * 0.35
    + vec3(1.0, 0.973, 0.906) * (exp(-d * d * 2600.0) * 1.1 + exp(-d * 38.0) * 0.18));   // one additive, monotonic falloff: no dark ring
  float hz = q.y - HZ;
  c = mix(c, uPal[0] * (0.9 + 0.3 * g), exp(-max(hz, 0.0) / 0.035) * 0.55 * step(0.0, hz));   // horizon haze / afterglow

  // far hills / islands on the horizon, lightened by atmosphere, silhouetted against the afterglow
  float x = q.x;
  float farB = 0.026 * exp(-pow((x - 0.10) / 0.17, 2.0)) + 0.011 * exp(-pow((x - 0.34) / 0.10, 2.0)) + 0.009 * exp(-pow((x - 0.60) / 0.045, 2.0));
  float nearB = 0.014 * exp(-pow((x - 0.05) / 0.12, 2.0)) + 0.006 * exp(-pow((x - 0.62) / 0.03, 2.0));
  float far = HZ + farB * (0.85 + 0.3 * vn(vec2(x * 60.0, 2.0)));
  float near = HZ + nearB * (0.85 + 0.3 * vn(vec2(x * 90.0, 5.0)));
  float inFar = step(HZ, q.y) * step(q.y, far) * step(0.0008, farB);
  float inNear = step(HZ, q.y) * step(q.y, near) * step(0.0008, nearB);
  vec3 hazeC = uPal[0] * (0.8 + 0.25 * g);
  c = mix(c, mix(mix(vec3(0.34, 0.24, 0.30), vec3(0.05, 0.07, 0.12), uNight), hazeC, 0.45), inFar);
  c = mix(c, mix(mix(vec3(0.16, 0.11, 0.17), vec3(0.02, 0.03, 0.06), uNight), hazeC, 0.18), inNear);

  // below the horizon the ocean mesh takes over; keep the same backdrop colour as its far fog so there is no seam
  c = mix(c, horizonSky(g) * mix(0.84, 1.0, uNight), 1.0 - step(HZ - 0.001, q.y));
  gl_FragColor = vec4(grade(c, uTime) * uFade, 1.0);
}`;

// ---------------------------------------------------------------- plane 2: ocean
const WAVES = /* glsl */ `
uniform float uTime, uMotion, uChop;
uniform vec4 uRip[8];          // pointer ripples: x,z world, birth time, strength
float hsh(vec2 p){ p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float vnz(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hsh(i), hsh(i + vec2(1.0, 0.0)), f.x), mix(hsh(i + vec2(0.0, 1.0)), hsh(i + vec2(1.0, 1.0)), f.x), f.y);
}
// one directional swell with a sharpened crest (trochoid-like): broad troughs, pointed crests
float swell(vec2 p, float t, float ang, float L, float A){
  vec2 d = vec2(sin(ang), cos(ang));                   // +z points toward the shore / viewer
  float k = 6.2831853 / L;
  float f = k * dot(d, p) - sqrt(9.8 * k) * 0.30 * t;   // slow, calm swell
  float s = 0.5 + 0.5 * sin(f);
  return A * (2.0 * pow(s, 1.7) - 1.0);
}
float waveH(vec2 p, float t, float dist){
  vec2 w = vec2(vnz(p * 0.11 + t * 0.020), vnz(p * 0.11 + 9.0 - t * 0.017)) - 0.5;
  vec2 q = p + w * 5.0;                                 // domain warp: the lines never march in perfect rows
  float h = 0.0;
  h += swell(q, t, 0.06, 26.0, 0.28);                   // long, low swells carry the shape...
  h += swell(q, t, 0.44, 15.0, 0.17);
  h += swell(q, t, -0.56, 9.5, 0.11);
  h += uChop * (swell(q, t, 0.84, 6.0, 0.06)            // ...and the short wind chop (uChop) adds texture without busyness
              + swell(q, t, -0.97, 3.6, 0.038)
              + swell(q, t, 0.20, 2.2, 0.022)
              + swell(q, t, -0.30, 1.4, 0.010));
  float a = 0.5, n = 0.0;
  vec2 c = q * 0.55 + vec2(0.0, -t * 0.12);
  for (int i = 0; i < 3; i++) { n += a * vnz(c); c = c * 2.07 + 3.1; a *= 0.5; }
  h += (n - 0.45) * 0.14 * (0.6 + 0.4 * uChop);
  for (int i = 0; i < 8; i++) {                         // pointer ripples
    vec4 r = uRip[i];
    float age = t - r.z;
    if (r.w > 0.0 && age > 0.0 && age < 4.0) {
      float rr = length(p - r.xy);
      float front = age * 2.2;
      h += exp(-age * 0.8) * exp(-pow((rr - front) / 1.2, 2.0)) * r.w * 0.2 * sin((rr - front) * 3.2);
    }
  }
  return h / (1.0 + dist * dist * 0.00005);
}
`;

const OCEAN_VERT = /* glsl */ `
precision highp float;
${WAVES}
varying vec2 vBase;
varying float vDist;
varying float vH;
void main(){
  vec2 p = position.xz;
  vDist = length(p - cameraPosition.xz);
  float h = waveH(p, uTime * uMotion + 6.0 * (1.0 - uMotion), vDist);
  vH = h;
  vBase = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p.x, h, p.y, 1.0);
}`;

const OCEAN_FRAG = /* glsl */ `
precision highp float;
${WAVES}
${HORIZON_COL}
${SKY_COMMON}
varying vec2 vBase;
varying float vDist;
varying float vH;
uniform vec3 uSunDir, uMoonDir, uTrough, uCop0, uCop1;   // water colours are keyframed by time of day (lib/sunsetTime.ts)
uniform float uFade, uSunI, uMoonI, uNight, uFoam, uFres, uMW;
uniform vec2 uRes, uFocus, uS;
void main(){
  float t = uTime * uMotion + 6.0 * (1.0 - uMotion);
  float dist = vDist;
  // surface normal by forward differences of the height field (3 evaluations)
  float e = 0.05 + dist * 0.0032;
  float hC = waveH(vBase, t, dist);
  float hX = waveH(vBase + vec2(e, 0.0), t, dist);
  float hZ = waveH(vBase + vec2(0.0, e), t, dist);
  vec3 n = normalize(vec3(hC - hX, e, hC - hZ));
  // fine wind ripples: tiny moving normals, faded out with distance so far water never shimmers
  float cf = 1.0 - smoothstep(8.0, 85.0, dist);
  vec2 cp = vBase * vec2(2.6, 3.1);
  float ct = uTime * uMotion;
  n.x += (vnz(cp + vec2(ct * 0.35, -ct * 0.6)) - 0.5) * 0.16 * cf + (vnz(cp * 2.3 + vec2(-ct * 0.5, ct * 0.9)) - 0.5) * 0.08 * cf;
  n.z += (vnz(cp.yx + vec2(-ct * 0.45, ct * 0.5) + 7.0) - 0.5) * 0.16 * cf + (vnz(cp.yx * 2.3 + vec2(ct * 0.6, -ct * 0.7) + 3.0) - 0.5) * 0.08 * cf;
  n = normalize(n);
  n = normalize(mix(n, vec3(0.0, 1.0, 0.0), smoothstep(90.0, 700.0, dist) * 0.8));   // distant water relaxes toward a smooth mirror

  vec3 worldPos = vec3(vBase.x, hC, vBase.y);
  vec3 toCam = cameraPosition - worldPos;
  vec3 v = normalize(toCam);
  vec3 r = reflect(-v, n);
  r.y = abs(r.y);

  // glow weight by azimuth from the sun (matches the sky plane's horizon glow)
  vec2 dirH = normalize(-toCam.xz);
  vec2 sunH = normalize(uSunDir.xz);
  float ang = acos(clamp(dot(dirH, sunH), -1.0, 1.0));
  float g = exp(-pow(ang / 0.55, 2.0));

  // reflected sky: the shared palette (warm at the horizon, indigo overhead) plus a soft mirror image of the Milky Way
  float warm = clamp(dot(normalize(r.xz + 1e-4), sunH) * 0.5 + 0.5, 0.0, 1.0) * (1.0 - clamp(r.y * 2.4, 0.0, 1.0));
  vec3 skyRefl = skyPal(clamp(r.y * 3.2, 0.0, 1.0), g) * 0.82;
  if (uMW > 0.003) {
    vec2 suv = uFocus + (gl_FragCoord.xy / uRes - 0.5) * uS;
    vec2 pm = vec2((suv.x + n.x * 0.25) * AR, 2.0 * HZ - suv.y);
    float sm = clamp((pm.y - HZ) / (1.0 - HZ), 0.0, 1.0);
    vec4 mw = milkyWay(pm);
    skyRefl += mw.rgb * mw.a * 0.07 * uMW * smoothstep(0.0, 0.2, sm);
  }

  // wave faces that lean toward the light catch copper; troughs stay deep and calm
  float lean = clamp(1.0 - n.y, 0.0, 1.0);
  float catchSun = clamp(lean * 4.5 + hC * 1.4 - 0.05, 0.0, 1.0);
  vec3 copper = mix(uCop0, uCop1, clamp(warm * 1.3 + g * 0.3, 0.0, 1.0));
  vec3 body = mix(uTrough, copper, catchSun * catchSun);

  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  // artistic cap: the water keeps its own colour instead of mirroring the whole horizon (the cap eases up at night so the sky reads)
  float refW = mix(0.45 + 0.55 * g, 1.0, uNight);
  vec3 col = mix(body, skyRefl, clamp(fres * 0.42 * refW, 0.0, uFres));

  // the sun's glitter path: golden shimmer under the sun, narrowing and fading as it sets
  float s = max(dot(r, uSunDir), 0.0);
  float shimmer = 0.55 + 0.45 * sin(t * 2.1 + vBase.x * 7.0 + vBase.y * 5.0);
  col += vec3(1.0, 0.745, 0.42) * uSunI * (pow(s, 60.0) * 0.38 + pow(s, 900.0) * 1.6 * shimmer + pow(s, 2500.0) * 1.4 * shimmer * shimmer);
  // and the moon's: a cooler, softer silver path
  float sm2 = max(dot(r, uMoonDir), 0.0);
  float shimM = 0.6 + 0.4 * sin(t * 1.7 + vBase.x * 5.0 + vBase.y * 3.5);
  col += vec3(0.60, 0.72, 1.0) * uMoonI * (pow(sm2, 40.0) * 0.10 + pow(sm2, 400.0) * 0.55 * shimM + pow(sm2, 1500.0) * 0.55 * shimM * shimM);

  // soft whitecaps on the pinched crests near the viewer: warm at dusk, cool at night
  float foam = smoothstep(0.55, 0.9, hC * 3.2 + (vnz(vBase * 3.7 + ct * 0.3) - 0.5) * 0.9) * (1.0 - smoothstep(30.0, 140.0, dist));
  vec3 foamCol = mix(vec3(0.62, 0.50, 0.46) * (0.35 + 0.65 * g), vec3(0.28, 0.34, 0.48), uNight);
  col = mix(col, foamCol, foam * 0.2 * uFoam);

  // horizon: haze toward the sky's horizon colour, far edge dissolves into the sky plane (same colour: no seam)
  col = mix(col, horizonSky(g) * mix(0.84, 1.0, uNight), smoothstep(mix(240.0, 150.0, uNight), 1000.0, dist));
  float alpha = 1.0 - smoothstep(620.0, 1250.0, dist);
  gl_FragColor = vec4(grade(col, uTime * uMotion) * uFade, alpha);
}`;

// ---------------------------------------------------------------- planes 3 + 4: silhouette layers
// Grass: the supplied dune-grass photo, baked to two textures. tGrass: R = sway weight (0 root .. 1 tip), A = coverage.
// tGrassCol: the real sunlit colours, shown through the hover aperture. Tips move in the breeze, roots stay planted.
const GRASS = /* glsl */ `
uniform sampler2D tGrass, tGrassCol;
uniform float uWarm;       // backlit amber on the blade tips: 1 at sunset, 0 at night
const vec3 GRASS_COL = vec3(0.040, 0.046, 0.066);
float gust(float t){ return 0.65 + 0.35 * sin(t * 0.37) + 0.2 * sin(t * 0.91 + 1.3); }
vec3 grassLayer(vec3 base, vec2 q, float t, float d, float m, vec3 gcol, out float cov){
  float w0 = texture2D(tGrass, q).r;
  float sw = (sin(t * 1.3 + q.x * 38.0) + 0.6 * sin(t * 2.4 + q.x * 90.0)) * 0.0030 * gust(t) * w0;
  vec2 qs = q - vec2(sw, 0.0);
  vec4 g = texture2D(tGrass, qs);
  vec4 gc = texture2D(tGrassCol, qs);
  cov = g.a;
  vec3 sil = gcol + vec3(0.95, 0.52, 0.22) * pow(w0, 1.7) * 0.12 * uWarm;     // a faint backlit amber on the blade tips
  return mix(base, revealColor(sil, vec4(gc.rgb, g.a), d, m), g.a);
}
`;

const RIDGE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tTex, tCol;
uniform vec2 uPtr, uS, uFocus, uFigure;
uniform float uTime, uScroll, uFade, uMotion;
${APERTURE}
${GRASS}
void main(){
  vec2 uv0 = uFocus + (vUv - 0.5) * uS;
  uv0 = vec2((uv0.x - uFigure.y) / uFigure.x, uv0.y / uFigure.x);   // shrink toward the bottom-left, nudge left (x = scale, y = shift)
  vec2 fc = vec2(${f(SUBJECT_X)}, 0.0);
  vec2 q = fc + (uv0 - fc) * (1.0 - 0.35 * uScroll) - uPtr * vec2(0.010, 0.004);
  float body = smoothstep(0.10, 0.28, q.y) * exp(-pow((q.x - ${f(SUBJECT_X)}) / 0.12, 2.0));
  q.y += sin(uTime * 0.9) * 0.0005 * body * uMotion;      // the figure breathes
  vec4 c = texture2D(tTex, q);
  float d = apertureD(vUv);
  float m = apertureM(d);
  vec3 rgb = revealColor(c.rgb, texture2D(tCol, q), d, m);
  float gcov;
  rgb = grassLayer(rgb, q, uTime * uMotion, d, m, texture2D(tTex, q - vec2(0.0, 0.045)).rgb, gcov);      // dune grass, swaying, in front of the person's base
  gl_FragColor = vec4(rgb * uFade, gcov + c.a * (1.0 - gcov));
}`;

const TREE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tTex, tCol;
uniform vec2 uPtr, uS, uFocus, uTreeL;
uniform float uTime, uScroll, uFade, uMotion;
${APERTURE}
${GRASS}
void main(){
  vec2 uv0 = uFocus + (vUv - 0.5) * uS;
  uv0 = vec2(1.0 + (uv0.x - 1.0 - uTreeL.y) / uTreeL.x, uv0.y / uTreeL.x);   // shrink toward the bottom-right, nudge right (x = scale, y = shift)
  vec2 fc = vec2(${f(TREE_X)}, 0.0);
  vec2 q = fc + (uv0 - fc) * (1.0 - 0.5 * uScroll) - uPtr * vec2(0.020, 0.008);   // nearest plane: strongest parallax
  // the mangrove's canopy sweeps left; each gust pushes it a little further and flutters it. Roots and cliff stay put.
  float t = uTime * uMotion;
  float hh = clamp((q.y - 0.15) / 0.36, 0.0, 1.0);                       // 0 at the roots .. 1 at the crown top
  float hw = pow(hh, 1.5) * smoothstep(0.60, 0.68, q.x);
  float gs = gust(t);
  q.x += (0.0034 * (0.5 + 0.5 * sin(t * 0.37)) + 0.0020 * sin(t * 0.9 + q.y * 5.0 + q.x * 3.0) * gs + 0.0008 * sin(t * 2.3 + q.y * 13.0 + q.x * 9.0)) * hw;
  q.y += sin(t * 1.3 + q.x * 9.0) * 0.0005 * hw;
  vec4 c = texture2D(tTex, q);
  float d = apertureD(vUv);
  float m = apertureM(d);
  vec3 rgb = revealColor(c.rgb, texture2D(tCol, q), d, m);
  float gcov;
  rgb = grassLayer(rgb, q, t, d, m, texture2D(tTex, q - vec2(0.0, 0.045)).rgb, gcov);                    // dune grass on the cliff crest and around the tree's base
  gl_FragColor = vec4(rgb * uFade, gcov + c.a * (1.0 - gcov));
}`;

// ---------------------------------------------------------------- ambient life: falling leaves + jugnu (fireflies)
// Both are single THREE.Points draws with the motion computed in the vertex shader: no per-frame CPU work.
const FX_COMMON = /* glsl */ `
uniform vec2 uS, uFocus, uPtr, uTreeL;
uniform float uTime, uMotion, uFade, uScroll, uPx;
float hash11(float n){ return fract(sin(n * 127.1) * 43758.5453); }
vec2 toNdc(vec2 uv0){ return 2.0 * (uv0 - uFocus) / uS; }
`;

const LEAF_VERT = /* glsl */ `
attribute float aSeed, aLife, aSize;
attribute vec2 aSpawn;
${FX_COMMON}
varying float vAlpha, vRot, vFlip;
void main(){
  float ph = fract(uTime * uMotion / aLife + aSeed * 7.0);      // 0 at the canopy, 1 at the end of the fall
  float tt = ph * aLife;
  float fall = max(aSpawn.y - 0.19, 0.10) * (0.92 + 0.12 * hash11(aSeed * 91.0));   // lands at the shoreline, not through the ground
  vec2 p = aSpawn;
  p.y -= ph * fall + 0.012 * sin(ph * 18.85 + aSeed * 30.0);                                  // gravity + a gentle bob
  p.x -= ph * (0.06 + 0.12 * hash11(aSeed * 13.0));                                            // carried diagonally downwind (the way the canopy leans), toward the water
  p.x += sin(uTime * uMotion * 0.5 + aSeed * 20.0) * 0.018 * (0.3 + ph) + sin(uTime * uMotion * 1.7 + aSeed * 40.0) * 0.004;   // wind
  vec2 fc = vec2(${f(TREE_X)}, 0.0);
  float k = 1.0 - 0.5 * uScroll;
  vec2 uv0 = fc + (p + uPtr * vec2(0.026, 0.010) - fc) / k;                                   // same plane as the tree, a touch nearer
  uv0 = vec2(1.0 + uTreeL.y + (uv0.x - 1.0) * uTreeL.x, uv0.y * uTreeL.x);   // follow the tree's smaller, right-shifted placement
  gl_Position = vec4(toNdc(uv0), 0.0, 1.0);
  vRot = tt * 0.9 + sin(tt * 2.2 + aSeed * 30.0) * 0.9;                                       // slow tumble + flutter
  vFlip = abs(cos(tt * 1.3 + aSeed * 50.0)) * 0.7 + 0.3;
  vAlpha = smoothstep(0.0, 0.10, ph) * (1.0 - smoothstep(0.78, 0.97, ph)) * uFade;     // eased in at the canopy and out near the ground: no popping
  gl_PointSize = uPx * aSize;
}`;
const LEAF_FRAG = /* glsl */ `
precision mediump float;
varying float vAlpha, vRot, vFlip;
uniform float uWarm;
void main(){
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  vec2 r = vec2(c * p.x + s * p.y, -s * p.x + c * p.y);
  r.x /= vFlip;                                                  // turns edge-on as it flutters
  float y = r.y / 0.44;
  float wid = 0.15 * pow(max(1.0 - y * y, 0.0), 0.75);           // slender lens with pointed tip and base
  float ax = abs(r.x);
  float mask = (1.0 - smoothstep(wid * 0.72, wid, ax)) * step(abs(y), 1.0);
  float rib = smoothstep(0.012, 0.0, ax) * step(abs(y), 0.9);
  // warm brown body, a bright amber rim on the edge facing the sun (screen left), a pale midrib
  float edge = smoothstep(wid * 0.35, wid, ax);
  float face = clamp(dot(normalize(p + 1e-4), vec2(-1.0, 0.25)), 0.0, 1.0);
  vec3 col = vec3(0.10, 0.068, 0.05) + vec3(1.0, 0.62, 0.27) * (edge * (0.25 + 0.75 * face)) * 0.95 * (0.15 + 0.85 * uWarm) + vec3(0.28, 0.17, 0.08) * rib;
  gl_FragColor = vec4(col, mask * vAlpha);
}`;

const FLY_VERT = /* glsl */ `
attribute float aSeed, aSize, aInt;
attribute vec2 aBase;
${FX_COMMON}
varying float vGlow, vSoft;
void main(){
  float t = uTime * uMotion;
  float period = 5.5 + 4.0 * hash11(aSeed * 7.13);                // each jugnu glows for a few seconds, dims, then reappears elsewhere
  float cyc = t / period + aSeed * 3.0;
  float ph = fract(cyc);
  float id = floor(cyc);
  vec2 jump = (vec2(hash11(id * 3.1 + aSeed * 17.0), hash11(id * 5.7 + aSeed * 29.0)) - 0.5) * vec2(0.20, 0.05);
  vec2 p = aBase + jump;
  p.x += sin(t * 0.23 * (0.6 + hash11(aSeed * 3.0)) + aSeed * 30.0) * 0.045 + sin(t * 0.51 + aSeed * 17.0) * 0.012;           // slow organic wander
  p.y += sin(t * 0.19 * (0.6 + hash11(aSeed * 5.0)) + aSeed * 11.0) * 0.026 + sin(t * 0.43 + aSeed * 23.0) * 0.009;
  p = clamp(p, vec2(0.01, 0.022), vec2(0.99, 0.28));
  vec2 fc = vec2(${f(SUBJECT_X)}, 0.0);
  float k = 1.0 - 0.35 * uScroll;
  vec2 uv0 = fc + (p + uPtr * vec2(0.010 + 0.006 * aSize, 0.004 + 0.003 * aSize) - fc) / k;      // nearer (bigger) ones shift more
  gl_Position = vec4(toNdc(uv0), 0.0, 1.0);
  float env = smoothstep(0.0, 0.25, ph) * (1.0 - smoothstep(0.55, 0.85, ph));                    // zero at both ends of the cycle: no pop when it jumps
  vGlow = env * aInt * (0.86 + 0.14 * sin(t * 7.0 + aSeed * 50.0)) * uFade;
  vSoft = clamp((aSize - 1.0) / 2.0, 0.0, 1.0);                                                    // close-up glows are softer and more diffuse
  gl_PointSize = uPx * aSize * (0.75 + 0.35 * env);
}`;
const FLY_FRAG = /* glsl */ `
precision mediump float;
varying float vGlow, vSoft;
void main(){
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float core = exp(-r * r * mix(13.0, 5.5, vSoft)) * mix(1.0, 0.55, vSoft);
  float halo = exp(-r * r * mix(3.4, 2.2, vSoft)) * mix(0.30, 0.42, vSoft);
  vec3 col = mix(vec3(1.0, 0.81, 0.43), vec3(1.0, 0.851, 0.557), core);   // #ffcf6e -> #ffd98e
  gl_FragColor = vec4(col * (core + halo) * vGlow * 0.85, 1.0);            // additive
}`;

export type SunsetHandle = {
  destroy: () => void;
  setScroll: (p: number) => void;
  /** pin the time of day (0 sunset .. 1 night); null hands control back to scroll */
  setTime: (t: number | null) => void;
  setParams: (p: Partial<SunsetParams>) => void;
};

// Ocean grid: 160 x 160 segments, dense under the camera and stretching toward the horizon.
function oceanGeometry(): BufferGeometry {
  const N = 160;
  const pos = new Float32Array((N + 1) * (N + 1) * 3);
  let o = 0;
  for (let j = 0; j <= N; j++) {
    const z = 12 - Math.pow(j / N, 2.4) * 1412;
    const half = 26 + Math.max(0, -z) * 1.5;
    for (let i = 0; i <= N; i++) {
      pos[o++] = (i / N - 0.5) * 2 * half;
      pos[o++] = 0;
      pos[o++] = z;
    }
  }
  const idx = new Uint32Array(N * N * 6);
  let q = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i;
      const c = a + N + 1;
      idx.set([a, a + 1, c, a + 1, c + 1, c], q); // counter-clockwise seen from above, so the surface is front-facing
      q += 6;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setIndex(new BufferAttribute(idx, 1));
  return g;
}

export async function mountSunset(
  host: HTMLElement,
  canvas: HTMLCanvasElement,
  src: { ridge: string; tree: string; ridgeColor: string; treeColor: string; grassMid: string; grassFront: string; grassMidColor: string; grassFrontColor: string },
  cb: { onReady: () => void; onFail: () => void },
  opts: { time?: number | null; params?: Partial<SunsetParams> } = {},
): Promise<SunsetHandle> {
  const noop: SunsetHandle = { destroy() {}, setScroll() {}, setTime() {}, setParams() {} };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches || window.innerWidth < 700;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: !coarse, alpha: false, powerPreference: "high-performance" });
  } catch {
    cb.onFail();
    return noop;
  }
  renderer.autoClear = false;

  const loader = new TextureLoader();
  const [ridgeTex, treeTex, ridgeColTex, treeColTex, grassMidTex, grassFrontTex, grassMidColTex, grassFrontColTex] = await Promise.all(
    [src.ridge, src.tree, src.ridgeColor, src.treeColor, src.grassMid, src.grassFront, src.grassMidColor, src.grassFrontColor].map((u) => loader.loadAsync(u).catch(() => null)),
  );
  if (!ridgeTex || !treeTex || !ridgeColTex || !treeColTex || !grassMidTex || !grassFrontTex || !grassMidColTex || !grassFrontColTex) {
    renderer.dispose();
    cb.onFail();
    return noop;
  }
  for (const t of [ridgeTex, treeTex, ridgeColTex, treeColTex, grassMidTex, grassFrontTex, grassMidColTex, grassFrontColTex] as Texture[]) {
    t.colorSpace = NoColorSpace; // display values in and out: the shaders do no sRGB conversion
    t.minFilter = LinearFilter;
    t.generateMipmaps = false;
  }

  const sunDir = new Vector3(0, 0.05, -1).normalize();
  const shared = {
    uTime: { value: reduce ? 6 : 0 },
    uMotion: { value: reduce ? 0 : 1 },
    uFade: { value: reduce ? 1 : 0 },
  };
  const ptr = new Vector2(0, 0);
  const uS = { value: new Vector2(1, 1) };
  const uFocus = { value: new Vector2(0.5, 0.5) };
  const uAng = { value: 1.2 };
  // foreground placement (scale, shift): full strength on wide screens, fades to the original layout as the view narrows (see frame())
  const layoutU = { uFigure: { value: new Vector2(1, 0) }, uTreeL: { value: new Vector2(1, 0) } };
  const ripples = Array.from({ length: 8 }, () => new Vector4(0, 0, -99, 0));

  // time of day: every mood-dependent uniform lives in one bag so sky, ocean, silhouettes and fx all read the same state
  const params: SunsetParams = { ...DEFAULT_PARAMS, ...opts.params };
  const ts = createTimeState();
  const tod = {
    uPal: { value: Array.from({ length: 8 }, () => new Vector3()) },
    uNight: { value: 0 },
    uStars: { value: 0 },
    uStarDens: { value: 1 },
    uMW: { value: 0 },
    uSun: { value: new Vector2(SUN_UV.x, SUN_UV.y) },
    uSunI: { value: 1 },
    uMoon: { value: new Vector2(0.5, 0.4) },
    uMoonI: { value: 0 },
    uMoonR: { value: MOON_SIZE },
    uPxUv: { value: 0.001 },
    uTextDim: { value: TEXT_DIM },
    uWarm: { value: 1 },
    uTrough: { value: new Vector3() },
    uCop0: { value: new Vector3() },
    uCop1: { value: new Vector3() },
    uMoonDir: { value: new Vector3(0, 0.3, -1).normalize() },
    uChop: { value: 1 },
    uFoam: { value: 1 },
    uFres: { value: 0.55 },
    uRes: { value: new Vector2(1, 1) },
  };
  let timeOverride: number | null = opts.time ?? null;
  let tNow = timeOverride ?? (reduce ? TIME_DEFAULT : SCROLL_T0);
  const applyTime = (t: number) => {
    evalTime(t, ts);
    for (let i = 0; i < 8; i++) tod.uPal.value[i].fromArray(ts.pal[i]);
    tod.uTrough.value.fromArray(ts.trough);
    tod.uCop0.value.fromArray(ts.cop0);
    tod.uCop1.value.fromArray(ts.cop1);
    tod.uNight.value = ts.night;
    tod.uStars.value = ts.stars;
    tod.uMW.value = ts.mw * params.milkyWay;
    tod.uStarDens.value = params.stars;
    tod.uSunI.value = ts.sunI;
    tod.uSun.value.set(SUN_UV.x, ts.sunY);
    tod.uMoonI.value = ts.moonI * Math.min(1, params.moon);
    tod.uMoon.value.set(ts.moonX, ts.moonY);
    tod.uMoonR.value = MOON_SIZE * Math.max(0.2, params.moon);
    tod.uWarm.value = ts.warm;
    tod.uFres.value = ts.fres;
    tod.uChop.value = params.chop;
    tod.uFoam.value = params.foam;
  };
  applyTime(tNow);

  const ortho = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const cam = new PerspectiveCamera(FOV, 1, 0.1, 4000);

  // 1. sky
  const skyScene = new Scene();
  const skyMat = new ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: SKY_FRAG, uniforms: { uS, uFocus, uAng, uPtr: { value: ptr }, ...tod, ...shared }, depthTest: false, depthWrite: false });
  const skyQuad = new Mesh(new PlaneGeometry(2, 2), skyMat);
  skyScene.add(skyQuad);

  // 2. ocean
  const oceanScene = new Scene();
  const oceanMat = new ShaderMaterial({
    vertexShader: OCEAN_VERT,
    fragmentShader: OCEAN_FRAG,
    uniforms: { ...shared, ...tod, uS, uFocus, uSunDir: { value: sunDir }, uRip: { value: ripples } },
    transparent: true,
    depthWrite: true,
  });
  const ocean = new Mesh(oceanGeometry(), oceanMat);
  ocean.frustumCulled = false;
  oceanScene.add(ocean);

  // 3 + 4. silhouette layers
  const aperture = { uAp: { value: new Vector3(0.5, 0.5, 0.19) }, uReveal: { value: 0 }, uScrAspect: { value: 1 } };
  const layer = (frag: string, tex: Texture, col: Texture, grassTex: Texture, grassColTex: Texture) => {
    const scene = new Scene();
    const mat = new ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: frag,
      uniforms: { tTex: { value: tex }, tCol: { value: col }, tGrass: { value: grassTex }, tGrassCol: { value: grassColTex }, uS, uFocus, uPtr: { value: ptr }, uScroll: { value: 0 }, ...aperture, ...layoutU, ...tod, ...shared },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new Mesh(new PlaneGeometry(2, 2), mat);
    scene.add(quad);
    return { scene, mat, quad };
  };
  const ridge = layer(RIDGE_FRAG, ridgeTex, ridgeColTex, grassMidTex, grassMidColTex);
  const tree = layer(TREE_FRAG, treeTex, treeColTex, grassFrontTex, grassFrontColTex);


  // ambient life: leaves shed from the canopy, jugnu over the grass and shoreline (none under reduced motion)
  const nLeaf = reduce ? 0 : coarse ? 18 : 34;
  const FIREFLIES = false; // jugnu (glowing fireflies) switched off for now: set to true to bring them back
  const nFly = !FIREFLIES || reduce ? 0 : coarse ? 16 : 30;
  const fxScene = new Scene();
  const px = { value: 12 };
  const fxU = () => ({ uS, uFocus, uPtr: { value: ptr }, uScroll: { value: 0 }, uPx: px, uWarm: tod.uWarm, uTreeL: layoutU.uTreeL, ...shared });
  const makePoints = (n: number, attrs: Record<string, [number[], number]>, vert: string, frag: string, additive: boolean) => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(n * 3), 3));
    for (const [name, [data, size]] of Object.entries(attrs)) g.setAttribute(name, new BufferAttribute(new Float32Array(data), size));
    const m = new ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: fxU(), transparent: true, depthTest: false, depthWrite: false, ...(additive ? { blending: AdditiveBlending } : {}) });
    const pts = new Points(g, m);
    pts.frustumCulled = false;
    fxScene.add(pts);
    return { g, m };
  };
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const leaves = nLeaf
    ? makePoints(
        nLeaf,
        {
          aSeed: [Array.from({ length: nLeaf }, () => Math.random()), 1],
          aLife: [Array.from({ length: nLeaf }, () => rnd(9, 16)), 1],
          aSize: [Array.from({ length: nLeaf }, () => rnd(1.05, 1.7)), 1],
          // spawn inside the mangrove crown (x 68-90%, y 30-52% up the canvas)
          aSpawn: [Array.from({ length: nLeaf }, () => [rnd(0.68, 0.9), rnd(0.28, 0.5)]).flat(), 2],
        },
        LEAF_VERT,
        LEAF_FRAG,
        false,
      )
    : null;
  const sizes = Array.from({ length: nFly }, () => (Math.random() < 0.18 ? rnd(2.0, 3.2) : rnd(0.55, 1.35)));
  const flies = nFly
    ? makePoints(
        nFly,
        {
          aSeed: [Array.from({ length: nFly }, () => Math.random()), 1],
          // mostly faint distant sparks, a few big soft close-up glows
          aSize: [sizes, 1],
          aInt: [sizes.map((z) => (z > 1.8 ? rnd(0.7, 0.95) : rnd(0.35, 0.7))), 1],
          // concentrated in the grass, with some over the lower shoreline
          aBase: [Array.from({ length: nFly }, () => [rnd(0.04, 0.96), Math.random() < 0.75 ? rnd(0.03, 0.16) : rnd(0.16, 0.28)]).flat(), 2],
        },
        FLY_VERT,
        FLY_FRAG,
        true,
      )
    : null;
  const fxMats = [leaves?.m, flies?.m].filter(Boolean) as ShaderMaterial[];

  // alpha maps of the two colour layers: the reveal only opens when the pointer is over the person, cat or tree
  const alphaMap = (tex: Texture) => {
    const im = tex.image as CanvasImageSource & { width: number; height: number };
    const c = document.createElement("canvas");
    c.width = 480;
    c.height = 270;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(im, 0, 0, c.width, c.height);
    return g.getImageData(0, 0, c.width, c.height).data;
  };
  const ridgeAlpha = alphaMap(ridgeColTex);
  const treeAlpha = alphaMap(treeColTex);
  // thin blades vanish when downsampled, so grow the grass hit maps by 2 texels
  const grow = (map: Uint8ClampedArray) => {
    const out = new Uint8ClampedArray(map.length);
    for (let y = 0; y < 270; y++)
      for (let x = 0; x < 480; x++) {
        let a = 0;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const yy = y + dy;
            const xx = x + dx;
            if (yy >= 0 && yy < 270 && xx >= 0 && xx < 480) a = Math.max(a, map[(yy * 480 + xx) * 4 + 3]);
          }
        out[(y * 480 + x) * 4 + 3] = a;
      }
    return out;
  };
  const grassMidAlpha = grow(alphaMap(grassMidColTex));
  const grassFrontAlpha = grow(alphaMap(grassFrontColTex));
  const aAt = (map: Uint8ClampedArray, x: number, y: number) => {
    if (x < 0 || x > 1 || y < 0 || y > 1) return 0;
    return map[(Math.min(269, Math.floor((1 - y) * 270)) * 480 + Math.min(479, Math.floor(x * 480))) * 4 + 3];
  };

  // --- framing: pitch the ocean camera so its horizon lands exactly on the canvas horizon; the sun maps to the sun
  let horizonNdc = 0;
  const sunNdc = new Vector2();
  const moonNdc = new Vector2();
  const sFit = new Vector2(1, 1);
  const rc = new Raycaster();
  const frame = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    const sa = w / h;
    // cover-fit the 16:9 layers; on tall phone screens zoom them out so the subject, sun and tree all stay in view
    const s0 = new Vector2(1, 1);
    if (sa < ASPECT) s0.x = sa / ASPECT;
    else s0.y = ASPECT / sa;
    s0.multiplyScalar(0.96);
    const k = sa < 1 ? MathUtils.clamp(0.62 / s0.x, 1, 3) : 1;
    sFit.copy(s0).multiplyScalar(k);
    const zoomed = k > 1.001;
    const focusX = zoomed ? 0.58 : 0.5 + 0.08 * MathUtils.clamp(((ASPECT - sa) / ASPECT) * 2, 0, 1);
    const focusY = zoomed ? 0.5 * sFit.y - 0.02 : 0.5 * sFit.y; // bottom-anchored: the ridge always meets the viewport bottom
    uS.value.copy(sFit);
    const lw = MathUtils.smoothstep(sFit.x, 0.62, 0.86); // 0 on narrow / portrait views (the crop would cut the figure off), 1 on wide ones
    layoutU.uFigure.value.set(MathUtils.lerp(1, FIGURE_LAYOUT.scale, lw), FIGURE_LAYOUT.shift * lw);
    layoutU.uTreeL.value.set(MathUtils.lerp(1, TREE_LAYOUT.scale, lw), TREE_LAYOUT.shift * lw);
    uFocus.value.set(focusX, focusY);
    horizonNdc = (2 * (HORIZON - focusY)) / sFit.y;
    sunNdc.set((2 * (SUN_UV.x - focusX)) / sFit.x, 0);
    const tanHalf = Math.tan(MathUtils.degToRad(FOV / 2));
    uAng.value = (2 * tanHalf * sa) / sFit.x; // radians (small-angle) per canvas-width unit
    aperture.uScrAspect.value = sa;
    cam.aspect = sa;
    cam.position.set(0, CAM_Y, 0);
    cam.rotation.set(-Math.atan(horizonNdc * tanHalf), 0, 0);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
  };
  const resize = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.5); // the ocean shader is the heavy part: cap fill cost for a steady 60fps
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    px.value = Math.max(8, h * 0.017) * dpr; // leaf/jugnu sprite size scales with the viewport
    frame();
    tod.uPxUv.value = uS.value.y / (h * dpr); // one device pixel in canvas-height units: stars never shrink below it (no aliasing)
    tod.uRes.value.set(w * dpr, h * dpr);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // --- input
  const target = new Vector2(0, 0);
  const lastRip = { x: -999, y: -999, t: 0 };
  let ripN = 0;
  const t0 = performance.now();
  let lastInput = -1e9;
  const surface = new Plane(new Vector3(0, 1, 0), 0);
  const hit = new Vector3();
  // hover reveal state (fine-pointer desktop only, like the original hero)
  const hoverOk = matchMedia("(hover: hover) and (pointer: fine)").matches && !reduce;
  const hov = { active: false, pos: new Vector2(0.5, 0.5), want: new Vector2(0.5, 0.5), v: 0, r: 0.08 };
  const R_TARGET = 0.19;
  const overFigure = (sx: number, sy: number) => {
    const ux = uFocus.value.x + (sx - 0.5) * uS.value.x;
    const uy = uFocus.value.y + (sy - 0.5) * uS.value.y;
    // same transforms as the layer shaders (placement, then zoom + parallax), so the hit-test follows the scene
    const fg = layoutU.uFigure.value;
    const tl = layoutU.uTreeL.value;
    const uv0x = (ux - fg.y) / fg.x;
    const uv0y = uy / fg.x;
    const tv0x = 1 + (ux - 1 - tl.y) / tl.x;
    const tv0y = uy / tl.x;
    const rx = SUBJECT_X + (uv0x - SUBJECT_X) * (1 - 0.35 * scroll) - ptr.x * 0.01;
    const ry = uv0y * (1 - 0.35 * scroll) - ptr.y * 0.004;
    const tx = TREE_X + (tv0x - TREE_X) * (1 - 0.5 * scroll) - ptr.x * 0.02;
    const ty = tv0y * (1 - 0.5 * scroll) - ptr.y * 0.008;
    return aAt(ridgeAlpha, rx, ry) > 40 || aAt(treeAlpha, tx, ty) > 40 || aAt(grassMidAlpha, rx, ry) > 12 || aAt(grassFrontAlpha, tx, ty) > 12;
  };
  const onMove = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
    target.set(nx, ny);
    lastInput = performance.now();
    if (hoverOk && e.pointerType === "mouse") {
      const sx = (e.clientX - r.left) / r.width;
      const sy = 1 - (e.clientY - r.top) / r.height;
      const inside = scroll < 0.5 && overFigure(sx, sy);
      hov.want.set(sx, sy);
      if (inside && !hov.active) {
        hov.active = true;
        hov.pos.copy(hov.want);
        if (hov.v < 0.05) hov.r = R_TARGET * 0.5;
      } else if (!inside && hov.active) hov.active = false;
    }
    if (reduce) return;
    const dist = Math.hypot(e.clientX - lastRip.x, e.clientY - lastRip.y);
    if (dist > 36 && lastInput - lastRip.t > 70 && ny < horizonNdc - 0.05) {
      rc.setFromCamera(new Vector2(nx, ny), cam);
      if (rc.ray.intersectPlane(surface, hit) && hit.distanceTo(cam.position) < 120) {
        ripples[ripN++ % 8].set(hit.x, hit.z, shared.uTime.value, Math.min(1, 0.4 + dist / 160));
        lastRip.x = e.clientX;
        lastRip.y = e.clientY;
        lastRip.t = lastInput;
      }
    }
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  const onLeaveDoc = () => (hov.active = false);
  document.documentElement.addEventListener("pointerleave", onLeaveDoc);
  const tiltOpen = typeof (window.DeviceOrientationEvent as unknown as { requestPermission?: unknown })?.requestPermission !== "function";
  const onTilt = (e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null) return;
    target.set(MathUtils.clamp(e.gamma / 22, -1, 1), MathUtils.clamp(-(e.beta - 50) / 22, -1, 1));
    lastInput = performance.now();
  };
  if (coarse && tiltOpen && !reduce) window.addEventListener("deviceorientation", onTilt, { passive: true });

  let visible = true;
  const io = new IntersectionObserver(([en]) => (visible = en.isIntersecting));
  io.observe(host);

  let scrollTarget = 0;
  let scroll = 0;
  let raf = 0;
  let ready = false;
  let tPrev = performance.now();
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - tPrev) / 1000);
    tPrev = now;
    const t = (now - t0) / 1000;
    if (!reduce) {
      shared.uTime.value = t;
      if (now - lastInput > 2500) target.set(Math.sin(t * 0.25) * 0.45, Math.sin(t * 0.17 + 1.0) * 0.25);
      ptr.lerp(target, DAMP);
      scroll += (scrollTarget - scroll) * 0.12;
      ridge.mat.uniforms.uScroll.value = scroll;
      tree.mat.uniforms.uScroll.value = scroll;
      for (const m of fxMats) m.uniforms.uScroll.value = scroll;
      shared.uFade.value = Math.min(1, t / 1.6); // the scene stays on screen for the whole scroll: the night sky is the payoff
    }
    // time of day: pinned by ?t= / the tune overlay, otherwise driven by scroll (damped like the other scroll-linked motion)
    const tTarget = reduce ? (timeOverride ?? TIME_DEFAULT) : (timeOverride ?? SCROLL_T0 + (SCROLL_T1 - SCROLL_T0) * scroll);
    if (!reduce) tNow += (tTarget - tNow) * (1 - Math.exp(-dt / 0.25));
    else tNow = tTarget;
    applyTime(tNow);
    // aperture: position follows with a short ease, radius and strength tween in/out (enter 0.5s, leave 0.6s)
    const ease = (tau: number) => 1 - Math.exp(-dt / tau);
    hov.pos.lerp(hov.want, ease(0.09));
    hov.v += ((hov.active ? 1 : 0) - hov.v) * ease(hov.active ? 0.16 : 0.22);
    hov.r += ((hov.active ? R_TARGET : R_TARGET * 0.32) - hov.r) * ease(hov.active ? 0.16 : 0.24);
    aperture.uAp.value.set(hov.pos.x, hov.pos.y, hov.r);
    aperture.uReveal.value = hov.v < 0.002 ? 0 : hov.v;

    // the ocean has its own, gentler plane: a slight yaw; keep its sun glitter under the sky plane's sun as that drifts
    cam.rotation.y = -ptr.x * 0.012;
    cam.updateMatrixWorld(true);
    const ndcY = (uvY: number) => (2 * (uvY - uFocus.value.y)) / sFit.y;
    rc.setFromCamera(new Vector2(sunNdc.x + (2 * ptr.x * 0.003) / sFit.x, ndcY(ts.sunY)), cam);
    sunDir.copy(rc.ray.direction).normalize();
    moonNdc.set((2 * (ts.moonX - uFocus.value.x)) / sFit.x + (2 * ptr.x * 0.003) / sFit.x, ndcY(ts.moonY)); // same sky-plane parallax as the sun
    rc.setFromCamera(moonNdc, cam);
    tod.uMoonDir.value.copy(rc.ray.direction).normalize();

    renderer.clear();
    renderer.render(skyScene, ortho); // 1. sky + far hills
    renderer.clearDepth();
    renderer.render(oceanScene, cam); // 2. ocean
    renderer.clearDepth();
    renderer.render(ridge.scene, ortho); // 3. ridge + person + cat
    renderer.render(tree.scene, ortho); // 4. tree + front cliff
    if (fxMats.length) renderer.render(fxScene, ortho); // falling leaves + jugnu
    if (!ready) {
      ready = true;
      cb.onReady();
    }
  };
  loop();

  return {
    setScroll(p: number) {
      scrollTarget = reduce ? 0 : MathUtils.clamp(p, 0, 1);
    },
    setTime(t: number | null) {
      timeOverride = t == null ? null : MathUtils.clamp(t, 0, 1);
    },
    setParams(p: Partial<SunsetParams>) {
      Object.assign(params, p);
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeaveDoc);
      window.removeEventListener("deviceorientation", onTilt);
      ro.disconnect();
      io.disconnect();
      skyQuad.geometry.dispose();
      skyMat.dispose();
      ocean.geometry.dispose();
      oceanMat.dispose();
      for (const l of [ridge, tree]) {
        l.quad.geometry.dispose();
        l.mat.dispose();
      }
      for (const o of [leaves, flies]) {
        o?.g.dispose();
        o?.m.dispose();
      }
      ridgeTex.dispose();
      treeTex.dispose();
      ridgeColTex.dispose();
      treeColTex.dispose();
      grassMidTex.dispose();
      grassFrontTex.dispose();
      grassMidColTex.dispose();
      grassFrontColTex.dispose();
      renderer.dispose();
    },
  };
}
