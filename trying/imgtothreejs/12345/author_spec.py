#!/usr/bin/env python3
"""Author spec.json for the chibi-soldier reference (12345.png) from the pristine template.

    python3 author_spec.py structure   # rebuild parts/materials/assessment from spec.template.json
    python3 author_spec.py evidence    # crop the reference, extract colour + PBR evidence into the spec
    python3 author_spec.py finish      # lighting, detail inventory, overrides, notes
    python3 author_spec.py all

All pixel coordinates below are measured on the 1818x974 reference. Units: 425 px = 1 relative unit,
origin = pelvis centre, +X = character's left (viewer's right), +Y up, +Z toward camera.
Hidden sides (back of head, rear of body, far side of backpack) are NOT visible in the image and are
inferred by symmetry/plausible volume only.
"""
import copy
import json
import math
import subprocess
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent
IMG = OUT.parent.parent / "12345.png"
SKILL = Path.home() / ".mcphub/skills/img2threejs"
TEMPLATE, SPEC = OUT / "spec.template.json", OUT / "spec.json"
EVID = OUT / "evidence"
U, OX, OY = 425.0, 895.0, 770.0
IW, IH = 1818.0, 974.0


def g(x, y, z=0.0):
    return ((x - OX) / U, (OY - y) / U, z / U)


