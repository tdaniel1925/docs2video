# Build prompt — Real cost per use, and internal usage kept separate

Paste to a build agent in `C:\dev\1 - Restylez`.

---

You are a senior full-stack engineer in the Restylez app at `C:\dev\1 - Restylez` (Next.js 15; Supabase schema `restylez` with `jobs`, `ledger`, `profiles`, `settings`; helpers in `lib/admin.ts` — `jobLog`, `COST`, `service()`, `getSetting`; billing in `lib/billing.ts`; admin pages in `app/admin/*` sharing `app/admin/ui.tsx`; OpenAI `gpt-image-2` for images, `gpt-4o` / `gpt-4o-mini` for text and vision). Dev server already runs on http://localhost:3005 — do NOT start another. Super-admin login: `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in `.env.local` (never print them). Playwright from `C:\dev\1 - PrismGraphs`.

**UX priority:** match `app/admin/settings/page.tsx` — section cards, a title and one-line helper, tidy tables, right-aligned numbers with `tabular-nums`, money as `$1,234.56`, plain English, `rz-*` classes only, radius max 10px. Screenshot every page desktop + 390px and LOOK at them before finishing.

**Ship rules:** `npx tsc --noEmit` and `npx next lint` clean on touched files. Commit in steps (co-author `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`), push, wait for `npx vercel ls restylez --scope bot-makers` Ready. Never print or commit secrets. Don't modify `C:\dev\1 - PrismGraphs`. The owner runs SQL by hand: put any schema change in `supabase/restylez-schema-v7-cogs.sql`, make the code work without it, and report the SQL to run.

## The problem

`COST` is three guessed numbers (`imageHigh: 25, imageMedium: 6, text: 1`). We do not record what a job really cost, and the owner's own testing is mixed into the same totals as paying customers. He needs true cost per use, and internal usage kept in its own view.

## Part 1 — Measure the real cost

Create `lib/cogs.ts`:

- A price table per model, in cents, with the numbers written as constants and a comment saying where they came from and when they were last checked: `gpt-image-2` (per image, by size and quality — high 1024×1024, high 1024×1536/1536×1024, medium equivalents), `gpt-4o` and `gpt-4o-mini` (per million input and output tokens, and the extra cost of image input for vision calls).
- `costOfImage({ size, quality, n })` and `costOfText({ model, usage })` returning cents (keep fractional cents as a number; round only for display).
- A tiny accumulator, `newSpend()`, giving `add(kind, cents, meta)` and `total()`, so a route can tally every call it makes in one job.

Then thread it through **every** route that calls a model — `create`, `remake`, `logo`, `thumbnails`, `create/words`, `write`, `outline`, `pack`, `pptx`, `image`, plus the QA/vision helpers and anything in `lib/` that calls a model. Each model response carries a `usage` object for text; use it. For images, use the size and quality actually requested, including retries and repair passes — a job that regenerated twice must show twice the cost.

Record on the job: `costCents` (the real total, not an estimate) and a `meta.spend` breakdown like `{ image: 52, text: 1.4, vision: 2.1, calls: 7 }`. Keep `COST` exported for anything not yet converted, but mark it deprecated in a comment.

## Part 2 — Tell internal usage apart

- Add to `profiles`: `account_kind text not null default 'customer'` with values `customer` | `internal` | `demo`. Migration in the v7 SQL file; the code must treat a missing column as `'customer'`.
- The super admin and anyone whose email is on an internal list (a new admin setting `internal_emails`, plus any address matching `+demo@`) counts as `internal`; the demo runs (`tool = 'demo'`) count as `demo`.
- Admin → Customers gets a small pill showing the kind, and a control on the customer page to set it. Changing it writes to the audit log.

## Part 3 — Two dashboards, not one

**Admin → Money** becomes customers-only by default: every figure excludes `internal` and `demo`. Add at the top of the page a clear line: "Customer usage only. Internal and demo usage is on its own page." Show:
- Cost, revenue charged and margin for today / 7 days / 30 days, as a small table.
- **Cost per use**, the number the owner asked for: a table by tool (New Design, Remake, Sizes, Logo Studio, Thumbnails, Decks, PowerPoint) with runs, average cost, average charge, margin per run, and total. Sortable is not needed; correct is.
- The most expensive individual jobs in the period, linking to the customer.
- A per-model split (image vs text vs vision) so a rising bill can be traced.

**A new page Admin → Internal** (same tab bar) with exactly the same tables, for `internal` and `demo` usage only, plus a "what our own testing cost this month" figure. This is the owner's spend on himself, kept out of the business numbers.

Both pages read from `jobs`; do the aggregation in one SQL view or one query, not by loading every row into the browser.

## Part 4 — Make it hard to get wrong later

- A single helper `isInternal(userId | email)` used by both dashboards, so the rule lives in one place.
- The admin Jobs list shows the real cost per job and a small "internal" tag where it applies.
- If a job's recorded cost is zero but it called a model, show it as "not measured" rather than "$0.00", so an unconverted route is visible rather than silently free.

## Test

Playwright as super admin: run one real New Design (one image), confirm the job's recorded cost is non-zero, matches the model calls made, and that the job appears on the **Internal** page and NOT in Money's customer figures. Then flip a throwaway user to `customer`, log a job for them by hand if needed, and confirm it appears in Money. Screenshots to `C:\Users\tdani\AppData\Local\Temp\claude\C--dev-1---PrismGraphs\b49a578b-8a92-4baa-9740-01972f39bb4f\scratchpad\cogs-*.png`. Clean up test rows.

Report under 300 words: what a real New Design cost broken down by model, the SQL to run by hand (verbatim in a code block), how internal/demo is decided, screenshot paths, commits, deployment status, anything left undone.
