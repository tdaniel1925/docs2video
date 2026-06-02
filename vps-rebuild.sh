#!/bin/bash
# Rebuild VPS container from original image with ANTHROPIC_API_KEY
# Usage: bash /tmp/vps-rebuild.sh YOUR_ANTHROPIC_KEY
KEY=$1
if [ -z "$KEY" ]; then echo "Usage: bash /tmp/vps-rebuild.sh YOUR_ANTHROPIC_KEY"; exit 1; fi
docker stop docs2video-service 2>/dev/null
docker rm docs2video-service 2>/dev/null
cd /root/video-service && docker compose down && docker compose up -d
# The compose file doesn't have ANTHROPIC_API_KEY, so inject it
docker stop docs2video-service
docker rm docs2video-service
# Recreate with all env vars from compose PLUS the new key
docker run -d --name docs2video-service --restart unless-stopped -p 4000:4000 --tmpfs /tmp:size=2G \
  --env-file <(docker inspect --format='{{range .Config.Env}}{{println .}}{{end}}' $(docker create --rm video-service-video-service) 2>/dev/null || echo "PORT=4000") \
  -e "ANTHROPIC_API_KEY=$KEY" \
  video-service-video-service
echo "Container rebuilt. Checking..."
sleep 3
docker logs docs2video-service --tail 3
