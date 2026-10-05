// WebGL enhancement for the hero portrait. Loaded lazily (dynamic import) from HeroPortrait.
// One point per cell of the approved static raster, so at rest it matches the static frame; depth is restrained.
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "three";

const CELL = 3; // px per dither cell in portrait-raster.png (see scripts/build-portrait.py)
const MAX_TILT = (2.5 * Math.PI) / 180; // pointer response cap
const FOV = 30;

const VERT = /* glsl */ `
uniform float uTime, uResolve, uPx, uDist, uScan;
attribute vec3 color;
attribute float seed;
varying vec3 vC;
varying float vKeep;
float h(float n){ return fract(sin(n * 127.1) * 43758.5453); }
void main(){
  float j = 1.0 - uResolve;                       // 1 = fragmented, 0 = resolved
  vec3 p = position;
  p.xy += (vec2(h(seed), h(seed + 1.7)) - 0.5) * 0.026 * j;
  p.z  += (h(seed + 3.1) - 0.5) * 0.05 * j;
  p.z  += sin(uTime * 0.6 + position.x * 5.0 + position.y * 3.0) * 0.004;   // breathing
  vKeep = h(seed + 9.0) < j * 0.25 ? 0.0 : 1.0;
  float band = 1.0 - smoothstep(0.0, 0.05, abs(fract(uTime * 0.06) - (0.5 - position.y / 1.4)));
  vC = color * (1.0 + band * uScan);
  p.xy *= (uDist - p.z) / uDist;                  // cancel perspective at rest: depth only shows as parallax when tilted
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx;
}`;
const FRAG = /* glsl */ `
varying vec3 vC; varying float vKeep;
void main(){ if (vKeep < 0.5) discard; gl_FragColor = vec4(vC, 1.0); }`;

async function sample(url: string) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  const cols = Math.floor(c.width / CELL);
  const rows = Math.floor(c.height / CELL);
  const aspect = c.height / c.width;
  const pos: number[] = [], col: number[] = [], seed: number[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (((y * CELL + 1) * c.width) + x * CELL + 1) * 4;
      if (data[i + 3] < 200) continue;
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      const lum = 0.3 * r + 0.59 * g + 0.11 * b;
      pos.push((x + 0.5) / cols - 0.5, (0.5 - (y + 0.5) / rows) * aspect, (lum - 0.5) * 0.16);
      col.push(r, g, b);
      seed.push(Math.random() * 100);
    }
  }
  return { pos, col, seed, aspect, cols, rows };
}

export type PortraitHandle = { destroy: () => void };

/** Mounts the point portrait. Calls onFail() (and cleans up) if WebGL is lost or too slow. */
export async function mountPortrait(
  host: HTMLElement,
  canvas: HTMLCanvasElement,
  url: string,
  cb: { onReady: () => void; onFail: () => void },
): Promise<PortraitHandle> {
  const data = await sample(url);
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
  } catch {
    cb.onFail();
    return { destroy() {} };
  }
  renderer.setClearColor(0x000000, 0);

  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(data.pos), 3));
  geo.setAttribute("color", new BufferAttribute(new Float32Array(data.col), 3));
  geo.setAttribute("seed", new BufferAttribute(new Float32Array(data.seed), 1));
  const dist = data.aspect / 2 / Math.tan((FOV * Math.PI) / 360); // plane z=0 exactly fills the view
  const mat = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uTime: { value: 0 }, uResolve: { value: 0 }, uPx: { value: 3 }, uDist: { value: dist }, uScan: { value: 0.1 } },
  });
  const group = new Group();
  group.add(new Points(geo, mat));
  const scene = new Scene();
  scene.add(group);
  const camera = new PerspectiveCamera(FOV, 1 / data.aspect, 0.01, 10);
  camera.position.z = dist;

  const resize = () => {
    const w = host.clientWidth;
    if (!w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Drawing buffer = exactly cols*n x rows*n device px (n px per dither cell, integer): gapless, exact grid match.
    // CSS scales the canvas to the host, same as the static <img>.
    const n = Math.max(1, Math.ceil((w / data.cols) * dpr));
    renderer.setPixelRatio(1);
    renderer.setSize(data.cols * n, data.rows * n, false);
    camera.aspect = data.cols / data.rows;
    camera.updateProjectionMatrix();
    mat.uniforms.uPx.value = n;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let tx = 0, ty = 0, rx = 0, ry = 0;
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    tx = (e.clientX / innerWidth - 0.5) * 2 * MAX_TILT;
    ty = (e.clientY / innerHeight - 0.5) * 2 * MAX_TILT;
  };
  addEventListener("pointermove", onMove, { passive: true });

  const t0 = performance.now();
  let raf = 0, last = t0, visible = true, running = true, frames = 0, slow = 0, readied = false;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(host);
  const onVis = () => (last = performance.now());
  document.addEventListener("visibilitychange", onVis);

  const destroy = () => {
    running = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    removeEventListener("pointermove", onMove);
    document.removeEventListener("visibilitychange", onVis);
    canvas.removeEventListener("webglcontextlost", onLost);
    geo.dispose();
    mat.dispose();
    renderer.dispose();
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    destroy();
    cb.onFail();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  const tick = (now: number) => {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    if (!visible || document.hidden) return; // paused offscreen / hidden tab
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const k = 1 - Math.exp(-dt * 5);
    rx += (ty - rx) * k;
    ry += (tx - ry) * k;
    group.rotation.set(rx, ry, 0);
    const p = Math.min((now - t0) / 1400, 1);
    mat.uniforms.uResolve.value = 0.3 + 0.7 * (1 - Math.pow(1 - p, 3)); // starts part-resolved: a short settle, not a dissolve
    mat.uniforms.uTime.value = (now - t0) / 1000;
    renderer.render(scene, camera);
    if (!readied) {
      readied = true;
      cb.onReady();
    }
    // performance gate: frames 15-60 averaged; too slow => fall back to the static raster
    frames++;
    if (frames > 15 && frames <= 60 && dt > 0.034) slow++;
    if (frames === 60 && slow > 20) {
      destroy();
      cb.onFail();
    }
  };
  raf = requestAnimationFrame(tick);
  return { destroy };
}
