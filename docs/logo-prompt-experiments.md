# Prompt research — what to actually measure

Companion to `logo-service-research.md`. That document makes claims. This one is
how to find out whether they are true.

The whole spike rests on one unproven sentence: *"the quality came from the
constraints, not the model."* It was one pass of eight logos. That is a
promising anecdote, not a finding. Everything below exists to turn it into
something known.

---

## 0. Build the scoring harness FIRST

Nothing else on this list means anything without it. "Better prompting" is pure
opinion until two batches can be compared side by side.

The harness needs to:
1. Generate N logos from a named prompt variant, with the variant recorded.
2. Lay them out as a numbered contact sheet — one image, everything visible.
3. Take a rating per logo (1–5) and store it against the variant.
4. Run the machine gates (§4) and store those numbers too.

Half a day's work, and every experiment below becomes a twenty-minute question
instead of an argument. Build this before writing another prompt.

**Rate blind.** Shuffle the sheet and hide which variant produced what, or the
result measures what was expected rather than what happened.

---

## 1. Ablation — which rules are actually load-bearing?

The house-style block has roughly a dozen rules. The assumption is that they all
matter. They almost certainly do not — probably three do most of the work.

Method: generate 20 logos with the full block. Then 20 more with exactly ONE
rule removed, for each rule. Rate blind. The rules whose removal collapses the
score are the real ones.

**Why it is worth the money:** every wasted rule is prompt budget and attention
spent on nothing, and a shorter prompt that works is easier to vary per brief.
It also identifies which rules to defend when someone later "tidies" the prompt.

Candidate rules to test individually:
- flat / no gradient / no 3D
- "one idea, executed simply"
- must work at 8mm in one colour
- the explicit ban list (swooshes, mascots, globes…)
- "nothing in frame but the logo"
- geometric construction language
- the era / studio reference

---

## 2. Reference vocabulary — is the Dribbble steer real?

The central claim of the research doc. Test it directly.

Same brief, five variants, 20 each:
- **A** no style steer at all
- **B** "modern, professional, clean" (what every competitor writes)
- **C** era: "in the visual language of 1960s–70s corporate identity"
- **D** named studios: "Chermayeff & Geismar, Paul Rand, Otl Aicher"
- **E** the anti-reference alone: "not Dribbble, not Fiverr, not stock vector"

This answers three things at once: whether steering matters, whether *naming
studios* beats *describing adjectives*, and whether saying what to avoid does
any work on its own. My expectation is D > C > E > B > A, with B possibly worse
than A because those three adjectives are exactly what the cheap tools use.

**If B beats D, the entire premise of the product is wrong** and it is worth
knowing that in an afternoon rather than after building the app.

---

## 3. Symbol-only versus whole logo

The open assumption behind the split-the-logo architecture.

Generate the same brands twice: once as a complete logo with the name, once as a
symbol ONLY with no lettering requested. Rate the symbols in isolation.

Hypothesis: symbols come back stronger when the model is not also budgeting
attention on letterforms. If true, it confirms the architecture and it means
Gemini alone is sufficient. If false, the split is still worth doing for the
kerning and spelling, but for different reasons — and the doc should say so.

Run this on **both engines**, because the answer may differ.

---

## 4. Do the machine gates predict human judgement?

The proposed automatic quality checks — colour count, gradient detection, path
node count, the 16px test, the one-colour test — are all hypotheses.

Method: take every logo already rated in §1–3, run the gates, and compare. Does
node count correlate with a low rating? Does the 16px test catch the ones a
human called mush?

**This is the highest-value experiment on the list.** A gate that genuinely
predicts human judgement means quality can be enforced automatically, at zero
marginal cost, before a customer ever sees anything. Nobody in the cheap tier
does this. A gate that does NOT correlate is worse than useless — it would
quietly throw away good work, so it must be checked rather than assumed.

Node count is the one I would most expect to work: a great mark is simple, and
simplicity is literally measurable after tracing.

---

## 5. Are "different territories" actually different?

An agency presents three genuinely different strategic directions. Ask a model
for four concepts and it may well produce four flavours of one idea.

Method: generate 4 territories per brand across 10 brands. Measure visual
similarity between them (perceptual hash, or embedding distance), and eye them.

If they cluster, the fix is structural rather than a better adjective: force
each territory to a DIFFERENT MARK TYPE — wordmark, monogram, abstract,
pictorial — so distinctness is guaranteed by construction instead of hoped for.

---

## 6. Repeatability and sameness across customers

Two customers in the same industry must not receive near-identical marks.

Method: generate for 20 fictional businesses in one category. Compare every
output against every other. Establish the natural collision rate.

This determines whether a similarity check against previously issued marks is a
nice-to-have or a launch requirement. It is cheap to measure now and expensive
to discover from a customer.

---

## 7. Prompt length and specificity

Does a longer, more specific brief beat a short one — and where does it stop
helping? Somewhere past a certain length, models begin dropping instructions,
and knowing that ceiling shapes how much of the brief can be spent on the
customer's own words versus the house style.

---

## What NOT to buy

**A large stock library of logo templates. Three reasons, in order of cost.**

**1. The licence almost certainly forbids the use you have in mind.** Stock
marketplace licences typically restrict using an item as a trademark or logo,
prohibit resale of the item as-is, and increasingly prohibit inclusion in
machine-learning datasets. Buying a library grants the right to USE those files
— not to feed them into a generator or to sell derivatives at scale. Read the
actual licence, and have a lawyer read it, before any money moves.

**2. It is the wrong aesthetic — it IS the problem.** Stock logo template
libraries are where the cheesy look comes from. Ingesting ten thousand of them
would make the output look more like Fiverr, not less. The whole thesis is
steering AWAY from that corpus.

**3. It is not needed.** Eight logos came back clean with no library at all.
The quality came from constraint and reference vocabulary — both of which are
words, not assets.

## What to build instead

**A coded design vocabulary.** Not ten thousand finished logos: perhaps 200–400
carefully written entries, each a few words of precise art direction, across:

- mark types (wordmark, monogram, pictorial, abstract, combination, emblem)
- construction methods (geometric grid, modular, single-stroke, stencil,
  counter-form, rotational symmetry)
- era and school vocabularies (Swiss, mid-century American corporate, Bauhaus,
  Japanese mon, English heritage, brutalist, contemporary editorial)
- industry conventions AND the cliché to avoid for each
- colour strategies (single ink, ink plus accent, monochrome only)
- typographic voices, tied to the curated font library

That composes into thousands of genuinely distinct briefs, it is legally clean,
it can be edited when something underperforms — and it is **yours**. A bought
library is a cost. This is the asset.

## What a human designer is actually for

Not drawing templates. **Judging.**

Pay a good identity designer for a few hours to blind-rate several hundred
outputs. That produces labelled data to tune the prompt system against and to
calibrate the machine gates in §4. It is far higher leverage than paying the
same person to draw marks that a model can already draw.

A second, later use: the final optical pass — the overshoot, the joint weight,
the kerning — which is the thing models genuinely cannot do and which may be
what justifies premium pricing.

## On looking at other people's work

Studying published logos to build a vocabulary is what design education is, and
naming a style, era or school in a prompt is legitimate. Copying a specific
mark, or ingesting a licensed collection into a pipeline, is not. The line is
between learning a language and reproducing a sentence.
