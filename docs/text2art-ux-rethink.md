# Text2Art — rethinking the interface

Written after the guided flow shipped and was worse than what it replaced. All
three faults in that screenshot have one root cause, so this starts there rather
than patching the symptoms.

---

## What actually went wrong

### The assistant can talk but cannot show anything

You asked *"can you offer me a way to select the files that I want to create"*
— a completely reasonable request — and it answered by typing out
twenty-three formats with their pixel dimensions as a paragraph.

It did that because it had no other option. The chat route can return words and
it can return design fields. It has no way to say *"open the format picker"*.
So when someone asks for a picker, the only thing it can do is describe one.

The picker exists. It is thirty pixels away. The assistant cannot reach it.

**This is the whole problem.** The conversation and the interface are two
separate systems with no way to call each other, so every gap between them gets
filled with prose.

### The question card never goes away

`app/(dashboard)/flyer/page.tsx:1710` pins it above the typing box whenever a
step is unanswered, and `:937` only advances the step when the assistant returns
design fields.

Talking about formats returns no fields. So the step never advances, and
"What should it say?" sits there permanently while the conversation moves on
around it. It looks broken because it is behaving exactly as written.

### Two things both think they are in charge

I added a step machine and left the free conversation in place. The step machine
believes the next thing is "content". The assistant believes the next thing is
"which formats". They disagree, on screen, at the same time.

### And a small one that makes it look shabby

`**Print**` renders as literal asterisks. The chat has no markdown rendering, so
anything the assistant emphasises comes out as punctuation.

---

## The change that fixes all of it

**Let the assistant show things.**

The chat route already returns `reply` and `fields`. It gains one more field:

```
show: 'formats' | 'styles' | 'photos' | 'reference' | 'slides' | 'confirm' | null
```

When it wants you to choose, it says so, and the page renders the real picker
**as a message in the thread** — pictures, tick boxes, a file button, whatever
that choice needs.

Consequences, all of them good:

- **No more lists of dimensions in prose.** Asked for a picker, it opens the
  picker. It literally cannot recite formats, because choosing is not a thing
  it does with words.
- **Nothing gets stuck.** A card is a message. It scrolls up with everything
  else and is replaced by whatever comes next. There is no pinned panel with its
  own idea of where you are.
- **One thing is in charge.** The step machine goes. The assistant decides what
  to ask, the page draws it. No disagreement is possible, because there is only
  one opinion.

---

## What the screen becomes

Three parts, and that is all.

**1. The thread.** Messages, and cards where a choice was needed. A card that
has been answered collapses to a line — *"Instagram post, Facebook post"* — with
a small **change** link. So the transcript reads as the record of the job.

**2. The typing box, stuck to the bottom.** Input, microphone, Send. Nothing
else, ever.

**3. The Make button, which appears only when there is something to make**, and
says what it will do: *Make 2 · 400 credits · about 2 min*.

A new chat opens with the greeting and four buttons — the same four as now, in a
card, because that IS the first choice.

---

## The pickers

Every choice is visual. That is what "go back to the selection picker" means and
it is right — nobody reads "12. Table tent 4×6 in" and pictures a table tent.

- **Formats** — grouped Print / Social / Slides, each a tile with the shape drawn
  to scale and a plain name. Tick as many as you want. The proportions do the
  explaining that the numbers were failing to do.
- **Styles** — six suggestions as pictures, *see all 225*, or upload your own.
  Unchanged; this one already works.
- **Photos** — drop area plus what each picture is.
- **Slides** — 5 / 8 / 10 / 12 / 16, with the credit cost on each.

---

## What gets deleted

- The `step` state machine and `advance()`.
- The pinned question card above the composer.
- The four numbered chips (already gone).

Roughly two hundred lines out, one field in. The flow stops being a thing I
wrote and starts being a thing the assistant does, which is the only version
that can keep up with a customer who says something unexpected.

---

## The honest risk

The assistant now decides when to show a picker, and it will sometimes get that
wrong — showing one too early, or talking when it should have shown. That is a
prompt to tune with a test, not a structural fault, and it fails softly: you get
a sentence instead of a card, and the typing box still works.

The version I shipped fails hard: a panel that will not go away and a wall of
numbers. Softly is better.

---

## Order

1. `show` in the chat route + render cards in the thread. Fixes the wall of text
   and the stuck panel together.
2. Delete the step machine.
3. Visual format picker with shapes drawn to scale.
4. Markdown in chat messages.
5. Answered cards collapse to a line with **change**.
