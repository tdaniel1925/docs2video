# A high-end logo service — how to actually not be janky

Research for a standalone chat-driven identity product. Written after testing
eight logos through GPT Image and Gemini and converting all of them to vector.

The tested claim from that spike: **the model is not the differentiator.**
Everyone can call the same two APIs. What separates a mark you'd put on a
building from Dribbble slop is the instruction, the reference vocabulary, and
what happens after generation. That is where the product lives.

---

## 1. Why every AI logo tool looks the same (and cheap)

Look at Looka, Tailor Brands, Brandmark, Wix, Canva. They share a house style:
a gradient blob, a geometric line-art animal, a lowercase geometric sans, a
swoosh, a "negative space" trick that isn't one. That look has a source.

**These models were trained on the internet's logo corpus, and the internet's
logo corpus is Dribbble.** Dribbble rewards a thumbnail that pops in a feed —
gradients, isometric tricks, decorative cleverness. It does not reward a mark
that survives being embroidered on a polo shirt.

So the single highest-leverage decision in this whole product:

> **Steer away from Dribbble and toward Logo Modernism.**

Ask for "a modern logo" and you get 2019 Dribbble. Ask in the visual language
of mid-century corporate identity — Chermayeff & Geismar, Paul Rand, Otl Aicher,
Massimo Vignelli, Total Design — and you get marks that read as expensive,
because that is the era that invented what "expensive" looks like in identity.

Every logo in the spike used that steer. None came back cheesy. That is not a
coincidence and it is not luck; it is the entire trick.

---

## 2. What a real identity designer does that a logo generator doesn't

A generator asks for a company name and an industry, then decorates. A designer
runs a process. The chatbot should run the process — that IS the product.

**Discovery.** What does the business actually do; who is it for; who are the
competitors and what do they all look like; what should someone feel in the
first half second; where will this live smallest and largest.

**Positioning — pick ONE thing to own.** Not "modern, trustworthy, innovative
and friendly". A mark that says four things says nothing. The single hardest and
most valuable job of the chat is to force this choice, gently.

**Territories, not variations.** An agency presents three genuinely different
strategic directions. Looka presents fifty near-identical files. The chat should
produce 3–4 DISTINCT concepts — different mark types, different arguments — and
say what each one claims about the business. That framing alone reads as
professional even before the customer sees the art.

**Craft.** Construction, optical correction, consistent terminals, kerning.

**System.** A logo is never one file (§6).

---

## 3. Choosing the right KIND of mark

Most tools skip this and default to icon-plus-name forever. Choosing correctly
is a strategic decision and it is free.

| Type | When it is right | Examples |
|---|---|---|
| **Wordmark** | The name is distinctive and worth teaching. Professional services, fashion, publishing. | Google, FedEx, Braun |
| **Lettermark / monogram** | The name is long or a mouthful. | IBM, HBO, CNN |
| **Pictorial** | A concrete thing genuinely stands for the business. | Apple, Shell, Twitter |
| **Abstract** | The business is a category with no obvious object, or spans several. | Nike, Pepsi, Chase |
| **Combination** | The default, and the safest. Symbol plus wordmark, lockable apart. | Adidas, Lacoste |
| **Emblem** | Heritage, craft, institutions. Poor at small sizes. | Starbucks, Harley, universities |

Rules that follow from the table:
- A consumer app **needs** a symbol that survives at 16px as a favicon and 60px
  as an app icon. Emblems fail here.
- A law firm, a wealth manager or an architecture practice usually wants a
  wordmark. Giving them an icon is what makes them look like a startup.
- **Do not draw the literal thing.** A tooth for a dentist, a house for an
  estate agent, a fork for a restaurant. Descriptive marks are why local
  business logos look cheap. Distinctive beats descriptive.

---

## 4. The craft rules that separate professional from janky

Encode these as non-negotiables in the generation layer. Every one of them was
in the spike prompt and every one earned its place.

**Reduction.** If you cannot draw it from memory after seeing it twice, it is
too complicated.

**The one-colour test.** It must work as solid black on white. If it needs a
gradient to read, it is not a logo, it is an illustration.

**The small test.** Legible at 8mm on a business card and at 16px in a browser
tab.

**Banned outright:** gradients, bevels, embossing, drop shadows, glows,
reflections, 3D extrusion, more than two colours in the mark itself, swooshes,
generic globes, lightbulbs, gears, handshake icons, "tech blue", circles of dots
orbiting a word, sparkles, and mascots unless explicitly asked for.

**Geometric construction.** Consistent stroke weights, true tangents where
curves meet lines, deliberate corner radii, a visible underlying logic.

