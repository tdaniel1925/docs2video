# The film engine: plan (2026-11-14)

Owner: "I want all current styles in Docs2Video to be able to be rendered by this engine" — after approving 12 look
samples and the advisor cover/closing made in `C:\dev\1 - Code Films\engine` (the prototype).

## What it is

A new way of DRAWING a scene-kit plan. Same plan, same voice, same music, same pricing — a different picture:
a real 3D camera (CSS 3D: dolly, orbit, rack focus), depth and light, words landing as they are spoken, one
continuous world per look, and a theme system that makes each look itself.

## Why this way (lowest risk)

The scene kit already does everything around the picture, and does it well:
the Claude planner with code checks (numbers from the source, compliance scrub, no platform name, contact from the
profile), per-scene voice with word timings on fal (−16 LUFS), real logo + presenter photo, music beds, per-video
asset folder + Lambda upload with `assetBase`, progress and completion on the `videos` row, refunds, the free
preview still. None of that changes.

So the film engine is a SECOND RENDERER inside the kit's one composition:

- `KitPlan.engine?: 'film'` and `KitPlan.filmTheme?: FilmThemeId` (spec.ts).
- `KitVideo` draws `plan.engine === 'film'` with `remotion/src/film/*` instead of the kit scene views; the voice,
  music and timeline (`kitTimeline`) stay the kit's. Sound effects: none in film mode except one soft hit under
  the closing (owner rule: almost no sound effects).
- The render service is UNCHANGED (it renders `KitVideo` either way); `/preview-still` gets film stills for free.
- Deploy = Lambda site (remotion/src changed) + Vercel. No render-service image, no migration.

## The 12 looks (themes)

slides (Animated slides) · editorial · bright · infographic · midnight · heritage · warm (Warm Editorial) ·
bold (Corporate Bold) · mint (Fresh Mint) · swiss (Swiss Corporate) · luxury (Luxury Gold) · night (Cinematic
Night). Palettes and fonts are today's (kit spec, presentation templates, explainer templates).
"Your look" / brand looks: the theme is DERIVED from the kit `Look` (colors, fonts, feel, background) so every
custom look works too.

## Scene mapping (kit type → film scene)

| kit | film |
|---|---|
| title | cover: "Prepared for", headline landing on the voice, presenter photo + name/role (if any) |
| bignumber | the figure counts up and lands on `landOn` |
| comparison | two sides, figures count, verdict line |
| timeline | steps along a path the camera travels |
| chart | bar (3D columns), line (drawn path), donut (drawn arcs), highlight + takeaway |
| checklist | cards the camera travels along, ticks drawing on |
| quote | the quote, words landing as spoken, attribution |
| cta | headline, button, contact rows (booking/phone/email/website), presenter photo + brand/logo |

## Switch and rollout

- `FILM_ENGINE` = off (default) | admins | on, like `EXPLAINER_ENGINE`. When on for the user and the draft is a
  kit video, the film engine is used and the explainer branch is skipped for it.
- Step 3: with the film engine on, the look cards are the 12 looks (+ Your look, Drawn slides, Walk-through).
- Old videos and their re-renders are untouched (their plans have no `engine`).

## Guards (learned on the prototype)

- No plane bigger than the frame in 3D (huge planes crossing the camera blank whole frames).
- No gradient-clipped text (`background-clip: text` paints a solid box in the video renderer): gold is layered.
- Words always fit: headline sizes come from length × the face's letter width; left/right margins ≥ 200 px.
- Letterboxed looks frame content between the bars.

## Phases

A. Remotion: `src/film` renderer for all 8 scene types, themes, KitVideo switch; render every look on a real kit
   plan (KIT_STORIES) and check stills + one full render per look.
B. App: flag, plan marking (`assembleKitPlan`), look cards and mapping, explainer precedence, tests.
C. Card pictures (`public/style-samples/film-<look>-{cover,data,closing}.png`), help text, BUILD-STATE.
D. Owner review on a real draft, then deploy (Lambda site via deploy-lambda-site.sh, Vercel), then FILM_ENGINE=admins → on.
