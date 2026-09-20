# Prompts for the builder-page UX fixes

One prompt per fix, in the order worth doing them. Paste one at a time, let it
finish and verify, then paste the next. Every prompt ends with the same rule:
prove it with a screenshot and the checks, don't just typecheck.

Shared context to paste FIRST, once per session:

---

**Context prompt (paste this first):**

The design builder page is `app/(dashboard)/flyer/page.tsx`. It is served by
BOTH storefronts (Docs2Video and Text2Art) — any fix lands on both, and copy
must not name either brand (use `useBrand()` from `app/_lib/brand.ts` if brand
words are needed). Layout: left = chat history (216px), middle = designs +
example looks (flex), right rail = 5 step rows + chat + typing box (420px),
all inside one fixed full-height container that stops above the cookie bar
(`--bottom-bar` CSS variable).

Verification tools that already exist — use them, do not write new ones unless
told: `scripts/shot.mjs <path>` (signed-in screenshot + scroll-region
measurements), `scripts/steps-check.mjs` (7 layout checks),
`scripts/no-duplicate-asks.mjs` (each question asked once),
`scripts/bottom-row-check.mjs` (bottom row reachable). All need TEST_EMAIL and
TEST_PASSWORD set in the environment — never write credentials into any file.
Run them with `MSYS_NO_PATHCONV=1` under Git Bash. Dev server is on
localhost:3000. After any change: typecheck, run all four check scripts, take
a screenshot and LOOK at it, then commit. If a check fails, fix the cause, not
the check — and if you add a check, prove it can fail before trusting a pass.

---

## Fix 1 — Phone layout (critical)

On a phone-width window (390px) the page is unusable: the three fixed columns
get clipped by `overflow: hidden`, the middle column is crushed to a sliver,
and the right rail — steps and typing box — is cut off the right edge with no
way to reach it. Verified by screenshot at 390×900.

Make the builder work on a phone. Below ~900px wide, stop showing three
columns side by side. Recommended shape: one column — steps + chat + typing
box first (that is the working surface), designs below, and chat history
behind a menu button rather than always visible. The typing box must stay
pinned at the bottom above the cookie bar. Do not break the desktop layout:
`steps-check.mjs` must still pass 7/7 at 1280×900 afterwards.

Add a width check to `scripts/steps-check.mjs` or a new small script: at
390×900, the typing box and all five step rows must be visible and clickable
(use elementFromPoint, not just "exists in the DOM"), and nothing may be
clipped off-screen. Prove the check fails against the current broken layout
before fixing (git stash the fix, run, see it fail, unstash).

## Fix 2 — "Thinking…" wait (high)

After Send, the user sees the single word "Thinking…" for ~18 seconds. Long
enough that people re-click, assume it broke, or leave.

Replace it with staged progress text that changes every few seconds while the
request is in flight — plain words about what is happening ("Reading what you
wrote…", "Working out what should go on it…", "Picking looks that fit…"),
advancing on a timer since the server sends no progress events. Keep it
honest: the stages must not claim a step that doesn't happen, and it must
never say anything is FINISHED (the no-false-claims rule in
`app/_lib/no-false-claims.ts` exists because the assistant once claimed
delivery before making anything). Also disable the Send button while a send is
in flight so double-clicks can't fire twice — check whether it already is
before changing anything.

Verify live: send a message, screenshot at 2s and at 10s, confirm the text
differs between the two shots.

## Fix 3 — Deck path shows flyer advice (high)

Pick "Make a slide deck", then open step 2 ("What's it about?"). Its help text
says: "Say it the way you would out loud — '24/7 heat repair, $89 tune-up,
555-0142'" — flyer advice with an HVAC example, shown while the chat correctly
asks what the deck is about. Two conflicting instructions side by side.

Make step 2's guidance depend on what is being made (the `kind` state:
'deck' | 'print' | 'social' | 'set'). Deck wording should ask what the deck is
about and who it's for, and mention uploading a document. Keep ONE source for
this guidance — the chat reply after picking a kind (`chooseKind`) and the
step-2 body must not disagree, so derive both from one place rather than
writing the words twice. The same-question-once rule is enforced by
`no-duplicate-asks.mjs` — keep it passing.

Verify live: new chat → Make a slide deck → screenshot step 2 open → confirm
the deck wording; then new chat → Make something to print → confirm the print
wording.

## Fix 4 — "See all looks" opens in the narrow rail (medium)

The "See all 105 looks" button opens the style browser inside the 420px right
rail — small tiles and a pile of category chips — while the wide middle
column, built for browsing looks, sits right beside it.

Move full-look browsing into the middle column: clicking "See all looks"
should swap the middle area to the full grid (with the category filters),
with an obvious way back. The rail keeps only the choice made. Do not create
a second permanent grid — `no-duplicate-asks.mjs` has a check that look
thumbnails live in one column only; it must still pass. Clicking a look
anywhere must still set the style, tick row 3, and show the name in the row.

## Fix 5 — Sizes two layers deep (medium)

Row 5 ("What sizes?") contains only a button, "Choose sizes", which opens a
separate panel. A required decision is hidden behind a button behind a row.

Put the size choices directly in row 5's body — grouped, tickable, with the
per-size credit cost — so opening the row IS the picker. Lead with the group
that matches what they're making (there is an existing `orderedGroups(kind)`
helper for exactly this). Remove the extra panel step for sizes. Keep the
overall rail scrollable and `steps-check.mjs` passing (especially "the results
area is still big enough to read").

## Fix 6 — Opens on the last conversation (medium)

Returning users land inside their most recent old job, full history and all,
and must find "+ New chat" to start fresh.

Change the landing behaviour: if the most recent chat already produced designs
(has rounds/decks), start on a FRESH chat instead, with the old one one click
away in the left list. If the most recent chat is mid-job (steps answered but
nothing made), keep opening it — that person is coming back to finish. Do not
lose any saved history.

## Fix 7 — Calm the screen (low)

79 clickable things are visible at once. The chat-history rows each show a pin
and a delete at all times.

Show the pin/delete controls on a chat row only while hovering that row (and
always show the pin on rows that ARE pinned, so pinned state stays visible).
Touch devices have no hover — on coarse pointers keep controls visible, or
reveal on tap; check with a 390px screenshot after Fix 1 is in. No other
behaviour changes.

---

After all fixes: run all four check scripts plus a screenshot at 1280 and 390,
update `BUILD-STATE.md`, and commit each fix as its own commit.