**Optical correction.** A circle must overshoot a square to look the same size.
Weight must be shaved where strokes join or the joint reads as a blob. These are
things models get wrong and a human eye catches instantly — which is an argument
for a review step, not against the whole idea.

**Negative space is a tool, not a trick.** The Thicket mark in the spike worked
because the shape reads as leaves first and a droplet second. When the cleverness
has to be pointed out, it has failed.

---

## 5. THE BIG ARCHITECTURAL IDEA: don't generate the type

This is the most important recommendation in this document.

Both models garble kerning eventually, and neither can be edited afterwards. But
**a wordmark is not a picture — it is typography.** So split the logo:

- **The symbol** is generated by the image model, then traced to vector.
- **The wordmark is SET IN A REAL TYPEFACE in code**, as vector, from the start.

What that buys, immediately and for free:
- Perfect letterforms and perfect kerning, every time.
- **Zero spelling errors** — the number one way AI logos embarrass a customer.
- Genuinely editable: change the name, the tracking, the weight, instantly.
- A clean, tiny SVG rather than a traced approximation of letters.
- The customer can be handed the actual font name, which is what a real brand
  guideline contains.

Font licensing solves itself with a **curated library of excellent open-licence
(OFL) typefaces**, which now includes genuinely first-rate faces — the days when
free fonts meant bad fonts are over. Curate perhaps 30, grouped by voice
(editorial serif, geometric sans, grotesque, humanist, display), and the choice
of typeface becomes another strategic decision the chat makes and explains.

The image model then only has to do the thing it is genuinely good at: invent
one striking symbol.

---

## 6. A logo is a set, not a file

This is where the cheap tools fake it and where an "agency" impression is won.
Once you have a traced symbol and a typeset wordmark, **the entire family is
composed in code** — deterministic, perfect, no second roll of the dice:

- Primary lockup (symbol beside wordmark)
- Stacked lockup (symbol above wordmark)
- Symbol only
- Wordmark only
- One-colour black, one-colour white (knockout)
- Reversed on the brand colour
- Favicon (16/32/48) and app icon (512/1024), with the symbol optically
  re-centred rather than naively scaled
- Clear-space and minimum-size diagram

Deliver SVG, PDF and PNG. **PDF matters more than people think** — it is what
printers and sign-makers ask for.

---

## 7. Where to draw reference from

**Archives worth mining for the visual vocabulary:**
- *Logo Modernism* (Jens Müller, Taschen) — around 6,000 marks from 1940–1980.
  The single best source for the look we want. If one book is bought, this one.
- *Marks of Excellence* (Per Mollerup) — the theory of why marks work.
- *Symbol* (Angus Hyland & Steven Bateman) — a large modern taxonomy, organised
  by visual type, which maps almost directly onto a prompt vocabulary.
- *Designing Brand Identity* (Alina Wheeler) — the process, and the deliverables
  list a client expects.
- *Logo Design Love* (David Airey) — the most practical single book on the craft.

**Sites for current standards:**
- **Brand New** (UnderConsideration) — professional critique of real rebrands.
  The comments teach you what practitioners consider a failure.
- **BP&O** and **Identity Designed** — case studies with the reasoning shown.
- **Logobook** and **LogoArchive** — searchable historical marks.
- **D&AD** and **Type Directors Club** annuals — the actual top of the field.

**Studios to name in prompts** (naming a house style is far more effective than
naming adjectives): Chermayeff & Geismar & Haviv, Pentagram, Paul Rand,
Saul Bass, Otl Aicher, Massimo Vignelli, Wim Crouwel / Total Design,
Landor, Wolff Olins, Base, Bureau Borsche, Order.

**The anti-reference, stated explicitly in the prompt:** Dribbble, Behance
trending, Fiverr, "logo templates", clipart, stock vector marketplaces. Naming
what to avoid measurably changes the output.

> Verify these names and titles before any of them appear in customer-facing
> copy. They are from memory, and a wrong attribution in a product that sells
> design credibility is worse than no reference at all.

---

## 8. The pipeline

```
CHAT (discovery)
  ↓  a structured brief, not a paragraph
BRIEF  { business, audience, one positioning word, mark type,
         era/reference vocabulary, colour strategy, avoid-list }
  ↓  3–4 DISTINCT territories, each with a stated argument
GENERATE  symbol only — Gemini for breadth, ~5s and ~4c each
  ↓
CURATE  automatic rejection before a human ever sees it (§9)
  ↓
REFINE  the chosen territory at higher craft
  ↓
TRACE   to vector — pure JavaScript, in-app, proven in the spike
  ↓
TYPESET the wordmark in a real font, as vector
  ↓
COMPOSE the whole family in code
  ↓
DELIVER SVG + PDF + PNG, plus a brand sheet
```

