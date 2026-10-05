import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

// THREE.CapsuleGeometry duplicates every UV-seam vertex (measured: 194 boundary
// edges on the default radius/segments below) -- same benign pattern as box/
// cylinder/sphere/torus, all of which weld cleanly to 0 given a CORRECT weld.
// (A naive vertex-only mergeVertices() reports 64 'non-manifold' edges here, but
// that is a counting artifact, not a real defect: it double-counts a handful of
// near-pole triangles that become degenerate once two of their three corners
// coincide -- confirmed by replicating subdivideCatmullClark's own degenerate-
// triangle-aware vertex identity, which finds a perfectly ordinary 2-manifold.)
// A capsule is the primary shape for skinned limbs/torso (PLAN_1.5), and skinning
// weight computation is O(vertices x bones), so fewer, guaranteed-simple vertices
// is worth having regardless -- authored as a deterministic, closed-by-
// construction mesh instead: shared pole vertices, and
// the radial index taken `% radialSegments` so the seam is never a duplicate
// vertex in the first place, rather than something to weld away afterward.
// Adapted from forge/stage5_rig/emit_rig.py's buildWatertightCapsule (verified
// there: 0 boundary edges, 0 non-manifold edges, deterministic across repeated
// runs) -- ported here rather than imported because this factory and the rig
// emitter are separate generated-output surfaces with no shared runtime module;
// see forge/tests/test_primitive_watertightness.py for the measured proof, and
// coordinate with the rig owner before changing either copy independently.
function buildWatertightCapsule(
  radius: number,
  cylLength: number,
  capSegments: number,
  radialSegments: number,
  heightSegments: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  const halfCyl = cylLength / 2;
  const totalSpan = 2 * (Math.PI / 2 * radius) + Math.max(0, cylLength);
  const vOf = (fromBottom: number) => (totalSpan > 0 ? fromBottom / totalSpan : 0);

  const bottomPoleIndex = positions.length / 3;
  positions.push(0, -halfCyl - radius, 0);
  uvs.push(0.5, vOf(0));

  const ringStarts: number[] = [];
  const ringV: number[] = [];
  for (let ring = 1; ring <= capSegments; ring += 1) {
    const phi = (Math.PI / 2) * (ring / capSegments);
    const y = -halfCyl - radius * Math.cos(phi);
    const r = radius * Math.sin(phi);
    const start = positions.length / 3;
    ringStarts.push(start);
    ringV.push(vOf(radius * phi));
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const theta = (radial / radialSegments) * Math.PI * 2;
      positions.push(r * Math.cos(theta), y, r * Math.sin(theta));
      uvs.push(radial / radialSegments, vOf(radius * phi));
    }
  }

  const cylinderRingStarts: number[] = [];
  if (cylLength > 0) {
    for (let step = 1; step <= heightSegments; step += 1) {
      const y = -halfCyl + (cylLength * step) / heightSegments;
      const start = positions.length / 3;
      cylinderRingStarts.push(start);
      const v = vOf(radius * (Math.PI / 2) + halfCyl + y);
      for (let radial = 0; radial < radialSegments; radial += 1) {
        const theta = (radial / radialSegments) * Math.PI * 2;
        positions.push(radius * Math.cos(theta), y, radius * Math.sin(theta));
        uvs.push(radial / radialSegments, v);
      }
    }
  }

  const topRingStarts: number[] = [];
  for (let ring = capSegments - 1; ring >= 1; ring -= 1) {
    const phi = (Math.PI / 2) * (ring / capSegments);
    const y = halfCyl + radius * Math.cos(phi);
    const r = radius * Math.sin(phi);
    const start = positions.length / 3;
    topRingStarts.push(start);
    const v = vOf(radius * (Math.PI / 2) + Math.max(0, cylLength) + radius * (Math.PI / 2 - phi));
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const theta = (radial / radialSegments) * Math.PI * 2;
      positions.push(r * Math.cos(theta), y, r * Math.sin(theta));
      uvs.push(radial / radialSegments, v);
    }
  }

  const topPoleIndex = positions.length / 3;
  positions.push(0, halfCyl + radius, 0);
  uvs.push(0.5, vOf(totalSpan));

  const firstBottomRing = ringStarts[0];
  for (let radial = 0; radial < radialSegments; radial += 1) {
    const next = (radial + 1) % radialSegments;
    indices.push(bottomPoleIndex, firstBottomRing + radial, firstBottomRing + next);
  }

  const allRings = [...ringStarts, ...cylinderRingStarts, ...topRingStarts];
  for (let i = 0; i < allRings.length - 1; i += 1) {
    const a = allRings[i];
    const b = allRings[i + 1];
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const next = (radial + 1) % radialSegments;
      indices.push(a + radial, a + next, b + next);
      indices.push(a + radial, b + next, b + radial);
    }
  }

  const lastRing = allRings[allRings.length - 1];
  for (let radial = 0; radial < radialSegments; radial += 1) {
    const next = (radial + 1) % radialSegments;
    indices.push(topPoleIndex, lastRing + next, lastRing + radial);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildLatheGeometry(profile: { points: [number, number][]; segments?: number }): THREE.LatheGeometry {
  const points = profile.points.map(([x, y]) => new THREE.Vector2(Math.max(0.0001, x), y));
  return new THREE.LatheGeometry(points, profile.segments ?? 24);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [clampAlbedoChannel((value >> 16) & 255), clampAlbedoChannel((value >> 8) & 255), clampAlbedoChannel(value & 255)];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  // setStyle with an explicit SRGBColorSpace, NOT the numeric constructor.
  //
  // `new THREE.Color(r, g, b)` treats its arguments as LINEAR working-space components,
  // while an authored `baseColor` hex is sRGB. Feeding one to the other skipped the
  // transfer function and lifted every dark albedo: #2e2a28, authored as a near-black
  // vinyl, rendered at roughly sRGB 0.46 — a mid grey. The error is largest exactly where
  // it matters most, because the transfer curve is steepest near black.
  return new THREE.Color().setStyle(source, THREE.SRGBColorSpace);
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions, denseComponent = false): THREE.MeshPhysicalMaterial {
  // A material that declares -- with evidence -- that its subject carries no texture
  // detail gets NO texture set. Synthesising one anyway is not a harmless default: the
  // branch below then forces color to white and roughness to 1 and reads both from the
  // generated maps, so the authored albedo and the reference-derived roughness are both
  // discarded, and the model gains mottling the reference does not have. Measured on the
  // tuxedo cat, whose black fur rendered as speckled grey-and-white from a palette that
  // only ever described two flat regions.
  const textureless = (spec.textureless as { declared?: boolean } | undefined)?.declared === true;
  const textures = textureless
    ? null
    : makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === 'dense' || spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(0.005, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Chibi Soldier
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createChibiSoldierModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Chibi Soldier";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 40.0, "aspect": 1.0, "orientation": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, "positionHint": [0.0, 0.0, 3.0], "note": "Reference is near-frontal with ~20 deg yaw (backpack peeks out on the viewer's right). Camera pose NOT solved (solve_camera_pose.py not run); modelled in a symmetric bind pose, asymmetric pose recorded in anatomy.pose."}, "approximationNotes": []};
  root.userData.materialPipeline = {};
  root.userData.materialReferenceRegistry = null;

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["skin"] = createSculptMaterial(
    "skin",
    {"id": "skin", "name": "Flat toon skin", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#f4cdae", "color": "#f4cdae", "albedo": {"dominant": "#f4cdae", "secondary": ["#f4cdae"]}, "colorVariation": {"palette": ["#f4cdae"], "pattern": "flat", "amplitude": 0.03, "heightCorrelation": 0.0}, "roughness": {"base": 0.75, "variation": 0.05}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Flat toon skin: flat cel-shaded paint, measured base #f4cdae; surface is procedural (no reference textures).", "textureless": {"declared": true, "evidence": ["12345.png patch x,y,w,h=(790, 470, 150, 40): 6000 px, mean #f4cdae, per-channel std 0.9/0.5/0.5 -> flat fill (grain-free)", "reference is a flat-shaded cartoon render with a thick uniform outline; identity is silhouette, proportion and boundaries between flat colour regions (measured with sample_ref.py)"]}},
    options
  );
  materialMap["shirt"] = createSculptMaterial(
    "shirt",
    {"id": "shirt", "name": "Grey-green jacket cloth", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#49504f", "color": "#49504f", "albedo": {"dominant": "#49504f", "secondary": ["#49504f"]}, "colorVariation": {"palette": ["#49504f"], "pattern": "flat", "amplitude": 0.03, "heightCorrelation": 0.0}, "roughness": {"base": 0.85, "variation": 0.05}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Grey-green jacket cloth: flat cel-shaded paint, measured base #49504f; surface is procedural (no reference textures).", "textureless": {"declared": true, "evidence": ["12345.png patch x,y,w,h=(850, 640, 45, 60): 2700 px, mean #49504f, per-channel std 0.5/0.5/0.4 -> flat fill (grain-free)", "reference is a flat-shaded cartoon render with a thick uniform outline; identity is silhouette, proportion and boundaries between flat colour regions (measured with sample_ref.py)"]}},
    options
  );
  materialMap["pants"] = createSculptMaterial(
    "pants",
    {"id": "pants", "name": "Dark grey trousers", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#444b4a", "color": "#444b4a", "albedo": {"dominant": "#444b4a", "secondary": ["#444b4a"]}, "colorVariation": {"palette": ["#444b4a"], "pattern": "flat", "amplitude": 0.03, "heightCorrelation": 0.0}, "roughness": {"base": 0.85, "variation": 0.05}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Dark grey trousers: flat cel-shaded paint, measured base #444b4a; surface is procedural (no reference textures).", "textureless": {"declared": true, "evidence": ["12345.png patch x,y,w,h=(810, 795, 45, 35): 1575 px, mean #444b4a, per-channel std 10.4/11.1/10.7 -> smooth low-frequency shading gradient only (no grain, print or relief)", "reference is a flat-shaded cartoon render with a thick uniform outline; identity is silhouette, proportion and boundaries between flat colour regions (measured with sample_ref.py)"]}},
    options
  );
  materialMap["shoes"] = createSculptMaterial(
    "shoes",
    {"id": "shoes", "name": "Black boots", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#030406", "color": "#030406", "albedo": {"dominant": "#030406", "secondary": ["#030406"]}, "colorVariation": {"palette": ["#030406"], "pattern": "flat", "amplitude": 0.03, "heightCorrelation": 0.0}, "roughness": {"base": 0.7, "variation": 0.05}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Black boots: flat cel-shaded paint, measured base #030406; surface is procedural (no reference textures).", "textureless": {"declared": true, "evidence": ["12345.png patch x,y,w,h=(802, 856, 60, 22): 1320 px, mean #030406, per-channel std 0.3/0.2/0.2 -> flat fill (grain-free)", "reference is a flat-shaded cartoon render with a thick uniform outline; identity is silhouette, proportion and boundaries between flat colour regions (measured with sample_ref.py)"]}},
    options
  );
  materialMap["eye"] = createSculptMaterial(
    "eye",
    {"id": "eye", "name": "Glossy black eye", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#040504", "color": "#040504", "albedo": {"dominant": "#040504", "secondary": ["#040504"]}, "colorVariation": {"palette": ["#040504"], "pattern": "flat", "amplitude": 0.03, "heightCorrelation": 0.0}, "roughness": {"base": 0.2, "variation": 0.05}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Glossy black eye: flat cel-shaded paint, measured base #040504; surface is procedural (no reference textures).", "textureless": {"declared": true, "evidence": ["12345.png patch x,y,w,h=(758, 408, 14, 28): 392 px, mean #040504, per-channel std 1.5/1.5/3.7 -> flat fill (grain-free)", "reference is a flat-shaded cartoon render with a thick uniform outline; identity is silhouette, proportion and boundaries between flat colour regions (measured with sample_ref.py)"]}},
    options
  );
  materialMap["helmet"] = createSculptMaterial(
    "helmet",
    {"id": "helmet", "name": "Glossy dark helmet shell", "type": "standard", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#414847", "color": "#414847", "albedo": {"dominant": "#414847", "secondary": ["#414847"]}, "colorVariation": {"palette": ["#414847"], "pattern": "flat", "amplitude": 0.03, "heightCorrelation": 0.0}, "roughness": {"base": 0.3, "variation": 0.05}, "metalness": {"base": 0.1, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "gloss-main", "description": "large soft white-grey specular highlight, upper-left of dome (x~738-833,y~180-240 of 12345.png)", "roughness": 0.18, "clearcoat": 0.8}, {"id": "gloss-dot", "description": "small round secondary highlight below the main one (x~735-760,y~238-263)", "roughness": 0.15}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Glossy dark helmet shell: flat cel-shaded paint, measured base #414847; surface is procedural (no reference textures).", "clearcoat": {"strength": 0.6, "roughness": 0.15}, "textureless": {"declared": true, "evidence": ["12345.png patch x,y,w,h=(900, 200, 150, 100): 15000 px, mean #414847, per-channel std 12.4/12.5/12.4 -> smooth low-frequency shading gradient only (no grain, print or relief)", "reference is a flat-shaded cartoon render with a thick uniform outline; identity is silhouette, proportion and boundaries between flat colour regions (measured with sample_ref.py)"]}},
    options
  );
  materialMap["backpack"] = createSculptMaterial(
    "backpack",
    {"id": "backpack", "name": "Red canvas backpack", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#8b2e29", "color": "#8b2e29", "albedo": {"dominant": "#8b2e29", "secondary": ["#8b2e29"]}, "colorVariation": {"palette": ["#8b2e29"], "pattern": "flat", "amplitude": 0.03, "heightCorrelation": 0.0}, "roughness": {"base": 0.8, "variation": 0.05}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Red canvas backpack: flat cel-shaded paint, measured base #8b2e29; surface is procedural (no reference textures).", "textureless": {"declared": true, "evidence": ["12345.png patch x,y,w,h=(1022, 580, 22, 40): 880 px, mean #8b2e29, per-channel std 2.5/1.6/1.6 -> flat fill (grain-free)", "reference is a flat-shaded cartoon render with a thick uniform outline; identity is silhouette, proportion and boundaries between flat colour regions (measured with sample_ref.py)"]}},
    options
  );
  materialMap["pistol"] = createSculptMaterial(
    "pistol",
    {"id": "pistol", "name": "Dark pistol metal", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#333435", "color": "#333435", "albedo": {"dominant": "#333435", "secondary": ["#333435"]}, "colorVariation": {"palette": ["#333435"], "pattern": "flat", "amplitude": 0.03, "heightCorrelation": 0.0}, "roughness": {"base": 0.45, "variation": 0.05}, "metalness": {"base": 0.4, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Dark pistol metal: flat cel-shaded paint, measured base #353638; surface is procedural (no reference textures).", "textureless": {"declared": true, "evidence": ["12345.png patch x,y,w,h=(672, 752, 8, 10) (class-filtered): 80 px, mean #353638, per-channel std 1.6/1.6/1.6 -> flat fill (grain-free)", "reference is a flat-shaded cartoon render with a thick uniform outline; identity is silhouette, proportion and boundaries between flat colour regions (measured with sample_ref.py)"]}},
    options
  );
  materialMap["belt"] = createSculptMaterial(
    "belt",
    {"id": "belt", "name": "Black belt", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#030406", "color": "#030406", "albedo": {"dominant": "#030406", "secondary": ["#030406"]}, "colorVariation": {"palette": ["#030406"], "pattern": "flat", "amplitude": 0.03, "heightCorrelation": 0.0}, "roughness": {"base": 0.75, "variation": 0.05}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Black belt: flat cel-shaded paint, measured base #030406; surface is procedural (no reference textures).", "textureless": {"declared": true, "evidence": ["12345.png patch x,y,w,h=(830, 726, 60, 6) (class-filtered): 170 px, mean #030406, per-channel std 1.5/1.7/1.5 -> flat fill (grain-free)", "reference is a flat-shaded cartoon render with a thick uniform outline; identity is silhouette, proportion and boundaries between flat colour regions (measured with sample_ref.py)"]}},
    options
  );
  materialMap["strap"] = createSculptMaterial(
    "strap",
    {"id": "strap", "name": "Black chin strap (measured #383d3d, darkened to read as black)", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#1b1f1f", "color": "#1b1f1f", "albedo": {"dominant": "#1b1f1f", "secondary": ["#1b1f1f"]}, "colorVariation": {"palette": ["#1b1f1f"], "pattern": "flat", "amplitude": 0.03, "heightCorrelation": 0.0}, "roughness": {"base": 0.75, "variation": 0.05}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Black chin strap (measured #383d3d, darkened to read as black): flat cel-shaded paint, measured base #383d3d; surface is procedural (no reference textures).", "textureless": {"declared": true, "evidence": ["12345.png patch x,y,w,h=(996, 426, 9, 12): 108 px, mean #383d3d, per-channel std 1.6/1.6/1.6 -> flat fill (grain-free)", "reference is a flat-shaded cartoon render with a thick uniform outline; identity is silhouette, proportion and boundaries between flat colour regions (measured with sample_ref.py)"]}},
    options
  );
  materialMap["buckle"] = createSculptMaterial(
    "buckle",
    {"id": "buckle", "name": "Grey buckle plate (measured #4a5150)", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#4a5150", "color": "#4a5150", "albedo": {"dominant": "#4a5150", "secondary": ["#4a5150"]}, "colorVariation": {"palette": ["#4a5150"], "pattern": "flat", "amplitude": 0.03, "heightCorrelation": 0.0}, "roughness": {"base": 0.4, "variation": 0.05}, "metalness": {"base": 0.5, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Grey buckle plate (measured #4a5150): flat cel-shaded paint, measured base #4a5150; surface is procedural (no reference textures).", "textureless": {"declared": true, "evidence": ["12345.png patch x,y,w,h=(838, 721, 22, 7): 154 px, mean #4a5150, per-channel std 1.5/1.5/1.5 -> flat fill (grain-free)", "reference is a flat-shaded cartoon render with a thick uniform outline; identity is silhouette, proportion and boundaries between flat colour regions (measured with sample_ref.py)"]}},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const endpoint_root_0 = makeAttachmentEndpoint(null);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "Soldier (root)__pivot";
  node_root_0.scale.set(1, 1, 1);
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "Soldier (root)", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Soldier (root): discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.0941, "height": 0.0941, "depth": 0.0941, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, 0.0, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.0941, 0.0941, 0.0941]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}}, "material": "shirt", "materialLayers": ["shirt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toon-outline", "kind": "linework", "description": "thick near-black outline (~4-5 px at 1818 wide) around every silhouette edge; render as inverted-hull or edge pass"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "root", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(74, 79, 79, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-root.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.901}}};
  node_root_0.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_root_0) {
    mesh_root_0Geometry.scale(0.0941, 0.0941, 0.0941);
  }
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["shirt"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "Soldier (root)";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "Soldier (root)", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Soldier (root): discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": null, "attachment": null, "dimensions": {"width": 0.0941, "height": 0.0941, "depth": 0.0941, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, 0.0, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.0941, 0.0941, 0.0941]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}}, "material": "shirt", "materialLayers": ["shirt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "toon-outline", "kind": "linework", "description": "thick near-black outline (~4-5 px at 1818 wide) around every silhouette edge; render as inverted-hull or edge pass"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "root", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(74, 79, 79, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-root.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.901}}};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);

  const endpoint_pelvis_1 = makeAttachmentEndpoint(null);
  const node_pelvis_1 = new THREE.Group();
  node_pelvis_1.name = "Pelvis / hips__pivot";
  node_pelvis_1.scale.set(1, 1, 1);
  if (endpoint_pelvis_1) {
    node_pelvis_1.position.copy(endpoint_pelvis_1.start);
    node_pelvis_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_pelvis_1.position.set(0.0, 0.0306, 0.0);
    node_pelvis_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_pelvis_1.userData.sculptComponent = {"id": "pelvis", "name": "Pelvis / hips", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Pelvis / hips: one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.4824, "height": 0.1647, "depth": 0.3294, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, 0.0306, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.4824, 0.1647, 0.3294]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pelvis", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pants"}}, "material": "pants", "materialLayers": ["pants"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "pelvis", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(45, 50, 50, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-pelvis.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.833}}};
  node_pelvis_1.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pelvis", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pants"}};
  (nodes["root"] ?? root).add(node_pelvis_1);
  nodes["pelvis"] = node_pelvis_1;
  const mesh_pelvis_1Geometry = endpoint_pelvis_1
    ? new THREE.CylinderGeometry(endpoint_pelvis_1.endRadius, endpoint_pelvis_1.baseRadius, endpoint_pelvis_1.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_pelvis_1) {
    mesh_pelvis_1Geometry.scale(0.4824, 0.1647, 0.3294);
  }
  const mesh_pelvis_1 = new THREE.SkinnedMesh(
    mesh_pelvis_1Geometry,
    materialMap["pants"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pelvis_1.name = "Pelvis / hips";
  if (endpoint_pelvis_1) {
    mesh_pelvis_1.position.copy(endpoint_pelvis_1.midpoint);
    mesh_pelvis_1.quaternion.copy(endpoint_pelvis_1.quaternion);
  }
  mesh_pelvis_1.castShadow = options.castShadow ?? true;
  mesh_pelvis_1.receiveShadow = options.receiveShadow ?? true;
  mesh_pelvis_1.userData.sculptComponent = {"id": "pelvis", "name": "Pelvis / hips", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Pelvis / hips: one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "root", "attachment": null, "dimensions": {"width": 0.4824, "height": 0.1647, "depth": 0.3294, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, 0.0306, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.4824, 0.1647, 0.3294]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "pelvis", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pants"}}, "material": "pants", "materialLayers": ["pants"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "pelvis", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(45, 50, 50, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-pelvis.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.833}}};
  node_pelvis_1.add(mesh_pelvis_1);
  meshes["pelvis"] = mesh_pelvis_1;
  colliders["pelvis"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["pelvis"] ??= [];
  destructionGroups["pelvis"].push(node_pelvis_1);

  const endpoint_abdomen_2 = makeAttachmentEndpoint(null);
  const node_abdomen_2 = new THREE.Group();
  node_abdomen_2.name = "Jacket lower torso (soft)__pivot";
  node_abdomen_2.scale.set(1, 1, 1);
  if (endpoint_abdomen_2) {
    node_abdomen_2.position.copy(endpoint_abdomen_2.start);
    node_abdomen_2.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_abdomen_2.position.set(0.0, 0.1576, 0.0);
    node_abdomen_2.rotation.set(0.0, 0.0, 0.0);
  }
  node_abdomen_2.userData.sculptComponent = {"id": "abdomen", "name": "Jacket lower torso (soft)", "level": "macro", "role": "shell", "importance": 1.0, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Jacket lower torso (soft): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pelvis", "attachment": null, "dimensions": {"width": 0.5059, "height": 0.1882, "depth": 0.3294, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, 0.1576, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.5059, 0.1882, 0.3294]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "abdomen", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}}, "material": "shirt", "materialLayers": ["shirt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "abdomen", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(74, 79, 79, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-abdomen.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.901}}};
  node_abdomen_2.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "abdomen", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}};
  (nodes["pelvis"] ?? root).add(node_abdomen_2);
  nodes["abdomen"] = node_abdomen_2;
  const mesh_abdomen_2Geometry = endpoint_abdomen_2
    ? new THREE.CylinderGeometry(endpoint_abdomen_2.endRadius, endpoint_abdomen_2.baseRadius, endpoint_abdomen_2.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_abdomen_2) {
    mesh_abdomen_2Geometry.scale(0.5059, 0.1882, 0.3294);
  }
  const mesh_abdomen_2 = new THREE.SkinnedMesh(
    mesh_abdomen_2Geometry,
    materialMap["shirt"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_abdomen_2.name = "Jacket lower torso (soft)";
  if (endpoint_abdomen_2) {
    mesh_abdomen_2.position.copy(endpoint_abdomen_2.midpoint);
    mesh_abdomen_2.quaternion.copy(endpoint_abdomen_2.quaternion);
  }
  mesh_abdomen_2.castShadow = options.castShadow ?? true;
  mesh_abdomen_2.receiveShadow = options.receiveShadow ?? true;
  mesh_abdomen_2.userData.sculptComponent = {"id": "abdomen", "name": "Jacket lower torso (soft)", "level": "macro", "role": "shell", "importance": 1.0, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Jacket lower torso (soft): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pelvis", "attachment": null, "dimensions": {"width": 0.5059, "height": 0.1882, "depth": 0.3294, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, 0.1576, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.5059, 0.1882, 0.3294]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "abdomen", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}}, "material": "shirt", "materialLayers": ["shirt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "abdomen", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(74, 79, 79, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-abdomen.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.901}}};
  node_abdomen_2.add(mesh_abdomen_2);
  meshes["abdomen"] = mesh_abdomen_2;
  colliders["abdomen"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["abdomen"] ??= [];
  destructionGroups["abdomen"].push(node_abdomen_2);

  const endpoint_chest_3 = makeAttachmentEndpoint(null);
  const node_chest_3 = new THREE.Group();
  node_chest_3.name = "Jacket upper torso (soft)__pivot";
  node_chest_3.scale.set(1, 1, 1);
  if (endpoint_chest_3) {
    node_chest_3.position.copy(endpoint_chest_3.start);
    node_chest_3.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_chest_3.position.set(0.0, 0.1835, 0.0);
    node_chest_3.rotation.set(0.0, 0.0, 0.0);
  }
  node_chest_3.userData.sculptComponent = {"id": "chest", "name": "Jacket upper torso (soft)", "level": "macro", "role": "shell", "importance": 1.0, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Jacket upper torso (soft): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "abdomen", "attachment": null, "dimensions": {"width": 0.5765, "height": 0.2776, "depth": 0.3529, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, 0.1835, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.5765, 0.2776, 0.3529]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}}, "material": "shirt", "materialLayers": ["shirt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "chest", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(74, 79, 79, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-chest.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.901}}};
  node_chest_3.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}};
  (nodes["abdomen"] ?? root).add(node_chest_3);
  nodes["chest"] = node_chest_3;
  const mesh_chest_3Geometry = endpoint_chest_3
    ? new THREE.CylinderGeometry(endpoint_chest_3.endRadius, endpoint_chest_3.baseRadius, endpoint_chest_3.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_chest_3) {
    mesh_chest_3Geometry.scale(0.5765, 0.2776, 0.3529);
  }
  const mesh_chest_3 = new THREE.SkinnedMesh(
    mesh_chest_3Geometry,
    materialMap["shirt"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_chest_3.name = "Jacket upper torso (soft)";
  if (endpoint_chest_3) {
    mesh_chest_3.position.copy(endpoint_chest_3.midpoint);
    mesh_chest_3.quaternion.copy(endpoint_chest_3.quaternion);
  }
  mesh_chest_3.castShadow = options.castShadow ?? true;
  mesh_chest_3.receiveShadow = options.receiveShadow ?? true;
  mesh_chest_3.userData.sculptComponent = {"id": "chest", "name": "Jacket upper torso (soft)", "level": "macro", "role": "shell", "importance": 1.0, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Jacket upper torso (soft): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "abdomen", "attachment": null, "dimensions": {"width": 0.5765, "height": 0.2776, "depth": 0.3529, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, 0.1835, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.5765, 0.2776, 0.3529]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}}, "material": "shirt", "materialLayers": ["shirt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "chest", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(74, 79, 79, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-chest.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.901}}};
  node_chest_3.add(mesh_chest_3);
  meshes["chest"] = mesh_chest_3;
  colliders["chest"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["chest"] ??= [];
  destructionGroups["chest"].push(node_chest_3);

  const endpoint_neck_4 = makeAttachmentEndpoint(null);
  const node_neck_4 = new THREE.Group();
  node_neck_4.name = "Neck__pivot";
  node_neck_4.scale.set(1, 1, 1);
  if (endpoint_neck_4) {
    node_neck_4.position.copy(endpoint_neck_4.start);
    node_neck_4.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_neck_4.position.set(-0.0353, 0.1224, 0.0);
    node_neck_4.rotation.set(0.0, 0.0, 0.0);
  }
  node_neck_4.userData.sculptComponent = {"id": "neck", "name": "Neck", "level": "meso", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Neck: one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "chest", "attachment": null, "dimensions": {"width": 0.1882, "height": 0.1365, "depth": 0.1882, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.0353, 0.1224, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.1882, 0.1365, 0.1882]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "neck", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "neck", "dominantAlbedo": "rgba(244, 205, 174, 1.0)", "secondaryAlbedo": "rgba(241, 203, 172, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-neck.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.996}}};
  node_neck_4.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "neck", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["chest"] ?? root).add(node_neck_4);
  nodes["neck"] = node_neck_4;
  const mesh_neck_4Geometry = endpoint_neck_4
    ? new THREE.CylinderGeometry(endpoint_neck_4.endRadius, endpoint_neck_4.baseRadius, endpoint_neck_4.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_neck_4) {
    mesh_neck_4Geometry.scale(0.1882, 0.1365, 0.1882);
  }
  const mesh_neck_4 = new THREE.SkinnedMesh(
    mesh_neck_4Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_neck_4.name = "Neck";
  if (endpoint_neck_4) {
    mesh_neck_4.position.copy(endpoint_neck_4.midpoint);
    mesh_neck_4.quaternion.copy(endpoint_neck_4.quaternion);
  }
  mesh_neck_4.castShadow = options.castShadow ?? true;
  mesh_neck_4.receiveShadow = options.receiveShadow ?? true;
  mesh_neck_4.userData.sculptComponent = {"id": "neck", "name": "Neck", "level": "meso", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Neck: one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "chest", "attachment": null, "dimensions": {"width": 0.1882, "height": 0.1365, "depth": 0.1882, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.0353, 0.1224, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.1882, 0.1365, 0.1882]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "neck", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "neck", "dominantAlbedo": "rgba(244, 205, 174, 1.0)", "secondaryAlbedo": "rgba(241, 203, 172, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-neck.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.996}}};
  node_neck_4.add(mesh_neck_4);
  meshes["neck"] = mesh_neck_4;
  colliders["neck"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["neck"] ??= [];
  destructionGroups["neck"].push(node_neck_4);

  const endpoint_collar_5 = makeAttachmentEndpoint(null);
  const node_collar_5 = new THREE.Group();
  node_collar_5.name = "Jacket collar ring__pivot";
  node_collar_5.scale.set(1, 1, 1);
  if (endpoint_collar_5) {
    node_collar_5.position.copy(endpoint_collar_5.start);
    node_collar_5.rotation.set(1.5708, 0.0, 0.0);
  } else {
    node_collar_5.position.set(-0.0353, 0.0894, 0.0188);
    node_collar_5.rotation.set(1.5708, 0.0, 0.0);
  }
  node_collar_5.userData.sculptComponent = {"id": "collar", "name": "Jacket collar ring", "level": "meso", "role": "shell", "importance": 0.7, "confidence": 0.7, "primitive": "torus", "topologyClass": "conforming-shell", "topologyRationale": "Jacket collar ring: thin layer following the form underneath, no independent volume.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "torusTubeRatio": 0.16}, "parent": "chest", "attachment": null, "dimensions": {"width": 0.3529, "height": 0.2635, "depth": 0.0612, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.0353, 0.0894, 0.0188], "rotation": [1.5708, 0.0, 0.0], "scale": [0.3381, 0.2524, 0.4248]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}}, "material": "shirt", "materialLayers": ["shirt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "collar-fold", "kind": "contour", "description": "two small collar flaps folding outward at the neckline"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "collar", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(74, 79, 79, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-collar.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.901}}};
  node_collar_5.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}};
  (nodes["chest"] ?? root).add(node_collar_5);
  nodes["collar"] = node_collar_5;
  const mesh_collar_5Geometry = endpoint_collar_5
    ? new THREE.CylinderGeometry(endpoint_collar_5.endRadius, endpoint_collar_5.baseRadius, endpoint_collar_5.length, 32, 12)
    : new THREE.TorusGeometry(0.45, 0.072, 24, 96);
  if (!endpoint_collar_5) {
    mesh_collar_5Geometry.scale(0.3381, 0.2524, 0.4248);
  }
  const mesh_collar_5 = new THREE.Mesh(
    mesh_collar_5Geometry,
    materialMap["shirt"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_collar_5.name = "Jacket collar ring";
  if (endpoint_collar_5) {
    mesh_collar_5.position.copy(endpoint_collar_5.midpoint);
    mesh_collar_5.quaternion.copy(endpoint_collar_5.quaternion);
  }
  mesh_collar_5.castShadow = options.castShadow ?? true;
  mesh_collar_5.receiveShadow = options.receiveShadow ?? true;
  mesh_collar_5.userData.sculptComponent = {"id": "collar", "name": "Jacket collar ring", "level": "meso", "role": "shell", "importance": 0.7, "confidence": 0.7, "primitive": "torus", "topologyClass": "conforming-shell", "topologyRationale": "Jacket collar ring: thin layer following the form underneath, no independent volume.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "torusTubeRatio": 0.16}, "parent": "chest", "attachment": null, "dimensions": {"width": 0.3529, "height": 0.2635, "depth": 0.0612, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.0353, 0.0894, 0.0188], "rotation": [1.5708, 0.0, 0.0], "scale": [0.3381, 0.2524, 0.4248]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}}, "material": "shirt", "materialLayers": ["shirt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "collar-fold", "kind": "contour", "description": "two small collar flaps folding outward at the neckline"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "collar", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(74, 79, 79, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-collar.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.901}}};
  node_collar_5.add(mesh_collar_5);
  meshes["collar"] = mesh_collar_5;
  colliders["collar"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["chest"] ??= [];
  destructionGroups["chest"].push(node_collar_5);

  const endpoint_head_6 = makeAttachmentEndpoint(null);
  const node_head_6 = new THREE.Group();
  node_head_6.name = "Head (face under helmet)__pivot";
  node_head_6.scale.set(1, 1, 1);
  if (endpoint_head_6) {
    node_head_6.position.copy(endpoint_head_6.start);
    node_head_6.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_head_6.position.set(-0.0824, 0.3529, 0.0);
    node_head_6.rotation.set(0.0, 0.0, 0.0);
  }
  node_head_6.userData.sculptComponent = {"id": "head", "name": "Head (face under helmet)", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Head (face under helmet): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "neck", "attachment": null, "dimensions": {"width": 0.7765, "height": 0.6353, "depth": 0.6588, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.0824, 0.3529, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.7765, 0.6353, 0.6588]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "head", "dominantAlbedo": "rgba(244, 205, 174, 1.0)", "secondaryAlbedo": "rgba(241, 203, 172, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-head.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.996}}};
  node_head_6.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["neck"] ?? root).add(node_head_6);
  nodes["head"] = node_head_6;
  const mesh_head_6Geometry = endpoint_head_6
    ? new THREE.CylinderGeometry(endpoint_head_6.endRadius, endpoint_head_6.baseRadius, endpoint_head_6.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_head_6) {
    mesh_head_6Geometry.scale(0.7765, 0.6353, 0.6588);
  }
  const mesh_head_6 = new THREE.SkinnedMesh(
    mesh_head_6Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_head_6.name = "Head (face under helmet)";
  if (endpoint_head_6) {
    mesh_head_6.position.copy(endpoint_head_6.midpoint);
    mesh_head_6.quaternion.copy(endpoint_head_6.quaternion);
  }
  mesh_head_6.castShadow = options.castShadow ?? true;
  mesh_head_6.receiveShadow = options.receiveShadow ?? true;
  mesh_head_6.userData.sculptComponent = {"id": "head", "name": "Head (face under helmet)", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Head (face under helmet): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "neck", "attachment": null, "dimensions": {"width": 0.7765, "height": 0.6353, "depth": 0.6588, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.0824, 0.3529, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.7765, 0.6353, 0.6588]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "head", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "head", "dominantAlbedo": "rgba(244, 205, 174, 1.0)", "secondaryAlbedo": "rgba(241, 203, 172, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-head.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.996}}};
  node_head_6.add(mesh_head_6);
  meshes["head"] = mesh_head_6;
  colliders["head"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["head"] ??= [];
  destructionGroups["head"].push(node_head_6);

  const endpoint_helmet_7 = makeAttachmentEndpoint(null);
  const node_helmet_7 = new THREE.Group();
  node_helmet_7.name = "Combat helmet dome (flattened top, scaled down)__pivot";
  node_helmet_7.scale.set(1, 1, 1);
  if (endpoint_helmet_7) {
    node_helmet_7.position.copy(endpoint_helmet_7.start);
    node_helmet_7.rotation.set(-0.12, 0.0, 0.0);
  } else {
    node_helmet_7.position.set(0.0118, 0.2729, 0.0);
    node_helmet_7.rotation.set(-0.12, 0.0, 0.0);
  }
  node_helmet_7.userData.sculptComponent = {"id": "helmet", "name": "Combat helmet dome (flattened top, scaled down)", "level": "macro", "role": "shell", "importance": 1.0, "confidence": 0.7, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Combat helmet dome (flattened top, scaled down): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "domed combat helmet with flared brim, open underneath", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "latheProfile": {"segments": 48, "points": [[0.499, -0.5], [0.496, -0.36], [0.488, -0.2], [0.47, -0.03], [0.435, 0.12], [0.38, 0.25], [0.31, 0.355], [0.23, 0.43], [0.14, 0.48], [0.0, 0.5]]}}, "parent": "head", "attachment": null, "dimensions": {"width": 1.0118, "height": 0.5459, "depth": 0.9129, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0118, 0.2729, 0.0], "rotation": [-0.12, 0.0, 0.0], "scale": [1.0118, 0.5459, 0.9129]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "helmet"}}, "material": "helmet", "materialLayers": ["helmet"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "brim-line", "kind": "linework", "description": "dark crease line where the dome meets the brim, ~0.55 of dome height, curving up at the front"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "helmet", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(46, 53, 52, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-helmet.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.707}}};
  node_helmet_7.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "helmet"}};
  (nodes["head"] ?? root).add(node_helmet_7);
  nodes["helmet"] = node_helmet_7;
  const mesh_helmet_7Geometry = endpoint_helmet_7
    ? new THREE.CylinderGeometry(endpoint_helmet_7.endRadius, endpoint_helmet_7.baseRadius, endpoint_helmet_7.length, 32, 12)
    : buildLatheGeometry({"segments": 48, "points": [[0.499, -0.5], [0.496, -0.36], [0.488, -0.2], [0.47, -0.03], [0.435, 0.12], [0.38, 0.25], [0.31, 0.355], [0.23, 0.43], [0.14, 0.48], [0.0, 0.5]]});
  if (!endpoint_helmet_7) {
    mesh_helmet_7Geometry.scale(1.0118, 0.5459, 0.9129);
  }
  const mesh_helmet_7 = new THREE.Mesh(
    mesh_helmet_7Geometry,
    materialMap["helmet"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_helmet_7.name = "Combat helmet dome (flattened top, scaled down)";
  if (endpoint_helmet_7) {
    mesh_helmet_7.position.copy(endpoint_helmet_7.midpoint);
    mesh_helmet_7.quaternion.copy(endpoint_helmet_7.quaternion);
  }
  mesh_helmet_7.castShadow = options.castShadow ?? true;
  mesh_helmet_7.receiveShadow = options.receiveShadow ?? true;
  mesh_helmet_7.userData.sculptComponent = {"id": "helmet", "name": "Combat helmet dome (flattened top, scaled down)", "level": "macro", "role": "shell", "importance": 1.0, "confidence": 0.7, "primitive": "lathe", "topologyClass": "continuous-sculpt", "topologyRationale": "Combat helmet dome (flattened top, scaled down): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "domed combat helmet with flared brim, open underneath", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "latheProfile": {"segments": 48, "points": [[0.499, -0.5], [0.496, -0.36], [0.488, -0.2], [0.47, -0.03], [0.435, 0.12], [0.38, 0.25], [0.31, 0.355], [0.23, 0.43], [0.14, 0.48], [0.0, 0.5]]}}, "parent": "head", "attachment": null, "dimensions": {"width": 1.0118, "height": 0.5459, "depth": 0.9129, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0118, 0.2729, 0.0], "rotation": [-0.12, 0.0, 0.0], "scale": [1.0118, 0.5459, 0.9129]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "helmet"}}, "material": "helmet", "materialLayers": ["helmet"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "brim-line", "kind": "linework", "description": "dark crease line where the dome meets the brim, ~0.55 of dome height, curving up at the front"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "helmet", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(46, 53, 52, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-helmet.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.707}}};
  node_helmet_7.add(mesh_helmet_7);
  meshes["helmet"] = mesh_helmet_7;
  colliders["helmet"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["chest"] ??= [];
  destructionGroups["chest"].push(node_helmet_7);

  const endpoint_helmet_rim_8 = makeAttachmentEndpoint(null);
  const node_helmet_rim_8 = new THREE.Group();
  node_helmet_rim_8.name = "Helmet rim ring (bottom edge)__pivot";
  node_helmet_rim_8.scale.set(1, 1, 1);
  if (endpoint_helmet_rim_8) {
    node_helmet_rim_8.position.copy(endpoint_helmet_rim_8.start);
    node_helmet_rim_8.rotation.set(1.4508, 0.0, 0.0);
  } else {
    node_helmet_rim_8.position.set(0.0118, 0.0, 0.0329);
    node_helmet_rim_8.rotation.set(1.4508, 0.0, 0.0);
  }
  node_helmet_rim_8.userData.sculptComponent = {"id": "helmet-rim", "name": "Helmet rim ring (bottom edge)", "level": "meso", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "torus", "topologyClass": "conforming-shell", "topologyRationale": "Helmet rim ring (bottom edge): thin layer following the form underneath, no independent volume.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "torusTubeRatio": 0.16}, "parent": "head", "attachment": null, "dimensions": {"width": 1.0165, "height": 0.9224, "depth": 0.0659, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0118, 0.0, 0.0329], "rotation": [1.4508, 0.0, 0.0], "scale": [0.9736, 0.8835, 0.4575]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "helmet"}}, "material": "helmet", "materialLayers": ["helmet"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "helmet-rim", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(46, 53, 52, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-helmet-rim.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.707}}};
  node_helmet_rim_8.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "helmet"}};
  (nodes["head"] ?? root).add(node_helmet_rim_8);
  nodes["helmet-rim"] = node_helmet_rim_8;
  const mesh_helmet_rim_8Geometry = endpoint_helmet_rim_8
    ? new THREE.CylinderGeometry(endpoint_helmet_rim_8.endRadius, endpoint_helmet_rim_8.baseRadius, endpoint_helmet_rim_8.length, 32, 12)
    : new THREE.TorusGeometry(0.45, 0.072, 24, 96);
  if (!endpoint_helmet_rim_8) {
    mesh_helmet_rim_8Geometry.scale(0.9736, 0.8835, 0.4575);
  }
  const mesh_helmet_rim_8 = new THREE.Mesh(
    mesh_helmet_rim_8Geometry,
    materialMap["helmet"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_helmet_rim_8.name = "Helmet rim ring (bottom edge)";
  if (endpoint_helmet_rim_8) {
    mesh_helmet_rim_8.position.copy(endpoint_helmet_rim_8.midpoint);
    mesh_helmet_rim_8.quaternion.copy(endpoint_helmet_rim_8.quaternion);
  }
  mesh_helmet_rim_8.castShadow = options.castShadow ?? true;
  mesh_helmet_rim_8.receiveShadow = options.receiveShadow ?? true;
  mesh_helmet_rim_8.userData.sculptComponent = {"id": "helmet-rim", "name": "Helmet rim ring (bottom edge)", "level": "meso", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "torus", "topologyClass": "conforming-shell", "topologyRationale": "Helmet rim ring (bottom edge): thin layer following the form underneath, no independent volume.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "torusTubeRatio": 0.16}, "parent": "head", "attachment": null, "dimensions": {"width": 1.0165, "height": 0.9224, "depth": 0.0659, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0118, 0.0, 0.0329], "rotation": [1.4508, 0.0, 0.0], "scale": [0.9736, 0.8835, 0.4575]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "helmet"}}, "material": "helmet", "materialLayers": ["helmet"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "helmet-rim", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(46, 53, 52, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-helmet-rim.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.707}}};
  node_helmet_rim_8.add(mesh_helmet_rim_8);
  meshes["helmet-rim"] = mesh_helmet_rim_8;
  colliders["helmet-rim"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["chest"] ??= [];
  destructionGroups["chest"].push(node_helmet_rim_8);

  const endpoint_helmet_rivet_9 = makeAttachmentEndpoint(null);
  const node_helmet_rivet_9 = new THREE.Group();
  node_helmet_rivet_9.name = "Helmet side rivet__pivot";
  node_helmet_rivet_9.scale.set(1, 1, 1);
  if (endpoint_helmet_rivet_9) {
    node_helmet_rivet_9.position.copy(endpoint_helmet_rivet_9.start);
    node_helmet_rivet_9.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_helmet_rivet_9.position.set(0.4471, -0.1137, 0.1569);
    node_helmet_rivet_9.rotation.set(0.0, 0.0, 0.0);
  }
  node_helmet_rivet_9.userData.sculptComponent = {"id": "helmet-rivet", "name": "Helmet side rivet", "level": "micro", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Helmet side rivet: discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "helmet", "attachment": null, "dimensions": {"width": 0.0424, "height": 0.0424, "depth": 0.0424, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.4471, -0.1137, 0.1569], "rotation": [0.0, 0.0, 0.0], "scale": [0.0424, 0.0424, 0.0424]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye"}}, "material": "eye", "materialLayers": ["eye"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "rivet-dot", "kind": "fastener", "description": "single black round rivet on the right side of the dome"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "helmet-rivet", "dominantAlbedo": "rgba(3, 5, 4, 1.0)", "secondaryAlbedo": "rgba(3, 6, 6, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-helmet-rivet.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.66}}};
  node_helmet_rivet_9.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye"}};
  (nodes["helmet"] ?? root).add(node_helmet_rivet_9);
  nodes["helmet-rivet"] = node_helmet_rivet_9;
  const mesh_helmet_rivet_9Geometry = endpoint_helmet_rivet_9
    ? new THREE.CylinderGeometry(endpoint_helmet_rivet_9.endRadius, endpoint_helmet_rivet_9.baseRadius, endpoint_helmet_rivet_9.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_helmet_rivet_9) {
    mesh_helmet_rivet_9Geometry.scale(0.0424, 0.0424, 0.0424);
  }
  const mesh_helmet_rivet_9 = new THREE.Mesh(
    mesh_helmet_rivet_9Geometry,
    materialMap["eye"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_helmet_rivet_9.name = "Helmet side rivet";
  if (endpoint_helmet_rivet_9) {
    mesh_helmet_rivet_9.position.copy(endpoint_helmet_rivet_9.midpoint);
    mesh_helmet_rivet_9.quaternion.copy(endpoint_helmet_rivet_9.quaternion);
  }
  mesh_helmet_rivet_9.castShadow = options.castShadow ?? true;
  mesh_helmet_rivet_9.receiveShadow = options.receiveShadow ?? true;
  mesh_helmet_rivet_9.userData.sculptComponent = {"id": "helmet-rivet", "name": "Helmet side rivet", "level": "micro", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Helmet side rivet: discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "helmet", "attachment": null, "dimensions": {"width": 0.0424, "height": 0.0424, "depth": 0.0424, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.4471, -0.1137, 0.1569], "rotation": [0.0, 0.0, 0.0], "scale": [0.0424, 0.0424, 0.0424]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye"}}, "material": "eye", "materialLayers": ["eye"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "rivet-dot", "kind": "fastener", "description": "single black round rivet on the right side of the dome"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "helmet-rivet", "dominantAlbedo": "rgba(3, 5, 4, 1.0)", "secondaryAlbedo": "rgba(3, 6, 6, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-helmet-rivet.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.66}}};
  node_helmet_rivet_9.add(mesh_helmet_rivet_9);
  meshes["helmet-rivet"] = mesh_helmet_rivet_9;
  colliders["helmet-rivet"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["chest"] ??= [];
  destructionGroups["chest"].push(node_helmet_rivet_9);

  const endpoint_chin_strap_10 = makeAttachmentEndpoint(null);
  const node_chin_strap_10 = new THREE.Group();
  node_chin_strap_10.name = "Black chin strap ring under the chin__pivot";
  node_chin_strap_10.scale.set(1, 1, 1);
  if (endpoint_chin_strap_10) {
    node_chin_strap_10.position.copy(endpoint_chin_strap_10.start);
    node_chin_strap_10.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_chin_strap_10.position.set(0.0, -0.0118, 0.0188);
    node_chin_strap_10.rotation.set(0.0, 0.0, 0.0);
  }
  node_chin_strap_10.userData.sculptComponent = {"id": "chin-strap", "name": "Black chin strap ring under the chin", "level": "micro", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "torus", "topologyClass": "conforming-shell", "topologyRationale": "Black chin strap ring under the chin: thin layer following the form underneath, no independent volume.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "torusTubeRatio": 0.16}, "parent": "head", "attachment": null, "dimensions": {"width": 0.8141, "height": 0.6871, "depth": 0.0329, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, -0.0118, 0.0188], "rotation": [0.0, 0.0, 0.0], "scale": [0.7798, 0.6581, 0.2288]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "strap"}}, "material": "strap", "materialLayers": ["strap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "strap-edge", "kind": "seam", "description": "dark strap running from the helmet down the cheek in front of the ear"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "chin-strap", "dominantAlbedo": "rgba(56, 61, 61, 1.0)", "secondaryAlbedo": "rgba(53, 58, 58, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-chin-strap.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.742}}};
  node_chin_strap_10.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "strap"}};
  (nodes["head"] ?? root).add(node_chin_strap_10);
  nodes["chin-strap"] = node_chin_strap_10;
  const mesh_chin_strap_10Geometry = endpoint_chin_strap_10
    ? new THREE.CylinderGeometry(endpoint_chin_strap_10.endRadius, endpoint_chin_strap_10.baseRadius, endpoint_chin_strap_10.length, 32, 12)
    : new THREE.TorusGeometry(0.45, 0.072, 24, 96);
  if (!endpoint_chin_strap_10) {
    mesh_chin_strap_10Geometry.scale(0.7798, 0.6581, 0.2288);
  }
  const mesh_chin_strap_10 = new THREE.Mesh(
    mesh_chin_strap_10Geometry,
    materialMap["strap"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_chin_strap_10.name = "Black chin strap ring under the chin";
  if (endpoint_chin_strap_10) {
    mesh_chin_strap_10.position.copy(endpoint_chin_strap_10.midpoint);
    mesh_chin_strap_10.quaternion.copy(endpoint_chin_strap_10.quaternion);
  }
  mesh_chin_strap_10.castShadow = options.castShadow ?? true;
  mesh_chin_strap_10.receiveShadow = options.receiveShadow ?? true;
  mesh_chin_strap_10.userData.sculptComponent = {"id": "chin-strap", "name": "Black chin strap ring under the chin", "level": "micro", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "torus", "topologyClass": "conforming-shell", "topologyRationale": "Black chin strap ring under the chin: thin layer following the form underneath, no independent volume.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "torusTubeRatio": 0.16}, "parent": "head", "attachment": null, "dimensions": {"width": 0.8141, "height": 0.6871, "depth": 0.0329, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, -0.0118, 0.0188], "rotation": [0.0, 0.0, 0.0], "scale": [0.7798, 0.6581, 0.2288]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "strap"}}, "material": "strap", "materialLayers": ["strap"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "strap-edge", "kind": "seam", "description": "dark strap running from the helmet down the cheek in front of the ear"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "chin-strap", "dominantAlbedo": "rgba(56, 61, 61, 1.0)", "secondaryAlbedo": "rgba(53, 58, 58, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-chin-strap.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.742}}};
  node_chin_strap_10.add(mesh_chin_strap_10);
  meshes["chin-strap"] = mesh_chin_strap_10;
  colliders["chin-strap"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["chest"] ??= [];
  destructionGroups["chest"].push(node_chin_strap_10);

  const endpoint_eye_r_11 = makeAttachmentEndpoint(null);
  const node_eye_r_11 = new THREE.Group();
  node_eye_r_11.name = "Eye (character right = viewer left)__pivot";
  node_eye_r_11.scale.set(1, 1, 1);
  if (endpoint_eye_r_11) {
    node_eye_r_11.position.copy(endpoint_eye_r_11.start);
    node_eye_r_11.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_eye_r_11.position.set(-0.1459, -0.0659, 0.2824);
    node_eye_r_11.rotation.set(0.0, 0.0, 0.0);
  }
  node_eye_r_11.userData.sculptComponent = {"id": "eye-r", "name": "Eye (character right = viewer left)", "level": "micro", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "Eye (character right = viewer left): discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": null, "dimensions": {"width": 0.1129, "height": 0.1459, "depth": 0.0706, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.1459, -0.0659, 0.2824], "rotation": [0.0, 0.0, 0.0], "scale": [0.1129, 0.1459, 0.0706]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye"}}, "material": "eye", "materialLayers": ["eye"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "eye-r", "dominantAlbedo": "rgba(5, 4, 0, 1.0)", "secondaryAlbedo": "rgba(4, 6, 10, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-eye-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.377}}};
  node_eye_r_11.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye"}};
  (nodes["head"] ?? root).add(node_eye_r_11);
  nodes["eye-r"] = node_eye_r_11;
  const mesh_eye_r_11Geometry = endpoint_eye_r_11
    ? new THREE.CylinderGeometry(endpoint_eye_r_11.endRadius, endpoint_eye_r_11.baseRadius, endpoint_eye_r_11.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_eye_r_11) {
    mesh_eye_r_11Geometry.scale(0.1129, 0.1459, 0.0706);
  }
  const mesh_eye_r_11 = new THREE.Mesh(
    mesh_eye_r_11Geometry,
    materialMap["eye"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_eye_r_11.name = "Eye (character right = viewer left)";
  if (endpoint_eye_r_11) {
    mesh_eye_r_11.position.copy(endpoint_eye_r_11.midpoint);
    mesh_eye_r_11.quaternion.copy(endpoint_eye_r_11.quaternion);
  }
  mesh_eye_r_11.castShadow = options.castShadow ?? true;
  mesh_eye_r_11.receiveShadow = options.receiveShadow ?? true;
  mesh_eye_r_11.userData.sculptComponent = {"id": "eye-r", "name": "Eye (character right = viewer left)", "level": "micro", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "Eye (character right = viewer left): discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": null, "dimensions": {"width": 0.1129, "height": 0.1459, "depth": 0.0706, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.1459, -0.0659, 0.2824], "rotation": [0.0, 0.0, 0.0], "scale": [0.1129, 0.1459, 0.0706]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye"}}, "material": "eye", "materialLayers": ["eye"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "eye-r", "dominantAlbedo": "rgba(5, 4, 0, 1.0)", "secondaryAlbedo": "rgba(4, 6, 10, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-eye-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.377}}};
  node_eye_r_11.add(mesh_eye_r_11);
  meshes["eye-r"] = mesh_eye_r_11;
  colliders["eye-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["eye-r"] ??= [];
  destructionGroups["eye-r"].push(node_eye_r_11);

  const endpoint_eye_l_12 = makeAttachmentEndpoint(null);
  const node_eye_l_12 = new THREE.Group();
  node_eye_l_12.name = "Eye (character left = viewer right)__pivot";
  node_eye_l_12.scale.set(1, 1, 1);
  if (endpoint_eye_l_12) {
    node_eye_l_12.position.copy(endpoint_eye_l_12.start);
    node_eye_l_12.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_eye_l_12.position.set(0.1459, -0.0659, 0.2824);
    node_eye_l_12.rotation.set(0.0, 0.0, 0.0);
  }
  node_eye_l_12.userData.sculptComponent = {"id": "eye-l", "name": "Eye (character left = viewer right)", "level": "micro", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "Eye (character left = viewer right): discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": null, "dimensions": {"width": 0.1129, "height": 0.1459, "depth": 0.0706, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.1459, -0.0659, 0.2824], "rotation": [0.0, 0.0, 0.0], "scale": [0.1129, 0.1459, 0.0706]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye"}}, "material": "eye", "materialLayers": ["eye"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "eye-oval", "kind": "decal", "description": "solid black vertical oval, no catchlight, no iris"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "eye-l", "dominantAlbedo": "rgba(5, 4, 0, 1.0)", "secondaryAlbedo": "rgba(4, 6, 10, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-eye-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.377}}};
  node_eye_l_12.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye"}};
  (nodes["head"] ?? root).add(node_eye_l_12);
  nodes["eye-l"] = node_eye_l_12;
  const mesh_eye_l_12Geometry = endpoint_eye_l_12
    ? new THREE.CylinderGeometry(endpoint_eye_l_12.endRadius, endpoint_eye_l_12.baseRadius, endpoint_eye_l_12.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_eye_l_12) {
    mesh_eye_l_12Geometry.scale(0.1129, 0.1459, 0.0706);
  }
  const mesh_eye_l_12 = new THREE.Mesh(
    mesh_eye_l_12Geometry,
    materialMap["eye"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_eye_l_12.name = "Eye (character left = viewer right)";
  if (endpoint_eye_l_12) {
    mesh_eye_l_12.position.copy(endpoint_eye_l_12.midpoint);
    mesh_eye_l_12.quaternion.copy(endpoint_eye_l_12.quaternion);
  }
  mesh_eye_l_12.castShadow = options.castShadow ?? true;
  mesh_eye_l_12.receiveShadow = options.receiveShadow ?? true;
  mesh_eye_l_12.userData.sculptComponent = {"id": "eye-l", "name": "Eye (character left = viewer right)", "level": "micro", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "assembled-solid", "topologyRationale": "Eye (character left = viewer right): discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": null, "dimensions": {"width": 0.1129, "height": 0.1459, "depth": 0.0706, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.1459, -0.0659, 0.2824], "rotation": [0.0, 0.0, 0.0], "scale": [0.1129, 0.1459, 0.0706]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "eye-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "eye"}}, "material": "eye", "materialLayers": ["eye"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "eye-oval", "kind": "decal", "description": "solid black vertical oval, no catchlight, no iris"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "eye-l", "dominantAlbedo": "rgba(5, 4, 0, 1.0)", "secondaryAlbedo": "rgba(4, 6, 10, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-eye-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.377}}};
  node_eye_l_12.add(mesh_eye_l_12);
  meshes["eye-l"] = mesh_eye_l_12;
  colliders["eye-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["eye-l"] ??= [];
  destructionGroups["eye-l"].push(node_eye_l_12);

  const endpoint_ear_r_13 = makeAttachmentEndpoint(null);
  const node_ear_r_13 = new THREE.Group();
  node_ear_r_13.name = "Ear sphere (character right), flush with the head__pivot";
  node_ear_r_13.scale.set(1, 1, 1);
  if (endpoint_ear_r_13) {
    node_ear_r_13.position.copy(endpoint_ear_r_13.start);
    node_ear_r_13.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_ear_r_13.position.set(-0.3482, -0.0941, 0.0);
    node_ear_r_13.rotation.set(0.0, 0.0, 0.0);
  }
  node_ear_r_13.userData.sculptComponent = {"id": "ear-r", "name": "Ear sphere (character right), flush with the head", "level": "micro", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Ear sphere (character right), flush with the head: discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": null, "dimensions": {"width": 0.1271, "height": 0.1647, "depth": 0.1176, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.3482, -0.0941, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.1271, 0.1647, 0.1176]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "ear-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "ear-r", "dominantAlbedo": "rgba(244, 205, 174, 1.0)", "secondaryAlbedo": "rgba(241, 203, 172, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-ear-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.996}}};
  node_ear_r_13.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "ear-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["head"] ?? root).add(node_ear_r_13);
  nodes["ear-r"] = node_ear_r_13;
  const mesh_ear_r_13Geometry = endpoint_ear_r_13
    ? new THREE.CylinderGeometry(endpoint_ear_r_13.endRadius, endpoint_ear_r_13.baseRadius, endpoint_ear_r_13.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_ear_r_13) {
    mesh_ear_r_13Geometry.scale(0.1271, 0.1647, 0.1176);
  }
  const mesh_ear_r_13 = new THREE.Mesh(
    mesh_ear_r_13Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_ear_r_13.name = "Ear sphere (character right), flush with the head";
  if (endpoint_ear_r_13) {
    mesh_ear_r_13.position.copy(endpoint_ear_r_13.midpoint);
    mesh_ear_r_13.quaternion.copy(endpoint_ear_r_13.quaternion);
  }
  mesh_ear_r_13.castShadow = options.castShadow ?? true;
  mesh_ear_r_13.receiveShadow = options.receiveShadow ?? true;
  mesh_ear_r_13.userData.sculptComponent = {"id": "ear-r", "name": "Ear sphere (character right), flush with the head", "level": "micro", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Ear sphere (character right), flush with the head: discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": null, "dimensions": {"width": 0.1271, "height": 0.1647, "depth": 0.1176, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.3482, -0.0941, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.1271, 0.1647, 0.1176]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "ear-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "ear-r", "dominantAlbedo": "rgba(244, 205, 174, 1.0)", "secondaryAlbedo": "rgba(241, 203, 172, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-ear-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.996}}};
  node_ear_r_13.add(mesh_ear_r_13);
  meshes["ear-r"] = mesh_ear_r_13;
  colliders["ear-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["ear-r"] ??= [];
  destructionGroups["ear-r"].push(node_ear_r_13);

  const endpoint_ear_l_14 = makeAttachmentEndpoint(null);
  const node_ear_l_14 = new THREE.Group();
  node_ear_l_14.name = "Ear sphere (character left), flush with the head__pivot";
  node_ear_l_14.scale.set(1, 1, 1);
  if (endpoint_ear_l_14) {
    node_ear_l_14.position.copy(endpoint_ear_l_14.start);
    node_ear_l_14.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_ear_l_14.position.set(0.3482, -0.0941, 0.0);
    node_ear_l_14.rotation.set(0.0, 0.0, 0.0);
  }
  node_ear_l_14.userData.sculptComponent = {"id": "ear-l", "name": "Ear sphere (character left), flush with the head", "level": "micro", "role": "detail", "importance": 0.7, "confidence": 0.5, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Ear sphere (character left), flush with the head: discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": null, "dimensions": {"width": 0.1271, "height": 0.1647, "depth": 0.1176, "units": "relative", "confidence": 0.5}, "transform": {"position": [0.3482, -0.0941, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.1271, 0.1647, 0.1176]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "ear-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "ear-l", "dominantAlbedo": "rgba(244, 205, 174, 1.0)", "secondaryAlbedo": "rgba(241, 203, 172, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-ear-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.996}}};
  node_ear_l_14.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "ear-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["head"] ?? root).add(node_ear_l_14);
  nodes["ear-l"] = node_ear_l_14;
  const mesh_ear_l_14Geometry = endpoint_ear_l_14
    ? new THREE.CylinderGeometry(endpoint_ear_l_14.endRadius, endpoint_ear_l_14.baseRadius, endpoint_ear_l_14.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_ear_l_14) {
    mesh_ear_l_14Geometry.scale(0.1271, 0.1647, 0.1176);
  }
  const mesh_ear_l_14 = new THREE.Mesh(
    mesh_ear_l_14Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_ear_l_14.name = "Ear sphere (character left), flush with the head";
  if (endpoint_ear_l_14) {
    mesh_ear_l_14.position.copy(endpoint_ear_l_14.midpoint);
    mesh_ear_l_14.quaternion.copy(endpoint_ear_l_14.quaternion);
  }
  mesh_ear_l_14.castShadow = options.castShadow ?? true;
  mesh_ear_l_14.receiveShadow = options.receiveShadow ?? true;
  mesh_ear_l_14.userData.sculptComponent = {"id": "ear-l", "name": "Ear sphere (character left), flush with the head", "level": "micro", "role": "detail", "importance": 0.7, "confidence": 0.5, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "Ear sphere (character left), flush with the head: discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "head", "attachment": null, "dimensions": {"width": 0.1271, "height": 0.1647, "depth": 0.1176, "units": "relative", "confidence": 0.5}, "transform": {"position": [0.3482, -0.0941, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.1271, 0.1647, 0.1176]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "ear-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "ear-l", "dominantAlbedo": "rgba(244, 205, 174, 1.0)", "secondaryAlbedo": "rgba(241, 203, 172, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-ear-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.996}}};
  node_ear_l_14.add(mesh_ear_l_14);
  meshes["ear-l"] = mesh_ear_l_14;
  colliders["ear-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["ear-l"] ??= [];
  destructionGroups["ear-l"].push(node_ear_l_14);

  const attachment_clavicle_r_15 = {"parentSocket": "chest-clavicle-r", "localStart": [-0.0588, 0.04, 0.0], "localEnd": [-0.2706, 0.04, 0.0], "contactType": "rigid-weld", "baseRadius": 0.0529, "endRadius": 0.045, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_clavicle_r_15 = makeAttachmentEndpoint(attachment_clavicle_r_15);
  const node_clavicle_r_15 = new THREE.Group();
  node_clavicle_r_15.name = "Shoulder (character right)__pivot";
  node_clavicle_r_15.scale.set(1, 1, 1);
  if (endpoint_clavicle_r_15) {
    node_clavicle_r_15.position.copy(endpoint_clavicle_r_15.start);
    node_clavicle_r_15.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_clavicle_r_15.position.set(-0.0588, 0.04, 0.0);
    node_clavicle_r_15.rotation.set(0.0, 0.0, 0.0);
  }
  node_clavicle_r_15.userData.sculptComponent = {"id": "clavicle-r", "name": "Shoulder (character right)", "level": "meso", "role": "support", "importance": 0.7, "confidence": 0.7, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Shoulder (character right): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "chest", "attachment": {"parentSocket": "chest-clavicle-r", "localStart": [-0.0588, 0.04, 0.0], "localEnd": [-0.2706, 0.04, 0.0], "contactType": "rigid-weld", "baseRadius": 0.0529, "endRadius": 0.045, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.2118, "height": 0.1059, "depth": 0.1412, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.0588, 0.04, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.2118, 0.1059, 0.1412]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "clavicle-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}}, "material": "shirt", "materialLayers": ["shirt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "clavicle-r", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(74, 79, 79, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-clavicle-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.901}}};
  node_clavicle_r_15.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "clavicle-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}};
  (nodes["chest"] ?? root).add(node_clavicle_r_15);
  nodes["clavicle-r"] = node_clavicle_r_15;
  const mesh_clavicle_r_15Geometry = endpoint_clavicle_r_15
    ? new THREE.CylinderGeometry(endpoint_clavicle_r_15.endRadius, endpoint_clavicle_r_15.baseRadius, endpoint_clavicle_r_15.length, 32, 12)
    : buildWatertightCapsule(0.35, 0.7, 16, 32, 1);
  if (!endpoint_clavicle_r_15) {
    mesh_clavicle_r_15Geometry.scale(0.2118, 0.1059, 0.1412);
  }
  const mesh_clavicle_r_15 = new THREE.SkinnedMesh(
    mesh_clavicle_r_15Geometry,
    materialMap["shirt"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_clavicle_r_15.name = "Shoulder (character right)";
  if (endpoint_clavicle_r_15) {
    mesh_clavicle_r_15.position.copy(endpoint_clavicle_r_15.midpoint);
    mesh_clavicle_r_15.quaternion.copy(endpoint_clavicle_r_15.quaternion);
  }
  mesh_clavicle_r_15.castShadow = options.castShadow ?? true;
  mesh_clavicle_r_15.receiveShadow = options.receiveShadow ?? true;
  mesh_clavicle_r_15.userData.sculptComponent = {"id": "clavicle-r", "name": "Shoulder (character right)", "level": "meso", "role": "support", "importance": 0.7, "confidence": 0.7, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Shoulder (character right): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "chest", "attachment": {"parentSocket": "chest-clavicle-r", "localStart": [-0.0588, 0.04, 0.0], "localEnd": [-0.2706, 0.04, 0.0], "contactType": "rigid-weld", "baseRadius": 0.0529, "endRadius": 0.045, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.2118, "height": 0.1059, "depth": 0.1412, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.0588, 0.04, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.2118, 0.1059, 0.1412]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "clavicle-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}}, "material": "shirt", "materialLayers": ["shirt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "clavicle-r", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(74, 79, 79, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-clavicle-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.901}}};
  node_clavicle_r_15.add(mesh_clavicle_r_15);
  meshes["clavicle-r"] = mesh_clavicle_r_15;
  colliders["clavicle-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["clavicle-r"] ??= [];
  destructionGroups["clavicle-r"].push(node_clavicle_r_15);

  const attachment_upper_arm_r_16 = {"parentSocket": "clavicle-shoulder-r", "localStart": [-0.2047, -0.0212, 0.0118], "localEnd": [-0.2047, -0.2282, 0.0118], "contactType": "socket-joint", "baseRadius": 0.0729, "endRadius": 0.062, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_upper_arm_r_16 = makeAttachmentEndpoint(attachment_upper_arm_r_16);
  const node_upper_arm_r_16 = new THREE.Group();
  node_upper_arm_r_16.name = "Upper arm sleeve (right)__pivot";
  node_upper_arm_r_16.scale.set(1, 1, 1);
  if (endpoint_upper_arm_r_16) {
    node_upper_arm_r_16.position.copy(endpoint_upper_arm_r_16.start);
    node_upper_arm_r_16.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_upper_arm_r_16.position.set(-0.2047, -0.0212, 0.0118);
    node_upper_arm_r_16.rotation.set(0.0, 0.0, 0.0);
  }
  node_upper_arm_r_16.userData.sculptComponent = {"id": "upper-arm-r", "name": "Upper arm sleeve (right)", "level": "meso", "role": "arm", "importance": 0.7, "confidence": 0.7, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Upper arm sleeve (right): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "clavicle-r", "attachment": {"parentSocket": "clavicle-shoulder-r", "localStart": [-0.2047, -0.0212, 0.0118], "localEnd": [-0.2047, -0.2282, 0.0118], "contactType": "socket-joint", "baseRadius": 0.0729, "endRadius": 0.062, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.1459, "height": 0.2071, "depth": 0.1459, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.2047, -0.0212, 0.0118], "rotation": [0.0, 0.0, 0.0], "scale": [0.1459, 0.2071, 0.1459]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "upper-arm-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}}, "material": "shirt", "materialLayers": ["shirt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "upper-arm-r", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(74, 79, 79, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-upper-arm-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.901}}};
  node_upper_arm_r_16.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "upper-arm-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}};
  (nodes["clavicle-r"] ?? root).add(node_upper_arm_r_16);
  nodes["upper-arm-r"] = node_upper_arm_r_16;
  const mesh_upper_arm_r_16Geometry = endpoint_upper_arm_r_16
    ? new THREE.CylinderGeometry(endpoint_upper_arm_r_16.endRadius, endpoint_upper_arm_r_16.baseRadius, endpoint_upper_arm_r_16.length, 32, 12)
    : buildWatertightCapsule(0.35, 0.7, 16, 32, 1);
  if (!endpoint_upper_arm_r_16) {
    mesh_upper_arm_r_16Geometry.scale(0.1459, 0.2071, 0.1459);
  }
  const mesh_upper_arm_r_16 = new THREE.SkinnedMesh(
    mesh_upper_arm_r_16Geometry,
    materialMap["shirt"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_upper_arm_r_16.name = "Upper arm sleeve (right)";
  if (endpoint_upper_arm_r_16) {
    mesh_upper_arm_r_16.position.copy(endpoint_upper_arm_r_16.midpoint);
    mesh_upper_arm_r_16.quaternion.copy(endpoint_upper_arm_r_16.quaternion);
  }
  mesh_upper_arm_r_16.castShadow = options.castShadow ?? true;
  mesh_upper_arm_r_16.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_arm_r_16.userData.sculptComponent = {"id": "upper-arm-r", "name": "Upper arm sleeve (right)", "level": "meso", "role": "arm", "importance": 0.7, "confidence": 0.7, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Upper arm sleeve (right): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "clavicle-r", "attachment": {"parentSocket": "clavicle-shoulder-r", "localStart": [-0.2047, -0.0212, 0.0118], "localEnd": [-0.2047, -0.2282, 0.0118], "contactType": "socket-joint", "baseRadius": 0.0729, "endRadius": 0.062, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.1459, "height": 0.2071, "depth": 0.1459, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.2047, -0.0212, 0.0118], "rotation": [0.0, 0.0, 0.0], "scale": [0.1459, 0.2071, 0.1459]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "upper-arm-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}}, "material": "shirt", "materialLayers": ["shirt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "upper-arm-r", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(74, 79, 79, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-upper-arm-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.901}}};
  node_upper_arm_r_16.add(mesh_upper_arm_r_16);
  meshes["upper-arm-r"] = mesh_upper_arm_r_16;
  colliders["upper-arm-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["upper-arm-r"] ??= [];
  destructionGroups["upper-arm-r"].push(node_upper_arm_r_16);

  const attachment_forearm_r_17 = {"parentSocket": "upper-arm-elbow-r", "localStart": [-0.0141, -0.1553, 0.0071], "localEnd": [-0.0141, -0.3341, 0.0071], "contactType": "hinge-joint", "baseRadius": 0.0635, "endRadius": 0.054, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_forearm_r_17 = makeAttachmentEndpoint(attachment_forearm_r_17);
  const node_forearm_r_17 = new THREE.Group();
  node_forearm_r_17.name = "Forearm sleeve (right)__pivot";
  node_forearm_r_17.scale.set(1, 1, 1);
  if (endpoint_forearm_r_17) {
    node_forearm_r_17.position.copy(endpoint_forearm_r_17.start);
    node_forearm_r_17.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_forearm_r_17.position.set(-0.0141, -0.1553, 0.0071);
    node_forearm_r_17.rotation.set(0.0, 0.0, 0.0);
  }
  node_forearm_r_17.userData.sculptComponent = {"id": "forearm-r", "name": "Forearm sleeve (right)", "level": "meso", "role": "arm", "importance": 0.7, "confidence": 0.7, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Forearm sleeve (right): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "upper-arm-r", "attachment": {"parentSocket": "upper-arm-elbow-r", "localStart": [-0.0141, -0.1553, 0.0071], "localEnd": [-0.0141, -0.3341, 0.0071], "contactType": "hinge-joint", "baseRadius": 0.0635, "endRadius": 0.054, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.1271, "height": 0.1788, "depth": 0.1271, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.0141, -0.1553, 0.0071], "rotation": [0.0, 0.0, 0.0], "scale": [0.1271, 0.1788, 0.1271]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "forearm-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}}, "material": "shirt", "materialLayers": ["shirt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "forearm-r", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(74, 79, 79, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-forearm-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.901}}};
  node_forearm_r_17.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "forearm-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}};
  (nodes["upper-arm-r"] ?? root).add(node_forearm_r_17);
  nodes["forearm-r"] = node_forearm_r_17;
  const mesh_forearm_r_17Geometry = endpoint_forearm_r_17
    ? new THREE.CylinderGeometry(endpoint_forearm_r_17.endRadius, endpoint_forearm_r_17.baseRadius, endpoint_forearm_r_17.length, 32, 12)
    : buildWatertightCapsule(0.35, 0.7, 16, 32, 1);
  if (!endpoint_forearm_r_17) {
    mesh_forearm_r_17Geometry.scale(0.1271, 0.1788, 0.1271);
  }
  const mesh_forearm_r_17 = new THREE.SkinnedMesh(
    mesh_forearm_r_17Geometry,
    materialMap["shirt"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_forearm_r_17.name = "Forearm sleeve (right)";
  if (endpoint_forearm_r_17) {
    mesh_forearm_r_17.position.copy(endpoint_forearm_r_17.midpoint);
    mesh_forearm_r_17.quaternion.copy(endpoint_forearm_r_17.quaternion);
  }
  mesh_forearm_r_17.castShadow = options.castShadow ?? true;
  mesh_forearm_r_17.receiveShadow = options.receiveShadow ?? true;
  mesh_forearm_r_17.userData.sculptComponent = {"id": "forearm-r", "name": "Forearm sleeve (right)", "level": "meso", "role": "arm", "importance": 0.7, "confidence": 0.7, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Forearm sleeve (right): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "upper-arm-r", "attachment": {"parentSocket": "upper-arm-elbow-r", "localStart": [-0.0141, -0.1553, 0.0071], "localEnd": [-0.0141, -0.3341, 0.0071], "contactType": "hinge-joint", "baseRadius": 0.0635, "endRadius": 0.054, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.1271, "height": 0.1788, "depth": 0.1271, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.0141, -0.1553, 0.0071], "rotation": [0.0, 0.0, 0.0], "scale": [0.1271, 0.1788, 0.1271]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "forearm-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}}, "material": "shirt", "materialLayers": ["shirt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "forearm-r", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(74, 79, 79, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-forearm-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.901}}};
  node_forearm_r_17.add(mesh_forearm_r_17);
  meshes["forearm-r"] = mesh_forearm_r_17;
  colliders["forearm-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["forearm-r"] ??= [];
  destructionGroups["forearm-r"].push(node_forearm_r_17);

  const endpoint_hand_r_18 = makeAttachmentEndpoint(null);
  const node_hand_r_18 = new THREE.Group();
  node_hand_r_18.name = "Mitten hand gripping pistol (right)__pivot";
  node_hand_r_18.scale.set(1, 1, 1);
  if (endpoint_hand_r_18) {
    node_hand_r_18.position.copy(endpoint_hand_r_18.start);
    node_hand_r_18.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_hand_r_18.position.set(-0.0094, -0.1671, 0.0094);
    node_hand_r_18.rotation.set(0.0, 0.0, 0.0);
  }
  node_hand_r_18.userData.sculptComponent = {"id": "hand-r", "name": "Mitten hand gripping pistol (right)", "level": "meso", "role": "hand", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Mitten hand gripping pistol (right): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "forearm-r", "attachment": null, "dimensions": {"width": 0.1459, "height": 0.1318, "depth": 0.1224, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.0094, -0.1671, 0.0094], "rotation": [0.0, 0.0, 0.0], "scale": [0.1459, 0.1318, 0.1224]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hand-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "hand-r", "dominantAlbedo": "rgba(244, 205, 174, 1.0)", "secondaryAlbedo": "rgba(241, 203, 172, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-hand-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.996}}};
  node_hand_r_18.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hand-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["forearm-r"] ?? root).add(node_hand_r_18);
  nodes["hand-r"] = node_hand_r_18;
  const mesh_hand_r_18Geometry = endpoint_hand_r_18
    ? new THREE.CylinderGeometry(endpoint_hand_r_18.endRadius, endpoint_hand_r_18.baseRadius, endpoint_hand_r_18.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_hand_r_18) {
    mesh_hand_r_18Geometry.scale(0.1459, 0.1318, 0.1224);
  }
  const mesh_hand_r_18 = new THREE.SkinnedMesh(
    mesh_hand_r_18Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_hand_r_18.name = "Mitten hand gripping pistol (right)";
  if (endpoint_hand_r_18) {
    mesh_hand_r_18.position.copy(endpoint_hand_r_18.midpoint);
    mesh_hand_r_18.quaternion.copy(endpoint_hand_r_18.quaternion);
  }
  mesh_hand_r_18.castShadow = options.castShadow ?? true;
  mesh_hand_r_18.receiveShadow = options.receiveShadow ?? true;
  mesh_hand_r_18.userData.sculptComponent = {"id": "hand-r", "name": "Mitten hand gripping pistol (right)", "level": "meso", "role": "hand", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Mitten hand gripping pistol (right): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "forearm-r", "attachment": null, "dimensions": {"width": 0.1459, "height": 0.1318, "depth": 0.1224, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.0094, -0.1671, 0.0094], "rotation": [0.0, 0.0, 0.0], "scale": [0.1459, 0.1318, 0.1224]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hand-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "hand-r", "dominantAlbedo": "rgba(244, 205, 174, 1.0)", "secondaryAlbedo": "rgba(241, 203, 172, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-hand-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.996}}};
  node_hand_r_18.add(mesh_hand_r_18);
  meshes["hand-r"] = mesh_hand_r_18;
  colliders["hand-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["hand-r"] ??= [];
  destructionGroups["hand-r"].push(node_hand_r_18);

  const attachment_clavicle_l_19 = {"parentSocket": "chest-clavicle-l", "localStart": [0.0588, 0.04, 0.0], "localEnd": [0.2706, 0.04, 0.0], "contactType": "rigid-weld", "baseRadius": 0.0529, "endRadius": 0.045, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_clavicle_l_19 = makeAttachmentEndpoint(attachment_clavicle_l_19);
  const node_clavicle_l_19 = new THREE.Group();
  node_clavicle_l_19.name = "Shoulder (character left)__pivot";
  node_clavicle_l_19.scale.set(1, 1, 1);
  if (endpoint_clavicle_l_19) {
    node_clavicle_l_19.position.copy(endpoint_clavicle_l_19.start);
    node_clavicle_l_19.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_clavicle_l_19.position.set(0.0588, 0.04, 0.0);
    node_clavicle_l_19.rotation.set(0.0, 0.0, 0.0);
  }
  node_clavicle_l_19.userData.sculptComponent = {"id": "clavicle-l", "name": "Shoulder (character left)", "level": "meso", "role": "support", "importance": 0.7, "confidence": 0.7, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Shoulder (character left): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "chest", "attachment": {"parentSocket": "chest-clavicle-l", "localStart": [0.0588, 0.04, 0.0], "localEnd": [0.2706, 0.04, 0.0], "contactType": "rigid-weld", "baseRadius": 0.0529, "endRadius": 0.045, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.2118, "height": 0.1059, "depth": 0.1412, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0588, 0.04, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.2118, 0.1059, 0.1412]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "clavicle-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}}, "material": "shirt", "materialLayers": ["shirt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "clavicle-l", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(74, 79, 79, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-clavicle-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.901}}};
  node_clavicle_l_19.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "clavicle-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}};
  (nodes["chest"] ?? root).add(node_clavicle_l_19);
  nodes["clavicle-l"] = node_clavicle_l_19;
  const mesh_clavicle_l_19Geometry = endpoint_clavicle_l_19
    ? new THREE.CylinderGeometry(endpoint_clavicle_l_19.endRadius, endpoint_clavicle_l_19.baseRadius, endpoint_clavicle_l_19.length, 32, 12)
    : buildWatertightCapsule(0.35, 0.7, 16, 32, 1);
  if (!endpoint_clavicle_l_19) {
    mesh_clavicle_l_19Geometry.scale(0.2118, 0.1059, 0.1412);
  }
  const mesh_clavicle_l_19 = new THREE.SkinnedMesh(
    mesh_clavicle_l_19Geometry,
    materialMap["shirt"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_clavicle_l_19.name = "Shoulder (character left)";
  if (endpoint_clavicle_l_19) {
    mesh_clavicle_l_19.position.copy(endpoint_clavicle_l_19.midpoint);
    mesh_clavicle_l_19.quaternion.copy(endpoint_clavicle_l_19.quaternion);
  }
  mesh_clavicle_l_19.castShadow = options.castShadow ?? true;
  mesh_clavicle_l_19.receiveShadow = options.receiveShadow ?? true;
  mesh_clavicle_l_19.userData.sculptComponent = {"id": "clavicle-l", "name": "Shoulder (character left)", "level": "meso", "role": "support", "importance": 0.7, "confidence": 0.7, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Shoulder (character left): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "chest", "attachment": {"parentSocket": "chest-clavicle-l", "localStart": [0.0588, 0.04, 0.0], "localEnd": [0.2706, 0.04, 0.0], "contactType": "rigid-weld", "baseRadius": 0.0529, "endRadius": 0.045, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.2118, "height": 0.1059, "depth": 0.1412, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0588, 0.04, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.2118, 0.1059, 0.1412]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "clavicle-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}}, "material": "shirt", "materialLayers": ["shirt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "clavicle-l", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(74, 79, 79, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-clavicle-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.901}}};
  node_clavicle_l_19.add(mesh_clavicle_l_19);
  meshes["clavicle-l"] = mesh_clavicle_l_19;
  colliders["clavicle-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["clavicle-l"] ??= [];
  destructionGroups["clavicle-l"].push(node_clavicle_l_19);

  const attachment_upper_arm_l_20 = {"parentSocket": "clavicle-shoulder-l", "localStart": [0.2047, -0.0212, 0.0118], "localEnd": [0.2047, -0.2282, 0.0118], "contactType": "socket-joint", "baseRadius": 0.0729, "endRadius": 0.062, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_upper_arm_l_20 = makeAttachmentEndpoint(attachment_upper_arm_l_20);
  const node_upper_arm_l_20 = new THREE.Group();
  node_upper_arm_l_20.name = "Upper arm sleeve (left)__pivot";
  node_upper_arm_l_20.scale.set(1, 1, 1);
  if (endpoint_upper_arm_l_20) {
    node_upper_arm_l_20.position.copy(endpoint_upper_arm_l_20.start);
    node_upper_arm_l_20.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_upper_arm_l_20.position.set(0.2047, -0.0212, 0.0118);
    node_upper_arm_l_20.rotation.set(0.0, 0.0, 0.0);
  }
  node_upper_arm_l_20.userData.sculptComponent = {"id": "upper-arm-l", "name": "Upper arm sleeve (left)", "level": "meso", "role": "arm", "importance": 0.7, "confidence": 0.7, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Upper arm sleeve (left): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "clavicle-l", "attachment": {"parentSocket": "clavicle-shoulder-l", "localStart": [0.2047, -0.0212, 0.0118], "localEnd": [0.2047, -0.2282, 0.0118], "contactType": "socket-joint", "baseRadius": 0.0729, "endRadius": 0.062, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.1459, "height": 0.2071, "depth": 0.1459, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.2047, -0.0212, 0.0118], "rotation": [0.0, 0.0, 0.0], "scale": [0.1459, 0.2071, 0.1459]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "upper-arm-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}}, "material": "shirt", "materialLayers": ["shirt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "upper-arm-l", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(74, 79, 79, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-upper-arm-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.901}}};
  node_upper_arm_l_20.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "upper-arm-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}};
  (nodes["clavicle-l"] ?? root).add(node_upper_arm_l_20);
  nodes["upper-arm-l"] = node_upper_arm_l_20;
  const mesh_upper_arm_l_20Geometry = endpoint_upper_arm_l_20
    ? new THREE.CylinderGeometry(endpoint_upper_arm_l_20.endRadius, endpoint_upper_arm_l_20.baseRadius, endpoint_upper_arm_l_20.length, 32, 12)
    : buildWatertightCapsule(0.35, 0.7, 16, 32, 1);
  if (!endpoint_upper_arm_l_20) {
    mesh_upper_arm_l_20Geometry.scale(0.1459, 0.2071, 0.1459);
  }
  const mesh_upper_arm_l_20 = new THREE.SkinnedMesh(
    mesh_upper_arm_l_20Geometry,
    materialMap["shirt"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_upper_arm_l_20.name = "Upper arm sleeve (left)";
  if (endpoint_upper_arm_l_20) {
    mesh_upper_arm_l_20.position.copy(endpoint_upper_arm_l_20.midpoint);
    mesh_upper_arm_l_20.quaternion.copy(endpoint_upper_arm_l_20.quaternion);
  }
  mesh_upper_arm_l_20.castShadow = options.castShadow ?? true;
  mesh_upper_arm_l_20.receiveShadow = options.receiveShadow ?? true;
  mesh_upper_arm_l_20.userData.sculptComponent = {"id": "upper-arm-l", "name": "Upper arm sleeve (left)", "level": "meso", "role": "arm", "importance": 0.7, "confidence": 0.7, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Upper arm sleeve (left): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "clavicle-l", "attachment": {"parentSocket": "clavicle-shoulder-l", "localStart": [0.2047, -0.0212, 0.0118], "localEnd": [0.2047, -0.2282, 0.0118], "contactType": "socket-joint", "baseRadius": 0.0729, "endRadius": 0.062, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.1459, "height": 0.2071, "depth": 0.1459, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.2047, -0.0212, 0.0118], "rotation": [0.0, 0.0, 0.0], "scale": [0.1459, 0.2071, 0.1459]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "upper-arm-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}}, "material": "shirt", "materialLayers": ["shirt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "upper-arm-l", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(74, 79, 79, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-upper-arm-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.901}}};
  node_upper_arm_l_20.add(mesh_upper_arm_l_20);
  meshes["upper-arm-l"] = mesh_upper_arm_l_20;
  colliders["upper-arm-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["upper-arm-l"] ??= [];
  destructionGroups["upper-arm-l"].push(node_upper_arm_l_20);

  const attachment_forearm_l_21 = {"parentSocket": "upper-arm-elbow-l", "localStart": [0.0141, -0.1553, 0.0071], "localEnd": [0.0141, -0.3341, 0.0071], "contactType": "hinge-joint", "baseRadius": 0.0635, "endRadius": 0.054, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_forearm_l_21 = makeAttachmentEndpoint(attachment_forearm_l_21);
  const node_forearm_l_21 = new THREE.Group();
  node_forearm_l_21.name = "Forearm sleeve (left)__pivot";
  node_forearm_l_21.scale.set(1, 1, 1);
  if (endpoint_forearm_l_21) {
    node_forearm_l_21.position.copy(endpoint_forearm_l_21.start);
    node_forearm_l_21.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_forearm_l_21.position.set(0.0141, -0.1553, 0.0071);
    node_forearm_l_21.rotation.set(0.0, 0.0, 0.0);
  }
  node_forearm_l_21.userData.sculptComponent = {"id": "forearm-l", "name": "Forearm sleeve (left)", "level": "meso", "role": "arm", "importance": 0.7, "confidence": 0.7, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Forearm sleeve (left): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "upper-arm-l", "attachment": {"parentSocket": "upper-arm-elbow-l", "localStart": [0.0141, -0.1553, 0.0071], "localEnd": [0.0141, -0.3341, 0.0071], "contactType": "hinge-joint", "baseRadius": 0.0635, "endRadius": 0.054, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.1271, "height": 0.1788, "depth": 0.1271, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0141, -0.1553, 0.0071], "rotation": [0.0, 0.0, 0.0], "scale": [0.1271, 0.1788, 0.1271]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "forearm-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}}, "material": "shirt", "materialLayers": ["shirt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "forearm-l", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(74, 79, 79, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-forearm-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.901}}};
  node_forearm_l_21.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "forearm-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}};
  (nodes["upper-arm-l"] ?? root).add(node_forearm_l_21);
  nodes["forearm-l"] = node_forearm_l_21;
  const mesh_forearm_l_21Geometry = endpoint_forearm_l_21
    ? new THREE.CylinderGeometry(endpoint_forearm_l_21.endRadius, endpoint_forearm_l_21.baseRadius, endpoint_forearm_l_21.length, 32, 12)
    : buildWatertightCapsule(0.35, 0.7, 16, 32, 1);
  if (!endpoint_forearm_l_21) {
    mesh_forearm_l_21Geometry.scale(0.1271, 0.1788, 0.1271);
  }
  const mesh_forearm_l_21 = new THREE.SkinnedMesh(
    mesh_forearm_l_21Geometry,
    materialMap["shirt"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_forearm_l_21.name = "Forearm sleeve (left)";
  if (endpoint_forearm_l_21) {
    mesh_forearm_l_21.position.copy(endpoint_forearm_l_21.midpoint);
    mesh_forearm_l_21.quaternion.copy(endpoint_forearm_l_21.quaternion);
  }
  mesh_forearm_l_21.castShadow = options.castShadow ?? true;
  mesh_forearm_l_21.receiveShadow = options.receiveShadow ?? true;
  mesh_forearm_l_21.userData.sculptComponent = {"id": "forearm-l", "name": "Forearm sleeve (left)", "level": "meso", "role": "arm", "importance": 0.7, "confidence": 0.7, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Forearm sleeve (left): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "upper-arm-l", "attachment": {"parentSocket": "upper-arm-elbow-l", "localStart": [0.0141, -0.1553, 0.0071], "localEnd": [0.0141, -0.3341, 0.0071], "contactType": "hinge-joint", "baseRadius": 0.0635, "endRadius": 0.054, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.1271, "height": 0.1788, "depth": 0.1271, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0141, -0.1553, 0.0071], "rotation": [0.0, 0.0, 0.0], "scale": [0.1271, 0.1788, 0.1271]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "forearm-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shirt"}}, "material": "shirt", "materialLayers": ["shirt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "forearm-l", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(74, 79, 79, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-forearm-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.901}}};
  node_forearm_l_21.add(mesh_forearm_l_21);
  meshes["forearm-l"] = mesh_forearm_l_21;
  colliders["forearm-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["forearm-l"] ??= [];
  destructionGroups["forearm-l"].push(node_forearm_l_21);

  const endpoint_hand_l_22 = makeAttachmentEndpoint(null);
  const node_hand_l_22 = new THREE.Group();
  node_hand_l_22.name = "Mitten hand (left)__pivot";
  node_hand_l_22.scale.set(1, 1, 1);
  if (endpoint_hand_l_22) {
    node_hand_l_22.position.copy(endpoint_hand_l_22.start);
    node_hand_l_22.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_hand_l_22.position.set(0.0094, -0.1671, 0.0094);
    node_hand_l_22.rotation.set(0.0, 0.0, 0.0);
  }
  node_hand_l_22.userData.sculptComponent = {"id": "hand-l", "name": "Mitten hand (left)", "level": "meso", "role": "hand", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Mitten hand (left): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "forearm-l", "attachment": null, "dimensions": {"width": 0.1459, "height": 0.1318, "depth": 0.1224, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0094, -0.1671, 0.0094], "rotation": [0.0, 0.0, 0.0], "scale": [0.1459, 0.1318, 0.1224]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hand-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "hand-l", "dominantAlbedo": "rgba(244, 205, 174, 1.0)", "secondaryAlbedo": "rgba(241, 203, 172, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-hand-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.996}}};
  node_hand_l_22.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hand-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}};
  (nodes["forearm-l"] ?? root).add(node_hand_l_22);
  nodes["hand-l"] = node_hand_l_22;
  const mesh_hand_l_22Geometry = endpoint_hand_l_22
    ? new THREE.CylinderGeometry(endpoint_hand_l_22.endRadius, endpoint_hand_l_22.baseRadius, endpoint_hand_l_22.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_hand_l_22) {
    mesh_hand_l_22Geometry.scale(0.1459, 0.1318, 0.1224);
  }
  const mesh_hand_l_22 = new THREE.SkinnedMesh(
    mesh_hand_l_22Geometry,
    materialMap["skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_hand_l_22.name = "Mitten hand (left)";
  if (endpoint_hand_l_22) {
    mesh_hand_l_22.position.copy(endpoint_hand_l_22.midpoint);
    mesh_hand_l_22.quaternion.copy(endpoint_hand_l_22.quaternion);
  }
  mesh_hand_l_22.castShadow = options.castShadow ?? true;
  mesh_hand_l_22.receiveShadow = options.receiveShadow ?? true;
  mesh_hand_l_22.userData.sculptComponent = {"id": "hand-l", "name": "Mitten hand (left)", "level": "meso", "role": "hand", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Mitten hand (left): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "forearm-l", "attachment": null, "dimensions": {"width": 0.1459, "height": 0.1318, "depth": 0.1224, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0094, -0.1671, 0.0094], "rotation": [0.0, 0.0, 0.0], "scale": [0.1459, 0.1318, 0.1224]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "hand-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "skin"}}, "material": "skin", "materialLayers": ["skin"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "hand-l", "dominantAlbedo": "rgba(244, 205, 174, 1.0)", "secondaryAlbedo": "rgba(241, 203, 172, 1.0)", "materialClass": "skin", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-hand-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.996}}};
  node_hand_l_22.add(mesh_hand_l_22);
  meshes["hand-l"] = mesh_hand_l_22;
  colliders["hand-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["hand-l"] ??= [];
  destructionGroups["hand-l"].push(node_hand_l_22);

  const endpoint_belt_23 = makeAttachmentEndpoint(null);
  const node_belt_23 = new THREE.Group();
  node_belt_23.name = "Black belt ring (thicker)__pivot";
  node_belt_23.scale.set(1, 1, 1);
  if (endpoint_belt_23) {
    node_belt_23.position.copy(endpoint_belt_23.start);
    node_belt_23.rotation.set(1.5708, 0.0, 0.0);
  } else {
    node_belt_23.position.set(0.0, 0.0941, 0.0);
    node_belt_23.rotation.set(1.5708, 0.0, 0.0);
  }
  node_belt_23.userData.sculptComponent = {"id": "belt", "name": "Black belt ring (thicker)", "level": "meso", "role": "shell", "importance": 0.7, "confidence": 0.7, "primitive": "torus", "topologyClass": "conforming-shell", "topologyRationale": "Black belt ring (thicker): thin layer following the form underneath, no independent volume.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "torusTubeRatio": 0.16}, "parent": "pelvis", "attachment": null, "dimensions": {"width": 0.5035, "height": 0.3435, "depth": 0.0894, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, 0.0941, 0.0], "rotation": [1.5708, 0.0, 0.0], "scale": [0.4823, 0.3291, 0.6209]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "belt"}}, "material": "belt", "materialLayers": ["belt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "belt", "dominantAlbedo": "rgba(4, 5, 7, 1.0)", "secondaryAlbedo": "rgba(75, 80, 80, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.776, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-belt.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.487}}};
  node_belt_23.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "belt"}};
  (nodes["pelvis"] ?? root).add(node_belt_23);
  nodes["belt"] = node_belt_23;
  const mesh_belt_23Geometry = endpoint_belt_23
    ? new THREE.CylinderGeometry(endpoint_belt_23.endRadius, endpoint_belt_23.baseRadius, endpoint_belt_23.length, 32, 12)
    : new THREE.TorusGeometry(0.45, 0.072, 24, 96);
  if (!endpoint_belt_23) {
    mesh_belt_23Geometry.scale(0.4823, 0.3291, 0.6209);
  }
  const mesh_belt_23 = new THREE.Mesh(
    mesh_belt_23Geometry,
    materialMap["belt"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_belt_23.name = "Black belt ring (thicker)";
  if (endpoint_belt_23) {
    mesh_belt_23.position.copy(endpoint_belt_23.midpoint);
    mesh_belt_23.quaternion.copy(endpoint_belt_23.quaternion);
  }
  mesh_belt_23.castShadow = options.castShadow ?? true;
  mesh_belt_23.receiveShadow = options.receiveShadow ?? true;
  mesh_belt_23.userData.sculptComponent = {"id": "belt", "name": "Black belt ring (thicker)", "level": "meso", "role": "shell", "importance": 0.7, "confidence": 0.7, "primitive": "torus", "topologyClass": "conforming-shell", "topologyRationale": "Black belt ring (thicker): thin layer following the form underneath, no independent volume.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals", "torusTubeRatio": 0.16}, "parent": "pelvis", "attachment": null, "dimensions": {"width": 0.5035, "height": 0.3435, "depth": 0.0894, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, 0.0941, 0.0], "rotation": [1.5708, 0.0, 0.0], "scale": [0.4823, 0.3291, 0.6209]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "belt"}}, "material": "belt", "materialLayers": ["belt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "belt", "dominantAlbedo": "rgba(4, 5, 7, 1.0)", "secondaryAlbedo": "rgba(75, 80, 80, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.776, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-belt.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.487}}};
  node_belt_23.add(mesh_belt_23);
  meshes["belt"] = mesh_belt_23;
  colliders["belt"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["chest"] ??= [];
  destructionGroups["chest"].push(node_belt_23);

  const endpoint_belt_buckle_24 = makeAttachmentEndpoint(null);
  const node_belt_buckle_24 = new THREE.Group();
  node_belt_buckle_24.name = "Belt buckle plate (grey)__pivot";
  node_belt_buckle_24.scale.set(1, 1, 1);
  if (endpoint_belt_buckle_24) {
    node_belt_buckle_24.position.copy(endpoint_belt_buckle_24.start);
    node_belt_buckle_24.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_belt_buckle_24.position.set(0.0, 0.0941, 0.1788);
    node_belt_buckle_24.rotation.set(0.0, 0.0, 0.0);
  }
  node_belt_buckle_24.userData.sculptComponent = {"id": "belt-buckle", "name": "Belt buckle plate (grey)", "level": "micro", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Belt buckle plate (grey): discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pelvis", "attachment": null, "dimensions": {"width": 0.0941, "height": 0.0565, "depth": 0.0329, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, 0.0941, 0.1788], "rotation": [0.0, 0.0, 0.0], "scale": [0.0941, 0.0565, 0.0329]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "buckle"}}, "material": "buckle", "materialLayers": ["buckle"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "belt-buckle", "dominantAlbedo": "rgba(74, 81, 80, 1.0)", "secondaryAlbedo": "rgba(75, 83, 81, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 1.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-belt-buckle.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.396}}};
  node_belt_buckle_24.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "buckle"}};
  (nodes["pelvis"] ?? root).add(node_belt_buckle_24);
  nodes["belt-buckle"] = node_belt_buckle_24;
  const mesh_belt_buckle_24Geometry = endpoint_belt_buckle_24
    ? new THREE.CylinderGeometry(endpoint_belt_buckle_24.endRadius, endpoint_belt_buckle_24.baseRadius, endpoint_belt_buckle_24.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_belt_buckle_24) {
    mesh_belt_buckle_24Geometry.scale(0.0941, 0.0565, 0.0329);
  }
  const mesh_belt_buckle_24 = new THREE.Mesh(
    mesh_belt_buckle_24Geometry,
    materialMap["buckle"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_belt_buckle_24.name = "Belt buckle plate (grey)";
  if (endpoint_belt_buckle_24) {
    mesh_belt_buckle_24.position.copy(endpoint_belt_buckle_24.midpoint);
    mesh_belt_buckle_24.quaternion.copy(endpoint_belt_buckle_24.quaternion);
  }
  mesh_belt_buckle_24.castShadow = options.castShadow ?? true;
  mesh_belt_buckle_24.receiveShadow = options.receiveShadow ?? true;
  mesh_belt_buckle_24.userData.sculptComponent = {"id": "belt-buckle", "name": "Belt buckle plate (grey)", "level": "micro", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Belt buckle plate (grey): discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pelvis", "attachment": null, "dimensions": {"width": 0.0941, "height": 0.0565, "depth": 0.0329, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, 0.0941, 0.1788], "rotation": [0.0, 0.0, 0.0], "scale": [0.0941, 0.0565, 0.0329]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "buckle"}}, "material": "buckle", "materialLayers": ["buckle"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "belt-buckle", "dominantAlbedo": "rgba(74, 81, 80, 1.0)", "secondaryAlbedo": "rgba(75, 83, 81, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 1.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-belt-buckle.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.396}}};
  node_belt_buckle_24.add(mesh_belt_buckle_24);
  meshes["belt-buckle"] = mesh_belt_buckle_24;
  colliders["belt-buckle"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["chest"] ??= [];
  destructionGroups["chest"].push(node_belt_buckle_24);

  const attachment_thigh_r_25 = {"parentSocket": "pelvis-hip-r", "localStart": [-0.1224, 0.0259, 0.0], "localEnd": [-0.1224, -0.1435, 0.0], "contactType": "socket-joint", "baseRadius": 0.1035, "endRadius": 0.088, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_thigh_r_25 = makeAttachmentEndpoint(attachment_thigh_r_25);
  const node_thigh_r_25 = new THREE.Group();
  node_thigh_r_25.name = "Thigh (right)__pivot";
  node_thigh_r_25.scale.set(1, 1, 1);
  if (endpoint_thigh_r_25) {
    node_thigh_r_25.position.copy(endpoint_thigh_r_25.start);
    node_thigh_r_25.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_thigh_r_25.position.set(-0.1224, 0.0259, 0.0);
    node_thigh_r_25.rotation.set(0.0, 0.0, 0.0);
  }
  node_thigh_r_25.userData.sculptComponent = {"id": "thigh-r", "name": "Thigh (right)", "level": "meso", "role": "leg", "importance": 0.7, "confidence": 0.7, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Thigh (right): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pelvis", "attachment": {"parentSocket": "pelvis-hip-r", "localStart": [-0.1224, 0.0259, 0.0], "localEnd": [-0.1224, -0.1435, 0.0], "contactType": "socket-joint", "baseRadius": 0.1035, "endRadius": 0.088, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.2071, "height": 0.1694, "depth": 0.2071, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.1224, 0.0259, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.2071, 0.1694, 0.2071]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "thigh-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pants"}}, "material": "pants", "materialLayers": ["pants"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "thigh-r", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(45, 50, 50, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-thigh-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.833}}};
  node_thigh_r_25.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "thigh-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pants"}};
  (nodes["pelvis"] ?? root).add(node_thigh_r_25);
  nodes["thigh-r"] = node_thigh_r_25;
  const mesh_thigh_r_25Geometry = endpoint_thigh_r_25
    ? new THREE.CylinderGeometry(endpoint_thigh_r_25.endRadius, endpoint_thigh_r_25.baseRadius, endpoint_thigh_r_25.length, 32, 12)
    : buildWatertightCapsule(0.35, 0.7, 16, 32, 1);
  if (!endpoint_thigh_r_25) {
    mesh_thigh_r_25Geometry.scale(0.2071, 0.1694, 0.2071);
  }
  const mesh_thigh_r_25 = new THREE.SkinnedMesh(
    mesh_thigh_r_25Geometry,
    materialMap["pants"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_thigh_r_25.name = "Thigh (right)";
  if (endpoint_thigh_r_25) {
    mesh_thigh_r_25.position.copy(endpoint_thigh_r_25.midpoint);
    mesh_thigh_r_25.quaternion.copy(endpoint_thigh_r_25.quaternion);
  }
  mesh_thigh_r_25.castShadow = options.castShadow ?? true;
  mesh_thigh_r_25.receiveShadow = options.receiveShadow ?? true;
  mesh_thigh_r_25.userData.sculptComponent = {"id": "thigh-r", "name": "Thigh (right)", "level": "meso", "role": "leg", "importance": 0.7, "confidence": 0.7, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Thigh (right): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pelvis", "attachment": {"parentSocket": "pelvis-hip-r", "localStart": [-0.1224, 0.0259, 0.0], "localEnd": [-0.1224, -0.1435, 0.0], "contactType": "socket-joint", "baseRadius": 0.1035, "endRadius": 0.088, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.2071, "height": 0.1694, "depth": 0.2071, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.1224, 0.0259, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.2071, 0.1694, 0.2071]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "thigh-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pants"}}, "material": "pants", "materialLayers": ["pants"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "thigh-r", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(45, 50, 50, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-thigh-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.833}}};
  node_thigh_r_25.add(mesh_thigh_r_25);
  meshes["thigh-r"] = mesh_thigh_r_25;
  colliders["thigh-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["thigh-r"] ??= [];
  destructionGroups["thigh-r"].push(node_thigh_r_25);

  const attachment_shin_r_26 = {"parentSocket": "thigh-knee-r", "localStart": [-0.0141, -0.1341, 0.0118], "localEnd": [-0.0141, -0.28, 0.0118], "contactType": "hinge-joint", "baseRadius": 0.0882, "endRadius": 0.075, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_shin_r_26 = makeAttachmentEndpoint(attachment_shin_r_26);
  const node_shin_r_26 = new THREE.Group();
  node_shin_r_26.name = "Shin (right)__pivot";
  node_shin_r_26.scale.set(1, 1, 1);
  if (endpoint_shin_r_26) {
    node_shin_r_26.position.copy(endpoint_shin_r_26.start);
    node_shin_r_26.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_shin_r_26.position.set(-0.0141, -0.1341, 0.0118);
    node_shin_r_26.rotation.set(0.0, 0.0, 0.0);
  }
  node_shin_r_26.userData.sculptComponent = {"id": "shin-r", "name": "Shin (right)", "level": "meso", "role": "leg", "importance": 0.7, "confidence": 0.7, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Shin (right): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "thigh-r", "attachment": {"parentSocket": "thigh-knee-r", "localStart": [-0.0141, -0.1341, 0.0118], "localEnd": [-0.0141, -0.28, 0.0118], "contactType": "hinge-joint", "baseRadius": 0.0882, "endRadius": 0.075, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.1765, "height": 0.1459, "depth": 0.1765, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.0141, -0.1341, 0.0118], "rotation": [0.0, 0.0, 0.0], "scale": [0.1765, 0.1459, 0.1765]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shin-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pants"}}, "material": "pants", "materialLayers": ["pants"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "shin-r", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(45, 50, 50, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-shin-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.833}}};
  node_shin_r_26.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shin-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pants"}};
  (nodes["thigh-r"] ?? root).add(node_shin_r_26);
  nodes["shin-r"] = node_shin_r_26;
  const mesh_shin_r_26Geometry = endpoint_shin_r_26
    ? new THREE.CylinderGeometry(endpoint_shin_r_26.endRadius, endpoint_shin_r_26.baseRadius, endpoint_shin_r_26.length, 32, 12)
    : buildWatertightCapsule(0.35, 0.7, 16, 32, 1);
  if (!endpoint_shin_r_26) {
    mesh_shin_r_26Geometry.scale(0.1765, 0.1459, 0.1765);
  }
  const mesh_shin_r_26 = new THREE.SkinnedMesh(
    mesh_shin_r_26Geometry,
    materialMap["pants"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_shin_r_26.name = "Shin (right)";
  if (endpoint_shin_r_26) {
    mesh_shin_r_26.position.copy(endpoint_shin_r_26.midpoint);
    mesh_shin_r_26.quaternion.copy(endpoint_shin_r_26.quaternion);
  }
  mesh_shin_r_26.castShadow = options.castShadow ?? true;
  mesh_shin_r_26.receiveShadow = options.receiveShadow ?? true;
  mesh_shin_r_26.userData.sculptComponent = {"id": "shin-r", "name": "Shin (right)", "level": "meso", "role": "leg", "importance": 0.7, "confidence": 0.7, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Shin (right): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "thigh-r", "attachment": {"parentSocket": "thigh-knee-r", "localStart": [-0.0141, -0.1341, 0.0118], "localEnd": [-0.0141, -0.28, 0.0118], "contactType": "hinge-joint", "baseRadius": 0.0882, "endRadius": 0.075, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.1765, "height": 0.1459, "depth": 0.1765, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.0141, -0.1341, 0.0118], "rotation": [0.0, 0.0, 0.0], "scale": [0.1765, 0.1459, 0.1765]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shin-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pants"}}, "material": "pants", "materialLayers": ["pants"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "shin-r", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(45, 50, 50, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-shin-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.833}}};
  node_shin_r_26.add(mesh_shin_r_26);
  meshes["shin-r"] = mesh_shin_r_26;
  colliders["shin-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["shin-r"] ??= [];
  destructionGroups["shin-r"].push(node_shin_r_26);

  const endpoint_foot_r_27 = makeAttachmentEndpoint(null);
  const node_foot_r_27 = new THREE.Group();
  node_foot_r_27.name = "Rounded boot (right)__pivot";
  node_foot_r_27.scale.set(1, 1, 1);
  if (endpoint_foot_r_27) {
    node_foot_r_27.position.copy(endpoint_foot_r_27.start);
    node_foot_r_27.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_foot_r_27.position.set(-0.0141, -0.1529, 0.0494);
    node_foot_r_27.rotation.set(0.0, 0.0, 0.0);
  }
  node_foot_r_27.userData.sculptComponent = {"id": "foot-r", "name": "Rounded boot (right)", "level": "meso", "role": "foot", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded boot (right): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "shin-r", "attachment": null, "dimensions": {"width": 0.2071, "height": 0.1271, "depth": 0.3059, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.0141, -0.1529, 0.0494], "rotation": [0.0, 0.0, 0.0], "scale": [0.2071, 0.1271, 0.3059]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "foot-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}}, "material": "shoes", "materialLayers": ["shoes"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "foot-r", "dominantAlbedo": "rgba(3, 4, 6, 1.0)", "secondaryAlbedo": "rgba(4, 4, 5, 1.0)", "materialClass": "rubber", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-foot-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.974}}};
  node_foot_r_27.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "foot-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}};
  (nodes["shin-r"] ?? root).add(node_foot_r_27);
  nodes["foot-r"] = node_foot_r_27;
  const mesh_foot_r_27Geometry = endpoint_foot_r_27
    ? new THREE.CylinderGeometry(endpoint_foot_r_27.endRadius, endpoint_foot_r_27.baseRadius, endpoint_foot_r_27.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_foot_r_27) {
    mesh_foot_r_27Geometry.scale(0.2071, 0.1271, 0.3059);
  }
  const mesh_foot_r_27 = new THREE.SkinnedMesh(
    mesh_foot_r_27Geometry,
    materialMap["shoes"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_foot_r_27.name = "Rounded boot (right)";
  if (endpoint_foot_r_27) {
    mesh_foot_r_27.position.copy(endpoint_foot_r_27.midpoint);
    mesh_foot_r_27.quaternion.copy(endpoint_foot_r_27.quaternion);
  }
  mesh_foot_r_27.castShadow = options.castShadow ?? true;
  mesh_foot_r_27.receiveShadow = options.receiveShadow ?? true;
  mesh_foot_r_27.userData.sculptComponent = {"id": "foot-r", "name": "Rounded boot (right)", "level": "meso", "role": "foot", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded boot (right): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "shin-r", "attachment": null, "dimensions": {"width": 0.2071, "height": 0.1271, "depth": 0.3059, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.0141, -0.1529, 0.0494], "rotation": [0.0, 0.0, 0.0], "scale": [0.2071, 0.1271, 0.3059]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "foot-r", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}}, "material": "shoes", "materialLayers": ["shoes"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "foot-r", "dominantAlbedo": "rgba(3, 4, 6, 1.0)", "secondaryAlbedo": "rgba(4, 4, 5, 1.0)", "materialClass": "rubber", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-foot-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.974}}};
  node_foot_r_27.add(mesh_foot_r_27);
  meshes["foot-r"] = mesh_foot_r_27;
  colliders["foot-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["foot-r"] ??= [];
  destructionGroups["foot-r"].push(node_foot_r_27);

  const attachment_thigh_l_28 = {"parentSocket": "pelvis-hip-l", "localStart": [0.1224, 0.0259, 0.0], "localEnd": [0.1224, -0.1435, 0.0], "contactType": "socket-joint", "baseRadius": 0.1035, "endRadius": 0.088, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_thigh_l_28 = makeAttachmentEndpoint(attachment_thigh_l_28);
  const node_thigh_l_28 = new THREE.Group();
  node_thigh_l_28.name = "Thigh (left)__pivot";
  node_thigh_l_28.scale.set(1, 1, 1);
  if (endpoint_thigh_l_28) {
    node_thigh_l_28.position.copy(endpoint_thigh_l_28.start);
    node_thigh_l_28.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_thigh_l_28.position.set(0.1224, 0.0259, 0.0);
    node_thigh_l_28.rotation.set(0.0, 0.0, 0.0);
  }
  node_thigh_l_28.userData.sculptComponent = {"id": "thigh-l", "name": "Thigh (left)", "level": "meso", "role": "leg", "importance": 0.7, "confidence": 0.7, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Thigh (left): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pelvis", "attachment": {"parentSocket": "pelvis-hip-l", "localStart": [0.1224, 0.0259, 0.0], "localEnd": [0.1224, -0.1435, 0.0], "contactType": "socket-joint", "baseRadius": 0.1035, "endRadius": 0.088, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.2071, "height": 0.1694, "depth": 0.2071, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.1224, 0.0259, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.2071, 0.1694, 0.2071]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "thigh-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pants"}}, "material": "pants", "materialLayers": ["pants"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "thigh-l", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(45, 50, 50, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-thigh-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.833}}};
  node_thigh_l_28.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "thigh-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pants"}};
  (nodes["pelvis"] ?? root).add(node_thigh_l_28);
  nodes["thigh-l"] = node_thigh_l_28;
  const mesh_thigh_l_28Geometry = endpoint_thigh_l_28
    ? new THREE.CylinderGeometry(endpoint_thigh_l_28.endRadius, endpoint_thigh_l_28.baseRadius, endpoint_thigh_l_28.length, 32, 12)
    : buildWatertightCapsule(0.35, 0.7, 16, 32, 1);
  if (!endpoint_thigh_l_28) {
    mesh_thigh_l_28Geometry.scale(0.2071, 0.1694, 0.2071);
  }
  const mesh_thigh_l_28 = new THREE.SkinnedMesh(
    mesh_thigh_l_28Geometry,
    materialMap["pants"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_thigh_l_28.name = "Thigh (left)";
  if (endpoint_thigh_l_28) {
    mesh_thigh_l_28.position.copy(endpoint_thigh_l_28.midpoint);
    mesh_thigh_l_28.quaternion.copy(endpoint_thigh_l_28.quaternion);
  }
  mesh_thigh_l_28.castShadow = options.castShadow ?? true;
  mesh_thigh_l_28.receiveShadow = options.receiveShadow ?? true;
  mesh_thigh_l_28.userData.sculptComponent = {"id": "thigh-l", "name": "Thigh (left)", "level": "meso", "role": "leg", "importance": 0.7, "confidence": 0.7, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Thigh (left): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "pelvis", "attachment": {"parentSocket": "pelvis-hip-l", "localStart": [0.1224, 0.0259, 0.0], "localEnd": [0.1224, -0.1435, 0.0], "contactType": "socket-joint", "baseRadius": 0.1035, "endRadius": 0.088, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.2071, "height": 0.1694, "depth": 0.2071, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.1224, 0.0259, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.2071, 0.1694, 0.2071]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "thigh-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pants"}}, "material": "pants", "materialLayers": ["pants"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "thigh-l", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(45, 50, 50, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-thigh-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.833}}};
  node_thigh_l_28.add(mesh_thigh_l_28);
  meshes["thigh-l"] = mesh_thigh_l_28;
  colliders["thigh-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["thigh-l"] ??= [];
  destructionGroups["thigh-l"].push(node_thigh_l_28);

  const attachment_shin_l_29 = {"parentSocket": "thigh-knee-l", "localStart": [0.0141, -0.1341, 0.0118], "localEnd": [0.0141, -0.28, 0.0118], "contactType": "hinge-joint", "baseRadius": 0.0882, "endRadius": 0.075, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_shin_l_29 = makeAttachmentEndpoint(attachment_shin_l_29);
  const node_shin_l_29 = new THREE.Group();
  node_shin_l_29.name = "Shin (left)__pivot";
  node_shin_l_29.scale.set(1, 1, 1);
  if (endpoint_shin_l_29) {
    node_shin_l_29.position.copy(endpoint_shin_l_29.start);
    node_shin_l_29.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_shin_l_29.position.set(0.0141, -0.1341, 0.0118);
    node_shin_l_29.rotation.set(0.0, 0.0, 0.0);
  }
  node_shin_l_29.userData.sculptComponent = {"id": "shin-l", "name": "Shin (left)", "level": "meso", "role": "leg", "importance": 0.7, "confidence": 0.7, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Shin (left): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "thigh-l", "attachment": {"parentSocket": "thigh-knee-l", "localStart": [0.0141, -0.1341, 0.0118], "localEnd": [0.0141, -0.28, 0.0118], "contactType": "hinge-joint", "baseRadius": 0.0882, "endRadius": 0.075, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.1765, "height": 0.1459, "depth": 0.1765, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0141, -0.1341, 0.0118], "rotation": [0.0, 0.0, 0.0], "scale": [0.1765, 0.1459, 0.1765]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shin-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pants"}}, "material": "pants", "materialLayers": ["pants"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "shin-l", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(45, 50, 50, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-shin-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.833}}};
  node_shin_l_29.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shin-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pants"}};
  (nodes["thigh-l"] ?? root).add(node_shin_l_29);
  nodes["shin-l"] = node_shin_l_29;
  const mesh_shin_l_29Geometry = endpoint_shin_l_29
    ? new THREE.CylinderGeometry(endpoint_shin_l_29.endRadius, endpoint_shin_l_29.baseRadius, endpoint_shin_l_29.length, 32, 12)
    : buildWatertightCapsule(0.35, 0.7, 16, 32, 1);
  if (!endpoint_shin_l_29) {
    mesh_shin_l_29Geometry.scale(0.1765, 0.1459, 0.1765);
  }
  const mesh_shin_l_29 = new THREE.SkinnedMesh(
    mesh_shin_l_29Geometry,
    materialMap["pants"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_shin_l_29.name = "Shin (left)";
  if (endpoint_shin_l_29) {
    mesh_shin_l_29.position.copy(endpoint_shin_l_29.midpoint);
    mesh_shin_l_29.quaternion.copy(endpoint_shin_l_29.quaternion);
  }
  mesh_shin_l_29.castShadow = options.castShadow ?? true;
  mesh_shin_l_29.receiveShadow = options.receiveShadow ?? true;
  mesh_shin_l_29.userData.sculptComponent = {"id": "shin-l", "name": "Shin (left)", "level": "meso", "role": "leg", "importance": 0.7, "confidence": 0.7, "primitive": "capsule", "topologyClass": "continuous-sculpt", "topologyRationale": "Shin (left): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "thigh-l", "attachment": {"parentSocket": "thigh-knee-l", "localStart": [0.0141, -0.1341, 0.0118], "localEnd": [0.0141, -0.28, 0.0118], "contactType": "hinge-joint", "baseRadius": 0.0882, "endRadius": 0.075, "embedDepth": 0.03, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.1765, "height": 0.1459, "depth": 0.1765, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0141, -0.1341, 0.0118], "rotation": [0.0, 0.0, 0.0], "scale": [0.1765, 0.1459, 0.1765]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shin-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pants"}}, "material": "pants", "materialLayers": ["pants"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "shin-l", "dominantAlbedo": "rgba(73, 80, 79, 1.0)", "secondaryAlbedo": "rgba(45, 50, 50, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-shin-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.833}}};
  node_shin_l_29.add(mesh_shin_l_29);
  meshes["shin-l"] = mesh_shin_l_29;
  colliders["shin-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["shin-l"] ??= [];
  destructionGroups["shin-l"].push(node_shin_l_29);

  const endpoint_foot_l_30 = makeAttachmentEndpoint(null);
  const node_foot_l_30 = new THREE.Group();
  node_foot_l_30.name = "Rounded boot (left)__pivot";
  node_foot_l_30.scale.set(1, 1, 1);
  if (endpoint_foot_l_30) {
    node_foot_l_30.position.copy(endpoint_foot_l_30.start);
    node_foot_l_30.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_foot_l_30.position.set(0.0141, -0.1529, 0.0494);
    node_foot_l_30.rotation.set(0.0, 0.0, 0.0);
  }
  node_foot_l_30.userData.sculptComponent = {"id": "foot-l", "name": "Rounded boot (left)", "level": "meso", "role": "foot", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded boot (left): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "shin-l", "attachment": null, "dimensions": {"width": 0.2071, "height": 0.1271, "depth": 0.3059, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0141, -0.1529, 0.0494], "rotation": [0.0, 0.0, 0.0], "scale": [0.2071, 0.1271, 0.3059]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "foot-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}}, "material": "shoes", "materialLayers": ["shoes"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "foot-l", "dominantAlbedo": "rgba(3, 4, 6, 1.0)", "secondaryAlbedo": "rgba(4, 4, 5, 1.0)", "materialClass": "rubber", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-foot-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.974}}};
  node_foot_l_30.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "foot-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}};
  (nodes["shin-l"] ?? root).add(node_foot_l_30);
  nodes["foot-l"] = node_foot_l_30;
  const mesh_foot_l_30Geometry = endpoint_foot_l_30
    ? new THREE.CylinderGeometry(endpoint_foot_l_30.endRadius, endpoint_foot_l_30.baseRadius, endpoint_foot_l_30.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_foot_l_30) {
    mesh_foot_l_30Geometry.scale(0.2071, 0.1271, 0.3059);
  }
  const mesh_foot_l_30 = new THREE.SkinnedMesh(
    mesh_foot_l_30Geometry,
    materialMap["shoes"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_foot_l_30.name = "Rounded boot (left)";
  if (endpoint_foot_l_30) {
    mesh_foot_l_30.position.copy(endpoint_foot_l_30.midpoint);
    mesh_foot_l_30.quaternion.copy(endpoint_foot_l_30.quaternion);
  }
  mesh_foot_l_30.castShadow = options.castShadow ?? true;
  mesh_foot_l_30.receiveShadow = options.receiveShadow ?? true;
  mesh_foot_l_30.userData.sculptComponent = {"id": "foot-l", "name": "Rounded boot (left)", "level": "meso", "role": "foot", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Rounded boot (left): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "shin-l", "attachment": null, "dimensions": {"width": 0.2071, "height": 0.1271, "depth": 0.3059, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0141, -0.1529, 0.0494], "rotation": [0.0, 0.0, 0.0], "scale": [0.2071, 0.1271, 0.3059]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "foot-l", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "shoes"}}, "material": "shoes", "materialLayers": ["shoes"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "foot-l", "dominantAlbedo": "rgba(3, 4, 6, 1.0)", "secondaryAlbedo": "rgba(4, 4, 5, 1.0)", "materialClass": "rubber", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-foot-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.974}}};
  node_foot_l_30.add(mesh_foot_l_30);
  meshes["foot-l"] = mesh_foot_l_30;
  colliders["foot-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["foot-l"] ??= [];
  destructionGroups["foot-l"].push(node_foot_l_30);

  const endpoint_backpack_31 = makeAttachmentEndpoint(null);
  const node_backpack_31 = new THREE.Group();
  node_backpack_31.name = "Red rounded backpack body__pivot";
  node_backpack_31.scale.set(1, 1, 1);
  if (endpoint_backpack_31) {
    node_backpack_31.position.copy(endpoint_backpack_31.start);
    node_backpack_31.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_backpack_31.position.set(0.2471, -0.0424, -0.2541);
    node_backpack_31.rotation.set(0.0, 0.0, 0.0);
  }
  node_backpack_31.userData.sculptComponent = {"id": "backpack", "name": "Red rounded backpack body", "level": "macro", "role": "shell", "importance": 1.0, "confidence": 0.5, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Red rounded backpack body: one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "chest", "attachment": null, "dimensions": {"width": 0.3106, "height": 0.4706, "depth": 0.2447, "units": "relative", "confidence": 0.5}, "transform": {"position": [0.2471, -0.0424, -0.2541], "rotation": [0.0, 0.0, 0.0], "scale": [0.3106, 0.4706, 0.2447]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "backpack"}}, "material": "backpack", "materialLayers": ["backpack"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "backpack", "dominantAlbedo": "rgba(138, 46, 41, 1.0)", "secondaryAlbedo": "rgba(140, 45, 42, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-backpack.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.784}}};
  node_backpack_31.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "backpack"}};
  (nodes["chest"] ?? root).add(node_backpack_31);
  nodes["backpack"] = node_backpack_31;
  const mesh_backpack_31Geometry = endpoint_backpack_31
    ? new THREE.CylinderGeometry(endpoint_backpack_31.endRadius, endpoint_backpack_31.baseRadius, endpoint_backpack_31.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_backpack_31) {
    mesh_backpack_31Geometry.scale(0.3106, 0.4706, 0.2447);
  }
  const mesh_backpack_31 = new THREE.Mesh(
    mesh_backpack_31Geometry,
    materialMap["backpack"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_backpack_31.name = "Red rounded backpack body";
  if (endpoint_backpack_31) {
    mesh_backpack_31.position.copy(endpoint_backpack_31.midpoint);
    mesh_backpack_31.quaternion.copy(endpoint_backpack_31.quaternion);
  }
  mesh_backpack_31.castShadow = options.castShadow ?? true;
  mesh_backpack_31.receiveShadow = options.receiveShadow ?? true;
  mesh_backpack_31.userData.sculptComponent = {"id": "backpack", "name": "Red rounded backpack body", "level": "macro", "role": "shell", "importance": 1.0, "confidence": 0.5, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Red rounded backpack body: one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "chest", "attachment": null, "dimensions": {"width": 0.3106, "height": 0.4706, "depth": 0.2447, "units": "relative", "confidence": 0.5}, "transform": {"position": [0.2471, -0.0424, -0.2541], "rotation": [0.0, 0.0, 0.0], "scale": [0.3106, 0.4706, 0.2447]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "backpack"}}, "material": "backpack", "materialLayers": ["backpack"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "backpack", "dominantAlbedo": "rgba(138, 46, 41, 1.0)", "secondaryAlbedo": "rgba(140, 45, 42, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-backpack.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.784}}};
  node_backpack_31.add(mesh_backpack_31);
  meshes["backpack"] = mesh_backpack_31;
  colliders["backpack"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["chest"] ??= [];
  destructionGroups["chest"].push(node_backpack_31);

  const endpoint_backpack_pocket_32 = makeAttachmentEndpoint(null);
  const node_backpack_pocket_32 = new THREE.Group();
  node_backpack_pocket_32.name = "Backpack side pocket__pivot";
  node_backpack_pocket_32.scale.set(1, 1, 1);
  if (endpoint_backpack_pocket_32) {
    node_backpack_pocket_32.position.copy(endpoint_backpack_pocket_32.start);
    node_backpack_pocket_32.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_backpack_pocket_32.position.set(0.16, -0.1365, 0.0376);
    node_backpack_pocket_32.rotation.set(0.0, 0.0, 0.0);
  }
  node_backpack_pocket_32.userData.sculptComponent = {"id": "backpack-pocket", "name": "Backpack side pocket", "level": "micro", "role": "detail", "importance": 0.7, "confidence": 0.5, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Backpack side pocket: one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "backpack", "attachment": null, "dimensions": {"width": 0.1129, "height": 0.1835, "depth": 0.1459, "units": "relative", "confidence": 0.5}, "transform": {"position": [0.16, -0.1365, 0.0376], "rotation": [0.0, 0.0, 0.0], "scale": [0.1129, 0.1835, 0.1459]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "backpack"}}, "material": "backpack", "materialLayers": ["backpack"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pocket-stitch", "kind": "stitch", "description": "darker rectangular side pocket with a rounded top edge"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "backpack-pocket", "dominantAlbedo": "rgba(138, 46, 41, 1.0)", "secondaryAlbedo": "rgba(140, 45, 42, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-backpack-pocket.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.784}}};
  node_backpack_pocket_32.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "backpack"}};
  (nodes["backpack"] ?? root).add(node_backpack_pocket_32);
  nodes["backpack-pocket"] = node_backpack_pocket_32;
  const mesh_backpack_pocket_32Geometry = endpoint_backpack_pocket_32
    ? new THREE.CylinderGeometry(endpoint_backpack_pocket_32.endRadius, endpoint_backpack_pocket_32.baseRadius, endpoint_backpack_pocket_32.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_backpack_pocket_32) {
    mesh_backpack_pocket_32Geometry.scale(0.1129, 0.1835, 0.1459);
  }
  const mesh_backpack_pocket_32 = new THREE.Mesh(
    mesh_backpack_pocket_32Geometry,
    materialMap["backpack"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_backpack_pocket_32.name = "Backpack side pocket";
  if (endpoint_backpack_pocket_32) {
    mesh_backpack_pocket_32.position.copy(endpoint_backpack_pocket_32.midpoint);
    mesh_backpack_pocket_32.quaternion.copy(endpoint_backpack_pocket_32.quaternion);
  }
  mesh_backpack_pocket_32.castShadow = options.castShadow ?? true;
  mesh_backpack_pocket_32.receiveShadow = options.receiveShadow ?? true;
  mesh_backpack_pocket_32.userData.sculptComponent = {"id": "backpack-pocket", "name": "Backpack side pocket", "level": "micro", "role": "detail", "importance": 0.7, "confidence": 0.5, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Backpack side pocket: one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "backpack", "attachment": null, "dimensions": {"width": 0.1129, "height": 0.1835, "depth": 0.1459, "units": "relative", "confidence": 0.5}, "transform": {"position": [0.16, -0.1365, 0.0376], "rotation": [0.0, 0.0, 0.0], "scale": [0.1129, 0.1835, 0.1459]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "backpack"}}, "material": "backpack", "materialLayers": ["backpack"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "pocket-stitch", "kind": "stitch", "description": "darker rectangular side pocket with a rounded top edge"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "backpack-pocket", "dominantAlbedo": "rgba(138, 46, 41, 1.0)", "secondaryAlbedo": "rgba(140, 45, 42, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-backpack-pocket.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.784}}};
  node_backpack_pocket_32.add(mesh_backpack_pocket_32);
  meshes["backpack-pocket"] = mesh_backpack_pocket_32;
  colliders["backpack-pocket"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["chest"] ??= [];
  destructionGroups["chest"].push(node_backpack_pocket_32);

  const endpoint_strap_front_r_33 = makeAttachmentEndpoint(null);
  const node_strap_front_r_33 = new THREE.Group();
  node_strap_front_r_33.name = "Strap, chest front (right)__pivot";
  node_strap_front_r_33.scale.set(1, 1, 1);
  if (endpoint_strap_front_r_33) {
    node_strap_front_r_33.position.copy(endpoint_strap_front_r_33.start);
    node_strap_front_r_33.rotation.set(0.0, 0.0, -0.1745);
  } else {
    node_strap_front_r_33.position.set(-0.1365, 0.0047, 0.1694);
    node_strap_front_r_33.rotation.set(0.0, 0.0, -0.1745);
  }
  node_strap_front_r_33.userData.sculptComponent = {"id": "strap-front-r", "name": "Strap, chest front (right)", "level": "meso", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Strap, chest front (right): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "chest", "attachment": null, "dimensions": {"width": 0.0612, "height": 0.2824, "depth": 0.0329, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.1365, 0.0047, 0.1694], "rotation": [0.0, 0.0, -0.1745], "scale": [0.0612, 0.2824, 0.0329]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "backpack"}}, "material": "backpack", "materialLayers": ["backpack"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "strap-front-r", "dominantAlbedo": "rgba(138, 46, 41, 1.0)", "secondaryAlbedo": "rgba(140, 45, 42, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-strap-front-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.784}}};
  node_strap_front_r_33.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "backpack"}};
  (nodes["chest"] ?? root).add(node_strap_front_r_33);
  nodes["strap-front-r"] = node_strap_front_r_33;
  const mesh_strap_front_r_33Geometry = endpoint_strap_front_r_33
    ? new THREE.CylinderGeometry(endpoint_strap_front_r_33.endRadius, endpoint_strap_front_r_33.baseRadius, endpoint_strap_front_r_33.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_strap_front_r_33) {
    mesh_strap_front_r_33Geometry.scale(0.0612, 0.2824, 0.0329);
  }
  const mesh_strap_front_r_33 = new THREE.Mesh(
    mesh_strap_front_r_33Geometry,
    materialMap["backpack"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_strap_front_r_33.name = "Strap, chest front (right)";
  if (endpoint_strap_front_r_33) {
    mesh_strap_front_r_33.position.copy(endpoint_strap_front_r_33.midpoint);
    mesh_strap_front_r_33.quaternion.copy(endpoint_strap_front_r_33.quaternion);
  }
  mesh_strap_front_r_33.castShadow = options.castShadow ?? true;
  mesh_strap_front_r_33.receiveShadow = options.receiveShadow ?? true;
  mesh_strap_front_r_33.userData.sculptComponent = {"id": "strap-front-r", "name": "Strap, chest front (right)", "level": "meso", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Strap, chest front (right): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "chest", "attachment": null, "dimensions": {"width": 0.0612, "height": 0.2824, "depth": 0.0329, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.1365, 0.0047, 0.1694], "rotation": [0.0, 0.0, -0.1745], "scale": [0.0612, 0.2824, 0.0329]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "backpack"}}, "material": "backpack", "materialLayers": ["backpack"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "strap-front-r", "dominantAlbedo": "rgba(138, 46, 41, 1.0)", "secondaryAlbedo": "rgba(140, 45, 42, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-strap-front-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.784}}};
  node_strap_front_r_33.add(mesh_strap_front_r_33);
  meshes["strap-front-r"] = mesh_strap_front_r_33;
  colliders["strap-front-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["chest"] ??= [];
  destructionGroups["chest"].push(node_strap_front_r_33);

  const endpoint_strap_front_l_34 = makeAttachmentEndpoint(null);
  const node_strap_front_l_34 = new THREE.Group();
  node_strap_front_l_34.name = "Strap, chest front (left)__pivot";
  node_strap_front_l_34.scale.set(1, 1, 1);
  if (endpoint_strap_front_l_34) {
    node_strap_front_l_34.position.copy(endpoint_strap_front_l_34.start);
    node_strap_front_l_34.rotation.set(0.0, 0.0, 0.1745);
  } else {
    node_strap_front_l_34.position.set(0.1365, 0.0047, 0.1694);
    node_strap_front_l_34.rotation.set(0.0, 0.0, 0.1745);
  }
  node_strap_front_l_34.userData.sculptComponent = {"id": "strap-front-l", "name": "Strap, chest front (left)", "level": "meso", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Strap, chest front (left): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "chest", "attachment": null, "dimensions": {"width": 0.0612, "height": 0.2824, "depth": 0.0329, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.1365, 0.0047, 0.1694], "rotation": [0.0, 0.0, 0.1745], "scale": [0.0612, 0.2824, 0.0329]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "backpack"}}, "material": "backpack", "materialLayers": ["backpack"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "strap-front-l", "dominantAlbedo": "rgba(138, 46, 41, 1.0)", "secondaryAlbedo": "rgba(140, 45, 42, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-strap-front-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.784}}};
  node_strap_front_l_34.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "backpack"}};
  (nodes["chest"] ?? root).add(node_strap_front_l_34);
  nodes["strap-front-l"] = node_strap_front_l_34;
  const mesh_strap_front_l_34Geometry = endpoint_strap_front_l_34
    ? new THREE.CylinderGeometry(endpoint_strap_front_l_34.endRadius, endpoint_strap_front_l_34.baseRadius, endpoint_strap_front_l_34.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_strap_front_l_34) {
    mesh_strap_front_l_34Geometry.scale(0.0612, 0.2824, 0.0329);
  }
  const mesh_strap_front_l_34 = new THREE.Mesh(
    mesh_strap_front_l_34Geometry,
    materialMap["backpack"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_strap_front_l_34.name = "Strap, chest front (left)";
  if (endpoint_strap_front_l_34) {
    mesh_strap_front_l_34.position.copy(endpoint_strap_front_l_34.midpoint);
    mesh_strap_front_l_34.quaternion.copy(endpoint_strap_front_l_34.quaternion);
  }
  mesh_strap_front_l_34.castShadow = options.castShadow ?? true;
  mesh_strap_front_l_34.receiveShadow = options.receiveShadow ?? true;
  mesh_strap_front_l_34.userData.sculptComponent = {"id": "strap-front-l", "name": "Strap, chest front (left)", "level": "meso", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Strap, chest front (left): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "chest", "attachment": null, "dimensions": {"width": 0.0612, "height": 0.2824, "depth": 0.0329, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.1365, 0.0047, 0.1694], "rotation": [0.0, 0.0, 0.1745], "scale": [0.0612, 0.2824, 0.0329]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "backpack"}}, "material": "backpack", "materialLayers": ["backpack"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "strap-front-l", "dominantAlbedo": "rgba(138, 46, 41, 1.0)", "secondaryAlbedo": "rgba(140, 45, 42, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-strap-front-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.784}}};
  node_strap_front_l_34.add(mesh_strap_front_l_34);
  meshes["strap-front-l"] = mesh_strap_front_l_34;
  colliders["strap-front-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["chest"] ??= [];
  destructionGroups["chest"].push(node_strap_front_l_34);

  const endpoint_strap_shoulder_r_35 = makeAttachmentEndpoint(null);
  const node_strap_shoulder_r_35 = new THREE.Group();
  node_strap_shoulder_r_35.name = "Strap over shoulder (right)__pivot";
  node_strap_shoulder_r_35.scale.set(1, 1, 1);
  if (endpoint_strap_shoulder_r_35) {
    node_strap_shoulder_r_35.position.copy(endpoint_strap_shoulder_r_35.start);
    node_strap_shoulder_r_35.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_strap_shoulder_r_35.position.set(-0.1365, 0.1318, 0.0);
    node_strap_shoulder_r_35.rotation.set(0.0, 0.0, 0.0);
  }
  node_strap_shoulder_r_35.userData.sculptComponent = {"id": "strap-shoulder-r", "name": "Strap over shoulder (right)", "level": "meso", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Strap over shoulder (right): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "chest", "attachment": null, "dimensions": {"width": 0.0612, "height": 0.0376, "depth": 0.3529, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.1365, 0.1318, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.0612, 0.0376, 0.3529]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "backpack"}}, "material": "backpack", "materialLayers": ["backpack"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "strap-shoulder-r", "dominantAlbedo": "rgba(138, 46, 41, 1.0)", "secondaryAlbedo": "rgba(140, 45, 42, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-strap-shoulder-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.784}}};
  node_strap_shoulder_r_35.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "backpack"}};
  (nodes["chest"] ?? root).add(node_strap_shoulder_r_35);
  nodes["strap-shoulder-r"] = node_strap_shoulder_r_35;
  const mesh_strap_shoulder_r_35Geometry = endpoint_strap_shoulder_r_35
    ? new THREE.CylinderGeometry(endpoint_strap_shoulder_r_35.endRadius, endpoint_strap_shoulder_r_35.baseRadius, endpoint_strap_shoulder_r_35.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_strap_shoulder_r_35) {
    mesh_strap_shoulder_r_35Geometry.scale(0.0612, 0.0376, 0.3529);
  }
  const mesh_strap_shoulder_r_35 = new THREE.Mesh(
    mesh_strap_shoulder_r_35Geometry,
    materialMap["backpack"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_strap_shoulder_r_35.name = "Strap over shoulder (right)";
  if (endpoint_strap_shoulder_r_35) {
    mesh_strap_shoulder_r_35.position.copy(endpoint_strap_shoulder_r_35.midpoint);
    mesh_strap_shoulder_r_35.quaternion.copy(endpoint_strap_shoulder_r_35.quaternion);
  }
  mesh_strap_shoulder_r_35.castShadow = options.castShadow ?? true;
  mesh_strap_shoulder_r_35.receiveShadow = options.receiveShadow ?? true;
  mesh_strap_shoulder_r_35.userData.sculptComponent = {"id": "strap-shoulder-r", "name": "Strap over shoulder (right)", "level": "meso", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Strap over shoulder (right): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "chest", "attachment": null, "dimensions": {"width": 0.0612, "height": 0.0376, "depth": 0.3529, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.1365, 0.1318, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.0612, 0.0376, 0.3529]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "backpack"}}, "material": "backpack", "materialLayers": ["backpack"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "strap-shoulder-r", "dominantAlbedo": "rgba(138, 46, 41, 1.0)", "secondaryAlbedo": "rgba(140, 45, 42, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-strap-shoulder-r.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.784}}};
  node_strap_shoulder_r_35.add(mesh_strap_shoulder_r_35);
  meshes["strap-shoulder-r"] = mesh_strap_shoulder_r_35;
  colliders["strap-shoulder-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["chest"] ??= [];
  destructionGroups["chest"].push(node_strap_shoulder_r_35);

  const endpoint_strap_shoulder_l_36 = makeAttachmentEndpoint(null);
  const node_strap_shoulder_l_36 = new THREE.Group();
  node_strap_shoulder_l_36.name = "Strap over shoulder (left)__pivot";
  node_strap_shoulder_l_36.scale.set(1, 1, 1);
  if (endpoint_strap_shoulder_l_36) {
    node_strap_shoulder_l_36.position.copy(endpoint_strap_shoulder_l_36.start);
    node_strap_shoulder_l_36.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_strap_shoulder_l_36.position.set(0.1365, 0.1318, 0.0);
    node_strap_shoulder_l_36.rotation.set(0.0, 0.0, 0.0);
  }
  node_strap_shoulder_l_36.userData.sculptComponent = {"id": "strap-shoulder-l", "name": "Strap over shoulder (left)", "level": "meso", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Strap over shoulder (left): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "chest", "attachment": null, "dimensions": {"width": 0.0612, "height": 0.0376, "depth": 0.3529, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.1365, 0.1318, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.0612, 0.0376, 0.3529]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "backpack"}}, "material": "backpack", "materialLayers": ["backpack"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "strap-shoulder-l", "dominantAlbedo": "rgba(138, 46, 41, 1.0)", "secondaryAlbedo": "rgba(140, 45, 42, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-strap-shoulder-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.784}}};
  node_strap_shoulder_l_36.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "backpack"}};
  (nodes["chest"] ?? root).add(node_strap_shoulder_l_36);
  nodes["strap-shoulder-l"] = node_strap_shoulder_l_36;
  const mesh_strap_shoulder_l_36Geometry = endpoint_strap_shoulder_l_36
    ? new THREE.CylinderGeometry(endpoint_strap_shoulder_l_36.endRadius, endpoint_strap_shoulder_l_36.baseRadius, endpoint_strap_shoulder_l_36.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_strap_shoulder_l_36) {
    mesh_strap_shoulder_l_36Geometry.scale(0.0612, 0.0376, 0.3529);
  }
  const mesh_strap_shoulder_l_36 = new THREE.Mesh(
    mesh_strap_shoulder_l_36Geometry,
    materialMap["backpack"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_strap_shoulder_l_36.name = "Strap over shoulder (left)";
  if (endpoint_strap_shoulder_l_36) {
    mesh_strap_shoulder_l_36.position.copy(endpoint_strap_shoulder_l_36.midpoint);
    mesh_strap_shoulder_l_36.quaternion.copy(endpoint_strap_shoulder_l_36.quaternion);
  }
  mesh_strap_shoulder_l_36.castShadow = options.castShadow ?? true;
  mesh_strap_shoulder_l_36.receiveShadow = options.receiveShadow ?? true;
  mesh_strap_shoulder_l_36.userData.sculptComponent = {"id": "strap-shoulder-l", "name": "Strap over shoulder (left)", "level": "meso", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "ellipsoid", "topologyClass": "continuous-sculpt", "topologyRationale": "Strap over shoulder (left): one smooth rounded volume (chibi stylisation), no panel breaks.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "chest", "attachment": null, "dimensions": {"width": 0.0612, "height": 0.0376, "depth": 0.3529, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.1365, 0.1318, 0.0], "rotation": [0.0, 0.0, 0.0], "scale": [0.0612, 0.0376, 0.3529]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "backpack"}}, "material": "backpack", "materialLayers": ["backpack"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "strap-shoulder-l", "dominantAlbedo": "rgba(138, 46, 41, 1.0)", "secondaryAlbedo": "rgba(140, 45, 42, 1.0)", "materialClass": "fabric", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 0.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-strap-shoulder-l.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.784}}};
  node_strap_shoulder_l_36.add(mesh_strap_shoulder_l_36);
  meshes["strap-shoulder-l"] = mesh_strap_shoulder_l_36;
  colliders["strap-shoulder-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["chest"] ??= [];
  destructionGroups["chest"].push(node_strap_shoulder_l_36);

  const endpoint_pistol_grip_37 = makeAttachmentEndpoint(null);
  const node_pistol_grip_37 = new THREE.Group();
  node_pistol_grip_37.name = "Pistol grip (centred in the right hand)__pivot";
  node_pistol_grip_37.scale.set(1, 1, 1);
  if (endpoint_pistol_grip_37) {
    node_pistol_grip_37.position.copy(endpoint_pistol_grip_37.start);
    node_pistol_grip_37.rotation.set(0.25, 0.0, 0.0);
  } else {
    node_pistol_grip_37.position.set(0.0, -0.0024, 0.0);
    node_pistol_grip_37.rotation.set(0.25, 0.0, 0.0);
  }
  node_pistol_grip_37.userData.sculptComponent = {"id": "pistol-grip", "name": "Pistol grip (centred in the right hand)", "level": "meso", "role": "tool", "importance": 0.7, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Pistol grip (centred in the right hand): discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "hand-r", "attachment": null, "dimensions": {"width": 0.0565, "height": 0.1553, "depth": 0.0612, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, -0.0024, 0.0], "rotation": [0.25, 0.0, 0.0], "scale": [0.0565, 0.1553, 0.0612]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pistol"}}, "material": "pistol", "materialLayers": ["pistol"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "pistol-grip", "dominantAlbedo": "rgba(53, 54, 56, 1.0)", "secondaryAlbedo": "rgba(51, 52, 54, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 1.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-pistol-grip.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.653}}};
  node_pistol_grip_37.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pistol"}};
  (nodes["hand-r"] ?? root).add(node_pistol_grip_37);
  nodes["pistol-grip"] = node_pistol_grip_37;
  const mesh_pistol_grip_37Geometry = endpoint_pistol_grip_37
    ? new THREE.CylinderGeometry(endpoint_pistol_grip_37.endRadius, endpoint_pistol_grip_37.baseRadius, endpoint_pistol_grip_37.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_pistol_grip_37) {
    mesh_pistol_grip_37Geometry.scale(0.0565, 0.1553, 0.0612);
  }
  const mesh_pistol_grip_37 = new THREE.Mesh(
    mesh_pistol_grip_37Geometry,
    materialMap["pistol"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pistol_grip_37.name = "Pistol grip (centred in the right hand)";
  if (endpoint_pistol_grip_37) {
    mesh_pistol_grip_37.position.copy(endpoint_pistol_grip_37.midpoint);
    mesh_pistol_grip_37.quaternion.copy(endpoint_pistol_grip_37.quaternion);
  }
  mesh_pistol_grip_37.castShadow = options.castShadow ?? true;
  mesh_pistol_grip_37.receiveShadow = options.receiveShadow ?? true;
  mesh_pistol_grip_37.userData.sculptComponent = {"id": "pistol-grip", "name": "Pistol grip (centred in the right hand)", "level": "meso", "role": "tool", "importance": 0.7, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Pistol grip (centred in the right hand): discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "hand-r", "attachment": null, "dimensions": {"width": 0.0565, "height": 0.1553, "depth": 0.0612, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, -0.0024, 0.0], "rotation": [0.25, 0.0, 0.0], "scale": [0.0565, 0.1553, 0.0612]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pistol"}}, "material": "pistol", "materialLayers": ["pistol"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "pistol-grip", "dominantAlbedo": "rgba(53, 54, 56, 1.0)", "secondaryAlbedo": "rgba(51, 52, 54, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 1.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-pistol-grip.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.653}}};
  node_pistol_grip_37.add(mesh_pistol_grip_37);
  meshes["pistol-grip"] = mesh_pistol_grip_37;
  colliders["pistol-grip"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["chest"] ??= [];
  destructionGroups["chest"].push(node_pistol_grip_37);

  const endpoint_pistol_slide_38 = makeAttachmentEndpoint(null);
  const node_pistol_slide_38 = new THREE.Group();
  node_pistol_slide_38.name = "Slim pistol slide pointing forward__pivot";
  node_pistol_slide_38.scale.set(1, 1, 1);
  if (endpoint_pistol_slide_38) {
    node_pistol_slide_38.position.copy(endpoint_pistol_slide_38.start);
    node_pistol_slide_38.rotation.set(0.12, 0.0, 0.0);
  } else {
    node_pistol_slide_38.position.set(0.0, 0.0871, 0.1035);
    node_pistol_slide_38.rotation.set(0.12, 0.0, 0.0);
  }
  node_pistol_slide_38.userData.sculptComponent = {"id": "pistol-slide", "name": "Slim pistol slide pointing forward", "level": "meso", "role": "tool", "importance": 0.7, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Slim pistol slide pointing forward: discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "hand-r", "attachment": null, "dimensions": {"width": 0.0565, "height": 0.0565, "depth": 0.3529, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, 0.0871, 0.1035], "rotation": [0.12, 0.0, 0.0], "scale": [0.0565, 0.0565, 0.3529]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pistol"}}, "material": "pistol", "materialLayers": ["pistol"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "slide-groove", "kind": "groove", "description": "lighter highlight edge along the top of the slide"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "pistol-slide", "dominantAlbedo": "rgba(53, 54, 56, 1.0)", "secondaryAlbedo": "rgba(51, 52, 54, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 1.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-pistol-slide.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.653}}};
  node_pistol_slide_38.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pistol"}};
  (nodes["hand-r"] ?? root).add(node_pistol_slide_38);
  nodes["pistol-slide"] = node_pistol_slide_38;
  const mesh_pistol_slide_38Geometry = endpoint_pistol_slide_38
    ? new THREE.CylinderGeometry(endpoint_pistol_slide_38.endRadius, endpoint_pistol_slide_38.baseRadius, endpoint_pistol_slide_38.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_pistol_slide_38) {
    mesh_pistol_slide_38Geometry.scale(0.0565, 0.0565, 0.3529);
  }
  const mesh_pistol_slide_38 = new THREE.Mesh(
    mesh_pistol_slide_38Geometry,
    materialMap["pistol"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pistol_slide_38.name = "Slim pistol slide pointing forward";
  if (endpoint_pistol_slide_38) {
    mesh_pistol_slide_38.position.copy(endpoint_pistol_slide_38.midpoint);
    mesh_pistol_slide_38.quaternion.copy(endpoint_pistol_slide_38.quaternion);
  }
  mesh_pistol_slide_38.castShadow = options.castShadow ?? true;
  mesh_pistol_slide_38.receiveShadow = options.receiveShadow ?? true;
  mesh_pistol_slide_38.userData.sculptComponent = {"id": "pistol-slide", "name": "Slim pistol slide pointing forward", "level": "meso", "role": "tool", "importance": 0.7, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Slim pistol slide pointing forward: discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "hand-r", "attachment": null, "dimensions": {"width": 0.0565, "height": 0.0565, "depth": 0.3529, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, 0.0871, 0.1035], "rotation": [0.12, 0.0, 0.0], "scale": [0.0565, 0.0565, 0.3529]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pistol"}}, "material": "pistol", "materialLayers": ["pistol"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "slide-groove", "kind": "groove", "description": "lighter highlight edge along the top of the slide"}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "pistol-slide", "dominantAlbedo": "rgba(53, 54, 56, 1.0)", "secondaryAlbedo": "rgba(51, 52, 54, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 1.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-pistol-slide.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.653}}};
  node_pistol_slide_38.add(mesh_pistol_slide_38);
  meshes["pistol-slide"] = mesh_pistol_slide_38;
  colliders["pistol-slide"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["chest"] ??= [];
  destructionGroups["chest"].push(node_pistol_slide_38);

  const endpoint_pistol_barrel_39 = makeAttachmentEndpoint(null);
  const node_pistol_barrel_39 = new THREE.Group();
  node_pistol_barrel_39.name = "Barrel tip__pivot";
  node_pistol_barrel_39.scale.set(1, 1, 1);
  if (endpoint_pistol_barrel_39) {
    node_pistol_barrel_39.position.copy(endpoint_pistol_barrel_39.start);
    node_pistol_barrel_39.rotation.set(0.12, 0.0, 0.0);
  } else {
    node_pistol_barrel_39.position.set(0.0, 0.0776, 0.2965);
    node_pistol_barrel_39.rotation.set(0.12, 0.0, 0.0);
  }
  node_pistol_barrel_39.userData.sculptComponent = {"id": "pistol-barrel", "name": "Barrel tip", "level": "micro", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Barrel tip: discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "hand-r", "attachment": null, "dimensions": {"width": 0.0282, "height": 0.0282, "depth": 0.0471, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, 0.0776, 0.2965], "rotation": [0.12, 0.0, 0.0], "scale": [0.0282, 0.0282, 0.0471]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pistol"}}, "material": "pistol", "materialLayers": ["pistol"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "pistol-barrel", "dominantAlbedo": "rgba(53, 54, 56, 1.0)", "secondaryAlbedo": "rgba(51, 52, 54, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 1.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-pistol-barrel.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.653}}};
  node_pistol_barrel_39.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pistol"}};
  (nodes["hand-r"] ?? root).add(node_pistol_barrel_39);
  nodes["pistol-barrel"] = node_pistol_barrel_39;
  const mesh_pistol_barrel_39Geometry = endpoint_pistol_barrel_39
    ? new THREE.CylinderGeometry(endpoint_pistol_barrel_39.endRadius, endpoint_pistol_barrel_39.baseRadius, endpoint_pistol_barrel_39.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_pistol_barrel_39) {
    mesh_pistol_barrel_39Geometry.scale(0.0282, 0.0282, 0.0471);
  }
  const mesh_pistol_barrel_39 = new THREE.Mesh(
    mesh_pistol_barrel_39Geometry,
    materialMap["pistol"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pistol_barrel_39.name = "Barrel tip";
  if (endpoint_pistol_barrel_39) {
    mesh_pistol_barrel_39.position.copy(endpoint_pistol_barrel_39.midpoint);
    mesh_pistol_barrel_39.quaternion.copy(endpoint_pistol_barrel_39.quaternion);
  }
  mesh_pistol_barrel_39.castShadow = options.castShadow ?? true;
  mesh_pistol_barrel_39.receiveShadow = options.receiveShadow ?? true;
  mesh_pistol_barrel_39.userData.sculptComponent = {"id": "pistol-barrel", "name": "Barrel tip", "level": "micro", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Barrel tip: discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "hand-r", "attachment": null, "dimensions": {"width": 0.0282, "height": 0.0282, "depth": 0.0471, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, 0.0776, 0.2965], "rotation": [0.12, 0.0, 0.0], "scale": [0.0282, 0.0282, 0.0471]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pistol"}}, "material": "pistol", "materialLayers": ["pistol"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "pistol-barrel", "dominantAlbedo": "rgba(53, 54, 56, 1.0)", "secondaryAlbedo": "rgba(51, 52, 54, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 1.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-pistol-barrel.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.653}}};
  node_pistol_barrel_39.add(mesh_pistol_barrel_39);
  meshes["pistol-barrel"] = mesh_pistol_barrel_39;
  colliders["pistol-barrel"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["chest"] ??= [];
  destructionGroups["chest"].push(node_pistol_barrel_39);

  const endpoint_pistol_sight_40 = makeAttachmentEndpoint(null);
  const node_pistol_sight_40 = new THREE.Group();
  node_pistol_sight_40.name = "Rear sight__pivot";
  node_pistol_sight_40.scale.set(1, 1, 1);
  if (endpoint_pistol_sight_40) {
    node_pistol_sight_40.position.copy(endpoint_pistol_sight_40.start);
    node_pistol_sight_40.rotation.set(0.12, 0.0, 0.0);
  } else {
    node_pistol_sight_40.position.set(0.0, 0.1224, -0.0471);
    node_pistol_sight_40.rotation.set(0.12, 0.0, 0.0);
  }
  node_pistol_sight_40.userData.sculptComponent = {"id": "pistol-sight", "name": "Rear sight", "level": "micro", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rear sight: discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "hand-r", "attachment": null, "dimensions": {"width": 0.0188, "height": 0.0188, "depth": 0.0188, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, 0.1224, -0.0471], "rotation": [0.12, 0.0, 0.0], "scale": [0.0188, 0.0188, 0.0188]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pistol"}}, "material": "pistol", "materialLayers": ["pistol"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "pistol-sight", "dominantAlbedo": "rgba(53, 54, 56, 1.0)", "secondaryAlbedo": "rgba(51, 52, 54, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 1.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-pistol-sight.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.653}}};
  node_pistol_sight_40.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pistol"}};
  (nodes["hand-r"] ?? root).add(node_pistol_sight_40);
  nodes["pistol-sight"] = node_pistol_sight_40;
  const mesh_pistol_sight_40Geometry = endpoint_pistol_sight_40
    ? new THREE.CylinderGeometry(endpoint_pistol_sight_40.endRadius, endpoint_pistol_sight_40.baseRadius, endpoint_pistol_sight_40.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_pistol_sight_40) {
    mesh_pistol_sight_40Geometry.scale(0.0188, 0.0188, 0.0188);
  }
  const mesh_pistol_sight_40 = new THREE.Mesh(
    mesh_pistol_sight_40Geometry,
    materialMap["pistol"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pistol_sight_40.name = "Rear sight";
  if (endpoint_pistol_sight_40) {
    mesh_pistol_sight_40.position.copy(endpoint_pistol_sight_40.midpoint);
    mesh_pistol_sight_40.quaternion.copy(endpoint_pistol_sight_40.quaternion);
  }
  mesh_pistol_sight_40.castShadow = options.castShadow ?? true;
  mesh_pistol_sight_40.receiveShadow = options.receiveShadow ?? true;
  mesh_pistol_sight_40.userData.sculptComponent = {"id": "pistol-sight", "name": "Rear sight", "level": "micro", "role": "detail", "importance": 0.7, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Rear sight: discrete rigid part with simple faces, correctly built from a primitive.", "geometryDescriptor": {"topologyIntent": "stylized character part", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "smooth vertex normals"}, "parent": "hand-r", "attachment": null, "dimensions": {"width": 0.0188, "height": 0.0188, "depth": 0.0188, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.0, 0.1224, -0.0471], "rotation": [0.12, 0.0, 0.0], "scale": [0.0188, 0.0188, 0.0188]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "chest", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "pistol"}}, "material": "pistol", "materialLayers": ["pistol"], "deformations": [], "joints": [], "seams": [], "localFeatures": [], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"componentId": "pistol-sight", "dominantAlbedo": "rgba(53, 54, 56, 1.0)", "secondaryAlbedo": "rgba(51, 52, 54, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.6, "roughnessEstimate": 0.87, "metalnessEstimate": 1.0, "highlightEvidence": "broad, gradually-fading highlight — supports high roughness/diffuse response", "sourceCropPath": "/Users/sonubodat/Desktop/MyWebsite/trying/imgtothreejs/12345/evidence/crops/part-pistol-sight.png", "labClusterMeta": {"clusterCount": 3, "dominantClusterSharePct": 0.653}}};
  node_pistol_sight_40.add(mesh_pistol_sight_40);
  meshes["pistol-sight"] = mesh_pistol_sight_40;
  colliders["pistol-sight"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["chest"] ??= [];
  destructionGroups["chest"].push(node_pistol_sight_40);

  // PLAN_1.5 WS-C slice 1: bone hierarchy from spec.rig. Model-space joints are
  // converted to parent-local offsets here. Nothing is bound yet (rig.bound === false).
  const bones: Record<string, THREE.Bone> = {};
  const boneOrder: string[] = [];
  const bone_pelvis = new THREE.Bone();
  bone_pelvis.name = "pelvis";
  bone_pelvis.position.set(0.0, -0.0518, 0.0);
  root.add(bone_pelvis);
  bones["pelvis"] = bone_pelvis;
  boneOrder.push("pelvis");
  const bone_abdomen = new THREE.Bone();
  bone_abdomen.name = "abdomen";
  bone_abdomen.position.set(0.0, 0.1459, 0.0);
  bone_pelvis.add(bone_abdomen);
  bones["abdomen"] = bone_abdomen;
  boneOrder.push("abdomen");
  const bone_chest = new THREE.Bone();
  bone_chest.name = "chest";
  bone_chest.position.set(0.0, 0.13879999999999998, 0.0);
  bone_abdomen.add(bone_chest);
  bones["chest"] = bone_chest;
  boneOrder.push("chest");
  const bone_clavicle_l = new THREE.Bone();
  bone_clavicle_l.name = "clavicle-l";
  bone_clavicle_l.position.set(0.0588, 0.1789, 0.0);
  bone_chest.add(bone_clavicle_l);
  bones["clavicle-l"] = bone_clavicle_l;
  boneOrder.push("clavicle-l");
  const bone_clavicle_r = new THREE.Bone();
  bone_clavicle_r.name = "clavicle-r";
  bone_clavicle_r.position.set(-0.0588, 0.1789, 0.0);
  bone_chest.add(bone_clavicle_r);
  bones["clavicle-r"] = bone_clavicle_r;
  boneOrder.push("clavicle-r");
  const bone_thigh_l = new THREE.Bone();
  bone_thigh_l.name = "thigh-l";
  bone_thigh_l.position.set(0.1224, 0.10830000000000001, 0.0);
  bone_pelvis.add(bone_thigh_l);
  bones["thigh-l"] = bone_thigh_l;
  boneOrder.push("thigh-l");
  const bone_shin_l = new THREE.Bone();
  bone_shin_l.name = "shin-l";
  bone_shin_l.position.set(0.014100000000000015, -0.1341, 0.0118);
  bone_thigh_l.add(bone_shin_l);
  bones["shin-l"] = bone_shin_l;
  boneOrder.push("shin-l");
  const bone_foot_l = new THREE.Bone();
  bone_foot_l.name = "foot-l";
  bone_foot_l.position.set(0.014100000000000001, -0.0895, -0.0271);
  bone_shin_l.add(bone_foot_l);
  bones["foot-l"] = bone_foot_l;
  boneOrder.push("foot-l");
  const bone_thigh_r = new THREE.Bone();
  bone_thigh_r.name = "thigh-r";
  bone_thigh_r.position.set(-0.1224, 0.10830000000000001, 0.0);
  bone_pelvis.add(bone_thigh_r);
  bones["thigh-r"] = bone_thigh_r;
  boneOrder.push("thigh-r");
  const bone_shin_r = new THREE.Bone();
  bone_shin_r.name = "shin-r";
  bone_shin_r.position.set(-0.014100000000000015, -0.1341, 0.0118);
  bone_thigh_r.add(bone_shin_r);
  bones["shin-r"] = bone_shin_r;
  boneOrder.push("shin-r");
  const bone_foot_r = new THREE.Bone();
  bone_foot_r.name = "foot-r";
  bone_foot_r.position.set(-0.014100000000000001, -0.0895, -0.0271);
  bone_shin_r.add(bone_foot_r);
  bones["foot-r"] = bone_foot_r;
  boneOrder.push("foot-r");
  const bone_upper_arm_l = new THREE.Bone();
  bone_upper_arm_l.name = "upper-arm-l";
  bone_upper_arm_l.position.set(0.20470000000000002, -0.021199999999999997, 0.0118);
  bone_clavicle_l.add(bone_upper_arm_l);
  bones["upper-arm-l"] = bone_upper_arm_l;
  boneOrder.push("upper-arm-l");
  const bone_forearm_l = new THREE.Bone();
  bone_forearm_l.name = "forearm-l";
  bone_forearm_l.position.set(0.014100000000000001, -0.1553, 0.007000000000000001);
  bone_upper_arm_l.add(bone_forearm_l);
  bones["forearm-l"] = bone_forearm_l;
  boneOrder.push("forearm-l");
  const bone_upper_arm_r = new THREE.Bone();
  bone_upper_arm_r.name = "upper-arm-r";
  bone_upper_arm_r.position.set(-0.20470000000000002, -0.021199999999999997, 0.0118);
  bone_clavicle_r.add(bone_upper_arm_r);
  bones["upper-arm-r"] = bone_upper_arm_r;
  boneOrder.push("upper-arm-r");
  const bone_forearm_r = new THREE.Bone();
  bone_forearm_r.name = "forearm-r";
  bone_forearm_r.position.set(-0.014100000000000001, -0.1553, 0.007000000000000001);
  bone_upper_arm_r.add(bone_forearm_r);
  bones["forearm-r"] = bone_forearm_r;
  boneOrder.push("forearm-r");
  const bone_hand_l = new THREE.Bone();
  bone_hand_l.name = "hand-l";
  bone_hand_l.position.set(0.009500000000000008, -0.10120000000000001, 0.009399999999999999);
  bone_forearm_l.add(bone_hand_l);
  bones["hand-l"] = bone_hand_l;
  boneOrder.push("hand-l");
  const bone_hand_r = new THREE.Bone();
  bone_hand_r.name = "hand-r";
  bone_hand_r.position.set(-0.009500000000000008, -0.10120000000000001, 0.009399999999999999);
  bone_forearm_r.add(bone_hand_r);
  bones["hand-r"] = bone_hand_r;
  boneOrder.push("hand-r");
  const bone_neck = new THREE.Bone();
  bone_neck.name = "neck";
  bone_neck.position.set(-0.0353, 0.193, 0.0);
  bone_chest.add(bone_neck);
  bones["neck"] = bone_neck;
  boneOrder.push("neck");
  const bone_head = new THREE.Bone();
  bone_head.name = "head";
  bone_head.position.set(-0.0823, 0.10349999999999998, 0.0);
  bone_neck.add(bone_head);
  bones["head"] = bone_head;
  boneOrder.push("head");
  // The bones are now in REST position. updateMatrixWorld() before constructing the
  // Skeleton is load-bearing: calculateInverses() reads each bone's CURRENT world matrix,
  // and those inverses are what cancel the rest pose during skinning. Constructed before
  // this call it captures identity matrices, the rest pose never cancels, and every
  // vertex is displaced by its bone's offset at rest. Measured, not assumed --
  // scratchpad/bind_experiment.mjs read (0, 3, 0) for a vertex authored at (0, 2, 0).
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(boneOrder.map((id) => bones[id]));
  const boneIndexOf = new Map<string, number>(boneOrder.map((id, i) => [id, i]));

  // ---- PLAN_1.5 §4 weight function: ONE function over the complete bone set. No
  // mesh-id or vertex-index branching -- only positions, segment endpoints and the
  // envelope radius derived per §4.3. Ported from forge/stage5_rig/emit_rig.py, which
  // measured max |sum(w) - 1| = 2.98e-8 on executed geometry.
  const BONE_JOINT: Record<string, number[]> = {"pelvis": [0.0, -0.0518, 0.0], "abdomen": [0.0, 0.0941, 0.0], "chest": [0.0, 0.2329, 0.0], "clavicle-l": [0.0588, 0.4118, 0.0], "clavicle-r": [-0.0588, 0.4118, 0.0], "thigh-l": [0.1224, 0.0565, 0.0], "shin-l": [0.1365, -0.0776, 0.0118], "foot-l": [0.1506, -0.1671, -0.0153], "thigh-r": [-0.1224, 0.0565, 0.0], "shin-r": [-0.1365, -0.0776, 0.0118], "foot-r": [-0.1506, -0.1671, -0.0153], "upper-arm-l": [0.2635, 0.3906, 0.0118], "forearm-l": [0.2776, 0.2353, 0.0188], "upper-arm-r": [-0.2635, 0.3906, 0.0118], "forearm-r": [-0.2776, 0.2353, 0.0188], "hand-l": [0.2871, 0.1341, 0.0282], "hand-r": [-0.2871, 0.1341, 0.0282], "neck": [-0.0353, 0.4259, 0.0], "head": [-0.1176, 0.5294, 0.0]};
  const BONE_TIP: Record<string, number[]> = {"pelvis": [0.0, 0.1129, 0.0], "abdomen": [0.0, 0.2824, 0.0], "chest": [0.0, 0.5106, 0.0], "clavicle-l": [0.2706, 0.4118, 0.0], "clavicle-r": [-0.2706, 0.4118, 0.0], "thigh-l": [0.1224, -0.1129, 0.0], "shin-l": [0.1365, -0.2235, 0.0118], "foot-l": [0.1506, -0.2941, 0.1631], "thigh-r": [-0.1224, -0.1129, 0.0], "shin-r": [-0.1365, -0.2235, 0.0118], "foot-r": [-0.1506, -0.2941, 0.1631], "upper-arm-l": [0.2635, 0.1835, 0.0118], "forearm-l": [0.2776, 0.0565, 0.0188], "upper-arm-r": [-0.2635, 0.1835, 0.0118], "forearm-r": [-0.2776, 0.0565, 0.0188], "hand-l": [0.2871, 0.0024, 0.0282], "hand-r": [-0.2871, 0.0024, 0.0282], "neck": [-0.0353, 0.5624, 0.0], "head": [-0.1176, 0.8471, 0.0]};
  const BONE_ENVELOPE: Record<string, number> = {"pelvis": 0.28944, "abdomen": 0.30354, "chest": 0.3459, "clavicle-l": 0.12708, "clavicle-r": 0.12708, "thigh-l": 0.12426, "shin-l": 0.1059, "foot-l": 0.18354, "thigh-r": 0.12426, "shin-r": 0.1059, "foot-r": 0.18354, "upper-arm-l": 0.08754, "forearm-l": 0.07626, "upper-arm-r": 0.08754, "forearm-r": 0.07626, "hand-l": 0.08754, "hand-r": 0.08754, "neck": 0.11292, "head": 0.4659};
  const _closest = new THREE.Vector3();
  const distanceToSegment = (p: THREE.Vector3, s: number[], e: number[]): number => {
    const ab = [e[0] - s[0], e[1] - s[1], e[2] - s[2]];
    const ap = [p.x - s[0], p.y - s[1], p.z - s[2]];
    const abLenSq = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
    const t = abLenSq > 1e-12
      ? THREE.MathUtils.clamp((ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / abLenSq, 0, 1)
      : 0;
    _closest.set(s[0] + ab[0] * t, s[1] + ab[1] * t, s[2] + ab[2] * t);
    return p.distanceTo(_closest);
  };
  const computeVertexWeights = (p: THREE.Vector3) => {
    const scored = boneOrder.map((id) => {
      const d = distanceToSegment(p, BONE_JOINT[id], BONE_TIP[id]);
      const u = d / BONE_ENVELOPE[id];
      const falloff = Math.max(0, 1 - u * u);
      return { id, d, w: falloff * falloff };
    });
    scored.sort((a, b) => b.w - a.w);
    const kept = scored.slice(0, 4);
    const total = kept.reduce((sum, c) => sum + c.w, 0);
    const indices = [0, 0, 0, 0];
    const weights = [0, 0, 0, 0];
    if (total > 0) {
      for (let slot = 0; slot < kept.length; slot++) {
        indices[slot] = boneIndexOf.get(kept[slot].id) ?? 0;
        weights[slot] = kept[slot].w / total;
      }
      return { indices, weights, fallback: false };
    }
    // Mandatory zero-sum fallback (PLAN_1.5 §4 / ADR-8). Without it three.js's own
    // normalizeSkinWeights() rewrites an all-zero vertex to (1,0,0,0) against bone 0
    // regardless of distance, which spikes stray vertices toward the hips. Instead:
    // ignore the envelope and pin weight 1.0 to the absolutely nearest bone.
    let nearest = boneOrder[0];
    let nearestDistance = Infinity;
    for (const id of boneOrder) {
      const d = distanceToSegment(p, BONE_JOINT[id], BONE_TIP[id]);
      if (d < nearestDistance) { nearestDistance = d; nearest = id; }
    }
    indices[0] = boneIndexOf.get(nearest) ?? 0;
    weights[0] = 1;
    return { indices, weights, fallback: true };
  };

  // ---- Bake to model space, weight, and bind.
  //
  // The arrangement below was chosen by measurement, not derivation, because the same
  // geometry can be skinned four plausible ways and three of them are wrong. With a
  // vertex authored at model-space (0, 2, 0) fully weighted to a bone at (0, 1, 0) and
  // that bone rotated +90 degrees about X (correct answer: (0, 1, 1)):
  //
  //   pivot transform kept, bind identity     -> rest pose already wrong, no deformation
  //   pivot transform kept, bind matrixWorld  -> (0, 1.5, 0.5): HALF the correct swing,
  //                                              because the pivot applies on top of skinning
  //   geometry baked, pivot bypassed          -> (0, 1, 1): correct
  //   no pivot at all                         -> (0, 1, 1): correct, and identical
  //
  // The last two agreeing is the finding: what matters is that the mesh's own world
  // transform is identity and its geometry lives in the skeleton's space. So each skinned
  // mesh gets its world matrix folded into its vertex data and is reparented to `root`
  // with an identity transform. Meshes are leaves -- components are added to their pivot
  // Group, never to another mesh -- so reparenting one moves nothing else.
  // No component carries an authored pose, so there is nothing to rest.
  root.updateMatrixWorld(true);
  const skinnedMeshNames: string[] = [];
  let boundCount = 0;
  for (const boneId of boneOrder) {
    const mesh = meshes[boneId];
    if (!mesh) continue;
    const position = mesh.geometry.getAttribute('position');
    if (!position) continue;
    mesh.updateWorldMatrix(true, false);
    // applyMatrix4 mutates the vertex buffer in place and is NOT idempotent: running it
    // twice on one geometry applies the world matrix squared, and every component lands
    // somewhere it has no reason to be -- the model reads as blown apart rather than
    // wrong. Throw rather than skip, because a silent skip would leave a mesh in the
    // wrong space and the failure would resurface later as a subtler misplacement.
    if (mesh.geometry.userData.worldBaked) {
      throw new Error(
        `geometry for '${boneId}' is already world-baked; baking twice squares the ` +
        'world matrix and scatters the parts. Build a fresh factory instead of re-binding.'
      );
    }
    mesh.geometry.applyMatrix4(mesh.matrixWorld);
    mesh.geometry.userData.worldBaked = true;
    root.add(mesh);
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1, 1, 1);
    mesh.updateMatrixWorld(true);
    // Vertices are model-space now, which is the space the weight function measures in,
    // so no per-vertex matrix multiply is needed any more.
    const count = position.count;
    const skinIndices = new Uint16Array(count * 4);
    const skinWeights = new Float32Array(count * 4);
    const vertex = new THREE.Vector3();
    for (let v = 0; v < count; v++) {
      vertex.fromBufferAttribute(position, v);
      const { indices, weights } = computeVertexWeights(vertex);
      for (let slot = 0; slot < 4; slot++) {
        skinIndices[v * 4 + slot] = indices[slot];
        skinWeights[v * 4 + slot] = weights[slot];
      }
    }
    mesh.geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    mesh.geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
    skinnedMeshNames.push(boneId);
    const skinned = mesh as THREE.SkinnedMesh;
    if (!skinned.isSkinnedMesh) continue;
    // bindMode is left at its default (AttachedBindMode). The bones live under `root`
    // rather than under any one mesh because a single Skeleton is shared by every skinned
    // mesh and cannot be parented under all of them; with root and each mesh at identity
    // the bone world matrices are the same either way.
    skinned.bind(skeleton, new THREE.Matrix4());
    // A SkinnedMesh's boundingSphere is computed from its REST vertex data and is not
    // recomputed when bones move, so a posed limb that swings outside its rest bounds gets
    // culled and vanishes -- worse, it vanishes only from certain camera angles, which
    // reads as a geometry bug rather than a culling one. Disabling the test outright is
    // chosen over recomputing bounds every frame because these are small, always-onscreen
    // character parts where the test saves nothing. Recorded in userData.rig so a consumer
    // that DOES need culling knows it has to supply its own bounds.
    skinned.frustumCulled = false;
    boundCount += 1;
  }
  root.userData.rig = { bones, skeleton, boneOrder, boneIndexOf, skinAttributes: skinnedMeshNames, bound: skinnedMeshNames.length > 0 && boundCount === skinnedMeshNames.length, frustumCulled: false, cullingNote: 'skinned meshes set frustumCulled = false; bone motion does not update a SkinnedMesh boundingSphere, so a consumer that needs culling must recompute bounds per frame' };

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"], "note": "Flat cel-shaded reference: flat albedo per material is CORRECT here and is declared via material.textureless with measured evidence. Do not bake the outline strokes or highlights into albedo; the outline is a separate pass."}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createChibiSoldierLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Chibi Soldier look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = [{"role": "key", "direction": "upper-left front (helmet specular at ~10-11 o'clock)", "intensity": 1.0, "color": "#fff4e6", "notes": "soft directional; cartoon lighting, low contrast"}, {"role": "fill", "direction": "hemisphere / front ambient", "intensity": 0.55, "color": "#c9d3d8", "notes": "keeps the shadow side from going black so flat colours read"}, {"role": "rim", "direction": "behind-right, slightly above", "intensity": 0.25, "color": "#bcd0ff", "notes": "separates the dark-grey uniform from the #1e1e1e background"}, {"role": "environment", "notes": "plain dark neutral studio background #1e1e1e, no reflections to match"}, {"role": "exposure", "notes": "exposure 1.0, ACESFilmic tone mapping, sRGB output; keep flat colours near the measured values"}, {"role": "contact-shadow", "notes": "soft ground contact shadow under the boots (opacity ~0.35, radius ~0.25 units) plus ambient occlusion under the helmet brim and between arm and torso"}];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"], "note": "Flat cel-shaded reference: flat albedo per material is CORRECT here and is declared via material.textureless with measured evidence. Do not bake the outline strokes or highlights into albedo; the outline is a separate pass."}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createChibiSoldierEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameChibiSoldierCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createChibiSoldierPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureChibiSoldierRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createChibiSoldierInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