# id, parent, level, role, primitive, material, centre(px x,y,z), dims(px w,h,d), rotZ deg, topology, name
P = [
    ("root", None, "macro", "body", "box", "shirt", (895, 770, 0), (40, 40, 40), 0, "assembled-solid", "Soldier (root)"),
    ("pelvis", "root", "macro", "body", "ellipsoid", "pants", (895, 757, 0), (205, 70, 140), 0, "continuous-sculpt", "Pelvis / hips"),
    ("abdomen", "pelvis", "macro", "shell", "ellipsoid", "shirt", (895, 690, 0), (215, 80, 140), 0, "continuous-sculpt", "Jacket lower torso (soft)"),
    ("chest", "abdomen", "macro", "shell", "ellipsoid", "shirt", (895, 612, 0), (245, 118, 150), 0, "continuous-sculpt", "Jacket upper torso (soft)"),
    ("neck", "chest", "meso", "detail", "ellipsoid", "skin", (880, 560, 0), (80, 58, 80), 0, "continuous-sculpt", "Neck"),
    ("collar", "chest", "meso", "shell", "torus", "shirt", (880, 574, 8), (150, 112, 26), 0, "conforming-shell", "Jacket collar ring"),
    ("head", "neck", "macro", "body", "ellipsoid", "skin", (845, 410, 0), (330, 270, 280), 0, "continuous-sculpt", "Head (face under helmet)"),
    ("helmet", "head", "macro", "shell", "lathe", "helmet", (850, 294, 0), (430, 232, 388), 0, "continuous-sculpt", "Combat helmet dome (flattened top, scaled down)"),
    ("helmet-rim", "head", "meso", "detail", "torus", "helmet", (850, 410, 14), (432, 392, 28), 0, "conforming-shell", "Helmet rim ring (bottom edge)"),
    ("helmet-rivet", "helmet", "micro", "detail", "sphere", "eye", (1040, 334, 72), (18, 18, 18), 0, "assembled-solid", "Helmet side rivet"),
    ("chin-strap", "head", "micro", "detail", "torus", "strap", (845, 415, 8), (346, 292, 14), 0, "conforming-shell", "Black chin strap ring under the chin"),
    ("eye-r", "head", "micro", "detail", "ellipsoid", "eye", (783, 438, 120), (48, 62, 30), 0, "assembled-solid", "Eye (character right = viewer left)"),
    ("eye-l", "head", "micro", "detail", "ellipsoid", "eye", (907, 438, 120), (48, 62, 30), 0, "assembled-solid", "Eye (character left = viewer right)"),
    ("ear-r", "head", "micro", "detail", "sphere", "skin", (697, 450, 0), (54, 70, 50), 0, "assembled-solid", "Ear sphere (character right), flush with the head"),
    ("ear-l", "head", "micro", "detail", "sphere", "skin", (993, 450, 0), (54, 70, 50), 0, "assembled-solid", "Ear sphere (character left), flush with the head"),
    ("clavicle-r", "chest", "meso", "support", "capsule", "shirt", (825, 595, 0), (90, 45, 60), 0, "continuous-sculpt", "Shoulder (character right)"),
    ("upper-arm-r", "clavicle-r", "meso", "arm", "capsule", "shirt", (783, 648, 5), (62, 88, 62), 0, "continuous-sculpt", "Upper arm sleeve (right)"),
    ("forearm-r", "upper-arm-r", "meso", "arm", "capsule", "shirt", (777, 708, 8), (54, 76, 54), 0, "continuous-sculpt", "Forearm sleeve (right)"),
    ("hand-r", "forearm-r", "meso", "hand", "ellipsoid", "skin", (773, 741, 12), (62, 56, 52), 0, "continuous-sculpt", "Mitten hand gripping pistol (right)"),
    ("clavicle-l", "chest", "meso", "support", "capsule", "shirt", (965, 595, 0), (90, 45, 60), 0, "continuous-sculpt", "Shoulder (character left)"),
    ("upper-arm-l", "clavicle-l", "meso", "arm", "capsule", "shirt", (1007, 648, 5), (62, 88, 62), 0, "continuous-sculpt", "Upper arm sleeve (left)"),
    ("forearm-l", "upper-arm-l", "meso", "arm", "capsule", "shirt", (1013, 708, 8), (54, 76, 54), 0, "continuous-sculpt", "Forearm sleeve (left)"),
    ("hand-l", "forearm-l", "meso", "hand", "ellipsoid", "skin", (1017, 741, 12), (62, 56, 52), 0, "continuous-sculpt", "Mitten hand (left)"),
    ("belt", "pelvis", "meso", "shell", "torus", "belt", (895, 717, 0), (214, 146, 38), 0, "conforming-shell", "Black belt ring (thicker)"),
    ("belt-buckle", "pelvis", "micro", "detail", "box", "buckle", (895, 717, 76), (40, 24, 14), 0, "assembled-solid", "Belt buckle plate (grey)"),
    ("thigh-r", "pelvis", "meso", "leg", "capsule", "pants", (843, 782, 0), (88, 72, 88), 0, "continuous-sculpt", "Thigh (right)"),
    ("shin-r", "thigh-r", "meso", "leg", "capsule", "pants", (837, 834, 5), (75, 62, 75), 0, "continuous-sculpt", "Shin (right)"),
    ("foot-r", "shin-r", "meso", "foot", "ellipsoid", "shoes", (831, 868, 26), (88, 54, 130), 0, "continuous-sculpt", "Rounded boot (right)"),
    ("thigh-l", "pelvis", "meso", "leg", "capsule", "pants", (947, 782, 0), (88, 72, 88), 0, "continuous-sculpt", "Thigh (left)"),
    ("shin-l", "thigh-l", "meso", "leg", "capsule", "pants", (953, 834, 5), (75, 62, 75), 0, "continuous-sculpt", "Shin (left)"),
    ("foot-l", "shin-l", "meso", "foot", "ellipsoid", "shoes", (959, 868, 26), (88, 54, 130), 0, "continuous-sculpt", "Rounded boot (left)"),
    ("backpack", "chest", "macro", "shell", "ellipsoid", "backpack", (1000, 630, -108), (132, 200, 104), 0, "continuous-sculpt", "Red rounded backpack body"),
    ("backpack-pocket", "backpack", "micro", "detail", "ellipsoid", "backpack", (1068, 688, -92), (48, 78, 62), 0, "continuous-sculpt", "Backpack side pocket"),
    ("strap-front-r", "chest", "meso", "detail", "ellipsoid", "backpack", (837, 610, 72), (26, 120, 14), -10, "continuous-sculpt", "Strap, chest front (right)"),
    ("strap-front-l", "chest", "meso", "detail", "ellipsoid", "backpack", (953, 610, 72), (26, 120, 14), 10, "continuous-sculpt", "Strap, chest front (left)"),
    ("strap-shoulder-r", "chest", "meso", "detail", "ellipsoid", "backpack", (837, 556, 0), (26, 16, 150), 0, "continuous-sculpt", "Strap over shoulder (right)"),
    ("strap-shoulder-l", "chest", "meso", "detail", "ellipsoid", "backpack", (953, 556, 0), (26, 16, 150), 0, "continuous-sculpt", "Strap over shoulder (left)"),
    ("pistol-grip", "hand-r", "meso", "tool", "box", "pistol", (773, 742, 12), (24, 66, 26), 0, "assembled-solid", "Pistol grip (centred in the right hand)"),
    ("pistol-slide", "hand-r", "meso", "tool", "box", "pistol", (773, 704, 56), (24, 24, 150), 0, "assembled-solid", "Slim pistol slide pointing forward"),
    ("pistol-barrel", "hand-r", "micro", "detail", "box", "pistol", (773, 708, 138), (12, 12, 20), 0, "assembled-solid", "Barrel tip"),
    ("pistol-sight", "hand-r", "micro", "detail", "box", "pistol", (773, 689, -8), (8, 8, 8), 0, "assembled-solid", "Rear sight"),
]

# Helmet profile for THREE.LatheGeometry: [radius, y] normalised into a unit box (r<=0.5, y -0.5..0.5).
HELMET_PROFILE = {"segments": 48, "points": [[0.499, -0.5], [0.496, -0.36], [0.488, -0.2], [0.47, -0.03], [0.435, 0.12], [0.38, 0.25], [0.31, 0.355], [0.23, 0.43], [0.14, 0.48], [0.0, 0.5]]}

