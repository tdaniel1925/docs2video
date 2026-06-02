# UX Streamline Report — Complete Create Flow Audit

**Date:** June 2, 2026
**Audited by:** Claude Code
**Scope:** Full create flow for Video, PPTX, and PDF modes

---

## Current Flow Summary

### Video: 5 pages, 4 clicks minimum
```
/create → /create/brand → /create/voice → /create/script → /create/generating
```

### PPTX / PDF: 4 pages, 3 clicks minimum
```
/create → /create/brand → /create/script → /create/generating
```

---

## Issues Found (Ranked by Impact)

### HIGH IMPACT — Blocking or Confusing Users

**H1. Four orphaned pages still in codebase**
- `/create/source`, `/create/extracting`, `/create/review`, `/create/options`
- These are from the old 7-step advanced flow
- Layout.tsx still detects them and shows a different progress bar
- If a user bookmarks or navigates to these, they get a broken experience
- **Fix:** Delete the 4 orphaned pages. Remove advanced flow logic from layout.tsx.

**H2. Brand page is too heavy for most users**
- After extraction, user lands on a full brand editing form (company name, description, services, USPs, industry, colors, contact info)
- Most users just want to confirm what was auto-detected and move on
- The "Skip — use generic styling" button text is misleading (you're skipping brand, not styling)
- **Fix:** Show a compact brand summary card with auto-detected info. One "Looks good" button to continue, one "Edit" link to expand the full form. Change skip text to "Skip branding."

**H3. No style/visual selection step in the new wizard**
- The old `styling/page.tsx` exists but is orphaned — not in the wizard flow
- Users have NO way to pick a visual style (warm-story, corporate-clean, bold-infographic, etc.)
- Style is either auto-suggested from URL or defaults to something generic
- **Fix:** Either (a) add a quick style picker to the brand page (3-4 thumbnail cards), or (b) restore a lightweight style step between brand and voice.

**H4. "AI writes it" content method is a dead button**
- Shows in the UI as an option but has no implementation
- Users who click it get nothing
- **Fix:** Either implement it (use Gemini to generate content from purpose description) or remove the button until it's ready.

**H5. Voice play buttons are placeholders**
- Voice selection shows 6 voices with play icons but no actual audio samples
- Users can't hear what they're choosing
- **Fix:** Generate 10-second TTS samples for each voice and store in `/public/samples/`. Wire up the play buttons.

**H6. No voice/music preview for podcast/dialogue modes**
- Solo vs podcast vs dialogue — user can't hear the difference
- **Fix:** Generate one 15-second sample of each narration style.

---

### MEDIUM IMPACT — Friction / Confusion

**M1. Detail level naming is confusing**
- Options labeled "Quick / Standard / Detailed / Comprehensive" sound like content depth
- They actually control video LENGTH (30s / 60-120s / 180-240s / 300-360s)
- Plan-gated options show "Starter+ plan" / "Pro+ plan" but no upgrade button
- **Fix:** Rename to show duration: "Short (30-60s)" / "Medium (1-2 min)" / "Long (3-4 min)" / "Extended (5-6 min)". Add "Upgrade" link on locked options.

**M2. Script page is overwhelming**
- 1100+ lines of UI — accordion scenes, editable narration, editable slide content, drag-to-reorder, AI chat sidebar, quick preview
- For most users this is too much — they just want to see the script and click Generate
- **Fix:** Default to a read-only script preview with a "Looks good, generate" button. Add an "Edit script" toggle that expands the full editor for power users.

**M3. Brand form stays visible after selecting a saved brand**
- Reported in testing — if user picks a saved brand, the create-new-brand form should collapse
- **Fix:** Hide inline form when a saved brand is selected.

**M4. No slide style previews**
- Style picker (if restored) needs actual thumbnail images, not just text descriptions
- **Fix:** Pre-generate 1 cover + 1 content slide per style and store as static images.

**M5. Fake progress bar during extraction**
- Step 1 shows hardcoded timeouts (2s, 5s, 10s, 18s) that don't reflect actual API progress
- **Fix:** Either show a simple spinner with "Extracting content..." or poll the actual extraction status.

**M6. Two different progress bar systems**
- `layout.tsx` has its own step detection (simple vs advanced)
- `WizardProgress.tsx` has its own step system (VIDEO_STEPS vs DOC_STEPS)
- They don't always agree
- **Fix:** Remove the layout.tsx step logic. Use only WizardProgress.tsx.

---

### LOW IMPACT — Polish

**L1. No "Continue draft" anywhere except dashboard**
- Drafts only show on the main dashboard page
- No indicator in the header or library
- **Fix:** Add a draft count badge to the header nav, or show a banner on the create page if drafts exist.

**L2. Header credit display is just a color dot**
- Users see green/yellow/red but not the actual number
- **Fix:** Show "X credits" text next to the dot, or in a small pill.

**L3. Output type cards don't explain the difference**
- "Video" / "Slide Deck (PPTX)" / "PDF Document" — what's the actual difference in output?
- **Fix:** Add a one-line subtitle: "Narrated video with AI visuals" / "Editable slides with speaker notes" / "Print-ready document".

**L4. No cancel/back during generation**
- Once generation starts, user can only wait or navigate away
- **Fix:** Add "Cancel" button that sets status back to draft.

**L5. Purpose field placeholder doesn't help enough**
- Generic placeholder text doesn't guide the user
- **Fix:** Show 2-3 example purposes based on output type: "Explain this policy to my client" / "Training deck for new hires" / "Client-ready summary document".

**L6. Contact info purpose is unclear**
- Phone, email, website, Calendly fields on brand page — user doesn't know these go on the closing slide
- **Fix:** Add helper text: "These appear on your closing slide/page."

---

## Recommended Streamlining Plan

### Phase 1: Clean Up (remove friction, no new features)
1. Delete 4 orphaned pages (`source`, `extracting`, `review`, `options`)
2. Remove advanced flow logic from layout.tsx
3. Fix brand form collapse when saved brand is selected (M3)
4. Remove "AI writes it" button (or hide until implemented) (H4)
5. Fix fake progress bar — use spinner instead (M5)
6. Unify progress bar systems — use only WizardProgress.tsx (M6)

### Phase 2: Quick Wins (reduce friction)
7. Compact brand page — summary card with "Looks good" default (H2)
8. Rename detail levels to show duration (M1)
9. Add subtitles to output type cards (L3)
10. Default script page to read-only with "Edit" toggle (M2)
11. Show credit balance number in header (L2)
12. Add "Continue draft" indicator in header (L1)

### Phase 3: Content (needs asset generation)
13. Generate voice samples for all 6 voices (H5)
14. Generate narration style samples (H6)
15. Add style picker with thumbnail previews (H3 + M4)
16. Add purpose placeholder examples (L5)

### Phase 4: Features (new functionality)
17. Implement "AI writes it" content method (H4 — if desired)
18. Add cancel button during generation (L4)
19. Add "Quick mode" — skip brand/voice/script, go straight to generation with defaults

---

## Click Count After Streamlining

### Current
| Mode | Pages | Minimum Clicks | Decisions |
|------|-------|---------------|-----------|
| Video | 5 | 4 | ~12 (type, purpose, content, brand fields, voice, style, length, music, script review) |
| PPTX | 4 | 3 | ~8 (type, purpose, content, brand fields, script review) |
| PDF | 4 | 3 | ~8 (type, purpose, content, brand fields, script review) |

### After Phase 2 (Streamlined)
| Mode | Pages | Minimum Clicks | Decisions |
|------|-------|---------------|-----------|
| Video | 5 | 4 | ~6 (type, purpose, content, "looks good" brand, voice+length, generate) |
| PPTX | 4 | 3 | ~4 (type, purpose, content, "looks good" brand, generate) |
| PDF | 4 | 3 | ~4 (type, purpose, content, "looks good" brand, generate) |

### After Phase 4 (Quick Mode)
| Mode | Pages | Minimum Clicks | Decisions |
|------|-------|---------------|-----------|
| Video (quick) | 2 | 2 | ~3 (type, purpose, content → auto-generate) |
| PPTX (quick) | 2 | 2 | ~3 (type, purpose, content → auto-generate) |
| Any (full) | 5 | 4 | ~6 (same as Phase 2) |
