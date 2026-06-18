# V3 Remotion Renderer — VPS deploy bundle

Renders videos with the V3 engine (cinematic OR infographic theme) on the VPS,
using Remotion + headless Chrome. The app routes here only when the admin flag
**video_engine_v3** is ON (admin back office → Settings). When OFF, the classic
pipeline runs unchanged.

## Architecture
- App (`generate-video`) generates the grounded script, then POSTs the V3 payload
  to `/render-v3` (theme auto-picked by content, brand colors + logo injected).
- VPS `/render-v3`: TTS per scene (+ Gemini backgrounds for cinematic) → writes
  the comp props JSON → `npx remotion render` → uploads MP4 + thumbnail → marks
  the videos row completed. Async + ACK-fast like `/generate`.
- The `remotion/` project is **baked into the image** at `/app/remotion`.

## What's in here
| File | Purpose |
|------|---------|
| `render-v3-endpoint.js` | The `/render-v3` Express handler to paste into `vps/server.js` |
| `Dockerfile.additions` | Chrome deps + `COPY remotion` + `npm install` + `remotion browser ensure` |
| `deploy.sh` | rsync remotion source + scp server.js/Dockerfile + rebuild + verify comps |

## Steps (from repo root on your machine)
1. **Endpoint:** paste the marked block from `render-v3-endpoint.js` into
   `vps/server.js` after `authCheck` (already done in the repo copy — verify with
   `grep -c render-v3 vps/server.js`).
2. **Dockerfile:** ensure `vps/Dockerfile` contains the `Dockerfile.additions`
   block (Chrome libs + `COPY remotion /app/remotion` + install). Order: after
   the apt/rembg blocks, before `COPY server.js`.
3. **Deploy:** `bash vps/render-v3-deploy/deploy.sh`
   - rsyncs `remotion/` source into `/root/video-service/remotion`
   - rebuilds the image (SLOW: Chrome + npm install + browser ensure, adds ~1.5GB)
   - verifies `V3Video` + `InfographicVideo` compositions are discoverable
4. **Smoke test:** flip the admin toggle ON, generate one video, watch the row go
   `scripting → assembling → completed` with a `video_url`.

## Notes / cost
- Render is ~10–15 min per video single-threaded (Chrome frame-by-frame). Fine
  for launch volume; revisit Remotion Lambda if throughput is needed.
- Disk: the V3 image is large (Chrome + node_modules + Remotion browser). Run
  `docker system prune -af` first if `df -h /` is tight (we freed 17GB earlier).
- Failures mark the row `failed`; the app's fix-stuck-videos cron refunds credits.
- The endpoint reuses server.js's existing GoogleGenAI/OpenAI/Supabase setup —
  no new keys needed.

## Caveat to verify on first deploy
`npx remotion render` in-container needs the baked `node_modules` + a working
Chrome. If the comps-verify step in deploy.sh prints `COMPS_MISSING`, the remotion
install didn't complete — check the build log for the `npm install` / `browser
ensure` steps. The render also needs fonts (`fonts-liberation` is installed; the
comps load Google fonts via @remotion/google-fonts at build/runtime).
