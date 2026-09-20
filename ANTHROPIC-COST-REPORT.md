# Anthropic (Claude) Cost Report — Docs2Video VPS pipelines

**Scope:** every Claude call in `vps/*.js`. Verified against source, not guessed.
**Headline:** every single Claude call in the whole system runs on **Opus 4.8** (~$15/M input, ~$75/M output) — the most expensive model — with **no prompt caching** anywhere. There is no Sonnet or Haiku call in the codebase.

All `$` and token figures below are **ESTIMATES** (marked). They scale with source length and output size.

---

## 1. Every Claude call site

| file:line | purpose | model | max_tokens | cadence | est calls/video |
|---|---|---|---|---|---|
| `slides.js:26-35` (`claude()` helper) | shared HTTP helper for ALL calls; model hardcoded (`slides.js:30`) | opus-4-8 | caller-supplied (no default) | — | 0 (helper) |
| `slides.js:154` comprehend | read full source → structured understanding JSON | opus-4-8 | 6000 | per-video | 1 (always) |
| `slides.js:192` writerFromUnderstanding | understanding → full 10-14 scene slide plan | opus-4-8 | 12000 | per-video | 1 (always) |
| `slides.js:377` smoothScrubbedSlides | repair carrier/product-scrubbed narration lines | opus-4-8 | 1500 | per-video | 0; 1 only if regulated AND a line changed |
| `commercial.js:808` comprehend (→`slides.js:154`) | understand brand from source | opus-4-8 | 6000 | per-video | 1 (always) |
| `commercial.js:864` creativeBrief (def 545, `claude()` 564) | invent mission/big_idea/voice | opus-4-8 | 1500 | per-video | 1 (always) |
| `commercial.js:867` direct (def 574, `claude()` 647) | MAIN writer: intent + styleId + all beats | opus-4-8 | 4500 | per-video | 1 (always) |
| `commercial.js:869` pickHook (def 656, `claude()` 665) | 5 hook variants, rewrite beat 1 | opus-4-8 | 800 | per-video | 0-1 (skip if beat1 kind = meet/brand) |
| `commercial.js:871` critiqueCreative (def 680, `claude()` 696) | judge each beat vs brief, rewrite weak lines | opus-4-8 | 2500 | per-video | 0-1 (skip if no brief) |
| `commercial.js:873` reviewConsistency (def 715, `claude()` 732) | QA: on-screen text matches VO, brand visible | opus-4-8 | 3000 | per-video | 1 (always) |
| `commercial.js:854` nameBrandColors (def 275, **inline** fetch 284) | VISION: name 2 hex from base64 screenshot | opus-4-8 (+image) | 200 | per-video | 0-1 (only when CSS + logo color both fail) |
| `commercial.js:891` smoothCommercial (def 457, `claude()` 467) | re-smooth scrubbed lines | opus-4-8 | 1500 | per-video | 0-1 (regulated only) |
| `server.js:2015` re-render-scene (edit-text) | rewrite one scene's copy after a manual edit | opus-4-8 | 2000 | per-EDIT (not generate) | 0 on generate; 0-3 per edited video |

**No per-scene / per-beat Claude loop exists.** The scene fan-out (`slides.js:494`) and beat loop (`commercial.js:926-966`) call ElevenLabs TTS + Gemini/FLUX images only. Scene count does NOT multiply Claude cost. Confirmed by reading both loops.

---

## 2. Calls + cost per video (ESTIMATES)

### Slide deck — 2 Opus calls (3 if regulated)
| step | in tok | out tok | est $ |
|---|---|---|---|
| comprehend (120K-char source ~30K in) | ~30,250 | ~2,500 | ~$0.64 |
| writer (12K max out) | ~3,300 | ~9,000 | ~$0.73 |
| smoothScrubbedSlides (regulated only) | ~500 | ~800 | ~$0.07 |
| **TOTAL typical** | | | **~$1.37/video** (regulated ~$1.44) |

### Commercial — ~6 Opus calls (7-8 on fallback/regulated)
| step | in tok | out tok | est $ |
|---|---|---|---|
| comprehend | ~30,000 | ~6,000 | ~$0.90 |
| creativeBrief | ~2,500 | ~1,500 | ~$0.15 |
| direct (main writer) | ~5,000 | ~4,500 | ~$0.42 |
| pickHook | ~500 | ~800 | ~$0.07 |
| critiqueCreative | ~2,000 | ~2,500 | ~$0.22 |
| reviewConsistency | ~3,000 | ~3,000 | ~$0.28 |
| nameBrandColors (vision, fallback only) | ~1,500 | ~200 | ~$0.04 |
| smoothCommercial (regulated only) | ~300 | ~1,500 | ~$0.11 |
| **TOTAL typical** | | | **~$2.06/video** (fallback/regulated ~$2.20) |

