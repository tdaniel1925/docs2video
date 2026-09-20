#!/usr/bin/env bash
#
# THIS SCRIPT IS FOR A MACHINE THAT NO LONGER EXISTS.
#
# It scp's server.js to a Hetzner box and restarts docker compose there. That
# box is gone. The render service runs on AWS ECS Fargate — a task is replaced,
# never edited, so copying a file at it does nothing even if the host answered.
#
# To ship the rembg endpoint now: merge process-logo-endpoint.js into
# render-service/server.js, then follow render-service/DEPLOY.md (assemble the
# context, upload the zip, build, force a new deployment).
#
# It refuses to run rather than half-deploying to nothing.
if [ "${I_KNOW_THE_VPS_IS_GONE:-}" != "yes" ]; then
  echo "deploy.sh: the VPS is gone — the render service runs on AWS ECS now." >&2
  echo "See render-service/DEPLOY.md. Override with I_KNOW_THE_VPS_IS_GONE=yes." >&2
  exit 1
fi
#
# Deploy the rembg logo enhancer to the video render service.
# Run from your machine AFTER you've:
#   1. merged process-logo-endpoint.js into vps/server.js
#   2. merged Dockerfile.additions into the VPS Dockerfile
#
# This mirrors the existing deploy flow (scp server.js + docker compose rebuild).
# The --build is REQUIRED here (not just restart) because the image changes
# (python3 + rembg + u2net model get installed).
set -euo pipefail

VPS="${VPS:-root@5.161.215.156}"
REMOTE_DIR="${REMOTE_DIR:-/root/video-service}"

echo "==> Copying server.js to ${VPS}:${REMOTE_DIR}/"
scp vps/server.js "${VPS}:${REMOTE_DIR}/server.js"

echo "==> Copying Dockerfile to ${VPS}:${REMOTE_DIR}/  (must already include Dockerfile.additions)"
scp vps/Dockerfile "${VPS}:${REMOTE_DIR}/Dockerfile" 2>/dev/null || \
  echo "    (no local vps/Dockerfile — edit it on the VPS directly, then skip this copy)"

echo "==> Rebuilding container (installs python3 + rembg + u2net model — first build is slow)"
ssh "${VPS}" "cd ${REMOTE_DIR} && docker compose up -d --build"

echo "==> Waiting for health..."
sleep 8
ssh "${VPS}" "curl -fsS -H 'x-api-secret: \$API_SECRET' http://localhost:4000/health || true"

echo "==> Verifying rembg is on PATH inside the container"
ssh "${VPS}" "docker compose -f ${REMOTE_DIR}/docker-compose.yml exec -T docs2video-service rembg --help >/dev/null && echo 'rembg OK' || echo 'rembg MISSING — check Dockerfile.additions'"

echo "==> Done. While you are SSH'd in, ALSO rotate the exposed secrets:"
echo "      passwd                              # rotate root password"
echo "      # then update GEMINI_API_KEY in ${REMOTE_DIR}/.env and rebuild"