# material id -> (hex colour guess, roughness, metalness, materialClass, crop box x,y,w,h, name)
MATS = {
    "skin": ("#f4cdae", 0.75, 0.0, "skin", (730, 455, 255, 88), "Flat toon skin"),
    "shirt": ("#49504f", 0.85, 0.0, "fabric", (830, 600, 150, 90), "Grey-green jacket cloth"),
    "pants": ("#444b4a", 0.85, 0.0, "fabric", (830, 745, 110, 32), "Dark grey trousers"),
    "shoes": ("#030406", 0.7, 0.0, "rubber", (780, 850, 96, 44), "Black boots"),
    "eye": ("#040504", 0.2, 0.0, "plastic", (742, 398, 36, 48), "Glossy black eye"),
    "helmet": ("#414847", 0.3, 0.1, "plastic", (660, 125, 480, 210), "Glossy dark helmet shell"),
    "backpack": ("#8b2e29", 0.8, 0.0, "fabric", (1010, 575, 55, 95), "Red canvas backpack"),
    "pistol": ("#333435", 0.45, 0.4, "metal", (678, 728, 22, 50), "Dark pistol metal"),
    "belt": ("#030406", 0.75, 0.0, "fabric", (800, 719, 170, 15), "Black belt"),
    "strap": ("#1b1f1f", 0.75, 0.0, "fabric", (996, 426, 9, 12), "Black chin strap (measured #383d3d, darkened to read as black)"),
    "buckle": ("#4a5150", 0.4, 0.5, "metal", (838, 721, 22, 7), "Grey buckle plate (measured #4a5150)"),
}

# component id -> crop (x,y,w,h) on flat colour of that part, verified numerically against expected colour
PATCH = {'buckle': (838, 721, 22, 7), 'skin': (790, 470, 150, 40), 'shirt': (850, 640, 45, 60), 'pants': (810, 795, 45, 35), 'shoes': (802, 856, 60, 22), 'eye': (758, 408, 14, 28), 'helmet': (900, 200, 150, 100), 'backpack': (1022, 580, 22, 40), 'rivet': (1010, 315, 10, 10), 'strap': (996, 426, 9, 12), 'pistol': (672, 752, 8, 10), 'belt': (830, 726, 60, 6)}
COMP_PATCH = {'root': 'shirt', 'abdomen': 'shirt', 'chest': 'shirt', 'collar': 'shirt', 'clavicle-r': 'shirt', 'clavicle-l': 'shirt', 'upper-arm-r': 'shirt', 'upper-arm-l': 'shirt', 'forearm-r': 'shirt', 'forearm-l': 'shirt', 'pelvis': 'pants', 'thigh-r': 'pants', 'thigh-l': 'pants', 'shin-r': 'pants', 'shin-l': 'pants', 'neck': 'skin', 'head': 'skin', 'hand-r': 'skin', 'hand-l': 'skin', 'ear-l': 'skin', 'ear-r': 'skin', 'foot-r': 'shoes', 'foot-l': 'shoes', 'eye-r': 'eye', 'eye-l': 'eye', 'backpack': 'backpack', 'backpack-pocket': 'backpack', 'strap-front-r': 'backpack', 'strap-front-l': 'backpack', 'strap-shoulder-r': 'backpack', 'strap-shoulder-l': 'backpack', 'pistol-grip': 'pistol', 'pistol-slide': 'pistol', 'pistol-barrel': 'pistol', 'pistol-sight': 'pistol', 'helmet': 'helmet', 'helmet-rim': 'helmet', 'helmet-rivet': 'rivet', 'chin-strap': 'strap', 'belt': 'belt', 'belt-buckle': 'buckle'}
CLASS_HINT = {"buckle": "metal", "skin": "skin", "shirt": "fabric", "pants": "fabric", "shoes": "rubber", "eye": "plastic",
              "helmet": "plastic", "backpack": "fabric", "pistol": "metal", "belt": "fabric", "strap": "fabric"}


TORUS_RATIO = 0.16
ROTX = {"helmet": -0.12}                                  # helmet tilts: front edge up, back edge down
ROT3 = {"helmet": (-0.12, 0.0, 0.0), "helmet-rim": (math.pi / 2 - 0.12, 0.0, 0.0),
        "collar": (math.pi / 2, 0.0, 0.0), "belt": (math.pi / 2, 0.0, 0.0),
        "pistol-grip": (0.25, 0.0, 0.0), "pistol-slide": (0.12, 0.0, 0.0), "pistol-barrel": (0.12, 0.0, 0.0),
        "pistol-sight": (0.12, 0.0, 0.0)}
KEEP_ATTACHMENT = {"clavicle-r", "clavicle-l", "upper-arm-r", "upper-arm-l", "forearm-r",
                   "forearm-l", "thigh-r", "thigh-l", "shin-r", "shin-l"}


WORN = {}


def p_role(cid):
    return next(q[3] for q in P if q[0] == cid)


def load(p):
    return json.loads(Path(p).read_text())


def save(p, d):
    Path(p).write_text(json.dumps(d, indent=2))


def run(*args, check=True):
    r = subprocess.run([sys.executable, str(SKILL / args[0]), *map(str, args[1:])], cwd=SKILL,
                       text=True, capture_output=True)
    if check and r.returncode != 0:
        print("   FAILED:", " ".join(map(str, args[:3])), "\n  ", (r.stdout + r.stderr).strip()[-400:])
    return r


def crop(box, out):
    x, y, w, h = box
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["sips", "--cropToHeightWidth", str(h), str(w), "--cropOffset", str(y), str(x),
                    str(IMG), "--out", str(out)], capture_output=True, check=True)


