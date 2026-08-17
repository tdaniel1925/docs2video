#!/usr/bin/env bash
# One-command VPS redeploy for the video-service.
# Run ON THE VPS:  bash /root/video-service/redeploy.sh
# (or: cd /root/video-service && ./redeploy.sh)
#
# Why this exists: past redeploys copied server.js but FORGOT remotion/src, and
# the bundled Remotion inside the Docker image went stale — so new render code
# (glass panel, editorial, etc.) never actually ran. This script always copies
# BOTH, does a clean rebuild, and VERIFIES the new code is in the running
# container before declaring success.
set -euo pipefail

REPO="https://github.com/tdaniel1925/docs2video.git"
DIR="/root/video-service"
TMP="/tmp/d2v-deploy"
# DEFAULT (no args) = fast CACHED build. Because server.js + remotion/src are the
# LAST COPY layers in the Dockerfile, a cached build already picks up ALL code
# changes (it only re-runs those final COPY layers) — this is what you want
# almost every time. Only pass --no-cache when a BASE dependency changed (apt
# packages, the rembg/python install, package.json) — it rebuilds everything and
# needs ~2x image size on disk, which can exhaust the small 37GB disk.
BUILD_FLAG="${1:-}"

echo "==> Pulling latest"
rm -rf "$TMP" && git clone --depth 1 "$REPO" "$TMP"

