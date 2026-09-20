# Build prompt — Understand the content, then check the result

Paste to a build agent in `C:\dev\1 - Restylez`.

---

You are a senior full-stack engineer in the Restylez app at `C:\dev\1 - Restylez` (Next.js 15; Supabase schema `restylez`; OpenAI `gpt-image-2` for images and `gpt-4o` / `gpt-4o-mini` for text and vision checks; billing via `lib/billing.ts`; sizes in `lib/sizes.ts`; looks in `lib/looks.ts`; brands in `app/brands` + `lib/store.ts`; help in `lib/help.ts`; CSS `rz-*` in `app/globals.css`, radius max 10px). Dev server already runs on http://localhost:3005 — do NOT start another. Super-admin login: `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in `.env.local` (never print them). Playwright + sharp from `C:\dev\1 - PrismGraphs`.

**UX priority:** the app is uncluttered and must stay that way. Match `app/new/page.tsx`. No new UI libraries, `rz-*` classes only, one primary button per step, one-sentence helpers.

**Ship rules:** `npx tsc --noEmit` and `npx next lint` clean on touched files (no impure calls in client component bodies). Commit in steps (co-author `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`), push, wait for `npx vercel ls restylez --scope bot-makers` Ready (on Error read `npx vercel inspect <url> --logs`, fix, push). Never print or commit secrets. Don't modify `C:\dev\1 - PrismGraphs`.

**The problem this solves.** A customer typed/dictated a grand-opening flyer. We printed their sentences verbatim: the headline read "they grand opening event" (a dictation slip), one line read "that is selling Daniel's birthday", and the address, the time and the offer were all buried in identical grey body text. We treat words as a block. We must understand what each line *is* before designing it, and check the result afterwards.

## Part 1 — The content brief (`lib/content-brief.ts`)

A function `readContent(words: string, opts)` that calls `gpt-4o-mini` (JSON mode) and returns:

```ts
type ContentBrief = {
  headline: string          // the one big line, tidied
  business?: string         // who it is
  when?: { text: string; iso?: string }    // date and/or time as written
  where?: { venue?: string; address?: string }
  offer?: string            // "free drinks until 2am", "20% off", "first bag free"
  action?: string           // "Call 555-0148", "Book at ridgeline.co", "RSVP"
  details: string[]         // everything else worth printing, in order
  smallPrint?: string       // terms, licence numbers, disclaimers
  fixes: { was: string; now: string; why: string }[]   // suggested corrections
  warnings: string[]        // things we could not verify
}
```

Rules for the prompt: never invent a fact — if a date, price, address or phone is not in the words, leave the field out; keep the customer's wording, only fixing obvious slips; put every original line somewhere (nothing silently dropped).

**Suggested fixes, never silent edits.** Detect and propose, with `why`: obvious speech-to-text slips ("they grand opening" → "The grand opening"); a broken idiom ("come one come home" → "come one, come all"); a sentence that is not a phrase a designer would set; a date that does not exist ("June 32"); a phone number with the wrong digit count; a web address with a typo. The customer sees these and accepts or rejects each one — **we never change their words without a click**.

## Part 2 — Use the brief in the design prompt

In `app/api/create/route.ts` and `app/api/remake/route.ts`, when a brief is available, replace the plain word block with a labelled hierarchy:

- HEADLINE — the largest thing on the piece, one clear line.
- WHEN + WHERE — kept together as one block, second in visual weight, never smaller than the equivalent of 12pt at the piece's real size.
- OFFER — visually highlighted (colour, panel or weight) so it reads before the details.
- ACTION — set apart at the end, in a button-like shape where the look allows.
- DETAILS — supporting lines, smaller.
- SMALL PRINT — smallest, inside the safe margin.

Say explicitly: every line must appear exactly as given; do not merge, reword, translate or drop any line.

## Part 3 — The checks after the image is made (`lib/proof.ts`)

Code-based where possible, so they are reliable rather than hopeful. Run in parallel, then one repair pass.

1. **Bleed check** (print sizes with bleed on): sample the outer 2% ring with sharp and compare to the ring just inside. If the outer ring is materially lighter/different (a white sliver), fix in code by extending the edge pixels outward — no regeneration.
2. **Contrast check**: locate text blocks with a `gpt-4o-mini` vision call returning bounding boxes; for each, sample the background behind it with sharp and compute the WCAG contrast ratio. Below 4.5:1 for body or 3:1 for large text, fix by compositing a subtle darkening/lightening scrim behind that block in code. Only regenerate if a block fails after the scrim.
3. **Spelling check against the brief**: a vision call that reads every visible line and compares to the brief's lines. Report anything printed that does not match what the customer approved. This is the double-check you asked for: the words are checked going in (Part 1) and coming out (here).
4. **Safe-area check**: keep the existing `qaSafeArea` and run it in this set.

Record every check's result in the job's `meta` so the admin Jobs page can show what was verified.

## Part 4 — Logo space reserved, not hoped for

Where a brand logo is used: tell the model a specific corner area is reserved and must be left clear (state it in the prompt), then composite the real logo into that area in code after generation with `sharp` (it is already used elsewhere). Never let the model draw the logo. Keep the placement identical across every size of the same piece.

## Part 5 — Dictation, safer

The owner is worried a misheard word gets printed. Do NOT remove the microphone. Instead:
- Keep it as-is on descriptive boxes (art direction, fix-by-sentence, "what's the post about") where nothing is printed verbatim.
- On boxes whose exact characters get printed (New Design words, Remake changes, Thumbnail headline), dictation lands in a small confirm strip: the heard text, an "Add to the words" button and a "Discard" link. Nothing enters the box until they press it.
- After any dictation, highlight numbers, dates, times, prices, phone numbers and web addresses in the box with a quiet note: "Check the parts we highlighted — these are what dictation gets wrong."

## Part 6 — The review step

In New Design (and Remake where it applies), between the words and the button, show a compact **"What we understood"** card built from the brief: Headline / When / Where / Offer / Action / Details, each editable inline. Any suggested fix appears as one line with "Use this" and "Keep mine". This is the moment that would have caught "they grand opening event". Keep it to one card; do not add a new station.

## Test

Playwright as super admin. Use this exact input, which is the real failure:

```
the grand opening event that is selling Daniel's birthday at the new pipe restaurant located at 1521 Main Street in Dallas Texas 77494 we are offering free drinks until 2:00 a.m. and everybody is invited come one come home
```

Confirm: the brief splits it correctly (headline / where / offer / action), at least one suggested fix appears (the broken idiom and/or the mangled clause), accepting a fix changes only that line, and the "What we understood" card matches. Then run ONE real generation and confirm the checks recorded results in the job meta. Screenshots (desktop + 390px) to `C:\Users\tdani\AppData\Local\Temp\claude\C--dev-1---PrismGraphs\b49a578b-8a92-4baa-9740-01972f39bb4f\scratchpad\brief-*.png`.

Report under 300 words: what the brief returned for the test input, which fixes it suggested, what each check does and what it caught, screenshot paths, commits, deployment status, anything left undone.
