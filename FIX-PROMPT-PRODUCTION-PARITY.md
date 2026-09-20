# Fix Prompt — Propagate tonight's 5 fixes to every engine

You are fixing the parity gaps found in AUDIT-PROMPT-PRODUCTION-PARITY.md (report in
the workflow output). Tonight's 5 fixes landed ONLY on the slide-deck path; almost
every other engine still has at least one bug. Work ROOT-CAUSE FIRST — a few shared
fixes clear most of the list. Read the actual code before editing. After each fix,
PROVE it works (construct an input that would have shipped the bug and show it no
longer does). Do not mark anything done you haven't verified. Repo root: C:/dev/1 - PrismGraphs.

## Guardrails (do NOT reintroduce tonight's bugs)

- The smoother MUST run BEFORE TTS. A smoothing pass after the voice is recorded is
  useless — the voice already spoke the stumble. Confirm ordering every time.
- The smoother must cover BOTH spoken narration AND on-screen text (headings, kickers,
  bullet/card labels) — tonight's "An Starting Point" was a heading, not narration.
- Never let a rewrite re-introduce a blocked carrier/product name or drop a $/%/age
  figure. Reuse the existing reject checks in compliance.ts smoothScrubbed / slides.js
  smoothScrubbedSlides (complianceLeaks + figure-preservation). Do not hand-roll new ones.
- "Agent's own contact / name" NEVER falls back to "docs2video", a source/scraped URL,
  or an empty string on a CLIENT-FACING frame. Follow the slides.js pattern: agent
  website → calendly → phone → email → company; person's name before company.
- Client-facing links emit the branded /watch/<id> (or presentation) page, never a raw
  Supabase storage / googleusercontent URL.
- READ-ONLY on prod data. No destructive SQL. Deploy: app = git push (Vercel); VPS =
  scp changed files + `bash redeploy.sh` on the box, then confirm the new code is in
  the running container.
- Plain-language commits; end each with the Co-Authored-By line.

## Phase 0 — Consolidate the 3 root causes FIRST (these unlock everything else)

R1. ONE shared `isRegulated` detector. `vps/commercial.js:384` is missing
    `death benefit|cash value|surrender` that `slides.js:213` has → some content skips
    the scrub entirely (a NAME LEAK, worse than mangled prose). Export slides.js's
    detector and have commercial.js + every path import it. Prove: feed a
    "cash value" script through commercial's detector and show it now scrubs.

R2. ONE shared smoother, callable from every generator. It already exists twice
    (app/_lib/compliance.ts `smoothScrubbed` @181; vps/slides.js `smoothScrubbedSlides`).
    Do NOT fork a third. Make the scrub record {before,after} for narration AND
    headings/labels, and expose a single "scrub → smooth" entry each caller invokes
    before TTS/render. Keep the app and VPS copies mirror-identical (they can't import
    across the boundary; comment each as the mirror of the other).

R3. The stored `video.script` is written PRE-scrub (generate-video ~:570/611, before the
    scrub ~:623-641). Every "edit an existing scene" feature that re-reads video.script
    (regenerate-slide confirmed; also edit-slide, retry, reedit, translate) inherits raw
    carrier names. Decide the canonical fix: EITHER persist the scrubbed+smoothed script,
    OR make every re-read run scrub→smooth before use. Prefer persisting the clean
    version (single source of truth) unless something needs the raw text — if so, store
    both and document which is which. Prove: regenerate-slide on a regulated video no
    longer emits a carrier name.

## Phase 1 — P0 (ships wrong to a client now)

P0-1. Wire scrub→smooth into the WHOLE video dispatcher. `app/api/generate-video/route.ts`
      import is missing `smoothScrubbed` (:17); scrub at :623-641. After the scrub loop,
      collect changed {before,after}, `await smoothScrubbed(pairs)`, map repaired strings
      back onto scenes BEFORE :914 (cover/closing narration), :953 (ttsScenes), :1046,
      :1121 (buildEditorialPayload), :1160 (buildV3Payload), :1008 (Inngest event), :1223
      (legacy /generate). This ONE fix closes V3, editorial, legacy, Inngest, dispatcher.
P0-2. Fix-a-Scene re-introduces the bug. `vps/server.js:2032` scrubs then TTS at :2049 with
      no smoother; helper not required at :1960. Import `smoothScrubbedSlides`, await it on
      the in-place changes, re-read scene.narration before generateSceneVO. Same for
      /re-render-scene (same edit-text path).
