#!/usr/bin/env python3
"""Split the moonlit hero photo into two clean PNG layers for the Three.js hero.

  art/moonlit-hero/foreground.png  person + cat + the whole rocky shoreline, opaque; sky and sea alpha = 0
  art/moonlit-hero/sky-bg.png      sky, moon, stars, far coastline; the sea is replaced by smooth horizon mist
                              so nothing is transparent or hard-edged behind the ocean mesh

Subject mask  : rembg (isnet-general-use) with alpha matting, restricted to a generous window around the person/cat
Rocks mask    : GrabCut seeded by a bottom-edge polygon (rocks are not a "subject" for a saliency model)
Edges         : morphological clean-up + feather, then colour decontamination so there is no sky/grey halo

Run (needs: pip install "rembg[cpu]" pillow numpy opencv-python-headless scipy):
  python scripts/extract-hero-layers.py [source.png]
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "Moonlit Seaside With Cat Companion.png"
OUT = ROOT / "art" / "moonlit-hero"  # intermediates; build-sunset-layers.py makes the shipped layers
WORK = ROOT / "scripts" / ".hero-work"
OUT.mkdir(parents=True, exist_ok=True)
WORK.mkdir(parents=True, exist_ok=True)

img = cv2.imread(str(SRC))  # BGR
H, W = img.shape[:2]
HORIZON_Y = 438  # horizon row in the 1671x941 source
MIST_BGR = (0x20, 0x13, 0x0B)  # #0b1320 in BGR


def k(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def poly_mask(*polys):
    m = np.zeros((H, W), np.uint8)
    for p in polys:
        cv2.fillPoly(m, [np.array(p, np.int32)], 255)
    return m


# Hand-placed seeds (only used to *seed* the matting, never as the final edge)
MAN = [[455, 330], [470, 285], [520, 265], [580, 285], [605, 330], [590, 390], [570, 420], [560, 455], [578, 520], [580, 600], [650, 565], [700, 560], [725, 600], [745, 665], [755, 700], [790, 730], [780, 750], [720, 755], [690, 800], [660, 850], [560, 860], [480, 850], [340, 845], [312, 790], [320, 640], [335, 540], [380, 470], [430, 415], [450, 380]]
CAT = [[755, 610], [770, 640], [790, 650], [815, 625], [830, 618], [828, 670], [835, 720], [832, 790], [850, 870], [790, 880], [700, 875], [668, 860], [672, 790], [690, 740], [745, 690], [752, 650]]
# bottom-edge polygon: the whole dark rocky shoreline across the frame
ROCKS = [[0, 575], [60, 590], [130, 620], [200, 660], [260, 692], [305, 718], [330, 800], [340, 850], [480, 855], [560, 858], [660, 855], [700, 872], [790, 880], [850, 872], [862, 868], [900, 825], [960, 802], [1020, 808], [1080, 845], [1112, 865], [1150, 880], [1200, 908], [1240, 918], [1300, 885], [1370, 865], [1440, 862], [1480, 890], [1530, 900], [1590, 860], [1640, 815], [1671, 780], [1671, 941], [0, 941]]

# ---------------------------------------------------------------- 1. subject (person + cat) via rembg
from rembg import new_session, remove  # noqa: E402

session = new_session("isnet-general-use")
rgb = Image.open(SRC).convert("RGB")
rb = remove(
    rgb,
    session=session,
    only_mask=True,
    alpha_matting=True,
    alpha_matting_foreground_threshold=240,
    alpha_matting_background_threshold=15,
    alpha_matting_erode_size=8,
)
subject = np.array(rb.convert("L"))
window = cv2.dilate(poly_mask(MAN, CAT), k(40))  # ignore saliency hits on the moon, clouds, waves
subject = np.where(window > 0, subject, 0).astype(np.uint8)
cv2.imwrite(str(WORK / "mask_rembg.png"), subject)

# ---------------------------------------------------------------- 2. rocks via GrabCut seeded by the bottom polygon
poly = poly_mask(MAN, CAT, ROCKS)
gc = np.full((H, W), cv2.GC_BGD, np.uint8)
gc[cv2.dilate(poly, k(16)) > 0] = cv2.GC_PR_BGD
gc[poly > 0] = cv2.GC_PR_FGD
gc[cv2.erode(poly, k(14)) > 0] = cv2.GC_FGD
cv2.grabCut(img, gc, None, np.zeros((1, 65)), np.zeros((1, 65)), 6, cv2.GC_INIT_WITH_MASK)
grab = (((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD)) * 255).astype(np.uint8)
cv2.imwrite(str(WORK / "mask_grabcut.png"), grab)

# ---------------------------------------------------------------- 3. combine, clean, feather
alpha = np.maximum(subject, grab)  # rembg matte wins where it is softer/higher, GrabCut guarantees the rocks
hard = (alpha > 127).astype(np.uint8) * 255
n, lab, st, _ = cv2.connectedComponentsWithStats(hard)
keep = np.zeros_like(hard)
for i in range(1, n):
    if st[i, cv2.CC_STAT_AREA] > 1500:
        keep[lab == i] = 255
inv = 255 - keep
n, lab, st, _ = cv2.connectedComponentsWithStats(inv)
for i in range(1, n):
    if st[i, cv2.CC_STAT_AREA] < 800:
        keep[lab == i] = 255
hard = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, k(2))
soft = cv2.GaussianBlur(hard, (0, 0), 1.1).astype(np.float32)
# keep the matted (soft) rembg alpha on the person/cat edge so hair and fur stay wispy
matte = np.maximum(soft, subject.astype(np.float32) * (soft > 0))
a = np.clip((matte - 20) * 255 / 215, 0, 255).astype(np.uint8)
a[hard > 0] = np.maximum(a[hard > 0], 250 * (cv2.erode(hard, k(1))[hard > 0] > 0))  # interior fully opaque

# decontaminate edge colour: push interior colours outward so no sky/grey halo survives
pure = cv2.erode(hard, k(3))
colour = cv2.inpaint(img, 255 - pure, 3, cv2.INPAINT_TELEA)
colour = np.where((a >= 250)[..., None], img, colour)
fg = cv2.cvtColor(colour, cv2.COLOR_BGR2RGB)
Image.fromarray(np.dstack([fg, a]), "RGBA").save(OUT / "foreground.png", optimize=True)

# ---------------------------------------------------------------- 4. sky-bg: remove the figures, then extend the horizon downward
hole = cv2.dilate(hard, k(16))
sm = cv2.resize(img, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
hm = cv2.resize(hole, (sm.shape[1], sm.shape[0]), interpolation=cv2.INTER_NEAREST)
fill = cv2.inpaint(sm, hm, 6, cv2.INPAINT_TELEA)
fill = cv2.resize(fill, (W, H), interpolation=cv2.INTER_CUBIC)
dist = cv2.distanceTransform((hole > 0).astype(np.uint8), cv2.DIST_L2, 5)
deep = np.clip((dist - 30) / 20, 0, 1)[..., None]
fill = (fill * (1 - deep) + cv2.GaussianBlur(fill, (0, 0), 22) * deep).astype(np.uint8)
hf = cv2.GaussianBlur(hole, (0, 0), 2.0)[..., None].astype(np.float32) / 255
plate = (img * (1 - hf) + fill * hf).astype(np.uint8)

# repair the horizon/coast strip behind the head by tiling clean columns to its right
y0, y1 = 370, 540
strip = plate[y0:y1, 640:760]
tile = np.hstack([strip, strip[:, ::-1]] * 4)
patch = plate.copy()
patch[y0:y1, 360 : 360 + tile.shape[1]] = tile[:, : W - 360][:, : patch[y0:y1, 360:].shape[1]]
region = np.zeros((H, W), np.uint8)
region[y0:y1, 380:650] = 255
mf = cv2.GaussianBlur(cv2.bitwise_and(hole, region), (0, 0), 5)[..., None].astype(np.float32) / 255
plate = (plate * (1 - mf) + patch * mf).astype(np.uint8)

# below the horizon: ease the photographed sea into flat horizon mist (#0b1320) so the 3D ocean has a seamless backdrop
yy = np.arange(H, dtype=np.float32)[:, None, None]
t = np.clip((yy - (HORIZON_Y - 2)) / 6.0, 0, 1)
t = t * t * (3 - 2 * t)
mist = np.array(MIST_BGR, np.float32)[None, None, :]
sky = (plate.astype(np.float32) * (1 - t) + mist * t).astype(np.uint8)
Image.fromarray(cv2.cvtColor(sky, cv2.COLOR_BGR2RGB), "RGB").save(OUT / "sky-bg.png", optimize=True)

for name in ("foreground.png", "sky-bg.png"):
    im = Image.open(OUT / name)
    ex = im.getchannel("A").getextrema() if "A" in im.mode else None
    print(f"{name}: {im.size[0]}x{im.size[1]} mode={im.mode} alpha_range={ex}")
