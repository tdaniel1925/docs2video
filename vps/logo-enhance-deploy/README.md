# rembg Logo Enhancer — VPS deploy bundle

Self-hosted background removal (rembg / U2-Net) for the brand-logo pipeline.
The app already calls this endpoint **gracefully** (`app/_lib/logo-enhance.ts`):
until it's deployed, logo processing just relies on Sharp's flat-color knockout.
Deploying this widens what processes cleanly (busy/photo/gradient backgrounds).

## What's in here
| File | Purpose |
|------|---------|
| `process-logo-endpoint.js` | The `/process-logo` Express handler to paste into `vps/server.js` |
| `Dockerfile.additions` | Lines to add to the VPS Dockerfile (python3 + rembg + u2net model) |
| `health-selftest.additions.js` | Optional: monitor rembg in `/health` + `/selftest` |
| `deploy.sh` | scp + `docker compose up -d --build` (rebuild required — image changes) |

## Steps
1. **Endpoint:** paste the marked block from `process-logo-endpoint.js` into
   `vps/server.js`, after `authCheck` is defined (e.g. near `/extract-document`).
2. **Image:** add `Dockerfile.additions` into the VPS Dockerfile
   (`/root/video-service/Dockerfile`), after the apt block, before `CMD`.
3. **Deploy:** `bash vps/logo-enhance-deploy/deploy.sh`
   (first build is slow — it installs Python + rembg + a ~176MB model).
4. **Verify:** the script pings `/health` and checks `rembg --help` in-container.
5. **While SSH'd in — rotate the exposed secrets** (root password + Gemini key).

## Contract
`POST /process-logo  { imageBase64 }` + `x-api-secret` → `200 { pngBase64 }`
(transparent PNG, background removed). Matches `app/_lib/logo-enhance.ts`.

## Notes / cost
- CPU inference (`onnxruntime`), ~1–3s per logo. No GPU needed for single images.
- Model baked at build time → no runtime download, works offline, deterministic.
- No vendor dependency, no per-image cost (uses your existing VPS).
- If rembg's output is still poor, the app's reject-with-guidance flow takes over
  (user uploads a transparent PNG, or continues without a logo).
