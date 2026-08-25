# Security Policy — PrismGraphs / Docs2Video

## Reporting a vulnerability

Email **trenttdaniel@gmail.com** with a description, reproduction steps, and
impact. You will receive an acknowledgment within 3 business days. Please do not
open public GitHub issues for security reports.

## Disclosure policy

- Report privately first; we ask for a 90-day coordinated-disclosure window
  while a fix is developed and deployed.
- Good-faith research against your own account/data is welcome. Do not access
  other users' data, degrade the service, or run automated scanners against
  production video-generation endpoints (they spend real AI credits).
- We will credit reporters who want credit once the fix ships.

## Secret handling rules

- **Never commit secrets.** All secrets live in environment configuration:
  Vercel env vars for the web app, `/root/video-service/.env` on the VPS
  (referenced via `${VAR}` in `vps/docker-compose.yml`), and the Supabase
  dashboard. `.env.local` is gitignored.
- **No `.env` backups in the repo or on shared drives.** Do not create
  `.env.bak`, `.env.old`, or copies of env files anywhere inside the working
  tree — gitleaks scans every push/PR and history (`.github/workflows/gitleaks.yml`).
- **Customer-provided files go in `.private/`**, which must remain gitignored —
  never alongside tracked sample assets.
- The VPS renderer fails closed if `API_SECRET` is unset; never reintroduce a
  fallback/default secret in code.
- When a secret is rotated, update every consumer (Vercel env, VPS `.env`,
  restart the container) and add a row to the rotation log below.

## Key rotation log

| Date | Secret | Action |
|---|---|---|
| 2026-08-24 | Apex-project Supabase keys | Migrated to `sb_secret` format keys |
| — | VPS `API_SECRET` / `VIDEO_ASSEMBLY_SECRET` | **Rotation still pending** — the old fallback value existed in code history (see SOC2-READINESS.md §1); rotate on the VPS `.env` + Vercel env and record here |

## Scope notes

- The web app runs on Vercel; the database/auth/storage is Supabase; the video
  assembly service is a Docker container on a Hetzner VPS reached only with the
  `x-api-secret` shared-secret header (constant-time compared).
- Supported version: the `main` branch as deployed to production. No older
  versions are supported.
