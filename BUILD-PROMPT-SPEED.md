# Build prompt — Make the app fast (or at least never make people wait)

Paste to a build agent in `C:\dev\1 - Restylez`.

---

You are a senior full-stack engineer in the Restylez app at `C:\dev\1 - Restylez` (Next.js 15 on Vercel; Supabase schema `restylez` with `jobs`, `ledger`, `profiles`, `settings`; helpers in `lib/admin.ts`, billing in `lib/billing.ts`, real cost in `lib/cogs.ts`; the browser library is IndexedDB via `lib/store.ts`; OpenAI `gpt-image-2` for images). Dev server already runs on http://localhost:3005 — do NOT start another. Super-admin login: `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in `.env.local` (never print them). Playwright + sharp from `C:\dev\1 - PrismGraphs`.

**UX priority:** the app is uncluttered and must stay that way. Match `app/new/page.tsx`. `rz-*` classes only, radius max 10px, one primary button per step, one-sentence helpers, plain English. Screenshot every changed state desktop + 390px and LOOK at them before finishing.

**Ship rules:** `npx tsc --noEmit` and `npx next lint` clean on touched files (no impure calls in client component bodies). `git pull --rebase` before pushing. Commit in steps (co-author `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`), push, wait for `npx vercel ls restylez --scope bot-makers` Ready (on Error read `npx vercel inspect <url> --logs`, fix, push). Never print or commit secrets. Don't modify `C:\dev\1 - PrismGraphs`. Schema changes go in `supabase/restylez-schema-v8-jobs.sql`, the code must work without it, and report the SQL to run.

## The problem

One image takes 90–240 seconds and we cannot make the model faster. But today the customer sits and watches, work is done one at a time when it could be done at once, and closing the tab loses everything. Fix the waiting, not the model.

**Do not change what the piece looks like.** No quality reductions, no smaller images, no cheaper model to gain speed. Every change here is about scheduling and waiting.

## Part 1 — Work that survives the tab (the big one)

Today a job lives inside the browser request. Move it to a queue.

- New table `restylez.render_jobs`: `id`, `user_id`, `kind` (create/remake/size/logo/thumbnail/deck), `status` (queued/running/done/failed), `request` jsonb, `result` jsonb, `error`, `attempts`, `created_at`, `started_at`, `finished_at`. Migration in the v8 file; if the table is missing, fall back to today's inline behaviour so nothing breaks before the SQL is run.
- A POST route returns a job id immediately. A worker route does the work. Trigger the worker with Vercel's `waitUntil` (from `@vercel/functions`, already available on the platform) so the response returns at once while the work continues, and add a small cron-style catch-up route that picks up anything left `queued` for more than a minute (Vercel Cron entry in `vercel.json`, every minute).
- The page polls the job id every 2 seconds (`/api/jobs/[id]`), shows the existing Making modal, and renders the result when it lands.
- **Closing the tab must not lose the work.** On return, any finished job for that user appears in the Library, and the page they were on offers "Your piece is ready" if it finished while they were away.
- Email when a job takes longer than ~3 minutes and the tab is gone (reuse the Resend helper from the promo feature; skip silently if not configured).

## Part 2 — Do things at once, not in turn

- **Sizes**: `app/sizes/page.tsx` still loops one at a time. Run them with a concurrency limit of 4 (a tiny promise pool, no dependency), preserving the existing per-size retry and the 402 stop-on-out-of-credit behaviour. Progress must report "3 of 5 done" correctly when they finish out of order.
- **New Design extra sizes** and **Logo Studio round variations**: same pool.
- **Thumbnails** already runs in parallel — reuse the same helper so there is one implementation, in `lib/pool.ts`.

## Part 3 — A matched family, made from one master (speed AND consistency)

When a customer asks for several sizes of the same piece:
- Make the **first** size normally. That is the master.
- For every other size, pass the master as the reference with an instruction to re-lay it out for the new shape keeping the identical artwork, palette and type treatment — this is what `resize` mode already does; make sure every path uses the master rather than the original upload, so the family matches.
- Record `masterJobId` on each derived job so the admin can see the family.

## Part 4 — Never pay for the same work twice

- **Identical repeats**: hash the full request (words, look, size, art direction, brand, photos) and, if the same user asks for the exact same thing within 24 hours, return the stored result instead of regenerating. Show a quiet note: "Same request as earlier — here it is again, no charge." Never charge for a cache hit.
- **The look reference**: looks are read from disk/URL on every job. Cache the fetched bytes in memory per instance.

## Part 5 — Feel faster

- The Making modal already climbs on a real clock. Add: when a job is queued behind others, say so ("Two pieces ahead of yours") rather than pretending it has started.
- Show finished pieces **as they arrive** in multi-piece runs, not all at the end (Sizes and Thumbnails).
- Preload the look image and the brand logo while the customer is still typing, so generation starts the moment they press the button.

## Part 6 — Measure it

- Record on every job: queued-at, started-at, finished-at, and the model time. Add a small "Speed" card to Admin → Money (or Internal, whichever fits): median and 90th-percentile time per tool for the last 7 days, and average queue wait. The owner should be able to see whether this work actually helped.

## Test

Playwright as super admin:
1. Start a New Design, close the tab mid-run, reopen, and confirm the piece is in the Library and the "ready" note appears.
2. Make 4 sizes and confirm they run together (total time well under 4× a single size) and that results appear as each lands.
3. Repeat an identical request and confirm it returns instantly, says so, and charges nothing.
Record the real timings in the report. Screenshots to `C:\Users\tdani\AppData\Local\Temp\claude\C--dev-1---PrismGraphs\b49a578b-8a92-4baa-9740-01972f39bb4f\scratchpad\speed-*.png`.

Report under 300 words: before-and-after timings you actually measured, the SQL to run by hand (verbatim in a code block), what happens when the tab closes, screenshot paths, commits, deployment status, anything left undone.

## Part 7 — Stop sending full-resolution images to the checkers

Measured on a live job: a New Design costs 53.5¢, of which **28.5¢ is the proof checks** and only 25¢ is the picture. Every check in `lib/proof.ts` (contrast block-finding, spelling read-back, safe area) sends the full-resolution PNG to a vision model — about 37,000 tokens each time.

Fix: downscale once per job to a checking copy (long side 1024px, JPEG quality 85) with sharp, and send **that** to every vision call. Keep the full-resolution buffer for the pixel-level work (bleed sampling, contrast sampling, scrim compositing) — those are code, not model calls, and must stay exact.

Requirements:
- One downscale per job, reused by every check, not one per check.
- The spelling read-back must still catch a wrong word at 1024px — verify by running it against a piece with a known text error and confirming it is still caught. If accuracy drops, raise to 1536px rather than reverting.
- Record the new per-check cost in the job's `spend` breakdown so the saving is visible on the admin pages.
- Report the before-and-after cost of one identical job.

Expected: the checking cost falls from ~28¢ to a few cents, and the checks finish faster, which also helps Part 5.