P0-3. Commercial director + TemplateCommercial. `vps/commercial.js:16` omits the smoother;
      scrub :833-834, TTS :882 on scrubbed vo; on-screen fields cleaned :424-438. Track
      before/after in clean(), smooth before the TTS loop. Covers /generate-commercial too.
P0-4. script-generator.ts (flipbook) — :8 imports only CARRIER_BLOCKLIST; narration scrub
      :996, headline delete :1009. Import + call the smoother on scrubbed narration/headlines
      before returning scenes.
P0-5. regenerate-slide reads UNSCRUBBED script (see R3). isRegulated → scrub → smooth over
      headline/subtitle/bullets/stat-labels BEFORE buildSlidePrompt, so the regenerated PNG
      matches its siblings.
P0-6. generate-video slides preparer leaks our brand. `route.ts:1046`
      `preparer: effectiveBrandName || companyName || 'docs2video'` on the DEFAULT slides
      path. Fall back to '' like the classic/V3 signoff (:931-933), never 'docs2video'.
P0-7. Infographic email CTA = raw storage URL. `send-email/route.ts:75` +
      `email.ts:17/41/53`. This one is BLOCKED on a missing branded infographic viewer
      route — build a /watch-style infographic page first, then emit that. If out of scope
      for this pass, flag it and stop shipping the raw image link (gate the button).

## Phase 2 — P1 (visible, not ship-blocking)

- /render-v3, /preview-editorial, /render-editorial, v3-render.ts — downstream of P0-1;
  confirm repaired strings actually reach server.js:1305/2376 + render-v3-endpoint.js:117.
- brief + v1/brief — brief-core.ts:26-48 scrubs, no smoother; smooth changed fields after
  parseBrief before store/return (no TTS, timing-safe).
- regenerate-slide LEADS-WITH-COMPANY (:84/94/114 use brand.name, no profile loaded) — load
  owner full_name, primary; company secondary. Mirror watch page :950.
- /watch/[id] layout HTML <title>/description hardcode "Docs2Video" (layout.tsx:6-20) — join
  agent profile, use agent/company.
- /m/[id] campaign page — h1 :116, footer :249, header leads with recipient not agent;
  route never joins the owning agent. Join it, render agent identity header+footer.
- send-video-email — :43 `company_name || full_name` → flip to full_name first; from/footer
  brand.
- V3Video TEXT-OVERLAP — FullScreenScene.tsx:67 top pad 120px vs DirectedVideo 150px → raise
  to 150. Verify a long "top"/metric heading at 1920x1080 doesn't kiss the chrome name.
- IllusDeck hardcoded 555/example.com closing (:292-296) → CONTACT as a prop from the agent.
- TemplateCommercial closing CTA falls back to scraped source hostname (:950; rendered
  :505/520/536) → thread agent-contact param; guard empty url.
- email.ts footer, hosted MCP links (list_videos raw video_url :263; client link default
  docs2video.com :307), /unsubscribe/[id], try-demo + v1/videos raw links.

## Phase 3 — P2 (cosmetic / internal / owner-facing)

download-pdf/pptx metadata "Docs2Video"; generate-pptx/deck raw owner-facing bucket URLs
(→ signed/expiring); /share-demo mockup; InfographicVideo eyebrow/watermark; notifications.ts
latent brand/link/name (add agent params before any caller is wired).

## Method & deliverable

- Do Phase 0 first and re-run the relevant audit checks — several P0/P1 rows flip to SAFE
  once R1–R3 land. Don't fix symptoms the root cause already covers.
- For every changed generator: prove (a) smoother runs before TTS, (b) it repairs a
  heading AND a narration line, (c) no name re-enters and no figure drops.
- Deploy in batches (app together, VPS together), confirm live, THEN move on.
- Also check the "verify-data-thin, NOT assumed safe" list the audit flagged: /assemble,
  /export-presentation, /convert, deck-generator/planner/split, presentation-exports,
  campaign generate/approve/nurture — audit each before declaring the class closed.
- Final deliverable: the parity matrix re-scored to all-SAFE (or an explicit, justified
  remainder), the exact diffs per file, and a one-line proof per P0.
