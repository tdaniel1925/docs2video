# Fluid Video Design Plan — "one authored piece," low/no Gemini cost

## The problem (your words)
The three styles feel **assembled, not authored** — "a Frankenstein instead of a beautiful portrait." Scenes look like separate slides glued together.

## Root cause (verified in code)
The disconnection AND the cost are the **same bug**: **cinematic (V3) generates a fresh, unrelated Gemini image per scene** (`vps/server.js` ~line 1071, the `artPrompts` loop → `v3GeminiBg` per scene). Each image is an independent roll of the dice → different palette/lighting/style every 5 seconds = "different artists." It's also ~7 × $0.13 = the bulk of the per-video cost.
- `editorial` already uses images only on cover/lede (~1–2).
- `infographic` already uses **0–1** scene images.

**So the fix and the cost-cut are the same move:** stop generating per-scene imagery. A premium "one fluid piece" look comes from **motion + typography + layout + ONE consistent backdrop**, not from a new illustration each scene. (This is how most high-end explainer/motion-graphics videos are actually made.)

## The goal
A render mode that feels **highly produced and continuous** while using **at most ONE Gemini image per video** (the cover/backdrop) — or zero. Cinematic cost drops from ~7 images to ~1 (≈85% of image cost gone), and it looks *more* cohesive, not less.

---

## The 6 levers that make it feel "authored" (all in the render layer, no per-scene image gen)

### 1. ONE shared backdrop, not N images  ⭐ biggest win
- Generate **a single** atmospheric background ONCE per video (1 Gemini image at 2K — or a pure CSS/gradient/mesh background = $0), then **every scene composes on top of it**.
- The backdrop drifts/parallaxes slowly and **continuously across scene cuts** (the camera never resets) → instant "one continuous world."
- Cost: 1 image (or 0) vs 7.

### 2. A locked layout grid (furniture never moves)
- Title always in the same zone; data callouts in the same rail; logo/footer/scene-number locked. Scenes change **content**, never **position**. The eye stops noticing "new slide."
- One **type scale** (display / headline / body / caption) reused everywhere; text always **enters and exits the same way**.

### 3. Real transitions + continuous motion
- Cross-dissolves / match-cuts between scenes instead of hard cuts (even 0.4s changes everything).
- A persistent **motion layer** under every scene, unbroken: subtle gradient drift, film grain, floating particles, or a slow vignette pulse. This single unbroken layer is the strongest "it's one piece" signal.
- Ken Burns / parallax that **carries through** the cut rather than restarting.

### 4. Typography as the hero (where the "premium" actually comes from)
- Kinetic text: words/numbers animate in with staggered, eased motion (you already have some of this in cinematic — make it the *main event*, not a caption over an image).
- Big expressive numbers for data beats; clean editorial headlines for narrative beats.
- This is what makes a $0-image video look like a $5k motion-graphics piece.

### 5. Code-rendered visuals instead of generated images
For the visual interest images used to provide, use **render-layer elements** (all free, all consistent):
- Animated charts/bars/donuts (infographic style already does this — promote it everywhere).
- Iconography + shape systems (consistent line/fill style, brand-colored).
- Optional **stock B-roll** (Pexels/Pixabay API, free) for ambiance when a literal scene is wanted — still cheaper + more consistent than per-scene Gemini.

### 6. Audio glue
- One continuous **music bed** under the whole video (you have music gen) — never silent between scenes.
- **Crossfade narration** scene-to-scene so there's no tonal reset / dead gap between TTS chunks.

---

## Proposed approach: a new "Designed" look (or upgrade cinematic in place)

**Director's vision, authored once.** Before rendering, the AI writes a SINGLE creative direction for the whole video — palette (brand-derived hexes), motif, energy curve, motion personality — and that one spec drives **every** scene component, the backdrop, transitions, and music. Today each scene is briefed in isolation; one shared vision is the cure for Frankenstein.

