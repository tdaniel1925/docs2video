# Text2Art — The Complete Workflow, Every Feature
*Current as of Aug 23, 2026 — reflects this week's UX overhaul. Plain language.*

---

## The big picture

Text2Art turns words into finished designs: flyers, posters, social posts, banners,
business cards, and whole slide decks. The user describes what they want (or points
at a website, or pastes their notes, or uploads a file) and the app designs it —
artwork and lettering together — in any of 225 looks. Everything made is saved to
My Library forever. Each design costs credits (200 per design; each size is its own
design).

There is ONE flow now: the 5-step designer at **/design**. The old one-page chat
builder (/flyer) is retired and redirects here.

---

## Entry — the front door (/design, Step 1: "What")

Two ways to start, on one screen:

**A. Say it in a sentence (the Prompt Hero).**
A big box: "Describe it in a sentence — e.g. a grand-opening flyer for my salon
this Saturday." Type or press the mic and talk. One-tap example chips below.
Press **Draft it** and the AI fills in the whole job: what kind of piece, a
matching look, the words (headline, tagline, selling points), and a sensible size.
- If the sentence names a **website** ("a flyer from jordyn.app"), the app reads
  that page and drafts everything FROM it — the real business name, their tagline,
  their strongest points, and their brand colours (used to tint the design).
- Honesty rules: it writes marketing copy but never invents a phone number,
  address, price, or date the user didn't give. Quoted words are treated as copy
  to print, never as commands.
- The user lands on Step 2 with everything pre-filled and badged "✨ Suggested" —
  a review, not a questionnaire.

**B. Or just tap a tile.** Four choices with sample images:
- **Something to print** — flyer, poster, postcard, sign, card
- **A social graphic** — Instagram, Facebook, LinkedIn, web
- **A slide deck** — a whole presentation, every slide matching
- **A set of sizes** — the same design in several sizes at once
Tapping a tile advances automatically (250ms mint-ring settle). The deck tile
reveals an upload box (see Decks below) instead of auto-advancing.

**Session behavior:** a fresh visit always starts clean (no leftovers from the
last job). Stepping BACK during a job never wipes it.

---

## The frame around every step

- **Sticky bottom action bar** — the primary button never leaves the screen, no
  matter how far you scroll. Every button is named for where it goes: "Next:
  choose a look", "Next: your words", "Next: pick sizes", "Next: review", and the
  red "Start designing." When disabled, it says exactly why.
- **Step rail (left)** — the five steps; a checkmark ONLY when a step is truly
  complete (a skipped step shows its number). Click a finished step to jump back.
- **Live preview (slide-in)** — a floating "👁 Preview" button slides a panel over
  the right edge showing the chosen size's true shape, the look (or uploaded
  reference), and the user's real headline. It takes no layout width, so the
  center is never squeezed. Labeled honestly: "final art is generated fresh."
- Titles set in the display serif ("Choose your *look*"). One design system:
  4px spacing grid, 10px-max corners, mint only for selection, red only for Start.

---

## Step 2 — Style ("Choose your look")

Two boxes, side by side (one column on phones):

**The look** — either:
- **Drop/paste a design you like** (file, drag, or paste an image). The app works
  in its STYLE — never copies its words, logos, or photos. A checkbox ("I own this
  artwork") unlocks close matching; unticked = style inspiration only.
- **Or pick from 225 ready-made styles** in an accordion (9 groups: business,
  sales, food & drink, local services, real estate, fitness, community, live
  music, nightlife), paged 24 at a time, each with a real thumbnail.
- These two are mutually exclusive — and switching now SAYS so, with **Undo**:
  "Using your reference — the chosen style was cleared. [Undo]"
- If the AI suggested the look from the opening sentence, a "✨ Suggested look"
  badge shows until the user confirms or changes it.

**Your logo & photos** (optional, up to 6):
- One drop box for everything; the app guesses each image's role (logo / photo /
  person) and the user can flip any guess with a tap.
