# Build prompt — Three shape families, three masters

Paste to a build agent in `C:\dev\1 - Restylez`.

---

You are a senior full-stack engineer in the Restylez app at `C:\dev\1 - Restylez` (Next.js 15; Supabase schema `restylez`; OpenAI `gpt-image-2` for images; sizes in `lib/sizes.ts`; the no-crop fitter in `lib/fit.ts`; the checks in `lib/proof.ts`; billing in `lib/billing.ts`; real cost in `lib/cogs.ts`; the makers are `app/api/create/route.ts` and `app/api/remake/route.ts`; the pages are `app/new`, `app/sizes`, `app/make`). Dev server already runs on http://localhost:3005 — do NOT start another. Super-admin login: `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in `.env.local` (never print them). Playwright + sharp from `C:\dev\1 - PrismGraphs`.

**UX priority:** the app is uncluttered and must stay that way. Match `app/new/page.tsx`. `rz-*` classes only, radius max 10px, one primary button per step with the price on it, one-sentence helpers, plain English. Screenshot every changed state desktop + 390px, LOOK at them, fix anything cramped.

**Ship rules:** `npx tsc --noEmit` and `npx next lint` clean on touched files. `git pull --rebase` before pushing. Commit in steps (co-author `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`), push, wait for `npx vercel ls restylez --scope bot-makers` Ready. Never print or commit secrets. Don't modify `C:\dev\1 - PrismGraphs`. Do NOT run `next build` against the running dev server — it overwrites `.next` and takes the site down.

## The problem, measured

`gpt-image-2` draws only three shapes: 1:1, 1.5 (wide) and 0.67 (tall). Real sizes are further away than that:

| size | target ratio | nearest drawable | gap |
|---|---|---|---|
| Instagram story | 0.56 | 0.67 | 16% |
| Facebook ad | 1.91 | 1.50 | 21% |
| LinkedIn banner | 4.00 | 1.50 | 63% |

Today we make ONE master (the first size ticked) and re-lay it out for every other size. Taking a 1.91 wide ad to a 0.56 story is a 240% shape change, and the model leaves blank bands — verified: the bottom 20% of a real story scored 6.9 and 4.4 against a middle of 65, and `checkDeadSpace` in `lib/proof.ts` flags exactly this.

## The fix: one master per shape family

Define three families in `lib/sizes.ts`:

- **wide** — target ratio > 1.2. Master drawn at 1536×1024.
- **square** — 0.83 to 1.2. Master drawn at 1024×1024.
- **tall** — < 0.83. Master drawn at 1024×1536.

Export `familyOf(size: SizeDef): 'wide' | 'square' | 'tall'` and `MASTER_SIZE: Record<family, '1536x1024' | '1024x1024' | '1024x1536'>`.

Then:
1. When a customer picks sizes, group them by family.
2. Make **one master per family they picked**, from the words and the look — in parallel (use `lib/pool.ts`).
3. Derive every other size **from the master of its own family** via the existing resize path, so a story comes from the tall master (a 16% stretch) rather than from a wide ad (240%).
4. Record `family` and `masterJobId` on every job so the admin can see which master a piece came from.

Nothing here changes the no-crop fitter or the checks; this reduces how much work the fitter has to do.

## Pricing — say it plainly, charge it plainly

- Each **master** is charged at the normal piece price (`print` or `small`, as now, by the master's own size).
- Every **derived** size stays $3, as now.
- So a customer ticking a flyer, an Instagram post and a story pays three masters. Ticking a flyer and a poster (both tall) pays one master plus $3.
- The "Before you make it" summary must show this honestly, e.g. *"3 shapes × $10, plus 4 extra sizes × $3 — $42"*, with one line under it: *"Each shape is designed properly for its own proportions, then every size within it follows."*
- Never charge for a master that fails. Existing free-first-piece and out-of-credit behaviour is unchanged.

## The UI

On the Sizes step of New Design (and the Sizes page), group the size pills under three quiet headings — **Wide**, **Square**, **Tall** — keeping the existing occasion grouping inside them if that reads better; your call, but do not add a second level of tabs. Show a small live line as they tick: *"2 shapes, 5 sizes."* Keep it to one added line; no new panels.

## Test

Playwright as super admin, on production after deploy:
1. Tick a Facebook ad (wide), an Instagram post (square) and a story (tall). Confirm three masters are made, the derived sizes come from their own family's master, and the summary showed the right price before the button.
2. Confirm `checkDeadSpace` passes on the story this time — that is the whole point. Compare against the recorded failure of 20% empty.
3. Tick a flyer and a poster (both tall) and confirm only ONE master is made.
Save the results and screenshots to `C:\Users\tdani\AppData\Local\Temp\claude\C--dev-1---PrismGraphs\b49a578b-8a92-4baa-9740-01972f39bb4f\scratchpad\family-*.png`, and look at the story yourself to confirm it fills its shape.

Report under 300 words: how families are decided, what a three-shape order costs, the dead-space verdict on the story before and after, screenshot paths, commits, deployment status, anything left undone.
