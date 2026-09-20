#!/usr/bin/env bash
#
# THIS SCRIPT IS FOR A MACHINE THAT NO LONGER EXISTS.
#
# It scp's files to a Hetzner box and rebuilds docker compose there. That box
# is gone. The render service runs on AWS ECS Fargate — a task is replaced,
# never edited, so copying a file at it does nothing even if the host
# answered.
#
# To ship the V3 renderer now: merge render-v3-endpoint.js into
# render-service/server.js, then follow render-service/DEPLOY.md.
#
# It refuses to run rather than half-deploying to nothing.
if [ "${I_KNOW_THE_VPS_IS_GONE:-}" != "yes" ]; then
  echo "deploy.sh: the VPS is gone — the render service runs on AWS ECS now." >&2
  echo "See render-service/DEPLOY.md. Override with I_KNOW_THE_VPS_IS_GONE=yes." >&2
  exit 1
fi
#
# Deploy the V3 Remotion renderer to the video VPS.
# Run from the REPO ROOT on your machine, AFTER you've:
#   1. merged render-v3-endpoint.js into render-service/server.js
#   2. merged Dockerfile.additions into render-service/Dockerfile (Chrome + COPY remotion)
#
# This rsyncs the remotion/ SOURCE into the VPS build context (excluding
# node_modules/out/generated-media), copies server.js + Dockerfile, and rebuilds.
# First build is SLOW + heavy: Chrome + npm install + remotion browser ensure.
set -euo pipefail

VPS="${VPS:-root@5.161.215.156}"
REMOTE_DIR="${REMOTE_DIR:-/root/video-service}"

echo "==> Syncing remotion/ source into the VPS build context"
# Source only — node_modules/out/generated media are rebuilt/regenerated.
rsync -az --delete \
  --exclude 'node_modules' --exclude 'out' \
  --exclude 'public/*.png' --exclude 'public/*.mp3' --exclude 'public/*.mp4' --exclude 'public/*.json' \
  --exclude '*.log' \
  remotion/ "${VPS}:${REMOTE_DIR}/remotion/"

echo "==> Copying server.js + Dockerfile"
scp render-service/server.js "${VPS}:${REMOTE_DIR}/server.js"
scp render-service/Dockerfile "${VPS}:${REMOTE_DIR}/Dockerfile"

echo "==> Disk check (V3 image is large — Chrome + node_modules)"
ssh "${VPS}" "df -h / | tail -1"

echo "==> Rebuilding (SLOW: Chrome deps + remotion npm install + browser ensure)"
ssh "${VPS}" "cd ${REMOTE_DIR} && docker compose up -d --build"

echo "==> Verifying remotion compositions are discoverable in-container"
ssh "${VPS}" "cd ${REMOTE_DIR} && docker compose exec -T video-service sh -c 'cd /app/remotion && npx remotion compositions 2>/dev/null | grep -E \"V3Video|InfographicVideo\" || echo COMPS_MISSING'"

echo "==> Done. Flip the admin toggle (Settings -> V3 engine ON) to route new videos here."
