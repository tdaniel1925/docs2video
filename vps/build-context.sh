#!/usr/bin/env bash
#
# ASSEMBLE THE BUILD CONTEXT FOR THE VIDEO SERVICE IMAGE.
#
# The Dockerfile does `COPY remotion /app/remotion`, but there is no
# vps/remotion in the repo: the old redeploy.sh copied it onto the SERVER at
# deploy time, from a git clone made on that box. That worked for exactly as
# long as the box existed. The box is gone, and with it the only place the
# image could actually be built.
#
# So this does that assembly HERE, from the repo, into a throwaway directory.
# The result is a self-contained context that `docker build` can consume
# anywhere — this laptop, ECS, a CI runner — with no server involved.
#
# What has to be in it, and why (all of this was learned the hard way and is
# recorded in redeploy.sh's comments — the notes are worth more than the code):
#
#   · server.js + slides.js + commercial.js + present-export.js
#       server.js requires ./slides and ./commercial. A missing module is not a
#       degraded feature, it is a crash-loop on startup with MODULE_NOT_FOUND.
#   · remotion/src
#       the compositions themselves.
#   · remotion/public/sfx/*.wav AND *.mp3
#       the Sfx components read these AT RENDER TIME. A missing file ENOENTs and
#       cancels the render. Copying only .wav once killed every luxury commercial.
#   · remotion/public/**/durations.json, beatgrid.json, transients.json
#       several compositions IMPORT these at the top of the bundle. Remotion
#       bundles every composition together, so ONE missing import fails the
#       WHOLE bundle before a single frame is drawn — this was the real cause of
#       the slide-render failures.
#
# Usage:  ./vps/build-context.sh [output-dir]
#         (defaults to .build-context, which is gitignored)

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$REPO/.build-context}"

echo "==> Assembling build context at $OUT"
rm -rf "$OUT"
mkdir -p "$OUT/remotion"

# --- the service itself -------------------------------------------------
for f in server.js slides.js commercial.js present-export.js Dockerfile package.json; do
  cp "$REPO/vps/$f" "$OUT/$f"
done
cp "$REPO/vps/package-lock.json" "$OUT/" 2>/dev/null || true

# --- the renderer -------------------------------------------------------
cp -r "$REPO/remotion/src" "$OUT/remotion/src"
cp "$REPO/remotion/package.json" "$OUT/remotion/package.json"
cp "$REPO/remotion/package-lock.json" "$OUT/remotion/package-lock.json" 2>/dev/null || true
mkdir -p "$OUT/remotion/scripts"
cp "$REPO/remotion/scripts/lambda-render.mjs" "$OUT/remotion/scripts/" 2>/dev/null || true

# Sound effects — read at render time; a missing one cancels the render.
mkdir -p "$OUT/remotion/public/sfx"
cp "$REPO"/remotion/public/sfx/*.wav "$OUT/remotion/public/sfx/" 2>/dev/null || true
cp "$REPO"/remotion/public/sfx/*.mp3 "$OUT/remotion/public/sfx/" 2>/dev/null || true

# JSON imported at the TOP of the bundle — one missing file fails every render.
for j in "$REPO"/remotion/public/*/durations.json \
         "$REPO"/remotion/public/*/beatgrid.json \
         "$REPO"/remotion/public/*/transients.json \
         "$REPO"/remotion/public/beatgrid.json; do
  [ -f "$j" ] || continue
  rel="${j#"$REPO"/remotion/public/}"
  mkdir -p "$OUT/remotion/public/$(dirname "$rel")"
  cp "$j" "$OUT/remotion/public/$rel"
done

# --- prove it, rather than hope ----------------------------------------
# Every one of these stands for a real outage. A context that is missing one of
# them builds fine and then fails at runtime, which is the worst kind of green.
echo "==> Checking the context is complete"
fail=0
need_file() { [ -f "$OUT/$1" ] && echo "   ok    $1" || { echo "   MISSING $1"; fail=1; }; }
need_file server.js
need_file slides.js
need_file commercial.js
need_file present-export.js
need_file remotion/package.json
need_file remotion/src/v3/V3Video.tsx
need_file remotion/src/templates/TemplateCommercial.tsx
need_file remotion/src/DirectedVideo.tsx

sfx=$(find "$OUT/remotion/public/sfx" -type f \( -name '*.wav' -o -name '*.mp3' \) 2>/dev/null | wc -l)
[ "$sfx" -ge 5 ] && echo "   ok    sound effects ($sfx)" || { echo "   MISSING sound effects (found $sfx, need 5+) — renders would ENOENT"; fail=1; }

json=$(find "$OUT/remotion/public" -name '*.json' 2>/dev/null | wc -l)
echo "   ok    bundle json files ($json)"

if [ "$fail" -ne 0 ]; then
  echo "==> INCOMPLETE — building this would produce an image that crashes at runtime."
  exit 1
fi

du -sh "$OUT" 2>/dev/null | sed 's/^/==> context size: /'
echo "==> Ready. Build with:"
echo "    docker build -t docs2video-service $OUT"