**On Gemini specifically**, since it was asked about: it is the right choice for
the exploration stage — nineteen times faster and roughly a quarter of the cost,
which means showing twelve directions in the time a competitor renders one. Its
weaknesses in the spike were uneven letterspacing and faint grey artefacts in the
white field. **Both are wordmark problems, and §5 removes wordmarks from its
job entirely.** For symbols alone, Gemini is likely sufficient — but that should
be tested head-to-head on symbols only before it is decided, because the spike
tested whole logos, not isolated marks.

---

## 9. Quality control is a feature, not an afterthought

The customer must never see the bad ones. Machine checks that are cheap and
genuinely catch the janky:

- **Colour count** — more than 2–3 distinct inks in the mark: reject.
- **Gradient detection** — smooth ramps across a region: reject.
- **Complexity** — trace it and count the path nodes. A great mark is simple;
  an enormous node count IS the definition of fussy. This is a real, measurable
  proxy for quality and nobody in the cheap tier uses it.
- **The small test, automatically** — render at 16px, check it is still
  distinguishable from a blob.
- **The one-colour test** — flatten to black, check it still reads.
- **Stray marks** — specks and artefacts outside the main shape: reject.

Everything on that list is computable, which means quality can be enforced
rather than hoped for.

---

## 10. Ownership — say it plainly, it is a selling point

- **Copyright:** in the US, a purely AI-generated image cannot be registered —
  no human author. Human creative choices in selection and arrangement may be
  protectable, which is another argument for a real refinement step.
- **Trademark:** this is what actually protects a brand, and it does not care
  how the mark was drawn. What matters is use in commerce and distinctiveness.
  A logo customer's real question is "can I own this", and the honest answer is
  "trademark is the thing you want, here is how".
- **Clearance:** a similarity check before delivery is both a genuine liability
  reduction and an obvious paid add-on.

Competitors bury this. Explaining it clearly, on the pricing page, is a trust
advantage in a market where the customer is quietly worried about exactly this.

> Not legal advice — this needs a lawyer's eye before it goes on a website.

---

## 11. Honest risks

- **Symbol quality is not yet proven in isolation.** The spike tested whole
  logos. Test symbols alone before committing to §5.
- **Optical refinement** is the thing models genuinely cannot do. A human design
  eye at the last step may be what actually justifies premium pricing — and that
  is a business model choice, not a technical one.
- **Sameness at scale.** Two customers in the same industry may get similar
  marks. Needs a check against previously generated marks.
- **Tracing is only clean because the house style is flat.** Any drift toward
  gradients or shadows breaks the vector step. The style rule is load-bearing
  in two places at once.

---

## PARKED 2026-08-09 — what the rating rounds actually established

Three blind rating passes by the owner. Recorded here so the next person does
not repeat them.

| batch | avg /5 | rated 4-or-5 |
|---|---|---|
| plain logos, six style steers | **2.79** | 16 / 48 |
| monograms, first attempt | 1.42 | 3 / 60 |
| monograms, after the legibility fix | **1.22** | 1 / 59 |

**Monograms failed, twice, and the fix made no difference.** The first round's
scores pointed hard at legibility — the three constructions that deform letters
each scored exactly 1.00, and an AHG came back as an unreadable blob. Adding a
rule that legibility outranks construction did not help. 1.42 became 1.22.

So legibility was a real defect but NOT the cause. Something else is wrong with
monograms, and the obvious suspect is the engine: every monogram was Gemini,
while the eight originals that started this whole thing were mostly GPT Image.

**The undone test that settles it:** run the same monogram briefs through GPT
Image 2. If they come back good, it is an engine choice. If they are also bad,
monograms should not be generated as pictures at all — they are TYPE, and the
right answer is the split-the-logo architecture taken to its conclusion: set the
initials in a real typeface and compose the interlocking, containing and
stacking in CODE as geometry, where it is deterministic and perfect.

That second possibility is the more interesting one, and this is the strongest
evidence yet for it.

**What did work:** plain logos on Gemini, 2.79 with a third rated 4-or-5.
Two other findings survived both raters — naming famous studios came LAST, and
briefs carrying a written CONCEPT beat briefs without. Neither has been retested
since.

**What still predicts nothing:** every machine gate. Best correlation with human
rating was 0.13. They remain switched off.