# --------------------------------------------------------------------------------------- structure
def structure():
    spec = load(TEMPLATE)
    tmpl = {c["id"]: c for c in spec["componentTree"]}
    proto = tmpl["chest"]
    glob = {p[0]: g(*p[6]) for p in P}

    def ep(cid, ctr, dims, rot, role):
        """(start, end, radius) in GLOBAL units for endpoint-built parts, else None."""
        if cid not in KEEP_ATTACHMENT and cid not in WORN:
            return None
        cx, cy, cz = ctr
        w, h, d = (v / U for v in dims)
        if cid in WORN:
            th = math.radians(rot)
            ax, ay = -math.sin(th), math.cos(th)
            rad = (w + d) / 4 if cid in ("backpack", "belt") else min(w, d) / 2
            return (cx - ax * h / 2, cy - ay * h / 2, cz), (cx + ax * h / 2, cy + ay * h / 2, cz), rad
        if cid.startswith("clavicle"):
            sgn = -1 if cid.endswith("-r") else 1
            return (cx - sgn * w / 2, cy, cz), (cx + sgn * w / 2, cy, cz), min(h, d) / 2
        if role in ("arm", "leg"):
            return (cx, cy + h / 2, cz), (cx, cy - h / 2, cz), min(w, d) / 2
        return (cx, cy - h / 2, cz), (cx, cy + h / 2, cz), (w + d) / 4
    epg, origin = {}, {}
    for q in P:
        epg[q[0]] = ep(q[0], glob[q[0]], q[7], q[8], q[3])
        origin[q[0]] = epg[q[0]][0] if epg[q[0]] else glob[q[0]]
    comps, keep = [], {p[0] for p in P}
    for cid, parent, level, role, prim, mat, ctr, dims, rot, topo, name in P:
        c = copy.deepcopy(tmpl.get(cid, proto))
        px, py, pz = origin[cid]
        qx, qy, qz = origin[parent] if parent else (0, 0, 0)
        w, h, d = (v / U for v in dims)
        c.update(id=cid, name=name, level=level, role=role, primitive=prim, parent=parent, material=mat,
                 materialLayers=[mat], topologyClass=topo, importance=1.0 if level == "macro" else 0.7,
                 confidence=0.7 if cid not in ("backpack", "backpack-pocket", "ear-l") else 0.5,
                 fidelityTier="blockout")
        c["topologyRationale"] = {
            "continuous-sculpt": f"{name}: one smooth rounded volume (chibi stylisation), no panel breaks.",
            "assembled-solid": f"{name}: discrete rigid part with simple faces, correctly built from a primitive.",
            "conforming-shell": f"{name}: thin layer following the form underneath, no independent volume.",
        }[topo]
        c["dimensions"] = {"width": round(w, 4), "height": round(h, 4), "depth": round(d, 4),
                           "units": "relative", "confidence": c["confidence"]}
        off = (px - qx, py - qy, pz - qz)
        rxp = ROTX.get(parent, 0.0)                      # parent tilted about X: express offset in its frame
        if rxp:
            cs, sn = math.cos(rxp), math.sin(rxp)
            off = (off[0], off[1] * cs + off[2] * sn, -off[1] * sn + off[2] * cs)
        scale3 = (w, h, d)
        if prim == "torus":                              # dims = (outer width, outer depth, tube diameter)
            tube_u = 0.45 * TORUS_RATIO
            outer = 0.9 + 2 * tube_u
            scale3 = (w / outer, h / outer, d / (2 * tube_u))
            c.setdefault("geometryDescriptor", {})["torusTubeRatio"] = TORUS_RATIO
        rot3 = ROT3.get(cid, (0.0, 0.0, math.radians(rot)))
        c["transform"] = {"position": [round(v, 4) for v in off], "rotation": [round(v, 4) for v in rot3],
                          "scale": [round(v, 4) for v in scale3]}
        c["evidenceRefs"] = ["full-object"]
        c["localFeatures"] = []
        c.setdefault("actionProfile", copy.deepcopy(proto["actionProfile"]))
        c["actionProfile"]["destruction"]["debrisMaterial"] = mat
        if cid == "helmet":
            c["geometryDescriptor"]["latheProfile"] = HELMET_PROFILE
            c["geometryDescriptor"]["topologyIntent"] = "domed combat helmet with flared brim, open underneath"
        if cid in ("eye-l", "eye-r"):
            c["actionProfile"]["animationRole"] = "static"
        # Attachment (embedding) contracts: ONLY real limb/torso parts keep one, recomputed from the chibi sizes.
        # Everything else is built from its own dimensions (copying the template chest's contract onto the helmet,
        # backpack, pistol... made each of them a chest-sized welded frustum).
        if epg[cid]:
            att = copy.deepcopy((tmpl.get(cid) or {}).get("attachment")) or {
                "parentSocket": WORN.get(cid, ""), "contactType": "rigid-weld", "embedDepth": 0.01,
                "gapTolerance": 0.01, "evidenceRefs": ["full-object"]}
            s_g, e_g, rad = epg[cid]
            att.update(localStart=[round(v - o, 4) for v, o in zip(s_g, (qx, qy, qz))],
                       localEnd=[round(v - o, 4) for v, o in zip(e_g, (qx, qy, qz))],
                       baseRadius=round(rad, 4), endRadius=round(rad * 0.85, 4))
            c["attachment"] = att
        else:
            c["attachment"] = None
        comps.append(c)

    # ---- local features (each detail in the inventory must map to one of these or a material override)
    feat = {
        "root": [{"id": "toon-outline", "kind": "linework", "description": "thick near-black outline (~4-5 px at 1818 wide) around every silhouette edge; render as inverted-hull or edge pass"}],
        "helmet": [{"id": "brim-line", "kind": "linework", "description": "dark crease line where the dome meets the brim, ~0.55 of dome height, curving up at the front"}],
        "helmet-rivet": [{"id": "rivet-dot", "kind": "fastener", "description": "single black round rivet on the right side of the dome"}],
        "chin-strap": [{"id": "strap-edge", "kind": "seam", "description": "dark strap running from the helmet down the cheek in front of the ear"}],
        "collar": [{"id": "collar-fold", "kind": "contour", "description": "two small collar flaps folding outward at the neckline"}],
        "backpack-pocket": [{"id": "pocket-stitch", "kind": "stitch", "description": "darker rectangular side pocket with a rounded top edge"}],
        "pistol-slide": [{"id": "slide-groove", "kind": "groove", "description": "lighter highlight edge along the top of the slide"}],
        "eye-l": [{"id": "eye-oval", "kind": "decal", "description": "solid black vertical oval, no catchlight, no iris"}],
    }
    for c in comps:
        c["localFeatures"] = feat.get(c["id"], [])

    spec["componentTree"] = comps
    spec["rig"]["bones"] = [b for b in spec["rig"]["bones"] if b["component"] in keep]
    rigpos = {}
    for b in spec["rig"]["bones"]:
        p = next(q for q in P if q[0] == b["component"])
        cx, cy, cz = glob[p[0]]
        w, h, dd = (v / U for v in p[7])
        cid = p[0]
        if cid.startswith("clavicle"):
            s = 1 if cid.endswith("-l") else -1
            jp, tp = (cx - s * w / 2, cy, cz), (cx + s * w / 2, cy, cz)
        elif p[3] in ("arm", "leg", "hand"):
            jp, tp = (cx, cy + h / 2, cz), (cx, cy - h / 2, cz)
        elif p[3] == "foot":
            jp, tp = (cx, cy + h / 2, cz - dd / 4), (cx, cy - h / 2, cz + dd / 3)
        elif cid == "head":
            jp, tp = (cx, cy - h / 2, cz), (cx, cy, cz)  # chibi workaround: PROPORTION_LIMIT caps bones at 40% of skeleton height
        else:
            jp, tp = (cx, cy - h / 2, cz), (cx, cy + h / 2, cz)
        b["jointPos"], b["tipPos"] = [round(v, 4) for v in jp], [round(v, 4) for v in tp]
        if b.get("parent") not in keep:
            b["parent"] = None
    # materials ------------------------------------------------------------------------------
    skin = next(m for m in spec["materials"] if m["id"] == "skin")
    mats = []
    for mid, (hexc, rough, metal, mclass, _crop, name) in MATS.items():
        m = copy.deepcopy(skin)
        m.update(id=mid, name=name, baseColor=hexc, color=hexc)
        m["albedo"] = {"dominant": hexc, "secondary": [hexc]}
        m["colorVariation"] = {"palette": [hexc], "pattern": "flat", "amplitude": 0.03, "heightCorrelation": 0.0}
        m["roughness"] = {"base": rough, "variation": 0.05}
        m["metalness"] = {"base": metal, "variation": 0.0}
        m["notes"] = f"{name}: flat cartoon shading, colour from reference pixels; no real surface relief."
        if mid == "helmet":
            m["clearcoat"] = {"strength": 0.6, "roughness": 0.15}
            m["shaderModel"] = "MeshPhysicalMaterial"
        mats.append(m)
    spec["materials"] = mats
    # prune stale references in other sections -----------------------------------------------
    def prune(o):
        if isinstance(o, list):
            return [prune(x) for x in o if not (isinstance(x, str) and x in TEMPLATE_IDS and x not in keep)]
        if isinstance(o, dict):
            return {k: prune(v) for k, v in o.items()}
        return o
    for k in ("buildPasses", "featureReviewTargets", "actionReadiness", "animationAnchors", "destructionAnchors",
              "repetitionSystems", "qualityTargets", "lookDevTargets", "selfCorrectLoop", "sculptPipeline"):
        if k in spec:
            spec[k] = prune(spec[k])
    spec["targetName"] = "Chibi Soldier"
    # build passes: add structural-pass after blockout
    macros = [p[0] for p in P if p[2] == "macro"]
    ids = [bp["id"] for bp in spec["buildPasses"]]
    if "structural-pass" not in ids:
        spec["buildPasses"].insert(1, {"id": "structural-pass", "goal": "Lock the parent/child hierarchy: root > pelvis > torso > neck > head > helmet, shoulders > arms > hands > pistol, pelvis > legs > boots, chest > backpack.",
                                       "componentRefs": [p[0] for p in P if p[2] != "micro"],
                                       "acceptance": ["every part has the parent shown in componentTree", "limbs hang from shoulders/hips, helmet sits on head, backpack sits behind chest", "no floating or intersecting-through parts in front/side/back views"]})
    for bp in spec["buildPasses"]:
        if not bp.get("componentRefs"):
            bp["componentRefs"] = macros
    spec["featureReviewTargets"] = [
        {"id": "anatomy-proportion", "name": "Chibi proportions (~1.8 head-units) and pose", "tier": "critical", "passIds": ["blockout", "proportion-lock"], "minimumScore": 0.78, "mustPass": True, "componentRefs": ["root", "head", "helmet", "chest"], "evidenceRefs": ["full-object"]},
        {"id": "helmet-silhouette", "name": "Helmet dome, flared brim, glossy highlight placement", "tier": "critical", "passIds": ["feature-placement", "material-pass"], "minimumScore": 0.75, "mustPass": True, "componentRefs": ["helmet", "helmet-rim", "head", "helmet-rivet"], "evidenceRefs": ["full-object"]},
        {"id": "face-landmark-placement", "name": "Two black oval eyes set low, visible ear, no nose/mouth", "tier": "critical", "passIds": ["feature-placement"], "minimumScore": 0.75, "mustPass": True, "componentRefs": ["head", "eye-l", "eye-r", "ear-l", "ear-r"], "evidenceRefs": ["full-object"]},
        {"id": "pose-silhouette", "name": "Standing pose, pistol lowered at side, backpack behind", "tier": "critical", "passIds": ["blockout", "proportion-lock"], "minimumScore": 0.75, "mustPass": True, "componentRefs": ["root", "upper-arm-r", "pistol-slide", "backpack", "thigh-l"], "evidenceRefs": ["full-object"]},
        {"id": "outfit-and-palette", "name": "Grey uniform, red backpack, black boots/belt", "tier": "important", "passIds": ["material-pass"], "minimumScore": 0.7, "mustPass": False, "componentRefs": ["chest", "backpack", "foot-l", "belt", "belt-buckle", "strap-front-l"], "evidenceRefs": ["full-object"]},
    ]
    # ---- pre-spec assessment ------------------------------------------------------------------
    a = spec["preSpecAssessment"]
    a["objectClass"].update(
        primaryType="chibi soldier character (stylised humanoid, helmet + sidearm + backpack)", primaryDomain="character",
        formLanguage=["chibi / super-deformed", "rounded volumes", "thick uniform outline", "flat cartoon shading", "oversized head"],
        structureKind=["humanoid-skeleton", "rigid-shell helmet", "worn gear (backpack, belt)", "handheld prop (pistol)"],
        motionPotential=["idle", "walk", "aim-pistol", "turn-head", "hit-react"],
        materialFamilies=["toon skin", "painted fabric (jacket/trousers/backpack)", "glossy hard-shell helmet", "rubber boots", "dark metal pistol"],
        notes="Filled from direct visual inspection of 12345.png (1818x974): single standing character, near-frontal with ~20 deg yaw (backpack peeks out at viewer right).")
    a["complexity"]["tier"] = "moderate"
    a["complexity"]["scores"] = {"silhouetteComplexity": 2, "componentCount": 2, "hierarchyDepth": 2, "repetitionDensity": 0, "materialLayerCount": 2, "localDetailDensity": 2, "occlusionRisk": 2, "actionReadinessNeed": 2}
    a["complexity"]["estimatedCounts"] = {"macroComponents": 8, "mesoComponents": 20, "microFeatureGroups": 9, "materialLayers": 10, "repetitionSystems": 0}
    a["complexity"]["reasoning"] = ["~35 parts, rigid helmet/backpack/pistol on a simple humanoid; flat shading so little surface relief", "hidden sides (back of head, rear of torso, far side of backpack, far hand grip) cannot be seen"]
    a["specDepthDecision"].update(requiredDepth="moderate", needsMaterialLocalOverrides=True, needsActionReadyHierarchy=True,
                                  rationale="Moderate: many discrete rigid accessories, flat toon surfaces; action-ready because it is a rigged character.")
    a["unknownsToResolveBeforeImplementation"] = []  # hidden sides are recorded as assumptions/risks, not blockers
    hu = 418.0
    a["anatomy"].update(applies=True, styleHeads=1.83, confidence=0.7,
        note="Measured on 12345.png: crown(helmet top y=130) to chin y=548 = 418 px; foot sole y=895 -> total 765 px = 1.83 head-units. Chibi.")
    a["anatomy"]["proportions"] = {"headUnit": round(hu / IH, 3), "torso": round((790 - 130) / hu, 2), "legs": round((895 - 790) / hu, 2),
                                   "shoulderWidth": round(240 / hu, 2), "hipWidth": round(200 / hu, 2)}
    a["anatomy"]["pose"] = {"type": "standing, weight even, pistol held low at side (muzzle down-left)", "jointAngles": {
        "shoulder-r": 8, "elbow-r": 12, "shoulder-l": 6, "elbow-l": 10, "hip-r": -4, "hip-l": 4, "knee-r": 0, "knee-l": 0, "head-yaw": -8}}
    a["anatomy"]["faceLandmarks"] = {"eyeLine": 0.69, "eyeSpacing": 0.21, "noseBase": 0.0, "mouthLine": 0.0, "hairline": 0.55}
    a["anatomy"]["features"] = ["huge head vs body (head ~54% of total height)", "eyes are plain black ovals, no nose or mouth drawn",
                                 "helmet covers all hair; visible ear on viewer's right", "mitten hands, no finger detail"]
    save(SPEC, spec)
    print(f"structure: {len(comps)} components, {len(mats)} materials, {len(spec['rig']['bones'])} bones -> {SPEC.name}")


