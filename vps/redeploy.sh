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
# Pass --no-cache as the first arg to force a full rebuild (use when remotion/src
# changed). Default is a fast build (only changed COPY layers re-run).
BUILD_FLAG="${1:-}"

echo "==> Pulling latest"
rm -rf "$TMP" && git clone --depth 1 "$REPO" "$TMP"

echo "==> Copying server.js + remotion/src (the part that's been getting missed)"
cp "$TMP/vps/server.js" "$DIR/server.js"
rm -rf "$DIR/remotion/src" && cp -r "$TMP/remotion/src" "$DIR/remotion/src"

echo "==> Sanity: key markers present on disk"
grep -c "SlidePanelScene" "$DIR/remotion/src/v3/V3Video.tsx" >/dev/null && echo "   glass-panel: ok"
grep -c "render-editorial" "$DIR/server.js" >/dev/null && echo "   editorial endpoint: ok"

echo "==> Reclaiming disk (prune old images/cache so the build doesn't run out of space)"
docker system prune -af >/dev/null 2>&1 || true
df -h / | tail -1

echo "==> Building (${BUILD_FLAG:-fast})"
cd "$DIR"
if [ "$BUILD_FLAG" = "--no-cache" ]; then docker compose build --no-cache; fi
docker compose up -d --build

echo "==> Verifying the RUNNING container has the new code"
sleep 6
docker compose exec -T video-service grep -c "SlidePanelScene" /app/remotion/src/v3/V3Video.tsx >/dev/null \
  && echo "   container glass-panel: ok" || echo "   !! container MISSING glass-panel — run with --no-cache"
docker compose exec -T video-service sh -c "cd /app/remotion && npx remotion compositions 2>/dev/null | grep -E 'V3Video|EditorialVideo'" || echo "   !! compositions missing"

echo "==> Done. Generate a video to verify."
