# /design — rebuild as a 5-step wizard (+ wait screen + results)

This is the prompt I'd give myself to build it. One page per step, a **persistent
left sidebar** on every page with the step list + a **Next button up top** so the
user never scrolls to advance. Route stays `/design`. `/flyer` untouched. Both
storefronts share the code (a change here shows on both).

Wizard state lives in the existing `useWizard.ts` (localStorage, key
`text2art:wizard`). Add the new fields there; do not invent a second store.

---

## Layout shell (applies to all step pages)

- Left **sidebar**, fixed, always visible: the 5 steps with the current one lit,
  a checkmark on finished ones, and a **Next** button pinned at the top of the
  content area (also a Back). No scrolling required to move on. Below ~900px the
  sidebar collapses to a slim top bar (reuse the phone-width pattern already in
  the repo).
- Content area to the right. Reuse `ui.tsx` tokens/`StepShell`. Progress bar
  becomes STEP x OF 5.

---

## Step 1 — What are you making?

Just the pick. Each choice is a card with **a sample image + a one-line plain
explanation of what you get** (e.g. "A flyer — one page, print-ready, artwork and
words together"). Options mirror today's kinds: Print, Social, Slide deck, Set of
sizes. Selecting one is enough to enable Next. No style, no uploads here.

## Step 2 — Style + your images

Two jobs on one page:

1. **Your images — ONE drop box** (not two). User drops/pastes headshots, place
   photos, product shots, AND logos together — because real uploads are mixed
   (a headshot + a house photo + a logo). On drop, run a **free local guess** per
   image: transparent background OR small OR very few flat colours ⇒ `logo`,
   else ⇒ `person`/`photo`. Show each thumbnail with a **Logo / Photo tag** and a
   **one-tap toggle to reclassify** if the guess is wrong. Logos preview on white
   (contain). This replaces the current two-button approach. Roles still flow to
   the engine as `role: 'logo' | 'person'` — that part already works.

2. **Style — a reference OR a premade look:**
   - A **reference drop / paste box**: "Grab an image from anywhere online and
     drop or paste it here — we'll design in its *style*, not copy it. We will
     **not** exactly duplicate someone else's work unless you confirm you own the
     original." Include a checkbox: *"I own this artwork / have the right to use
     it"* — only then allow close-style matching; otherwise style-inspired only.
   - **"Or choose one of our premade styles"** — an **accordion** that, when
     opened, reveals our style thumbnails (the existing `VISIBLE_STYLES`
     browser). Picking one clears the reference and vice-versa.

Next is enabled once they've either dropped a reference or picked a premade style.

## Step 3 — Content (chat)

A **chat window**. The user can:
- **Type or speak** what goes in the design (reuse the dictation hook the repo
  already has — do NOT rebuild the mic).
- **Ask AI to write it from a topic** ("write it for me about ___").
- **Upload a document** (PDF / Word / txt) — extract text and use it. Reuse the
  repo's existing document-extraction path; do not build a new parser.
- **Paste text** directly.

Whatever comes in becomes the design's words (headline / details / cta / contact),
same fields the engine already takes. Keep it to ONE clear thing at a time so it
doesn't feel like a form.

## Step 4 — Output sizes

Pick the output sizes (the existing size picker). **For any PRINT size, force a
choice: Full bleed or No bleed**, and **explain the difference with a small
illustration** (a diagram: bleed = artwork runs off the edge so trimming leaves
no white line; no-bleed = safe margin). Bleed already exists in the engine
(`printPixels`/`apiSize` take a `bleed` flag) — thread the user's choice through.

## Step 5 — Summary

Show the choices back (what, style, #sizes, bleed) and **pre-done example outputs**
so they see the *kind* of thing they'll get. These examples are **one set we
generate ONCE with OpenAI and reuse forever** — store them as static files in
`public/`, do not generate live per visit. The **Next button turns into a red
"Start designing" button** here.

## Wait screen (after Start designing)

A **beautiful full-page progress animation** while the batch renders. Rotating
content: **fun facts about design/print** and **our three products** —
jordyn.app, docs2video.com, botmakers.ai (full-stack video) — as clean branded
slides. No sellable "advertise here" slot for now. This runs while
`/api/flyer-art` works; poll the round until designs are ready, then go to
results.

## Results

- Big preview of the finished designs.
- **Sidebar + under-image list** of every size with **clickable links: Download
  all / Download each**.
- A **Share button** (social post / email) per design.
- Keep the existing **spot-edit** ("Edit a part") on the preview.

---

## Rules / reuse (do not re-invent)
- Real uploaded logos only — never AI-drawn; logos placed as-is (engine already
  does this).
- Reuse: dictation hook, document extraction, `VISIBLE_STYLES`, size picker,
  `/api/flyer-art`, `/api/flyer-edit`, `/api/flyer-history`, bleed flags, the
  chat-scoped `chatId` fix already in the wizard.
- Both storefronts share code; verify Text2Art host + Docs2Video host.
- Typecheck clean, write a check script that walks all 5 pages + wait + results
  and proves state survives navigation (prove it can FAIL first).
- Plain language throughout — the user is not a coder.

## Open build order (phased, each shippable)
1. Sidebar shell + Next-up-top + STEP x OF 5, on the current pages.
2. Step 1 rebuild (samples + explanations).
3. Step 2 (one smart drop box + reclassify + reference/own-it + premade accordion).
4. Step 3 chat (type/speak/AI-write/paste, then +document upload).
5. Step 4 bleed choice + illustration.
6. Step 5 summary + reused OpenAI examples + red Start button.
7. Wait screen (facts + 3 brands).
8. Results (download all/each + share + keep spot-edit).
