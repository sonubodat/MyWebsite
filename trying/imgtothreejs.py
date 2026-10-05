#!/usr/bin/env python3
"""Run the img2threejs pipeline on one reference image.

1. Edit IMAGE_PATH below (or pass an image path as the first argument).
2. Run:  python3 ~/.mcphub/bin/imgtothreejs.py

Output lands in  imgtothreejs/<image-name>/  (next to where you run it):
    probe.json  assessment.json  spec.json  createObjectModel.ts

Stages 2-3 only scaffold an EMPTY spec. Strict validation fails until spec.json holds
object-specific detail (components, materials, lighting, detail inventory), which needs
something that can look at the image: Claude/Codex with the img2threejs skill, or you.
Re-running keeps your edited spec.json and just re-validates / regenerates.
"""
import json
import subprocess
import sys
from pathlib import Path

# ---- edit these ---------------------------------------------------------------------------
HERE = Path(__file__).resolve().parent
IMAGE_PATH = HERE / "12345.png"               # <- change this to your image (absolute path also works)
OBJECT_NAME = "Chibi Soldier"                 # "" = use the image file name
OUT_ROOT = HERE / "imgtothreejs"              # output folder, next to this script
CHARACTER = True                              # True when the reference is a humanoid character
# --------------------------------------------------------------------------------------------

SKILL = Path.home() / ".mcphub/skills/img2threejs"


def py(script, *args):
    cmd = [sys.executable, str(SKILL / script), *map(str, args)]
    return subprocess.run(cmd, cwd=SKILL, text=True, capture_output=True)


def tail(r, n=12):
    return "\n".join((r.stdout + r.stderr).strip().splitlines()[-n:])


def step(n, label, script, *args):
    r = py(script, *args)
    print(f"[{n}/5] {label} ... {'ok' if r.returncode == 0 else 'FAILED'}")
    if r.returncode != 0:
        sys.exit(f"{tail(r)}\n(stopped at step {n})")
    return r


def main():
    img = Path(sys.argv[1] if len(sys.argv) > 1 else IMAGE_PATH).expanduser().resolve()
    if not img.is_file():
        sys.exit(f"image not found: {img}\nEdit IMAGE_PATH in {__file__} or pass a path as an argument.")

    name = OBJECT_NAME or img.stem
    out = OUT_ROOT / img.stem
    out.mkdir(parents=True, exist_ok=True)
    probe, assessment, spec = out / "probe.json", out / "assessment.json", out / "spec.json"
    ts, blocked = out / "createObjectModel.ts", out / "blocked.json"
    char = ["--character"] if CHARACTER else []

    print(f"image : {img}\noutput: {out}\n")
    step(1, "probe image", "forge/stage1_intake/probe_image.py", img, "--out", probe)
    if json.loads(probe.read_text()).get("width") is None:
        sys.exit(
            f"\nNot a readable PNG/JPEG/WebP (wrong extension? PSD? corrupt?). Check:  file \"{img}\"\n"
            f"Convert to a real PNG first, e.g.:  sips -s format png \"{img}\" --out ~/Desktop/ref.png\n"
            f"(stopped at step 1; delete {out} if it was just created for this bad file)"
        )

    if assessment.exists():
        print("[2/5] pre-spec assessment ... kept existing")
    else:
        step(2, "pre-spec assessment", "forge/stage2_spec/new_pre_spec_assessment.py",
             name, "--image", img, "--out", assessment, *char)

    if spec.exists():
        print("[3/5] sculpt spec ... kept existing (not overwritten)")
    else:
        step(3, "sculpt spec (empty template)", "forge/stage2_spec/new_sculpt_spec.py",
             name, "--image", img, "--assessment", assessment, "--out", spec, *char)

    r = py("forge/stage2_spec/validate_sculpt_spec.py", spec, "--strict-quality")
    if r.returncode != 0:
        errs = [l[7:] for l in (r.stdout + r.stderr).splitlines() if l.startswith("error:")]
        print("[4/5] strict validation ... FAILED")
        for e in errs[:10]:
            print(f"   - {e}")
        if len(errs) > 10:
            print(f"   ... +{len(errs) - 10} more")
        sys.exit(
            f"\nspec.json is still an empty template. Fill it in, then run this script again:\n  {spec}\n"
            f"Fast way: tell Claude/Codex  \"Use the img2threejs skill: fill in {spec} for {img}, "
            f"then run python3 ~/.mcphub/bin/imgtothreejs.py\""
        )
    print("[4/5] strict validation ... ok")

    r = py("forge/stage3_build/generate_threejs_factory.py", spec, "--out", ts, "--force",
           "--blocked-report", blocked)
    if r.returncode != 0:
        sys.exit(f"[5/5] generate factory ... BLOCKED\n{tail(r)}\nsee {blocked}")
    blocked.unlink(missing_ok=True)
    print(f"[5/5] generate factory ... ok\n\nDone: {ts}")


if __name__ == "__main__":
    main()
