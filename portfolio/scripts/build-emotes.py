"""Cut the six cat emotes (art/emotes/*.png, cream plate) into transparent, bottom-aligned WebP sprites.
Cat = everything enclosed by the dark outline; hearts / sparks / zzz kept as islands; plate + ground shadow dropped."""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import colorsys

NAMES = ["love", "play", "pet", "sleep", "happy", "curious"]
OUT_W = 560

def cut(path):
    im = Image.open(path).convert("RGB")
    a = np.array(im).astype(int)
    lum = (a[..., 0] * 299 + a[..., 1] * 587 + a[..., 2] * 114) // 1000
    outline = (lum < 105).astype(np.uint8) * 255                        # dark brown outline + zzz strokes
    closed = Image.fromarray(outline).filter(ImageFilter.MaxFilter(11))   # close outline gaps up to ~10px; the matching erode below removes the fringe
    wall = np.array(closed) > 0
    field = Image.fromarray(np.where(wall, 0, 255).astype(np.uint8)).convert("RGB")   # RGB: floodfill is unreliable on mode L
    W, H = im.size
    for seed in [(1, 1), (W - 2, 1), (1, H - 2), (W - 2, H - 2), (W // 2, 1), (W // 2, H - 2)]:
        if field.getpixel(seed) == (255, 255, 255):
            ImageDraw.floodfill(field, seed, (128, 0, 0), thresh=0)
    reached = (np.array(field)[..., 0] == 128)                                     # plate + shadow + gaps outside the outline
    # colourful islands outside the outline (hearts, sparks, question mark)
    sat = np.max(a, axis=2) - np.min(a, axis=2)
    bgc = np.array([253, 249, 238])
    far = np.sqrt(((a - bgc) ** 2).sum(axis=2)) > 70
    # cat body: undo the closing fringe (erode 5px); colourful islands (hearts/sparks) kept as found
    body = Image.fromarray((~reached * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(11))
    isl = Image.fromarray(((reached & far & (sat > 70)) * 255).astype(np.uint8))
    alpha = Image.fromarray(np.maximum(np.array(body), np.array(isl))).filter(ImageFilter.GaussianBlur(0.8))
    if "pet" in path:  # drop the patting hand/arm entering from the top-right (the page supplies the pointer)
        al = np.array(alpha); yy = np.arange(H)[:, None] / H; xx = np.arange(W)[None, :] / W
        cut_y = np.where(xx > 0.68, 0.262, np.where(xx > 0.52, 0.2, 0.0))
        alpha = Image.fromarray(np.where(yy < cut_y, 0, al).astype(np.uint8))
    out = im.convert("RGBA"); out.putalpha(alpha)
    return out

cuts = {n: cut(f"art/emotes/{n}.png") for n in NAMES}
if __name__ == "__main__":
    import sys
    boxes = {n: c.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox() for n, c in cuts.items()}
    # common canvas: union size, bottom-centre anchored so poses swap without jumping
    crops = {n: cuts[n].crop(boxes[n]) for n in NAMES}
    cw = max(c.width for c in crops.values()); ch = max(c.height for c in crops.values())
    print("canvas", cw, ch, boxes)
    for n, c in crops.items():
        can = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        can.paste(c, ((cw - c.width) // 2, ch - c.height), c)
        s = OUT_W / cw
        can = can.resize((OUT_W, round(ch * s)), Image.LANCZOS)
        can.save(f"public/mascot/{n}.webp", quality=88, alpha_quality=100, method=6)
        if len(sys.argv) > 1:
            pv = Image.new("RGB", can.size, (7, 19, 15)); pv.paste(can, (0, 0), can); pv.save(f"{sys.argv[1]}/pv_{n}.png")
    print("size", OUT_W, round(ch * OUT_W / cw))
