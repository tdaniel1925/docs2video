#!/usr/bin/env bash
# Deploys vps/server.js to the Hetzner box (5.161.215.156).
# Run from the repo root: bash vps/deploy.sh
set -euo pipefail

HOST=root@5.161.215.156

echo "==> Uploading server.js"
scp vps/server.js "$HOST:/root/server.js.new"

echo "==> Inspecting runtime + backing up + swapping"
ssh "$HOST" '
  set -e
  C=$(docker ps --format "{{.Names}}" | head -1)
  if [ -n "$C" ]; then
    echo "Found container: $C"
    echo "--- env check (names only) ---"
    docker exec "$C" sh -c "env | grep -oE \"^(GEMINI_API_KEY|CARTESIA_API_KEY|API_SECRET|OPENAI_API_KEY|SUPABASE_URL)\" | sort"
    echo "--- @google/genai installed? ---"
    docker exec "$C" sh -c "ls /app/node_modules/@google/genai/package.json >/dev/null 2>&1 && echo YES || echo MISSING"
    docker exec "$C" sh -c "cp /app/server.js /app/server.js.bak.$(date +%s)"
    docker cp /root/server.js.new "$C:/app/server.js"
    docker restart "$C"
    echo "Deployed + restarted container $C"
  else
    echo "No docker container found — checking pm2/systemd"
    command -v pm2 && pm2 list || true
    ls /app/server.js 2>/dev/null || echo "/app/server.js not found on host"
    exit 1
  fi
'

echo "==> Health check"
sleep 4
curl -s -o /dev/null -w "health: %{http_code}\n" http://5.161.215.156:4000/health
echo "Done. IMPORTANT: if the env check above was missing CARTESIA_API_KEY or API_SECRET,"
echo "add them to the container env (video-service/docker-compose.yml on the box) and recreate."
