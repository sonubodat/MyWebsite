#!/usr/bin/env python3
"""Stdlib PNG sampler for choosing clean crop regions on the reference (no PIL).

    python3 sample_ref.py map              # coarse ASCII colour map (20 px cells)
    python3 sample_ref.py box x y w h      # mean/dominant colour inside a box + class breakdown
"""
import struct
import sys
import zlib
from pathlib import Path

IMG = Path(__file__).resolve().parent.parent.parent / "12345.png"


def decode(path):
    b = path.read_bytes()
    pos, idat, w = 8, b"", None
    while pos < len(b):
        n, t = struct.unpack(">I4s", b[pos:pos + 8])
        d = b[pos + 8:pos + 8 + n]
        if t == b"IHDR":
            w, h, depth, ctype, _, _, il = struct.unpack(">IIBBBBB", d)
            assert depth == 8 and il == 0 and ctype in (2, 6), "need 8-bit non-interlaced RGB/RGBA"
        elif t == b"IDAT":
            idat += d
        pos += 12 + n
    bpp = 4 if ctype == 6 else 3
    raw, stride, rows, prev = zlib.decompress(idat), w * bpp, [], bytearray(w * bpp)
    for y in range(h):
        f, line = raw[y * (stride + 1)], bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for i in range(stride):
            a = line[i - bpp] if i >= bpp else 0
            c = prev[i - bpp] if i >= bpp else 0
            up = prev[i]
            if f == 1: line[i] = (line[i] + a) & 255
            elif f == 2: line[i] = (line[i] + up) & 255
            elif f == 3: line[i] = (line[i] + (a + up) // 2) & 255
            elif f == 4:
                p = a + up - c
                pa, pb, pc = abs(p - a), abs(p - up), abs(p - c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else up if pb <= pc else c)) & 255
        rows.append(line)
        prev = line
    return w, h, bpp, rows


def px(rows, bpp, x, y):
    r = rows[y]
    return r[x * bpp], r[x * bpp + 1], r[x * bpp + 2]


def cls(c):
    r, g, b = c
    lum = (r + g + b) / 3
    if lum < 16: return "#"                       # black outline / eyes / boots
    if abs(r - 30) < 8 and abs(g - 30) < 8 and abs(b - 30) < 8: return "."   # background
    if r > 200 and g > 170 and b > 140: return "S"  # skin
    if r > 110 and r - g > 45 and r - b > 45: return "R"  # red backpack
    if lum > 105: return "m"                      # light grey (metal, highlight)
    if lum < 40: return "k"                       # very dark (belt, boots, pistol)
    return "g"                                    # mid grey (helmet, jacket, trousers)


if __name__ == "__main__":
    w, h, bpp, rows = decode(IMG)
    if sys.argv[1] == "map":
        step = 20
        print(f"{w}x{h}; each char = {step}px; columns start at x=0, rows at y=0")
        print("    " + "".join(str((x * step // 100) % 10) if (x * step) % 100 == 0 else " " for x in range(w // step)))
        for y in range(0, h - step + 1, step):
            print(f"{y:4d}" + "".join(cls(px(rows, bpp, x + step // 2, y + step // 2)) for x in range(0, w - step + 1, step)))
    else:
        x0, y0, bw, bh = map(int, sys.argv[2:6])
        cnt, tot = {}, [0, 0, 0]
        for y in range(y0, y0 + bh):
            for x in range(x0, x0 + bw):
                c = px(rows, bpp, x, y); k = cls(c); cnt[k] = cnt.get(k, 0) + 1
                for i in range(3): tot[i] += c[i]
        n = bw * bh
        print("mean RGB", tuple(round(t / n) for t in tot), "hex #%02x%02x%02x" % tuple(round(t / n) for t in tot))
        print("class share:", {k: round(v / n, 2) for k, v in sorted(cnt.items(), key=lambda kv: -kv[1])})
