# Landing Page Audit — app/page.tsx

**Date:** 2026-06-21
**Audited against:** live codebase (`CREDIT_COSTS`, `TIER_CREDITS`, theme/style/voice config, generation routes, feature gates)
**Verdict:** The page has **real inaccuracies** — most seriously, the credit/pricing numbers are now *stale by 2×* after today's price doubling, and the page contradicts itself on whether Infographic and Course are live.

Severity key: 🔴 must-fix (misleading or wrong), 🟡 should-fix (overstated/inconsistent), 🟢 accurate.

---

## 🔴 1. Credit table is stale — shows OLD (pre-doubling) costs

We doubled all credit costs today (commit `c440d23`). The landing "How Pricing Works" table (lines 631–652) still shows the **old** numbers:

| What you create | Page says | Actual now (`CREDIT_COSTS`) |
|---|---|---|
| Quick video (<60s) | 250 | **500** (`videoQuick`) |
| Standard video (2–3 min) | 500 | **1000** (`videoStandard`) |
| Detailed video (5+ min) | 750 | **1500** (`videoDetailed`) |
| Slide deck (PPTX) | 400 | **800** (`pptx`) |
| PDF document | 300 | **600** (`pdf`) |
| Podcast narration add-on | +200 | **+400** (`podcastAddon`) |
| Style preview | 50 (first free) | **100** (first free) (`stylePreview`) |

**Fix:** update the table + the footnote (line 652) to the doubled numbers.

---

## 🔴 2. "~N standard explainers" per plan — overstated 2× on EVERY plan

Each plan card claims a video count that assumes the **old** 500-credit standard video. At the new 1000-credit cost the real counts are **half**:

| Plan | Credits | Page claims | Real (@1000/standard) |
|---|---|---|---|
| Free | 1,000 | "2 short videos / ~2 standard" (line 669–670) | **1 standard** |
| Starter | 5,000 | "~10 standard explainers" (684) | **5** |
| Pro | 25,000 | "~50 standard explainers" (699) | **25** |
| Business | 75,000 | "~150 standard explainers" (713) | **75** |
| Enterprise | 200,000 | "~400 standard explainers" (727) | **200** |

Note: `TIER_APPROX_VIDEOS` in `credits.ts` (lines 87–93) is ALSO still on the old math (free.standard:2, starter:10, pro:50, business:150, enterprise:400) — fix it there too so anything that reads it stays consistent.

**Fix:** halve every "~N standard explainers" figure on the page AND update `TIER_APPROX_VIDEOS`.

---

## 🔴 3. "Infographic" — page conflates a live VIDEO STYLE with a dead standalone product

**Critical distinction (confirmed with operator):** there are TWO different things called "infographic," and only one is live.

- ✅ **Infographic-STYLE VIDEO is LIVE.** It's a *video look/theme* (the `apex-corporate` / `bold-infographic` styles + the VPS `isInfo` render branch). The user gets a **video** that looks like an animated infographic. This works today.
- ❌ **Standalone INFOGRAPHIC MAKING is NOT live.** A single static shareable graphic (no video) does NOT ship. The code exists (`app/api/generate-infographic/route.ts`, `app/(dashboard)/infographic-creator/page.tsx`) but the UI is gated behind "Coming Soon" with `display:'none'`. Users cannot make a standalone infographic.

**The landing page's "Infographic" service card describes the dead one.** Lines 173–175 promise *"AI extracts charts, stats, and key findings into a single shareable graphic"* — that's standalone infographic making, which does not exist. It IS labeled "(Coming Soon)" there, so that card is technically honest — but it advertises a static-graphic product, not the video style that's actually shipping.

**Worse: two other sections imply infographic is a ready deliverable** (no Coming-Soon caveat), blurring the static product with the video style:
- Line 132 (How it works, step 2): *"…or data infographic — AI builds it in minutes."*
- Line 141 (step 3): *"…or embed your infographic — whatever works for your client."* (You can't embed a standalone infographic — that feature is off.)
- Line 420 (comparison table, "Output formats"): *"✓ Video, Deck, Course, Infographic"* — claims infographic as a current output advantage over Loom/Synthesia/Canva. Misleading: infographic is only available *as a video style*, not as its own output format.

**Video COURSE** is likewise built-but-gated (`course-builder/page.tsx`, Coming-Soon, `display:'none'`) — correctly labeled at line 167, but also implied-live at line 132 ("multi-episode course") and line 420 ("Course").

Today the **actual user-selectable outputs are: Video Explainer (incl. infographic-style look), Slide Deck (PPTX), and PDF.**

**Fix:**
- Lines 132, 141, 420: drop "infographic" and "course" from the implied-live lists. Output formats should read **"Video, Deck, PDF"** (infographic is a *style of video*, not a separate output; course is coming soon).
- 4-Services "Infographic" card (173–175): either keep as Coming Soon (fine), or — better — reframe what's actually live as **"Infographic-style video"** so visitors know that look is available now. Don't promise a "single shareable graphic" until standalone infographic making launches.

---

## 🟡 4. "16+ professionally designed templates" — only ~5–8 exist

Line 211: *"16+ professionally designed templates."* Actual:
- Infographic styles (`types.ts` ~320–351): **5** — isometric-3d, apex-corporate (Corporate Infographic), warm-story, dark-cinematic, bold-infographic.
- Video themes (`create/theme/page.tsx`): **3** — cinematic, editorial, explainer.

That's **8 at most**, not 16+. (The Templates showcase section lower down only displays 3 sample tiles.)

**Fix:** change "16+" to an honest number, or reword to "professionally designed styles" without the inflated count. Recommend "5 designed styles" or just "professionally designed templates" (drop the number).

---

## 🟢 5. Accurate claims (verified — leave as-is)

- **"6 natural-sounding voices"** (line 218) — correct: `VOICE_OPTIONS` has exactly 6 (nova/Sarah, shimmer/Emily, onyx/James, echo/Michael, alloy/Alex, fable/Oliver).
- **Video Explainer** and **Slide Deck (PPTX)** as live products — correct (`generate-video`, `generate-deck`/`generate-pptx` routes exist; selectable via `outputType`).
- **PDF document** output — correct (`pdf` cost + route exist).
- Default voice female (Sarah/nova first) — correct, matches the project rule.

---

## ⚠️ 6. Claims I could NOT verify in code — confirm before launch

These aren't code-checkable; verify they're true/legally defensible:
- **"SOC 2 compliant"** (line 747) — only claim this if you actually hold a SOC 2 report. False compliance claims are a legal risk.
- **"Bank-level encryption"** / **"Documents processed securely"** (lines 743, 751) — fine if TLS + at-rest encryption is in place (Supabase provides this), but "bank-level" is marketing puffery.
- Per-format **$10 / $249 price tags** in the 4-Services cards (lines 157, 163, 169, 175) — these are the legacy à-la-carte/one-off prices. Confirm they still match what a non-subscriber is actually charged, now that pricing is credit-based + doubled. The $249 Course price is moot while Course is Coming Soon.

---

## Recommended fix order
1. **#1 + #2** (credit table + plan video counts) — these are flat-out wrong as of today's price change and will cause refund disputes. Do these first.
2. **#3** (infographic/course contradiction) — reword the two "live" mentions to match the Coming-Soon reality.
3. **#4** ("16+" → honest count).
4. **#6** — confirm SOC 2 / encryption / per-format price claims with you before they ship.
