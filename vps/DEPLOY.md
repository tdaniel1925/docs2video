# Deploying the video service

> **This folder is called `vps/` for historical reasons only. There is no VPS.**
> The renderer runs on **AWS ECS Fargate** behind a load balancer, and the app
> reaches it through `VIDEO_ASSEMBLY_URL`.
>
> An earlier version of this document described a Hetzner box at
> `root@5.161.215.156`, with `ssh` and `scp` commands you could copy and paste.
> That machine is gone. Every one of those commands would now fail, or worse,
> reach something unrelated. `vps/build-context.sh` already says so in its own
> header — "the box is gone, and with it the only place the image could
> actually be built" — but this file was never updated to match, so the one
> canonical deploy document pointed at a dead host.

## Where it runs

| Thing | Value |
|---|---|
| Platform | AWS ECS Fargate |
| AWS account | `423401347103`, region `us-east-1` |
| Task family | `docs2video-service` (`vps/ecs-task-definition.json`) |
| Image | `423401347103.dkr.ecr.us-east-1.amazonaws.com/docs2video-service:latest` |
| Container port | `4000` |
| Reached by | `VIDEO_ASSEMBLY_URL` → the load balancer, not an IP |
| Health check | `GET $VIDEO_ASSEMBLY_URL/health` → `{"status":"ok","ffmpeg":true}` |
| Secrets | SSM Parameter Store under `/docs2video/` — never in git, never in the image |

## The golden rule, unchanged

**Never hand-edit the running server.** Edit `vps/server.js` in this repo and
deploy. The live file once drifted ~174 lines from the repo because it was
patched directly with one-off scripts, and nobody could say what was actually
running. That risk is lower on ECS — a task is replaced, not edited — but the
rule is the same: git is the only source of truth.

## How a deploy works

1. **Assemble the build context.** `vps/build-context.sh` gathers everything
   the Dockerfile expects into a throwaway directory. This exists because the
   Dockerfile does `COPY remotion /app/remotion` and there is no `vps/remotion`
   in the repo — the old script copied it onto the server at deploy time, from
   a clone made on that box. That worked for exactly as long as the box did.

2. **Build and push.** `vps/buildspec.yml` builds the image and pushes it to
   ECR. It then **verifies the push by digest** rather than trusting the exit
   code — this project lost a day to sixteen pushes that all reported success
   while none of them landed, leaving yesterday's image serving traffic.

3. **Roll the service.** Force a new deployment so ECS pulls `:latest`:

   ```sh
   aws ecs update-service \
     --cluster <cluster> \
     --service docs2video-service \
     --force-new-deployment \
     --region us-east-1
   ```

   Without `--force-new-deployment` the task definition is unchanged, so ECS
   sees nothing to do and keeps running the old image. A green pipeline and an
   unchanged service look identical from the outside.

4. **Confirm the new code is live.** A deploy that reports success and changes
   nothing is the failure mode this whole file exists to prevent:

   ```sh
   curl -s "$VIDEO_ASSEMBLY_URL/health"
   ```

   Then check something only the new build does. The `relLum` blue coefficient
   fix (0.4361 → 0.0722) is invisible in `/health` — render a slide deck for a
   blue-branded customer and look at the accent.

## Secrets (SSM Parameter Store)

The task definition reads every key from SSM under `/docs2video/`. **A missing
key is not a deploy error** — the container starts without it and the code
falls through to its second choice. That is how this project once ran for days
on the wrong image provider with nothing in the logs.

**FAL_KEY is required for explainer slides.** `app/_lib/slide-engine.ts` draws
slides on fal and falls back to Gemini; without the key every slide silently
comes from the fallback. It warns once per process, into a container log
nobody is reading.

```sh
# One time, per environment. Value is in .env.local as FAL_KEY.
aws ssm put-parameter \
  --name /docs2video/FAL_KEY \
  --value "<the key>" \
  --type SecureString \
  --region us-east-1 \
  --overwrite

# Confirm it is readable (prints the name, not the secret)
aws ssm get-parameter --name /docs2video/FAL_KEY --region us-east-1 \
  --query 'Parameter.Name' --output text
```

## Logs

```sh
aws logs tail /ecs/docs2video-service --follow --region us-east-1
```

Per render the server logs `Audio N/N`, a `FAILED` count when TTS failed, and
`DB UPDATE ERROR` when a `videos` column is missing.

## Database columns come FIRST

If `server.js` writes a new `videos` column, add it by migration **before**
deploying. A missing column makes the entire "completed" update fail — and
supabase-js returns that as a value rather than throwing, so nothing crashes
and nothing is logged. This has bitten repeatedly; the most recent was
`slide_urls`, which had no definition anywhere in the repo while the refund
cron named it in a `.select()`.

Production does not run `supabase db push`. Apply migrations by hand in the
SQL editor and record it in `supabase/APPLIED.md`.

## Rolling back

ECS keeps previous task definition revisions. Roll back to one rather than
rebuilding:

```sh
aws ecs update-service \
  --cluster <cluster> \
  --service docs2video-service \
  --task-definition docs2video-service:<previous-revision> \
  --region us-east-1
```

## Not the deploy path

- **`vps/redeploy.sh`** — written for the Hetzner box. It clones to
  `/root/video-service` and runs `docker compose` there, which no longer
  exists. Kept only for the notes in its comments.
- The `systemd` unit `docs2video-assembler` at `/opt/docs2video-assembler/`
  was abandoned even on the old box (it could not bind port 4000 — Docker
  owned it).
- `video-service/setup.sh` describes that same old setup and is historical.