- A **logo** or **QR code** is placed exactly as supplied — never redrawn (a QR
  still scans). A **photo of a person** becomes the featured subject, redrawn
  into the artwork.
- A separate "Add a QR code" button tags QRs explicitly.
- Every upload is shrunk in the browser before storing (reference→1280px,
  logo→900px keeping transparency, QR→600px) so nothing is ever silently lost
  between steps.

---

## Step 3 — Words ("What should it say?")

A conversation, with the OUTPUT always visible: as words are captured they show as
a card (headline, bullet details, call-to-action) that feeds the live preview.

Ways to give the words:
- **Type or talk** (the mic shows its state in words: Talk / Listening… /
  Transcribing…)
- **Paste anything over ~120 characters** — treated as content to design from
- **Paste or name a WEBSITE** — the chat reads the page and writes the design's
  words from it: real business name, tagline in their voice, strongest selling
  points. It also pulls the site's brand colours (used to tint the design) and,
  if it spots a logo on the site, nudges the user to the Look step to add it (we
  never auto-place someone's logo). If the page can't be read it says so plainly.
- **Upload a document** (PDF, Word, txt, CSV, PPTX) — content is extracted and
  turned into the words
- **"Write it for me"** — the AI drafts from a topic
- **"Type it in myself"** — plain headline/details/CTA boxes

Guardrails: the user's words are copy to PRINT, never commands to the AI ("make it
say 'call me tonight'" goes on the design; the AI doesn't "obey" it). It never
invents contact details or prices. The chat only auto-scrolls if the user is
already at the bottom.

**If the job is a DECK** (picked on Step 1, no file uploaded): whatever the user
types or pastes here becomes the brief for a WHOLE deck, and the AI builds it as
a STORY, not a pile of topic slides:
- First it asks **how long** — Short (5–7), Medium (8–14), or Long (15–24). The
  count then floats inside that range to fit the content; nothing is padded to
  hit a number.
- Then it reads the whole brief (up to ~24,000 characters), works out the deck's
  **purpose** (investor pitch, sales, training, report, all-hands, talk…) and
  **audience**, and lays the slides along the matching narrative arc — e.g. an
  investor deck runs hook → problem → solution → why now → market → model →
  traction → team → the ask. Every slide earns its place in the argument.
- The **running order is shown back** before anything is drawn: each slide's
  title and a one-line "why this slide is here." The user can **Remove** any
  slide or pick a **different length**, then press **Make it a deck**. Nobody
  pays for images from an order they never saw.
- Honesty wins over the arc: if the brief has no traction numbers, the traction
  slide is skipped — never invented. Real figures are kept verbatim.

---

## Step 4 — Sizes ("Where will you use it?")

- Grouped checkboxes at real-world sizes: **Print** (letter flyer, poster,
  postcards, rack card, door hanger, A4, yard sign, banner…), **Social** (IG post,
  FB post/cover, YouTube thumbnail…), **Banners & headers**, **Business cards**
  (front and back), **Slides** (1920×1080). Up to 8 sizes; each is designed from
  scratch and billed separately.
- **The price is always visible and can never silently vanish**: "3 designs ·
  600 credits · 4,200 left after." If the price fails to load, Next is BLOCKED
  with a "couldn't load the price — try again" retry. Nobody picks blind.
- **Print bleed choice** — when any print size is ticked: two illustrated tiles,
  Full bleed (art runs off the edge, for commercial printing) vs No bleed (white
  margin, for home printing), with a one-line explanation.
- **Decks skip this step's choices entirely** — a deck is always 1920×1080 16:9;
  the page just confirms that and shows the per-slide cost. No size picker.

---

## Step 5 — Review ("Review and start")

- A full-width summary of every choice: Making / Look / Headline / Sizes / Print
  edge / Your images. (For decks: From, Look, Slides count.)
- The rail's checkmarks are honest — if something's missing, that step shows its
  number and the Start button's hint names it exactly: "Pick a look on the Style
  step first."
- Sample images are labeled truthfully: "A sample for the look — yours is made
  fresh from your words, so it won't look like this one."
- The red **Start designing** button begins the build.

---

## The wait (making screen) — watching the work

- A placeholder appears instantly for EVERY design being made, in its true shape.
- The status line walks the real stages: "Sketching the layout… Setting your
  headline… Placing your images… Bringing in colour… Final polish…"
- Decks fill in slide by slide, each sharpening from blur as it lands, with a
  true count ("3 of 8 slides").
- Copy reassures: finished designs are saved to the Library even if the tab
  closes. Design facts and small house ads rotate quietly below.
- Words are verified: after generation the app reads the words back OFF the
  design; each result wears "✓ words checked" or a warning naming the word to
  check ("⚠ check 'Saturday'").

---

## Results — see, fix, download, share

The finished designs, big, with a side list (selected one highlighted mint and
scrolled into view).

**Spot editing ("Edit a part"):**
- Paint over the part to change, say the change ("make the background blue"),
  press Change it. Only the painted area is redrawn; everything else stays
  pixel-identical. Costs one design. The old version is never lost.
- **Brush size slider** (small for a price, big for a sky) and **Undo one stroke
  at a time**. The brush stays accurate after window resizing.
- **Words can't be paint-edited on purpose** — image editing garbles lettering.
  Asking for a word change gets a calm pointer to the "Change the words" path,
  which redraws with clean type. Never charged for the refusal.

**Place a logo or QR (no AI):** pick the file → click the spot on the design →
confirm. Pasted pixel-exact (a QR still scans). A Back at each stage.

**Other actions:**
- **Download** any one design, or all
- **Download as PDF** — a deck stitches into one PDF
- **Share** — link or system share sheet
- **Make more sizes** — goes to the Sizes step with the same words and look; adds
  sizes without redoing anything (confirms first if a paint edit is in progress)
- **Change the words** — back to the Words step to revise and remake
- **Start another design** — clean slate

---

## Slide decks — two ways

**1. Make a deck from words** (Step 1: tap "A slide deck", then just describe or
paste on the Words step): the AI asks how long (Short/Medium/Long), reads the
whole brief, works out its purpose and audience, and plans a STORY along the
matching arc — then shows the running order (title + one-line purpose per slide)
for the user to trim before anything is drawn. Locked to 16:9, every slide drawn
to match the chosen look. The **logo stays in one fixed corner on every inside
slide** (cover and closing keep a hero placement) so the set looks designed, not
shuffled. Downloads as images or one PDF.

**2. Restyle a deck you already have** (Step 1: the upload box under the deck
tile): drop a PowerPoint (.pptx) or PDF. The app reads it slide by slide, KEEPS
the words, and redraws every slide in the chosen look. Old .ppt files and
scanned/image-only PDFs are refused with a plain explanation (save as .pptx).
Image-only slides are counted and flagged, not lost. The slide list is shown for
confirmation BEFORE anything is drawn or charged.

---

## My Library — everything ever made

- Every job, grouped by project, newest first, paginated — with a **search box**
  to find any project by name.
- Each design has five actions:
  - **Edit again** — reopens the whole job in the designer (words, look, and
    sizes restored) at the results screen with the spot editor
  - **More sizes** — same reopen; add sizes and remake
  - **Download** — saves the real file to the device
  - **Share** — system share sheet (or copies the link)
  - **Post to social** — carries the design into the Social Posts tool with the
    caption topic pre-filled
- Empty state invites the first design. "Make something new" starts a fresh job.

---

## Money & safety rails (invisible until needed)

- **200 credits per design**; every size, slide, spot-edit, and placement is one
  design's cost. Nothing generates without the price shown first.
- Failures refund automatically ("you were not charged").
- Real logos only — the AI never draws a logo from a name.
- A safe fetcher reads user-supplied websites (can't be pointed at anything
  private).
- Insurance/regulated content gets carrier/product names scrubbed automatically.
- The finished design's words are machine-checked against the brief (the ✓/⚠
  badge above).