# --------------------------------------------------------------------------------------- evidence
def evidence():
    """Per-component colour recipes from PURE flat patches (see sample_ref.py purity numbers)."""
    cdir = EVID / "crops"
    for p in P:
        cid, mat = p[0], p[5]
        patch = COMP_PATCH[cid]
        out = cdir / f"part-{cid}.png"
        crop(PATCH[patch], out)
        r = run("forge/stage1_intake/extract_part_color_recipe.py", out, "--component-id", cid,
                "--material-class-hint", CLASS_HINT[mat], "--spec", SPEC, "--in-place",
                "--target-threshold", "0.6", "--no-cache")
        print(f"color {cid:17s} patch={patch:9s} exit={r.returncode}")

# --------------------------------------------------------------------------------------- finish
TEXTURE_FIELDS = ("normal", "bump", "displacement", "surfaceFrequencyBands", "textureProjection",
                  "textureResolution", "referencePbr")
# material -> (patch used as measurement, how to describe its tonal behaviour)
MAT_PATCH = {"buckle": "buckle", "skin": "skin", "shirt": "shirt", "pants": "pants", "shoes": "shoes", "eye": "eye",
             "helmet": "helmet", "backpack": "backpack", "pistol": "pistol", "belt": "belt", "strap": "strap"}


