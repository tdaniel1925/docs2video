# Fix: agent name overlaps the slide headline in explainer/slide videos

This is the prompt I'd give myself. Investigate with real renders, not guesses.
Prove the fix on the SAME slides that broke (Michele de Vahle → Renee Hudson,
"Clearing Up the Confusion"). Plain language in any user-facing copy.

## The bug (from three share-page screenshots)
On the slide-deck explainer video, the TOP of each content slide stacks three
things that collide:
1. a small gold **eyebrow/kicker** ("WHY IT'S DIFFERENT", "THE BIG PICTURE",
   "OPTION TWO"), and
2. the **agent's name** in white caps ("MICHELE DE VAHLE"), sitting directly on
   top of / overlapping
3. the **big headline** ("A Tax-Smart…", "Three Paths To Compare", "Steady But
   Slow").

The name's baseline sits inside the headline's cap-height, so letters overlap and
it looks broken. This is the branded "Prepared for <client>" explainer style
(top-right shows "PREPARED FOR / Renee Hudson"; header shows "Powered by
Docs2Video").

There is ALSO a grammar defect on one slide — a bullet reads "And an strategy"
(should be "and a strategy"). Note it, but the OVERLAP is the priority.

## Where it lives (confirmed)
- Composition: `remotion/src/DirectedVideo.tsx` — the SLIDE SCENE renders
  `<SlideHeading kicker=… heading=… />` (from `remotion/src/slides/Slides.tsx`)
  inside a "reserved header band" (see the comments near lines 285–318).
- The **agent name** is a SEPARATE persistent overlay — look in
  `remotion/src/cinematic/Glass.tsx` (`PersistentFrame` / `LowerThird` / the
  top-left name), and how DirectedVideo mounts it. The kicker (in SlideHeading)
  and the name (in the frame overlay) are positioned INDEPENDENTLY, so on slides
  where both exist they land on top of each other.
- The slide videos render on the **VPS**; the same `remotion/src` is bundled
  there (redeploy.sh). A `remotion/src` change needs a VPS redeploy to take live.

## Investigate (do this first, don't skip)
1. Reproduce locally: render (or `<Player>`-screenshot) the actual scenes. Reuse
   the real plan if possible — pull the failing video's `script`/plan from the
   `videos` row (id `2e6a887e-9c65-4893-86d3-5617a359b3b2`) or the VPS `.job`
   payload, so you fix the exact layout that shipped.
2. Measure the two boxes: the frame's agent-name Y/position and font size, and
   the SlideHeading band's top + kicker + heading Y. Find WHERE they overlap and
   by how much. Screenshot before.
3. Decide the real cause — is the name drawn at a fixed top offset that ignores
   the kicker? Is the heading band starting too high? Is the name meant to be a
   lower-third that was moved to the top? Don't patch blindly.

## Fix (options — pick by what the render shows)
- Simplest robust fix: give the top a SINGLE owned stack with reserved space —
  name → kicker → heading in one fl<column> with real gaps, so nothing can
  overlap regardless of heading length. OR move the persistent agent name OUT of
  the headline zone (a lower-third at the bottom, or top-right under "PREPARED
  FOR", where there's room).
- Whatever the choice: the heading band must reserve enough vertical space for
  (name line + kicker line + up to 2 heading lines) and push bullets down
  accordingly, so a long headline never rides up into the name.
- Keep it consistent across ALL slide types (bullets / cards / screenshot / plain
  stack in DirectedVideo) — the overlap must be impossible on every layout, not
  just the three that were screenshotted.

## Guardrails
- Real uploaded assets only; don't change the brand look, just the spacing.
- Long headings must WRAP or fit-shrink, never collide — test with a
  deliberately long heading ("Three Paths To Compare And More" etc.).
- Fix "And an strategy" grammar at the source (the script writer /
  bullet-generator), not by hand on one slide.

## Verify (prove it — the checkers-that-lie rule)
1. Re-render the three failing scenes; screenshot each; confirm the name and
   headline are clearly SEPARATED with clean gaps. Show before/after.
2. Add a layout guard/test: render a scene with name + kicker + a long 2-line
   heading + bullets and assert (by reading pixels or bounding boxes) that the
   name's box and the heading's box do NOT overlap. Prove it FAILS on the old
   layout first.
3. typecheck; redeploy remotion bundle to the VPS (redeploy.sh --no-cache);
   regenerate one real explainer end-to-end and eyeball the top band.
4. Update the help/BUILD-STATE note if the slide layout changed materially.
