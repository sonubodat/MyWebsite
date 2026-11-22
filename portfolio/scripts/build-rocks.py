#!/usr/bin/env python3
"""Build the foreground shoreline assets from the supplied rocks photo. All outputs share ONE coordinate system (2172x724), so
the WebGL layers that draw them (lib/sunsetGL.ts, ROCKS_FRAG) can never drift apart at any viewport size.

  public/hero/rocks.webp    the photo with its black sky cut out (flood-filled from the top edge, so dark rock interiors survive),
                           plus a few small, irregular dark grass clusters growing out of the crest
  public/hero/terrain.webp  one continuous dark ground ridge that sits BEHIND the rocks: it joins the left pile, the low middle
                           rocks and the right rocks, so no water / sand shows between them

The supplied source photo is never modified.
Run: python3 scripts/build-rocks.py   (needs pillow numpy scipy)"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Golden-Rimmed Coastal Rock Formation-2.png"
OUT = ROOT / "public" / "hero"
rng = np.random.default_rng(7)

rgb = np.asarray(Image.open(SRC).convert("RGB"))
H, W = rgb.shape[:2]

# ---- 1. cut the sky out of the photo
dark = rgb.max(axis=2) < 10
lab, _ = ndi.label(dark)
sky = np.isin(lab, np.unique(lab[0][lab[0] > 0]))
sky = ndi.binary_opening(sky, iterations=1, border_value=1)   # outside the frame counts as sky, so the image edges are not eroded into spikes
alpha = ndi.gaussian_filter((~sky).astype(np.float32), 0.8)
alpha = np.clip((alpha - 0.15) / 0.7, 0, 1)

# ---- 2. the crest line of the rocks (first opaque row per column), smoothed
opaque = alpha > 0.5
top_raw = np.where(opaque.any(axis=0), opaque.argmax(axis=0), H).astype(np.float32)
top_s = ndi.gaussian_filter1d(top_raw, 22, mode="nearest")


def smooth_noise(n, scale, seed):
    r = np.random.default_rng(seed)
    pts = r.normal(size=n // scale + 3)
    return ndi.zoom(pts, scale, order=3)[:n]


# ---- 3. terrain ridge: an organic baseline that joins the rock piles; it never rises above the person's feet
xs = np.arange(W, dtype=np.float32)
base = 562 + 24 * smooth_noise(W, 480, 1) + 13 * smooth_noise(W, 190, 2) + 4.5 * smooth_noise(W, 46, 3)
# a few low, irregular boulder humps along the open stretch (right of the figure), so the ridge is never a flat line
for cx, wd, ht in [(0.43, 70, 16), (0.50, 120, 30), (0.58, 55, 14), (0.64, 95, 26), (0.72, 65, 20), (0.79, 110, 24)]:
    base -= ht * np.exp(-(((xs - cx * W + rng.normal(0, 12)) / wd) ** 2))
terr_top = np.minimum(base, top_s + 30)             # follows the rock crest where the rocks are high (hidden behind them)
terr_top = ndi.gaussian_filter1d(terr_top, 5, mode="nearest")
rows = np.arange(H, dtype=np.float32)[:, None]
depth = rows - terr_top[None, :]                    # px below the ridge line
cov = np.clip(depth / 1.6 + 0.5, 0, 1)              # ~1.5px soft top edge

# real rock detail for the ground: a crop of the photo's own lit stones, mirror-tiled, reduced to local contrast only (no brightness of its own)
crop = Image.fromarray(rgb[606:724, 760:1560]).resize((1200, 177), Image.LANCZOS)
tile = np.asarray(crop.convert("L"), dtype=np.float32) / 255.0
tile = np.concatenate([tile, tile[:, ::-1]], axis=1)
tile = np.concatenate([tile, tile[::-1]], axis=0)
tile = np.tile(tile, (H // tile.shape[0] + 1, W // tile.shape[1] + 1))[:H, :W]
detail = np.clip(tile / (ndi.gaussian_filter(tile, 22) + 0.02), 0.35, 2.2)

# ground colour: dark navy-charcoal, darker toward the bottom, with fine mottling so it reads as rock/earth, not a flat fill
tex = 1.0 + 0.16 * (ndi.gaussian_filter(rng.normal(size=(H, W)), (2.0, 9.0)) * 6) + 0.10 * (ndi.gaussian_filter(rng.normal(size=(H, W)), 1.1) * 3)
g = np.clip(1.0 - depth / 260.0, 0.0, 1.0)
col = np.stack([2.8 + 5 * g, 3.8 + 6 * g, 8 + 9 * g], axis=2) * np.clip(tex * detail ** 1.25, 0.35, 2.6)[:, :, None]
# restrained moonlight on the ridge top only: patchy (never a continuous outline), cool, low strength
rim_patch = np.clip(0.5 + 1.4 * smooth_noise(W, 90, 4), 0, 1) ** 1.5
rim = np.exp(-np.clip(depth, 0, None) / 3.0) * (depth >= 0) * rim_patch[None, :] * 0.16
col = col + rim[:, :, None] * np.array([46, 62, 98])
terrain = np.dstack([np.clip(col, 0, 255), cov * 255]).astype(np.uint8)
Image.fromarray(terrain, "RGBA").save(OUT / "terrain.webp", quality=92, method=6)

# ---- 4. grass: small irregular clusters on the crest line of (rocks + terrain), never a continuous border
union_top = np.minimum(top_raw, terr_top)
SS = 3
layer = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
dr = ImageDraw.Draw(layer)


def blade(x0, y0, length, lean, bend, w0, color):
    n = 14
    t = np.linspace(0, 1, n)
    px = x0 + lean * length * t + bend * length * t**2
    py = y0 - length * t * (1 - 0.18 * t)
    w = w0 * (1 - t) ** 0.8 + 0.25
    left = [((px[i] - w[i]) * SS, py[i] * SS) for i in range(n)]
    right = [((px[i] + w[i]) * SS, py[i] * SS) for i in range(n - 1, -1, -1)]
    dr.polygon(left + right, fill=color)


x = 70.0
while x < W - 40:
    x += rng.uniform(60, 190)
    fx = x / W
    if 0.14 < fx < 0.34 or x >= W - 30:        # keep clear of the seated figure and the cat
        continue
    y0 = float(union_top[int(x)]) + 5
    if y0 > H - 8:
        continue
    open_stretch = 0.40 < fx < 0.84                # the open shoreline between the rock piles: lusher, taller clumps
    if open_stretch:
        x -= rng.uniform(20, 70)                   # (pull the next clump closer)
    for _ in range(int(rng.integers(7, 14) if open_stretch else rng.integers(3, 9))):
        bx = x + rng.normal(0, 11 if open_stretch else 7)
        length = rng.uniform(16, 52) * (1.9 if open_stretch else 1.0) * (1.5 if rng.random() < 0.12 else 1.0)
        lean = rng.normal(0.10, 0.20)
        bend = rng.normal(0.06, 0.12)
        lit = rng.random() < 0.22                # a few blades catch a trace of moonlight; the rest stay dark
        color = (66, 84, 118, 215) if lit else (8, 12, 20, 255)
        blade(bx, y0, length, lean, bend, rng.uniform(1.5, 2.6), color)

grass = np.asarray(layer.resize((W, H), Image.LANCZOS)).astype(np.float32)
ga = grass[:, :, 3:4] / 255.0
photo = np.dstack([rgb.astype(np.float32), alpha * 255])
pa = photo[:, :, 3:4] / 255.0
oa = ga + pa * (1 - ga)
orgb = (grass[:, :, :3] * ga + photo[:, :, :3] * pa * (1 - ga)) / np.clip(oa, 1e-4, None)
rocks = np.dstack([orgb, oa * 255]).astype(np.uint8)
Image.fromarray(rocks, "RGBA").save(OUT / "rocks.webp", quality=92, method=6)
print("wrote", OUT / "rocks.webp", OUT / "terrain.webp", (W, H))