def patch_stats(box, only=None):
    import math
    import sample_ref as sr
    w, h, bpp, rows = sr.decode(sr.IMG)
    x0, y0, bw, bh = box
    px = [sr.px(rows, bpp, x, y) for y in range(y0, y0 + bh) for x in range(x0, x0 + bw)
          if only is None or sr.cls(sr.px(rows, bpp, x, y)) == only]
    n = len(px)
    mean = [sum(q[i] for q in px) / n for i in range(3)]
    sd = [math.sqrt(sum((q[i] - mean[i]) ** 2 for q in px) / n) for i in range(3)]
    return n, "#%02x%02x%02x" % tuple(round(v) for v in mean), sd


def finish():
    spec = load(SPEC)
    # ---- materials: flat cel-shaded reference -> declare textureless WITH measurements ------------
    for m in spec["materials"]:
        mid = m["id"]
        box = PATCH[MAT_PATCH[mid]]
        only = {"pistol": "g", "belt": "#"}.get(mid)
        n, hexc, sd = patch_stats(box, only)
        smooth = max(sd) > 6
        kind = ("smooth low-frequency shading gradient only (no grain, print or relief)" if smooth
                else "flat fill (grain-free)")
        for f in TEXTURE_FIELDS:
            m.pop(f, None)
        m["textureless"] = {"declared": True, "evidence": [
            f"12345.png patch x,y,w,h={box}{' (class-filtered)' if only else ''}: {n} px, mean {hexc}, "
            f"per-channel std {sd[0]:.1f}/{sd[1]:.1f}/{sd[2]:.1f} -> {kind}",
            "reference is a flat-shaded cartoon render with a thick uniform outline; identity is silhouette, "
            "proportion and boundaries between flat colour regions (measured with sample_ref.py)"]}
        m["notes"] = f"{m['name']}: flat cel-shaded paint, measured base {hexc}; surface is procedural (no reference textures)."
    mats = {m["id"]: m for m in spec["materials"]}
    mats["helmet"]["localOverrides"] = [
        {"id": "gloss-main", "description": "large soft white-grey specular highlight, upper-left of dome (x~738-833,y~180-240 of 12345.png)", "roughness": 0.18, "clearcoat": 0.8},
        {"id": "gloss-dot", "description": "small round secondary highlight below the main one (x~735-760,y~238-263)", "roughness": 0.15}]
    lk = spec["lookDevTargets"]["materialPass"]
    lk["mustAvoid"] = [x for x in lk.get("mustAvoid", []) if "single flat albedo" not in x]
    lk["note"] = ("Flat cel-shaded reference: flat albedo per material is CORRECT here and is declared via material.textureless "
                  "with measured evidence. Do not bake the outline strokes or highlights into albedo; the outline is a separate pass.")

    # ---- lighting (read off the reference: highlights on the helmet's upper-left, no cast shadows) --
    spec["lightingFromPhoto"] = [
        {"role": "key", "direction": "upper-left front (helmet specular at ~10-11 o'clock)", "intensity": 1.0, "color": "#fff4e6", "notes": "soft directional; cartoon lighting, low contrast"},
        {"role": "fill", "direction": "hemisphere / front ambient", "intensity": 0.55, "color": "#c9d3d8", "notes": "keeps the shadow side from going black so flat colours read"},
        {"role": "rim", "direction": "behind-right, slightly above", "intensity": 0.25, "color": "#bcd0ff", "notes": "separates the dark-grey uniform from the #1e1e1e background"},
        {"role": "environment", "notes": "plain dark neutral studio background #1e1e1e, no reflections to match"},
        {"role": "exposure", "notes": "exposure 1.0, ACESFilmic tone mapping, sRGB output; keep flat colours near the measured values"},
        {"role": "contact-shadow", "notes": "soft ground contact shadow under the boots (opacity ~0.35, radius ~0.25 units) plus ambient occlusion under the helmet brim and between arm and torso"}]
    spec["referenceCamera"]["note"] = ("Reference is near-frontal with ~20 deg yaw (backpack peeks out on the viewer's right). Camera pose NOT solved "
                                       "(solve_camera_pose.py not run); modelled in a symmetric bind pose, asymmetric pose recorded in anatomy.pose.")
    spec["suitability"] = "conditional"
    spec["assumptions"] = [
        "Chibi proportions are taken from the reference (~1.83 head-units); no realistic-ratio template is applied.",
        "Hidden sides (back of helmet/head, rear torso, far side of backpack, far hand) are inferred by symmetry.",
        "Bind pose is symmetric (the chirality gate requires mirrored pairs); the photo's asymmetric stance and the ~20 deg turn are recorded as pose, not baked into component positions.",
        "Mitten hands: no finger geometry; no nose/mouth/brows because the reference draws none.",
        "Head bone is shortened to the head centre because PROPORTION_LIMIT (bone <= 40% of skeleton height) cannot hold for a chibi; component geometry is unaffected."]
    spec["risks"] = [
        "Single view: back/side silhouette unverified; request turnaround views for accuracy there.",
        "Thick uniform outline needs a dedicated edge/inverted-hull pass; it is not part of any component's material.",
        "Pistol model is generic; backpack depth is a guess.",
        "No browser render + side-by-side review has been run yet: all geometry is first-pass from measured pixels."]

    # ---- detail inventory: each detail crops the reference and maps to a feature/override ---------------
    W, H = 1818.0, 974.0
    D = [("helmet-gloss-main", "gloss", (738, 180, 95, 60), "meso", "albedo/spec", "material", "gloss-main", "large soft specular highlight on the dome"),
         ("helmet-gloss-dot", "gloss", (735, 238, 25, 25), "micro", "albedo/spec", "material", "gloss-dot", "small secondary highlight dot"),
         ("helmet-brim-line", "linework", (700, 318, 330, 25), "meso", "silhouette", "component", "brim-line", "crease line where dome meets brim"),
         ("helmet-rivet", "fastener", (1005, 310, 26, 26), "micro", "silhouette", "component", "helmet-rivet", "single black rivet on the dome side"),
         ("chin-strap", "seam", (975, 410, 45, 120), "micro", "silhouette", "component", "strap-edge", "dark strap down the cheek"),
         ("collar-fold", "contour", (820, 545, 120, 50), "meso", "silhouette", "component", "collar-fold", "two folded collar flaps"),
         ("belt-buckle", "fastener", (826, 716, 44, 18), "micro", "silhouette", "component", "belt-buckle", "small grey buckle plate on the black belt"),
         ("toon-outline", "linework", (646, 128, 500, 770), "macro", "silhouette", "component", "toon-outline", "thick near-black outline on every edge"),
         ("backpack-pocket", "stitch", (1045, 650, 50, 75), "meso", "silhouette", "component", "pocket-stitch", "rounded side pocket"),
         ("pistol-slide-line", "groove", (620, 665, 160, 170), "micro", "silhouette", "component", "slide-groove", "lighter edge line along the slide"),
         ("eye-ovals", "decal", (745, 395, 190, 55), "meso", "albedo", "component", "eye-oval", "two plain black ovals, no catchlight")]
    details = []
    for did, kind, (x, y, w, h), scale, affects, mtype, ref, desc in D:
        out = EVID / "details" / f"{did}.png"
        crop((x, y, w, h), out)
        details.append({"id": did, "kind": kind, "description": desc,
                        "region": {"x": round(x / W, 4), "y": round(y / H, 4), "width": round(w / W, 4), "height": round(h / H, 4), "units": "normalized"},
                        "scale": scale, "affects": affects, "mapsTo": {"type": mtype, "ref": ref},
                        "evidenceRef": str(out), "confidence": 0.8})
    inv = spec["preSpecAssessment"]["detailInventory"]
    inv["details"], inv["scanMethod"] = details, "component-zones"
    spec["viewEvidence"][0]["observations"] = [
        "single standing chibi soldier, near-frontal with ~20 deg yaw on a plain #1e1e1e background",
        "thick uniform near-black outline; flat colour fills with a soft gradient on the helmet",
        "glossy dark helmet with flared brim, two plain black oval eyes, no nose/mouth, visible ear on viewer's right",
        "grey-green jacket, black belt, dark trousers, black boots, red backpack behind, dark pistol held low in the right hand"]
    spec["viewEvidence"][0]["confidence"] = 0.85
    save(SPEC, spec)
    # keep assessment.json in step with the spec's assessment
    a = load(OUT / "assessment.json")
    a["targetName"] = spec["targetName"]
    a["preSpecAssessment"] = spec["preSpecAssessment"]
    save(OUT / "assessment.json", a)
    print(f"finish: {len(spec['materials'])} materials textureless, {len(details)} details, {len(spec['lightingFromPhoto'])} lighting entries; assessment.json synced")



if __name__ == "__main__":
    TEMPLATE_IDS = {c["id"] for c in load(TEMPLATE)["componentTree"]}
    step = sys.argv[1] if len(sys.argv) > 1 else "all"
    if step in ("structure", "all"):
        structure()
    if step in ("evidence", "all"):
        evidence()
    if step in ("finish", "all"):
        finish()