**Render pipeline (per video):**
1. AI: one **art-direction spec** (no per-scene prompts).
2. Backdrop: 1 shared image (Gemini 2K) **or** a pure code background ($0) — user/admin toggle.
3. Remotion composition renders ALL scenes onto the shared backdrop using the locked grid + type system + continuous motion + transitions.
4. One music bed + crossfaded narration.

**Cost per video (cinematic):** ~7 images → **1 or 0**. Looks more cohesive, costs ~1/7th of the imagery.

---

## Where each change lives
- **Director's vision spec** → `app/_lib/script-generator.ts` (emit one creative-direction block per video) + thread into the render payload.
- **Stop per-scene Gemini in cinematic; one shared backdrop** → `vps/server.js` V3 branch (replace the `artPrompts`/per-scene `v3GeminiBg` loop with a single backdrop; pass it to the composition).
- **Locked grid, type scale, transitions, continuous motion layer, kinetic text** → the Remotion V3 components (the composition rendered by `/render-v3`).
- **Music bed + narration crossfade** → render/assembly step.
- **Toggle: shared-image backdrop vs $0 code backdrop** → `app_settings` flag (you already have the flag store) + per-video override.

## Rollout (low risk, incremental)
1. **Phase 1 (cheap + huge):** cinematic → ONE shared backdrop + continuous motion layer + dissolves + locked grid. Cuts cost ~85% and kills the Frankenstein feel immediately.
2. **Phase 2:** elevate kinetic typography + code-rendered charts/icons as the primary visuals (so $0-backdrop videos look premium).
3. **Phase 3:** director's-vision spec unifies image + motion + music + transitions from one authored direction.
4. **Phase 4 (optional):** Pexels B-roll option for literal-scene ambiance.

## Verification
- Render the same source as a video before/after; confirm: consistent palette across all scenes, no hard cuts, furniture doesn't move, one continuous motion+music bed, and **≤1 Gemini image** in the render logs.
- Check `/admin/costs` (and real Gemini usage) drops to ~1 image/video for the new look.

## Net
You don't need Gemini-per-scene to look premium — that's what's *causing* the cheap, stitched feel. Moving the "wow" into motion + typography + one consistent world makes it look more expensive **and** cuts your biggest cost line.

---

## DECISION (locked with user)
Rework **Cinematic** into a single shared "fluid" Remotion design system exposing **TWO selectable looks**:
- **Aurora** — pure Remotion, **$0 images**: continuous drifting mesh-gradient + grain + vignette background, kinetic display type, code-drawn charts/shapes, cross-dissolves, one music bed.
- **Editorial Cinema** — **~1 Gemini image** (one shared backdrop for the whole video) + continuous Ken-Burns push that carries through cuts, glass-panel cards, serif editorial type.

Both share ONE persistent shell: continuous background layer (never resets across cuts), locked layout grid (title/footer/logo zones fixed), one type scale + one motion personality, cross-dissolve transitions, unbroken music bed. Only content changes per scene.

Verified engine reality: the 3 current styles render via **Remotion** on the VPS (`npx remotion render V3Video|InfographicVideo|EditorialVideo`). The Frankenstein feel = cinematic's **per-scene Gemini bg** (`vps/server.js` ~1071 `v3GeminiBg` loop). Fix is Remotion-first; Gemini drops to ≤1/video.

### Build order
0. **Still mockups FIRST** — render 2–3 sample frames of Aurora + Editorial Cinema (no full pipeline) so the user approves the look before the full build.
1. New Remotion composition(s) for the fluid shell + both looks (in the baked `remotion/` project).
2. VPS V3 branch: drop per-scene `v3GeminiBg`; for Editorial-Cinema generate ONE backdrop; pass `look: 'aurora' | 'editorial-cinema'` + scene data as props.
3. Style picker: expose Aurora / Editorial Cinema (replace/augment current "cinematic").
4. Render full sample, verify ≤1 Gemini image in logs, palette consistent across all scenes, no hard cuts.
