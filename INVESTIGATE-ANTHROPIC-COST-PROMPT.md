# Investigation Prompt — Why is our Anthropic (Claude) spend so high?

You are auditing Anthropic/Claude API COST for the Docs2Video system (app on Vercel +
the video-service on the VPS at 5.161.215.156, container `docs2video-service`, code in
`vps/`; app code in `app/`). The key just ran DRY and had to be topped up — find out
WHERE the money goes and WHAT is wasteful. Read the actual code and, where possible,
measure real token counts. Deliver a ranked list of the biggest cost drivers with a
concrete fix + estimated $ saving for each. READ-ONLY — do not change behavior in this
pass; propose fixes.

## 1. Map every Claude call site

Find EVERY place that calls Claude/Anthropic across both codebases:
- VPS: `vps/slides.js`, `vps/commercial.js`, `vps/server.js`, any other vps/*.js — grep
  for the `claude(` helper, `anthropic`, `messages.create`, `x-api-key`,
  `api.anthropic.com`.
- App: grep `app/` for `@anthropic-ai/sdk`, `Anthropic(`, `messages.create`, `claude-`.
- For EACH call site record: file:line, the purpose (comprehend / write / critique /
  smooth / edit / brief / etc.), the MODEL used, `max_tokens`, whether it's per-VIDEO,
  per-SCENE, or per-REQUEST, and roughly how many times it fires to make ONE video.

## 2. Count calls-per-video (the multiplier is where cost hides)

For a single slide-deck video and a single commercial, trace the pipeline and count how
many Claude calls happen end-to-end. Look specifically for:
- PER-SCENE loops that call Claude once per scene (N scenes = N calls) — e.g. the writer,
  scene edits, the new smoother, per-beat work. A 14-scene video doing a per-scene Claude
  call is 14× the cost of a single batched call.
- Multi-pass chains on the SAME content: comprehend → write → critique → review →
  consistency → hook-pick → scrub-smooth. Each pass re-sends a large context. List them
  and flag any that could be merged or dropped.
- Retries / fallbacks that silently double a call.
- The compliance SMOOTHER specifically (`smoothScrubbed` / `smoothScrubbedSlides` /
  `smoothCommercial`): confirm it's batched into ONE call per video (it should be), not
  one per line. If it's per-line, that's a regression to fix.

## 3. Model + token efficiency

- Which model does each call use? Flag any call using an EXPENSIVE model
  (Opus/Sonnet-class) for a job a CHEAP model (Haiku-class) would do fine — comprehension,
  smoothing, short rewrites, JSON reformatting, classification are all Haiku jobs. The
  app-side smoother already uses `claude-haiku-4-5`; check the VPS `claude()` helper's
  default model and every big call's model.
- Look at `max_tokens` on each call — is anything set far higher than the output needs
  (you pay for the ceiling on some setups; you always pay for what's generated)?
- Input bloat: are we re-sending the ENTIRE source document / full plan on every pass when
  a summary or just-the-changed-fields would do? The comprehend step sends up to 120k
  chars — is that whole payload re-sent downstream?
- Prompt-caching: are the big, static system prompts eligible for Anthropic prompt caching
  and NOT using it? Repeated identical system prompts across scenes/videos are the #1
  caching win.

## 4. Waste + runaway patterns

- Any Claude call in a hot path that runs on EVERY request (not just video generation) —
  e.g. help-chat, script-chat, brief preview, a health/selftest, a cron.
- Loops with no upper bound on scene count / retries.
- Duplicate work: the same comprehension or scrub run more than once for one video
  (e.g. preview then final both call the full chain).
- Calls that fire even when the result is discarded or overwritten downstream.
- Dev/test scripts under `vps/` or `scripts/` that hit the live key.

## 5. Measure, don't guess

Where feasible, instrument or estimate: for one representative slide video and one
commercial, produce an approximate token+cost breakdown per call site (input tokens ×
model input price + output tokens × output price). Use the models' real pricing. If you
can't measure live, estimate from prompt sizes + max_tokens and SAY it's an estimate.

## Deliverable

1. A table of every Claude call site: file:line, purpose, model, max_tokens,
   per-video/scene/request, est. calls-per-video.
2. Calls-per-video total for a slide deck AND a commercial, with the token/$ estimate.
3. RANKED cost drivers (biggest first), each with: why it's expensive, the fix
   (cheaper model / batch the loop / prompt-cache the system prompt / drop a redundant
   pass / cap tokens / summarize input), and an estimated % or $ saving.
4. Any runaway/duplicate/hot-path calls that shouldn't be hitting Claude at all.
5. One-paragraph bottom line: the 3 changes that would cut the most spend.