echo "==> Copying server.js + slides.js + Dockerfile + remotion/src (the part that's been getting missed)"
# SELF-UPDATE: copy the newest redeploy.sh into place so this script never goes
# stale on disk (the footgun that made adding commercial.js a multi-step ordeal —
# the running copy couldn't copy the new module because IT was old). This affects
# the NEXT run; the current run finishes with whatever logic it started with.
cp "$TMP/vps/redeploy.sh" "$DIR/redeploy.sh" 2>/dev/null || true
cp "$TMP/vps/server.js" "$DIR/server.js"
cp "$TMP/vps/slides.js" "$DIR/slides.js"
# commercial.js — the commercial pipeline module (server.js requires ./commercial;
# without it the container crash-loops on startup with MODULE_NOT_FOUND).
cp "$TMP/vps/commercial.js" "$DIR/commercial.js"
# the Dockerfile itself must be synced — it now COPYs slides.js into the image
# (server.js requires ./slides; without it the container crash-loops on startup).
cp "$TMP/vps/Dockerfile" "$DIR/Dockerfile"
# docker-compose.yml must sync too — it maps env vars (e.g. ANTHROPIC_API_KEY)
# into the container. A stale compose file = the container silently lacks the key.
# NOTE: this preserves the box's .env (which the ${VAR} refs resolve against);
# only the compose file's structure/env-list is updated from git.
cp "$TMP/vps/docker-compose.yml" "$DIR/docker-compose.yml"
rm -rf "$DIR/remotion/src" && cp -r "$TMP/remotion/src" "$DIR/remotion/src"
# STATIC ASSETS the renderer reads at render time (SFX — the Sfx components load
# sfx/*.wav AND sfx/*.mp3; a missing file ENOENTs and cancels the render. The
# TemplateCommercial 'luxury'/'aurora' styles use .mp3 SFX like shimmer.mp3 —
# copying only *.wav (the old bug) killed every luxury commercial).
# These live in git under remotion/public/sfx and must reach the build context.
mkdir -p "$DIR/remotion/public/sfx"
cp -f "$TMP"/remotion/public/sfx/*.wav "$DIR/remotion/public/sfx/" 2>/dev/null || true
cp -f "$TMP"/remotion/public/sfx/*.mp3 "$DIR/remotion/public/sfx/" 2>/dev/null || true
# BUNDLE-REQUIRED JSON METADATA — several compositions IMPORT these at the TOP of
# the bundle (public/cinematic/durations.json, public/*/beatgrid.json, etc.).
# Remotion bundles ALL compositions together, so ONE missing import fails the
# WHOLE bundle at setup-cache and EVERY render (slides included) crashes before a
# frame is drawn. This copy was missing — the real cause of slide-render failures.
for j in "$TMP"/remotion/public/*/durations.json "$TMP"/remotion/public/*/beatgrid.json "$TMP"/remotion/public/*/transients.json "$TMP"/remotion/public/beatgrid.json; do
  [ -f "$j" ] || continue
  rel="${j#"$TMP"/remotion/public/}"
  mkdir -p "$DIR/remotion/public/$(dirname "$rel")"
  cp -f "$j" "$DIR/remotion/public/$rel"
done
# remotion/package.json must ride along so new deps (@remotion/transitions, paths)
# get installed on the next image build. NOTE: since COPY remotion precedes
# npm install in the Dockerfile, a package.json change needs a --no-cache build.
cp "$TMP/remotion/package.json" "$DIR/remotion/package.json"
cp "$TMP/remotion/package-lock.json" "$DIR/remotion/package-lock.json" 2>/dev/null || true

echo "==> Sanity: key markers present on disk"
grep -c "SlidePanelScene" "$DIR/remotion/src/v3/V3Video.tsx" >/dev/null && echo "   glass-panel: ok"
grep -c "render-editorial" "$DIR/server.js" >/dev/null && echo "   editorial endpoint: ok"
grep -c "generate-slides" "$DIR/server.js" >/dev/null && echo "   slide pipeline endpoint: ok"
grep -c "generateSlidePlan" "$DIR/slides.js" >/dev/null && echo "   slides.js module: ok"
grep -c "generate-commercial" "$DIR/server.js" >/dev/null && echo "   commercial pipeline endpoint: ok"
grep -c "generateCommercial" "$DIR/commercial.js" >/dev/null && echo "   commercial.js module: ok"
test -f "$DIR/remotion/src/templates/TemplateCommercial.tsx" && echo "   TemplateCommercial composition: ok"
test -f "$DIR/remotion/src/DirectedVideo.tsx" && echo "   DirectedVideo composition: ok"
grep -c "@remotion/transitions" "$DIR/remotion/package.json" >/dev/null && echo "   transitions dep: ok"
SFXN=$(ls "$DIR"/remotion/public/sfx/*.wav 2>/dev/null | wc -l); [ "$SFXN" -ge 5 ] && echo "   sfx wavs: ok ($SFXN)" || echo "   !! sfx wavs MISSING ($SFXN) — render will crash on ENOENT"

echo "==> Reclaiming disk BEFORE build (repeated --no-cache builds fill the disk)"
echo "   disk before:"; df -h / | tail -1
# The build CACHE is the usual culprit after --no-cache rebuilds — system prune
# alone leaves it. Nuke build cache + unused images + dangling volumes.
docker builder prune -af >/dev/null 2>&1 || true
docker image prune -af >/dev/null 2>&1 || true
docker system prune -af --volumes >/dev/null 2>&1 || true
echo "   disk after prune:"; df -h / | tail -1

echo "==> Building (${BUILD_FLAG:-fast})"
cd "$DIR"
# NOTE: server.js + remotion/src are the LAST COPY layers in the Dockerfile, so a
# normal CACHED build already picks up code changes — it only re-runs the cheap
# final COPY layers. --no-cache rebuilds the heavy ffmpeg/rembg/onnxruntime
# layers too, needing ~2x the image size on disk during export (the cause of
# "no space left on device" on the small 37GB disk). Only use --no-cache when a
# base dependency actually changed.
if [ "$BUILD_FLAG" = "--no-cache" ]; then
  # Build once with --no-cache, then `up` reuses that freshly-built image (no
  # second rebuild — avoids doubling the disk/time).
  docker compose build --no-cache
  docker compose up -d
else
  docker compose up -d --build
fi

echo "==> Post-build cleanup (drop the now-dangling old image layers)"
docker image prune -af >/dev/null 2>&1 || true
docker builder prune -af >/dev/null 2>&1 || true
echo "   disk after build:"; df -h / | tail -1

echo "==> Verifying the RUNNING container has the new code"
sleep 6
docker compose exec -T video-service grep -c "SlidePanelScene" /app/remotion/src/v3/V3Video.tsx >/dev/null \
  && echo "   container glass-panel: ok" || echo "   !! container MISSING glass-panel — run with --no-cache"
docker compose exec -T video-service test -f /app/slides.js \
  && echo "   container slides.js: ok" || echo "   !! container MISSING slides.js — run with --no-cache"
docker compose exec -T video-service sh -c "cd /app/remotion && npx remotion compositions 2>/dev/null | grep -E 'V3Video|EditorialVideo|DirectedVideo|TemplateCommercial'" || echo "   !! compositions missing"
# commercial pipeline module must be in the image (server.js requires ./commercial):
docker compose exec -T video-service test -f /app/commercial.js \
  && echo "   container commercial.js: ok" || echo "   !! container MISSING commercial.js — run with --no-cache"
# the slide renderer needs @remotion/transitions installed IN the image:
docker compose exec -T video-service test -d /app/remotion/node_modules/@remotion/transitions \
  && echo "   container transitions dep: ok" || echo "   !! MISSING @remotion/transitions — run: bash redeploy.sh --no-cache"
# SFX wavs must be IN the image (DirectedVideo's Sfx loads sfx/*.wav; missing = render crash):
CSFX=$(docker compose exec -T video-service sh -c 'ls /app/remotion/public/sfx/*.wav 2>/dev/null | wc -l' | tr -d '\r')
[ "${CSFX:-0}" -ge 5 ] && echo "   container sfx wavs: ok ($CSFX)" || echo "   !! container MISSING sfx wavs ($CSFX) — run: bash redeploy.sh --no-cache"

echo "==> Done. Verify: POST /generate-slides (slides) or /generate-commercial (commercial)."