Output-token estimates assume calls run near their `max_tokens` cap; real cost may be lower if the model returns shorter JSON.

---

## 3. Ranked cost drivers (biggest first)

**1. Everything runs on Opus 4.8.** Every call in both pipelines is Opus. comprehend, creativeBrief, direct, critique, review, the two smoothers, the edit-text rewrite, and even "name 2 hex colors" are all structured-JSON transforms that Sonnet handles at ~5x lower cost and that Haiku handles for the trivial ones. The fix is one line: give `claude()` (`slides.js:26`) a model parameter and route each call to the cheapest model that passes. **Est saving: 60-80% of total Claude spend** (~$0.85-1.10/slide video, ~$1.30-1.60/commercial). This is the single biggest lever by far.

**2. comprehend re-sends up to 120K chars (~30K input tokens) of raw source, on Opus, every video** (`slides.js:154`). Shared by BOTH pipelines. Input alone is ~$0.45/video. Two fixes: (a) run comprehend on **Sonnet or Haiku** (it's a faithful-extraction task, not creative), and (b) trim the slice — 120K chars is huge; cap nearer 30-40K for most sources. **Est saving: ~$0.35-0.40/video on both pipelines.**

**3. No prompt caching anywhere.** No `anthropic-beta` / `cache_control` header exists in the codebase (confirmed — grep returned nothing). The big static system prompts (`direct()`'s 22-style catalog + schema + playbooks, ~2-3K tokens; writer's director/schema block; comprehend/critique/review system prompts) are identical across every video and re-sent uncached each call. Add cache headers to those static system blocks. **Est saving: cached input drops to ~10% of its cost → roughly $0.10-0.20/video, most on the commercial's repeated re-sends of the same `u` object across creativeBrief + direct.**

**4. The same understanding `u` is paid for as input 2-3 times per commercial.** `u` is re-serialized into creativeBrief (864), direct (867), and its facts flow into critique/review. Combine with driver 3 (cache it) or pass a slimmed `u` to the downstream passes. **Est saving: ~$0.05-0.10/video.**

**5. Multi-pass redundancy on the commercial.** critiqueCreative (871) and reviewConsistency (873) are two separate Opus passes over the same beats. On Sonnet they're cheap; if kept on any tier, they could be merged into one QA pass. **Est saving: ~$0.15-0.25/video if merged, or fold into driver 1.**

**6. nameBrandColors uses Opus + a vision image to name 2 hex colors** (`commercial.js:284`, max_tokens 200). Overkill, though it only fires on the CSS+logo fallback path. Move to Haiku vision. **Est saving: small (~$0.03/video, fallback only).**

---

## 4. Runaway / duplicate / hot-path / dev-script calls

- **No runaway loops.** Both per-item loops are TTS + image only. Confirmed by reading `slides.js:494` and `commercial.js:926-966`.
- **No Claude in dev/test scripts.** `parity-selftest.js`, `test-commercial.js`, `present-export.js`, `render-v3-endpoint.js` (editorial/V3 uses OpenAI TTS + Gemini only), and the `fix-*-rerender.js` scripts have **zero** Anthropic calls. Good — nothing stray hitting Claude.
- **Duplicate helper path:** nameBrandColors (`commercial.js:284`) does NOT use the shared `claude()` helper — it has its own inline fetch with the model hardcoded again. So a model fix in `claude()` will miss it; it needs its own edit.
- **edit-text (`server.js:2015`)** is off the generate hot path — it only fires on manual scene edits, so it's low volume, but it's still Opus for a light rewrite. Route to Haiku/Sonnet.
- **Data was thin on real output-token sizes** — I used the `max_tokens` caps as the upper bound, so the per-video `$` totals are ceilings, not averages. Actual spend is likely 10-30% lower where the model returns shorter JSON.

---

## 5. Bottom line — the 3 changes that cut the most spend

1. **Add a model param to `claude()` (`slides.js:26`) and move everything off Opus.** Sonnet for comprehend/direct/creativeBrief/critique/review/writer; Haiku for the two smoothers, nameBrandColors, and edit-text. Don't forget the inline call at `commercial.js:284`. **~60-80% cut.**
2. **Add prompt caching** (`cache_control` on the static system prompts) — biggest win on the commercial's repeated system prompts and re-sent `u`. **~$0.10-0.20/video.**
3. **Shrink comprehend's input** (`slides.js:154`): cap the source slice well below 120K chars and run it on the cheapest model that stays faithful. Helps BOTH pipelines. **~$0.35-0.40/video.**

Combined, a typical commercial drops from ~$2.06 to well under ~$0.50, and a slide video from ~$1.37 to under ~$0.35 — all estimates.
