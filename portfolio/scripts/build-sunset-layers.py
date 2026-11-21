#!/usr/bin/env python3
"""Build the dusk-silhouette foreground layers for the sunset hero (1920x1080 design canvas).

  public/hero/ridge-subject.png   mid-ground: left rock mound + smooth ridge across the bottom + person and cat
  public/hero/tree-front.png      foreground: the mangrove (prop roots to crown) on the right + the right-hand cliff
  public/hero/grass-mid.png        dune-grass blades along the ridge crest  (coverage + sway weight; drawn over ridge-subject)
  public/hero/grass-front.png      the same on the cliff crest              (drawn over tree-front)
  public/hero/grass-mid-color.png  true-colour blades (hover reveal)
  public/hero/grass-front-color.png
  public/hero/subject-color.png   true-colour person + cat   (hover reveal)
  public/hero/tree-color.png      true-colour tree           (hover reveal)

Grass: the supplied dune-grass photo (flat RGB on white, sand at the bottom) is keyed off white, the sand is cut away along
its surface line so roots land exactly on our crest, and mirrored/varied-scale tiles are bent to follow the ridge.
Grass PNG R = sway weight (0 root .. 1 tip), A = blade coverage; the shader tints the silhouette with the ground colour and
swings the tips in the wind. The *-color PNGs carry the real sunlit blade colours for the hover reveal.

Everything is built at 2-3x and area-downsampled, so contours are smooth. One ground colour field (#07090e -> #11131a)
feeds both layers, so they meet with no seam.

Inputs : art/moonlit-hero/foreground.png (person/cat cutout from extract-hero-layers.py)
         "Isolated Mangrove Tree with Exposed Roots.png" (project root)
Run    : python scripts/build-sunset-layers.py       (needs pillow numpy opencv-python-headless scipy)
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
HERO = ROOT / "public" / "hero"
ART = ROOT / "art" / "moonlit-hero"
TREE_SRC = ROOT / "Isolated Mangrove Tree with Exposed Roots.png"
GRASS_SRC = ROOT / "Sunlit Coastal Dune Grass-1.png"
W, H = 1920, 1080

# --- composition (fractions of the canvas; y from the top). The lower scene sits ~5% left of the previous cut. ---
SUN = (0.62 * W, 0.545 * H)  # low sun; moved left with the scene so it stays clear of the tree
GROUND_Y = 0.945  # ridge top: a thin shoreline strip, the water runs almost to the bottom edge
SUBJECT_X = 0.28  # a little further left
SUBJECT_SCALE = 0.83  # a touch larger so the head still reads against the sky glow on the lower shore
TREE_X = 0.855  # centre of the mangrove's root base
TREE_S = 0.38  # uniform scale: the whole tree is ~390px tall, canopy sweeping left over the water
RISE_START = 0.70  # where the right-hand cliff starts to climb

SUBJ_DARK = np.array([0x0B, 0x0C, 0x10], np.float32) / 255.0
SUBJ_MID = np.array([0x18, 0x14, 0x1A], np.float32) / 255.0
GND_DARK = np.array([0x07, 0x09, 0x0E], np.float32) / 255.0  # #07090e
GND_MID = np.array([0x11, 0x13, 0x1A], np.float32) / 255.0  # #11131a
AMBER = np.array([255, 172, 88], np.float32) / 255.0


# ---------------------------------------------------------------- helpers
def smooth1d(n, sigma, seed):
    pad = 4 * int(sigma)
    r = np.random.default_rng(seed).standard_normal((1, n + 2 * pad)).astype(np.float32)
    r = cv2.GaussianBlur(r, (0, 0), sigma)[0, pad : pad + n]
    return r / (np.abs(r).max() + 1e-6)


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def premul(rgba_u8):
    f = rgba_u8.astype(np.float32) / 255.0
    f[..., :3] *= f[..., 3:4]
    return f


def unpremul(f):
    a = np.clip(f[..., 3:4], 1e-4, 1)
    return np.dstack([np.clip(f[..., :3] / a, 0, 1), f[..., 3]])


def save_straight(path, rgba01):
    Image.fromarray((np.clip(rgba01, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA").save(path, optimize=True)


def to_png(path, premult):
    save_straight(path, unpremul(premult))


def fill_below(top):
    """Smooth anti-aliased silhouette filled below the per-column top edge (3x supersampled)."""
    S = 3
    m = np.zeros((H * S, W * S), np.uint8)
    xs = np.arange(W * S)
    t2 = np.interp(xs / S, np.arange(W), top) * S
    pts = np.concatenate([np.stack([xs, t2], 1), [[W * S - 1, H * S], [0, H * S]]]).astype(np.int32)
    cv2.fillPoly(m, [pts], 255)
    return cv2.resize(m, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0


def load_grass():
    """key the dune-grass photo off white, cut the sand away along its surface line, return premultiplied RGBA + the cut line."""
    from scipy import ndimage

    im = np.array(Image.open(GRASS_SRC).convert("RGB")).astype(np.float32)
    h, w = im.shape[:2]
    mn = im.min(2)
    mx = im.max(2)
    sat = (mx - mn) / (mx + 1e-3)
    lum = im @ np.array([0.299, 0.587, 0.114], np.float32)
    # the sand: pale, low-saturation, connected to the bottom edge
    sandlike = (sat < 0.60) & (lum > 105) & (lum < 247)  # sunlit sand is warm (sat ~0.45); blades are far more saturated or much darker
    shaded = (sat < 0.50) & (lum > 38) & (lum <= 105)  # the sand in shadow: dark, grey-brown, unsaturated
    shaded[: int(h * 0.80)] = False
    sandlike = sandlike | shaded
    sandlike[: int(h * 0.55)] = False
    # every connected piece of sand that reaches the bottom of the photo (the blades split it into several pieces)
    lab, n = ndimage.label(sandlike)
    reach = np.unique(lab[int(h * 0.88) :][lab[int(h * 0.88) :] > 0])
    sizes = ndimage.sum(sandlike, lab, reach)
    keep = reach[sizes > 400]
    sand = np.isin(lab, keep)
    sand = ndimage.binary_closing(sand, iterations=2)
    # per-column dune surface = top-most sand row; columns with none are filled from their neighbours; median-smoothed
    has = sand.any(0)
    top_row = np.where(has, sand.argmax(0), -1).astype(np.float32)
    xs_ = np.arange(w)
    top_row = np.interp(xs_, xs_[has], top_row[has]).astype(np.float32)
    ycut = ndimage.median_filter(top_row, size=21)
    # white key: estimate coverage from the darkest channel; recover the blade colour by un-compositing from white
    a = np.clip((255.0 - mn) / 175.0, 0, 1)
    a = np.clip(a * 1.35, 0, 1) ** 0.85
    f = np.clip((im - (1 - a)[..., None] * 255.0) / np.maximum(a, 1e-3)[..., None], 0, 255) / 255.0
    yy = np.arange(h, dtype=np.float32)[:, None]
    xx_ = np.arange(w, dtype=np.float32)[None, :]
    edge = np.clip(np.minimum(xx_, w - 1 - xx_) / 150.0, 0, 1)
    edge = edge * edge * (3 - 2 * edge)
    a = a * edge * (yy < (ycut[None, :] + 3))
    a[ndimage.binary_dilation(sand, iterations=3)] = 0  # every sand pixel goes; only blades survive
    a[sandlike & (yy > (ycut[None, :] - 40))] = 0  # and the pale fringe right at the roots
    a[a < 0.05] = 0
    lab2, n2 = ndimage.label(a > 0.05)
    if n2:
        sz = ndimage.sum(a > 0.05, lab2, np.arange(1, n2 + 1))
        small = np.isin(lab2, np.where(sz < 60)[0] + 1)
        a[small] = 0
    return np.dstack([f * a[..., None], a]).astype(np.float32), ycut


GRASS_PM, GRASS_YCUT = load_grass()
GH, GW = GRASS_PM.shape[:2]


def grass_layer(top, seed, scale, col_mask=None, shrink_at=None, max_h=150.0):
    """Tile the grass photo (mirrored, varied scale) along a crest; every column's sand line lands on top[x].
    Two interleaved passes (the 2nd half a tile out of phase) cross-fade every tile join, so no cut line shows.
    Returns (straight RGBA: R = sway weight, A = coverage) and (straight RGBA of true colour)."""
    S = 2
    Xs = (np.arange(W * S, dtype=np.float32) + 0.5) / S
    top_x = np.interp(Xs, np.arange(W), top).astype(np.float32)
    Yd = (np.arange(H * S, dtype=np.float32) + 0.5)[:, None] / S

    def one_pass(pseed, phase):
        r = np.random.default_rng(pseed)
        starts, scales, x = [], [], -r.uniform(0, 200) - phase * GW * np.mean(scale)
        while x < W + 400:
            sc = r.uniform(*scale)
            if shrink_at is not None:  # keep it lower around the person
                cx = x + GW * sc / 2
                sc *= 1 - 0.30 * np.exp(-(((cx - shrink_at) / 230.0) ** 2))
            starts.append(x)
            scales.append(sc)
            x += GW * sc
        starts = np.array(starts)
        scales = np.array(scales)
        idx = np.clip(np.searchsorted(starts, Xs, side="right") - 1, 0, len(starts) - 1)
        sc = scales[idx].astype(np.float32)
        u = (Xs - starts[idx]) / sc
        u = np.where((idx % 2) == 1, GW - 1 - u, u)
        u = np.clip(u, 0, GW - 1)
        ycut_u = np.interp(u, np.arange(GW), GRASS_YCUT).astype(np.float32)
        map_x = np.broadcast_to(u[None, :], (H * S, W * S)).astype(np.float32).copy()
        map_y = (ycut_u[None, :] + (Yd - top_x[None, :]) / sc[None, :]).astype(np.float32)
        warped = cv2.remap(GRASS_PM, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
        return cv2.resize(warped, (W, H), interpolation=cv2.INTER_AREA)

    a_, b_ = one_pass(seed, 0.0), one_pass(seed + 101, 0.5)
    out = b_ + a_ * (1 - b_[..., 3:4])  # premultiplied "over"
    cov = out[..., 3]
    if col_mask is not None:
        cov = cov * col_mask[None, :]
        out = out * col_mask[None, :, None]
    straight = unpremul(np.dstack([out[..., :3], cov]))
    yy = np.arange(H, dtype=np.float32)[:, None]
    weight = np.clip((top[None, :] - yy) / max_h, 0, 1) * (cov > 0.02)
    sway = np.zeros((H, W, 4), np.float32)
    sway[..., 0] = weight
    sway[..., 3] = cov
    tint = np.array([1.06, 0.93, 0.78], np.float32)
    colour = np.dstack([np.clip(straight[..., :3] ** 0.95 * tint, 0, 1), cov])
    return sway, colour


# one ground colour field of (x, y): both layers sample it, so they match everywhere
_g = np.random.default_rng(5)
_f = cv2.resize(_g.random((H // 40, W // 40)).astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC)
_f = cv2.GaussianBlur(_f, (0, 0), 14)
_f = (_f - _f.min()) / (_f.max() - _f.min())
GROUND_RGB = GND_DARK[None, None, :] + (GND_MID - GND_DARK)[None, None, :] * (0.2 + 0.6 * _f)[..., None]

# ---------------------------------------------------------------- ground profiles (smooth, organic)
X = np.arange(W, dtype=np.float32)
xf = X / W
ridge_top = (
    GROUND_Y * H
    + 11 * smooth1d(W, 90, 3)
    + 4 * smooth1d(W, 26, 4)
    - 0.092 * H * (1 - sstep(0.0, 0.25, xf)) ** 1.3  # left rock mound
    - 13 * smooth1d(W, 30, 6) * (1 - sstep(0.0, 0.25, xf))
    - 15 * np.exp(-(((X - SUBJECT_X * W) / 260.0) ** 2))  # a grassy knoll under the person
)
right_rise = 0.13 * H * sstep(RISE_START, 0.99, xf) ** 1.55 + 12 * smooth1d(W, 34, 7) * sstep(RISE_START + 0.08, 1.0, xf)
front_top = ridge_top - np.maximum(right_rise, 0)  # right cliff in front of the ridge; one continuous ground, no separate band

# ---------------------------------------------------------------- layer 3: ridge + person + cat
fg = np.array(Image.open(ART / "foreground.png").convert("RGBA"))
fh, fw = fg.shape[:2]
MAN = [[455, 330], [470, 285], [520, 265], [580, 285], [605, 330], [590, 390], [570, 420], [560, 455], [578, 520], [580, 600], [650, 565], [700, 560], [725, 600], [745, 665], [755, 700], [790, 730], [780, 750], [720, 755], [690, 800], [660, 850], [560, 860], [480, 850], [340, 845], [312, 790], [320, 640], [335, 540], [380, 470], [430, 415], [450, 380]]
CAT = [[755, 610], [770, 640], [790, 650], [815, 625], [830, 618], [828, 670], [835, 720], [832, 790], [850, 870], [790, 880], [700, 875], [668, 860], [672, 790], [690, 740], [745, 690], [752, 650]]
keep = np.zeros((fh, fw), np.uint8)
for p in (MAN, CAT):
    cv2.fillPoly(keep, [np.array(p, np.int32)], 255)
ell = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
keep = cv2.GaussianBlur(cv2.dilate(keep, ell(14)), (0, 0), 3).astype(np.float32) / 255.0
sub = fg.astype(np.float32)
sub[..., 3] *= keep
src_lum = (sub[..., :3] / 255.0) @ np.array([0.299, 0.587, 0.114], np.float32)

ax, ay = 520, 858
dest_x = SUBJECT_X * W
dest_y = ridge_top[int(dest_x)] + 7
S2 = 2  # warp at 2x, then area-downsample: no jagged mask edges
M2 = np.array([[SUBJECT_SCALE * S2, 0, (dest_x - ax * SUBJECT_SCALE) * S2], [0, SUBJECT_SCALE * S2, (dest_y - ay * SUBJECT_SCALE) * S2]], np.float32)
sub_w = cv2.resize(cv2.warpAffine(premul(sub.astype(np.uint8)), M2, (W * S2, H * S2), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0)), (W, H), interpolation=cv2.INTER_AREA)
lum_w = cv2.resize(cv2.warpAffine(src_lum, M2, (W * S2, H * S2), flags=cv2.INTER_LINEAR, borderValue=0), (W, H), interpolation=cv2.INTER_AREA)
sub_s = unpremul(sub_w)
subj_a = cv2.GaussianBlur(sub_s[..., 3], (0, 0), 0.7)  # feather: no harsh cutout line

ridge_a = fill_below(ridge_top)


def rim_light(alpha, sun_xy, mask, strength):
    """thin amber rim on edges that face the sun; mask removes it wherever the edge is buried in the ground."""
    a = cv2.GaussianBlur(alpha.astype(np.float32), (0, 0), 1.6)
    gx = cv2.Sobel(a, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(a, cv2.CV_32F, 0, 1, ksize=3)
    mag = np.sqrt(gx * gx + gy * gy) + 1e-6
    nx, ny = -gx / mag, -gy / mag
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    lx, ly = sun_xy[0] - xx, sun_xy[1] - yy
    ll = np.sqrt(lx * lx + ly * ly) + 1e-6
    facing = np.clip(nx * lx / ll + ny * ly / ll, 0, 1) ** 1.4
    inside = cv2.distanceTransform((alpha > 0.5).astype(np.uint8), cv2.DIST_L2, 5)
    band = np.clip(1 - inside / 5.0, 0, 1) * (alpha > 0.35)
    return (facing * band * mask * strength)[..., None]


subj_rgb = SUBJ_DARK[None, None, :] + (SUBJ_MID - SUBJ_DARK)[None, None, :] * (np.clip(lum_w / 0.55, 0, 1) ** 1.2 * 0.8)[..., None]
yy_col = np.arange(H, dtype=np.float32)[:, None]
settle = 1 - np.clip((yy_col - (ridge_top[None, :] - 70)) / 75.0, 0, 1)  # low on the body the colour settles into the ground colour
sub_over = (np.clip((subj_a - ridge_a) * 6, 0, 1) * settle)[..., None]  # soft hand-off between subject colour and ground colour
rgb3 = subj_rgb * sub_over + GROUND_RGB * (1 - sub_over)
rgb3 = rgb3 + AMBER[None, None, :] * rim_light(subj_a, SUN, (1 - ridge_a), 0.75)
alpha3 = np.maximum(ridge_a, subj_a)
layer_a = np.dstack([np.clip(rgb3, 0, 1), alpha3])
layer_a[..., :3] *= layer_a[..., 3:4]
to_png(HERO / "ridge-subject.png", layer_a)

# ---------------------------------------------------------------- layer 4: mangrove (wind-swept by nature) + right cliff
tree = np.array(Image.open(TREE_SRC).convert("RGBA"))
th, tw = tree.shape[:2]
ta = np.clip((tree[..., 3].astype(np.float32) / 255.0 - 0.08) / 0.55, 0, 1)  # solidify the see-through leaf gaps
tree_rgb = tree[..., :3].astype(np.float32) / 255.0
tree_in = np.dstack([tree_rgb * ta[..., None], ta]).astype(np.float32)
bx, by = 1110, 1008  # centre of the prop-root base in the source
X0 = TREE_X * W
Y0 = front_top[int(X0)] + 6  # the lowest roots sink into the shore
Mt = np.array([[TREE_S * S2, 0, (X0 - TREE_S * bx) * S2], [0, TREE_S * S2, (Y0 - TREE_S * by) * S2]], np.float32)
tree_w = cv2.resize(cv2.warpAffine(tree_in, Mt, (W * S2, H * S2), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0)), (W, H), interpolation=cv2.INTER_AREA)
t_s = unpremul(tree_w)
tree_a = cv2.GaussianBlur(t_s[..., 3], (0, 0), 0.7)  # feathered edge, no harsh cutout line

cliff_a = fill_below(front_top)
tlum = (t_s[..., :3]) @ np.array([0.299, 0.587, 0.114], np.float32)
tree_rgb_g = SUBJ_DARK[None, None, :] + (SUBJ_MID - SUBJ_DARK)[None, None, :] * (np.clip(tlum / 0.5, 0, 1) ** 1.2 * 0.8)[..., None]
tree_over = np.clip((tree_a - cliff_a) * 6, 0, 1)[..., None]
rgb4 = tree_rgb_g * tree_over + GROUND_RGB * (1 - tree_over)
rgb4 = rgb4 + AMBER[None, None, :] * rim_light(tree_a, SUN, (1 - cliff_a), 0.85)
alpha4 = np.maximum(tree_a, cliff_a)
layer_b = np.dstack([np.clip(rgb4, 0, 1), alpha4])
layer_b[..., :3] *= layer_b[..., 3:4]
to_png(HERO / "tree-front.png", layer_b)

# ---------------------------------------------------------------- grass (the supplied dune-grass photo, bent to the crests)
sway_m, col_m = grass_layer(ridge_top, 41, (0.36, 0.46), shrink_at=SUBJECT_X * W, max_h=190.0)
save_straight(HERO / "grass-mid.png", sway_m)
save_straight(HERO / "grass-mid-color.png", col_m)
on_cliff = np.clip(((ridge_top - front_top) - 6) / 24.0, 0, 1).astype(np.float32)  # grass only where the cliff stands above the ridge
sway_f, col_f = grass_layer(front_top, 57, (0.42, 0.54), col_mask=on_cliff, max_h=210.0)
save_straight(HERO / "grass-front.png", sway_f)
save_straight(HERO / "grass-front-color.png", col_f)


# ---------------------------------------------------------------- hover reveal: true-colour versions (same geometry)
def warm(rgb, gain, tint, gamma=0.92):
    return np.clip(np.clip(rgb * gain, 0, 1) ** gamma * np.array(tint, np.float32)[None, None, :], 0, 1)


sub_col = warm(sub_s[..., :3], 1.7, (1.10, 0.93, 0.76))
col_a = np.dstack([sub_col, subj_a * (subj_a > ridge_a)])
col_a[..., :3] *= col_a[..., 3:4]
to_png(HERO / "subject-color.png", col_a)

tr_col = warm(t_s[..., :3], 1.05, (1.0, 0.80, 0.50), 0.95)
col_b = np.dstack([tr_col, tree_a * (tree_a > cliff_a)])
col_b[..., :3] *= col_b[..., 3:4]
to_png(HERO / "tree-color.png", col_b)

ys, xs = np.where(tree_a > 0.3)
print(f"tree bbox: x {xs.min()}-{xs.max()} ({xs.min()/W:.3f}-{xs.max()/W:.3f})  y {ys.min()}-{ys.max()} ({ys.min()/H:.3f}-{ys.max()/H:.3f})")
print(f"ground top: ridge@subject {ridge_top[int(dest_x)]/H:.3f}  front@tree {front_top[int(X0)]/H:.3f}")
for name in ("ridge-subject.png", "tree-front.png", "grass-mid.png", "grass-front.png", "grass-mid-color.png", "grass-front-color.png", "subject-color.png", "tree-color.png"):
    im = Image.open(HERO / name)
    a = np.array(im.getchannel("A"))
    print(f"{name}: {im.size[0]}x{im.size[1]} {im.mode} alpha {a.min()}-{a.max()} opaque {100*(a>250).mean():.1f}%")
