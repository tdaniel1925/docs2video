# Text2Art — workflow review

Written 2026-08-10, after a live deck build went wrong. Everything below was
measured or traced to a line of code, not guessed. Where I guessed earlier in
the day and was wrong, that is said plainly, because two of my first
explanations did not survive being checked.

---

## 1. You cannot talk to the chat. This is the biggest problem.

The page is built to look like a conversation and is not one.

There is no Send button. The only ways to submit are **Preview details** and
**Make** — and *Preview details* does not mean "reply", it means "extract the
design fields from what I typed". So the box invites you to talk and then has
nowhere for the talk to go.

It gets worse than missing. When you typed *"all of the sides say the same
thing"*, that went to the field extractor, which is required to return JSON
describing a design. It could not, so it threw, and you got a red error box
reading **"no fields came back"**. A reasonable sentence produced an error
message written for a developer.

The cause is in `app/api/flyer-chat/route.ts:99`. If the model's answer contains
no JSON object, the route throws. There is no path in the whole feature for a
message that is a question, a complaint, or a correction phrased as a sentence.

**What it should be:** one input, one Send button, and a chat that can reply in
words. Field extraction becomes something the assistant *may* do as a side
effect of a message, not the only thing a message is allowed to be. When a
message changes nothing about the design, it should get an answer, not an error.

---

## 2. Why every slide came out identical

Not the AI. A rendering bug, and I can point at the line.

A **round** in this app is "one design per size you ticked", so it is keyed by
size. A **deck** is many designs at the *same* size. On reload, the history
loader rebuilds a deck as a round:

```
app/(dashboard)/flyer/page.tsx:400
sizeIds: round.designs.map((d) => d.sizeId)   // ['slide-16x9'] x 5
```

and the grid then does:

```
app/(dashboard)/flyer/page.tsx:1651
const d = round.designs.find((x) => x.sizeId === id)
```

With five identical size ids, all five tiles find the **same first design**. Five
different slides were generated, saved and charged for. Five copies of one of
them were displayed. That is also why every tile was badged "1".

It only happens after a reload. During the live build the deck renders through
`DeckBlock`, which numbers its slides `slide-1`, `slide-2`, … and is correct.

**I was wrong twice on the way to this.** First I assumed the anchor image was
making every slide a copy of slide 1 — plausible, because slides 2+ use
`images.edit` with slide 1 attached. I tested it: slide 1 said "How AI Is Growing
Business", the anchored slide 2 said "Where AI creates value" with its own three
bullets, correctly. The anchor works. Second, on the earlier "Network error" I
assumed the payload was too big; measured, it was 1.9 MB against a 4.5 MB limit.

**Fix:** decks must come back as decks. Store a marker on the round, restore it
through `DeckBlock`, and key every grid by position rather than by size id so
this class of collision cannot happen again.

---

## 3. Cost and speed: Gemini is worth switching to

Measured on the same slide, same prompt, today:

| | gpt-image-2 | Gemini 2.5 Flash Image |
|---|---|---|
| Time | 81–92 s | **5 s** |
| Cost per image | ~18¢ | **~4¢** |
| Aspect | native 16:9 | native 16:9 |
| Layout and look | good | good |
| Small text | correct | **misspelled "REPETITIVE" as "REPETIVE"** |

Gemini is roughly **16× faster and 4× cheaper**, and the design itself was
comparable — right composition, right palette, right feel.

The one problem is spelling in small text, and on a deck someone stands up and
presents, a misspelling is not cosmetic.

**The idea this unlocks:** at 5 seconds and 4¢ you can afford to *check and
redo*. Generate with Gemini, read the text back off the image, and regenerate
the ones that came back wrong. Three attempts on Gemini still costs 12¢ and 15
seconds against 18¢ and 90 seconds for one gpt-image-2 attempt.

A twelve-slide deck today is about 18 minutes and $2.16 of image cost. On Gemini
with a redo budget it is under two minutes and about 60¢.

**Recommended:** Gemini as the default with an automatic spelling check and
retry; gpt-image-2 kept for business cards and anything print-critical, where
small type has to be right first time and 90 seconds is acceptable.

Worth knowing: we already pay for a text model that could read the words back
off a generated slide, and fal is already configured for the upscaler.

---

## 4. Everything else that adds friction

Ordered by how much it costs the customer.

**a. A failed slide kills the deck, and you keep paying.** Three slides failed;
the other five were charged for and are unusable as a deck. There is no "retry
the failed ones". This is the most expensive gap after the two above.

**b. "Make 2 · 400 cr" while a deck is on screen.** Two different Make buttons
mean two different things at once. When a deck plan exists, the normal Make
should step back.

**c. The style is chosen before the deck is planned.** "Pick Your Style · Early
Start" was picked for a flyer and silently became the look of an eight-slide
business deck. A deck should confirm its look, ideally by drawing slide 1 first
and asking "like this?" before spending the other eleven.

**d. No cost warning before a big spend.** 1,600 credits leaves in one click. A
deck should say what it will cost and what will be left.

**e. Nothing says how long it takes.** A twelve-slide deck is fifteen minutes.
The customer is told nothing before starting and will assume it has hung.

**f. You cannot edit one slide.** The footer invites "design 2, make the price
$25" — and for a deck there is no path that does it.

**g. Nothing survives navigation.** The deck plan lives in page state. Refresh
mid-build and the running order is gone even though the slides are saved.

**h. The placeholder still says "doors at 9, $20 cover, DJ Sable headlining"**
under a business deck. Small, but it tells the customer this tool is for
nightclub flyers.

---

## 5. What I would do, in order

1. **Send button and a real conversation.** Nothing else matters as much. It is
   the difference between a chat and a form with a chat costume.
2. **Fix the deck reload collision.** People are paying for slides they cannot
   see.
3. **Retry failed slides.** Turns a wasted deck into a finished one.
4. **Move to Gemini with a spell-check-and-retry loop.** Cuts cost by ~4× and
   time by ~16×, which changes what the product can offer.
5. **Draw slide 1 first and confirm the look** before committing to the rest.
6. **Say the cost and the wait** before the button is pressed.

Items 1–3 are correctness. Items 4–6 are what make it feel effortless.
