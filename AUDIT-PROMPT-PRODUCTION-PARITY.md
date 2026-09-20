# Deep-Dive Audit Prompt — "Did tonight's fixes reach every engine?"

You are auditing the Docs2Video production system for PARITY. Tonight we fixed five
real bugs in the SLIDE-DECK video path (the VPS `/generate-slides` → DirectedVideo
pipeline). Your job: prove whether each fix is present, absent, or partial in EVERY
other place that produces client-facing video, presentation, or share output — and
list exactly what's still broken with file+line evidence.

Do NOT trust comments or memory. Read the actual code and the actual rendered/served
output. For each finding, state: which engine, the file+line, whether the bug can
still ship, and the minimal fix. Prove a check can FAIL before you trust a pass.

## The five bug classes to hunt (all found + fixed in slides.js/watch page tonight)

1. COMPLIANCE SCRUB LEAVES BROKEN PROSE
   The carrier/product name-scrub deletes words mid-sentence, leaving stumbles the
   voice speaks ("so let's it up", "an strategy") and broken on-screen headings
   ("An Starting Point", "Long- Upside"). Fixed in slides.js via `smoothScrubbedSlides`
   (mirrors app/_lib/compliance.ts `smoothScrubbed`). QUESTION: does every OTHER
   generation path that scrubs also re-smooth BOTH narration AND headings/labels
   before TTS + render? Check: commercial.js, script-generator.ts (flipbook),
   /api/brief, V3/aurora/editorial engines, presentations, personalize.ts openings.

2. CLOSING/CONTACT SHOWS OUR PLATFORM, NOT THE AGENT
   The closing slide defaulted to "docs2video.com" and cta.contact=null. Fixed so
   footer/cta fall back to the AGENT'S own contact (never our brand, never source URL).
   QUESTION: does any other engine or template still hardcode "docs2video.com", a
   source URL, or an empty contact on a CLIENT-FACING frame? Grep every renderer +
   composition (remotion/src/**), commercial.js, editorial/V3, presentation output,
   PDF/deck export, email footers that go to clients.

3. TEXT OVERLAP / LAYOUT COLLISION
   Slide headings collided with the persistent chrome name until top padding was
   raised (DirectedVideo.tsx). QUESTION: do the OTHER compositions (V3Video,
   EditorialVideo, TemplateCommercial, any presentation/deck layout) have the same
   chrome-vs-content collision, or long-title overflow, at 1080p? Check each layout
   variant's top padding vs the chrome name/eyebrow position.

4. SHARE/OUTPUT LEADS WITH COMPANY INSTEAD OF THE PERSON
   The /watch page showed company_name ("Valor") where the agent's name belongs.
   Fixed to full_name-first with company as the secondary line. QUESTION: does every
   client-facing surface prefer the PERSON then company? Check: watch page (done),
   presentation share page, email templates (send-video-email, campaigns, nurture),
   PDF cover, deck export, MCP/presentation share_url, any "prepared by" string.

5. RAW STORAGE LINK INSTEAD OF THE BRANDED SHARE PAGE
   We nearly sent Renee a raw Supabase file URL instead of /watch/<id>. QUESTION:
   anywhere the system EMITS a link to a client (email templates, share buttons, MCP
   responses, API responses, "copy link" UI) — does it emit the branded /watch (or
   /p/ presentation) page, or a raw storage/googleusercontent URL? List every emitter.

## Engines/surfaces that MUST each be checked (enumerate, don't sample)

Video/presentation generators:
- VPS: server.js endpoints (/generate-slides, /render-v3, /render-editorial,
  /generate-commercial, /re-render-scene), slides.js, commercial.js
- Compositions: remotion/src/DirectedVideo, v3/V3Video, EditorialVideo,
  templates/TemplateCommercial, and any presentation/deck composition
- App: app/_lib/script-generator.ts, personalize.ts, compliance.ts, /api/brief,
  /api/generate-video, /api/generate-slides, /api/generate-presentation, /api/v1/*

Client-facing output surfaces:
- app/(public)/watch/[id] (done — reverify), the presentation share page (/p or
  equivalent), PDF/source export, deck "Download as PDF"
- Email: send-video-email, send-email, admin/campaigns/**, notifications.ts,
  _actions/auth.ts, prospect-send
- MCP + API: create_presentation/check_presentation, create_commercial, v1 routes —
  what URL do they hand back?

## Method (and anti-false-green rules)

- For each bug class × each engine, produce a row: {engine, file:line, status
  (SAFE / BROKEN / PARTIAL / N/A), evidence, minimal fix}.
- Where a fix is "shared" (compliance.ts, personalize.ts), confirm the OTHER engine
  actually CALLS it — an exported helper nobody invokes is BROKEN, not SAFE.
- For compliance smoothing: confirm it runs BEFORE TTS (a fix after VO is generated
  is useless — the voice already spoke the stumble).
- Prove at least one check can fail: e.g. construct a scrub input that leaves "an X"
  and show whether that engine emits it or repairs it.
- Regulated vs non-regulated: the scrub only runs when `isRegulated` — confirm the
  detection is consistent across engines (a video mis-flagged as non-regulated skips
  the scrub AND the smoothing).
- Do NOT edit anything. This is READ-ONLY. Output a prioritized findings table +ranked
  fix list (P0 = ships wrong to a client, P1 = cosmetic, P2 = internal-only).

## Deliverable

1. A parity matrix (5 bug classes × N engines) with SAFE/BROKEN/PARTIAL + file:line.
2. A ranked list of every place still broken, with the minimal fix for each.
3. One clear sentence per bug class: "This fix IS / IS NOT fully propagated, because…"
4. Anything ADJACENT you found while reading (same-family bugs we didn't hit tonight).
