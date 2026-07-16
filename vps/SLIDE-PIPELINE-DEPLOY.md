# Slide-Deck Pipeline — Deploy & Test Checklist

The slide-deck video system (DirectedVideo) now runs **entirely on the VPS**, matching
how document extraction + rendering already work. Vercel just triggers it.

```
Vercel  POST /api/generate-slides  ──►  VPS  POST /generate-slides
  (auth, create videos row)               • read doc (pdftotext / libreoffice) or text
                                          • comprehend + write deck (Claude)
                                          • VO with word timestamps (ElevenLabs)
                                          • backdrops (Gemini, best-effort)
                                          • render DirectedVideo (concurrency 8)
                                          • upload mp4 + thumb → Supabase
                                          • writes progress to the videos row
```

## What changed (all committed to git — the VPS clones from git)

- `vps/server.js` — new endpoints: **`/generate-slides`** (full pipeline) and **`/render-directed`** (render a pre-built plan).
- `vps/slides.js` — NEW module: the ported generation pipeline (comprehend, write, word-timed TTS, number/pronunciation normalization, cue resolution, brand palette, plan assembly). Anthropic via raw HTTP.
- `vps/redeploy.sh` — now copies `slides.js` + `remotion/package.json`, and verifies the new endpoint + `@remotion/transitions` are present.
- `remotion/` — the whole slide renderer: `DirectedVideo.tsx`, `slides/`, `IconMotif.tsx`, updated `Looks.tsx`, `cinematic/`, plus new deps `@remotion/transitions` + `@remotion/paths` in `remotion/package.json`.
- `app/api/generate-slides/route.ts` — NEW Vercel trigger route.

## STEP 1 — Commit & push (REQUIRED — the VPS deploys from git)

The redeploy script does `git clone`, so **anything not pushed will not deploy**. Many
slide-system files are currently untracked. From the repo root:

```bash
git add remotion/src remotion/package.json remotion/package-lock.json \
        vps/server.js vps/slides.js vps/redeploy.sh \
        app/api/generate-slides
git commit -m "feat(slides): slide-deck video pipeline on the VPS + Vercel trigger"
git push origin main
```

## STEP 2 — Add ANTHROPIC_API_KEY to the VPS

The pipeline uses Claude for comprehend + write. The VPS doesn't have this key yet.
Add it to the VPS environment (in `/root/video-service/docker-compose.yml` under the
service's `environment:` block, OR the `.env` it reads):

```yaml
    environment:
      - ANTHROPIC_API_KEY=sk-ant-...        # NEW — required for slides
      # (ELEVENLABS_API_KEY, GEMINI_API_KEY, SUPABASE_* already present)
```

## STEP 3 — Redeploy the VPS (run ON the VPS)

Because `remotion/package.json` changed (new deps), this needs a **`--no-cache`** build
so `@remotion/transitions` + `@remotion/paths` actually install in the image:

```bash
cd /root/video-service
bash redeploy.sh --no-cache
```

Watch the output for the new sanity markers — all should say **ok**:
```
   slide pipeline endpoint: ok
   slides.js module: ok
   DirectedVideo composition: ok
   transitions dep: ok
   container slides.js: ok
   container transitions dep: ok
```
The compositions check should now list **DirectedVideo** alongside V3Video / EditorialVideo.

> If `transitions dep` says MISSING, the build used cache — re-run `bash redeploy.sh --no-cache`.

## STEP 4 — Set the Vercel env (if not already)

`VIDEO_ASSEMBLY_URL` and `VIDEO_ASSEMBLY_SECRET` are already set (existing renders use
them). No new Vercel env needed for the trigger route.

## STEP 5 — Test the handoff end-to-end

**A) VPS health:**
```bash
curl -s $VIDEO_ASSEMBLY_URL/health   # (or open it) — expect ok
```

**B) A live slide video** — from the app, POST to `/api/generate-slides` with a document:
```jsonc
// POST /api/generate-slides   (authenticated)
{ "fileBase64": "<base64 of a PDF>", "fileName": "annuity.pdf",
  "preparer": "Meridian Financial Group", "recipient": "Mrs. Reyes", "music": "warm" }
// → { success: true, videoId }
```
Then poll the `videos` row (`progress_pct` / `progress_detail` climb 10→100). On success,
`status='completed'` and `video_url` is the mp4.

**C) Watch the VPS logs** if anything fails:
```bash
docker compose logs -f video-service | grep generate-slides
```
Failures write the real cause to the videos row's `progress_detail` (`[fail] generate-slides: ...`).

## Known limitations (current)

- **URL/website sources are NOT yet supported on the VPS** — the crawl needs Playwright
  in the Docker image (the local pipeline uses it, but it's not in the VPS container).
  `/generate-slides` returns a clear error for `url` sources. Documents + pasted text work.
  To add later: install Playwright + chromium in the Dockerfile and port `crawlSite`.
- **Backdrops need Gemini image credits** — when depleted, backdrops are skipped and the
  animated look-background is used (still clean). Music comes via `musicUrl` (else skipped).
- Concurrency is **8** (proven safe on this 16-core box; higher crashed Chrome via /dev/shm).

## Rollback

The new endpoints are additive — they don't touch `/render-v3`, `/render-editorial`, or
`/generate`. If a deploy misbehaves, the previous image still serves those. To fully revert,
redeploy from a prior git commit.
