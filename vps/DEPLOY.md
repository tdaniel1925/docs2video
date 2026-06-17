# Deploying the Video Assembly Server (VPS)

The video renderer (`vps/server.js`) runs as a **Docker container** on a
Hetzner VPS. The app calls it via `VIDEO_ASSEMBLY_URL`. This doc is the
canonical, tested deploy procedure — follow it exactly.

> ⚠️ **Golden rule: never hand-edit the server on the box.** Always edit
> `vps/server.js` in this repo, then deploy. In the past the live file was
> patched directly via one-off `vps-fix-*.py` scripts, which made the running
> server drift ~174 lines from the repo. `vps/server.js` in git is the single
> source of truth and must stay byte-identical to what's deployed.

## Facts

| Thing | Value |
|---|---|
| Host | `root@5.161.215.156` (Ubuntu 24.04) — this is the shared **apex-n8n-production** box; n8n also runs here |
| App directory | `/root/video-service` |
| Entry file | `/root/video-service/server.js` (per `Dockerfile`: `COPY server.js ./`, `CMD ["node", "server.js"]`) |
| Container name | `docs2video-service` |
| Compose image | `video-service-video-service` |
| Port | `4000` (bound by the container's `docker-proxy`) |
| Health check | `GET http://localhost:4000/health` → `{"status":"ok","ffmpeg":true}` |
| Env / secrets | `/root/video-service/.env` (on the box, NOT in git) |

There is **no bind mount** — `server.js` is baked into the image at build time,
so a file copy alone does nothing until you rebuild the image.

> Ignore these leftovers in `/root/video-service`: `container-server.js`,
> `server.js.bak`, `server-backup-*.j`, `patch.js`, `vps-*.py`. They are stale.
> Only `server.js` is built and run.

## Deploy (run from your local machine)

Keep each command on **one physical line** — PowerShell line-wraps (`>>`) will
split and corrupt the command.

```sh
# 1. Back up the currently-deployed file so you can roll back instantly.
ssh root@5.161.215.156 "cp /root/video-service/server.js /root/video-service/server.js.before-$(date +%Y%m%d-%H%M)"

# 2. Upload the repo's server.js (overwrites the deployed entry file).
scp "vps/server.js" root@5.161.215.156:/root/video-service/server.js

# 3. Rebuild the image and recreate the container.
ssh root@5.161.215.156 "cd /root/video-service && docker compose up -d --build"

# 4. Verify it came up healthy.
ssh root@5.161.215.156 "docker ps --filter name=docs2video-service"
ssh root@5.161.215.156 "curl -s http://localhost:4000/health"
```

On Windows PowerShell, `$(date ...)` in step 1 won't expand — use a literal
date suffix instead, e.g. `server.js.before-20260617`.

Step 4 must show the container `Up` and `{"status":"ok","ffmpeg":true}`.

## Rollback

```sh
# List backups, then restore the one you want.
ssh root@5.161.215.156 "ls -la /root/video-service/server.js.before-*"
ssh root@5.161.215.156 "cp /root/video-service/server.js.before-YYYYMMDD-HHMM /root/video-service/server.js && cd /root/video-service && docker compose up -d --build"
ssh root@5.161.215.156 "curl -s http://localhost:4000/health"
```

## Logs / debugging

```sh
ssh root@5.161.215.156 "docker logs --tail 100 docs2video-service"
# Per-render the server logs: 'Audio N/N', a 'FAILED' count if TTS failed,
# and 'DB UPDATE ERROR' if a videos-table column is missing.
```

## DB columns

If `server.js` writes a new `videos` column, add it via a
`supabase-*-migration.sql` **before** deploying — a missing column makes the
entire "completed" update fail. Example: `slide_durations` was added in
`supabase-slide-durations-migration.sql`.

## After deploying

Confirm the repo and the box match (no drift):

```sh
scp root@5.161.215.156:/root/video-service/server.js /tmp/deployed-server.js
git diff --no-index vps/server.js /tmp/deployed-server.js   # should be empty
```

## NOT the deploy path (stale leftovers — do not use)

- The `systemd` service `docs2video-assembler` at `/opt/docs2video-assembler/`
  is an abandoned, non-functional unit (it can't bind port 4000 — Docker owns
  it). Leave it disabled. Do **not** `scp` here or `systemctl restart` it.
- `video-service/setup.sh` in this repo describes that old systemd setup and is
  historical only.
