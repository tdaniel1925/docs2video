# Build prompt — Logo Studio: think first, then draw, and tell the client the idea

Paste to a build agent in `C:\dev\1 - Restylez`. **Read `LOGO-CONCEPT-RESEARCH.md` in this same folder first** — it holds the researched design framework this build implements. That file is the authority on *what* the concept step should reason about; this file is the authority on *how* it fits the app.

---

You are a senior full-stack engineer in the Restylez app at `C:\dev\1 - Restylez` (Next.js 15; OpenAI `gpt-image-2` for images and `gpt-4o` for reasoning; Logo Studio is `app/logo/page.tsx`, `app/api/logo/route.ts`, `lib/logo.ts`, `lib/logo-kit.ts`; brands in `lib/store.ts`; CSS `rz-*` in `app/globals.css`, radius max 10px). Dev server already runs on http://localhost:3005 — do NOT start another. Super-admin login: `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in `.env.local` (never print them). Playwright from `C:\dev\1 - PrismGraphs`.

**UX priority:** the app is uncluttered and must stay that way. Match `app/logo/page.tsx` as it is now. `rz-*` classes only, one primary button per step, plain English. Screenshot every state desktop + 390px, LOOK at them, fix anything cramped.

**Ship rules:** `npx tsc --noEmit` and `npx next lint` clean on touched files. `git pull --rebase` before pushing. Commit in steps (co-author `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`), push, wait for `npx vercel ls restylez --scope bot-makers` Ready. Never print or commit secrets. Don't modify `C:\dev\1 - PrismGraphs`. Do NOT run `next build` against the running dev server.

## The problem, in the owner's words

He tested it with **"BotMakers — AI Powered Software and Web Solutions"** and judged two of nine good. The seven weak ones were *literal*: the model took "bot" and drew a cartoon robot, five times, in five different arrangements. His words: "it just looks like you tried to put bot into something and make it look decent."

**The cause, confirmed in the code.** `basePrompt()` in `app/api/logo/route.ts` hands the image model the brand name, the tagline, one line on what they do, and a mood word — then a *style* line (wordmark, monogram, badge…). Style is an arrangement, not an idea. Nothing anywhere says what the symbol should MEAN. So the model reaches for the most literal noun in the name. Nine styles, one idea.

**What we are selling.** This is a $149–299 product positioned as a design studio, not a generator. A studio does not hand over nine pictures; it hands over ideas, each with a reason, and says why. That is the thing being bought.

## Build

### 1. A concept step, before any image (`lib/logo-concepts.ts`)

A new `gpt-4o` call that turns the brief into **nine genuinely distinct concepts**, following the framework in `LOGO-CONCEPT-RESEARCH.md`. It must reason about the business before naming any object: what it does for people, what changes because it exists, its materials and vernacular, its category's conventions.

```ts
export type LogoConcept = {
  id: string
  /** The idea in two or three words — "The handoff", "Built, not bought". */
  title: string
  /** The story, for the customer. Two sentences: what the mark is, and why it means this business. */
  story: string
  /** What is actually drawn — the instruction the image model receives. */
  mark: string
  /** Which arrangement suits this idea, chosen to fit the concept (not assigned in advance). */
  style: LogoStyleId
  /** Why this one is different from the other eight — used to enforce variety. */
  angle: string
}
```

Hard rules for the concept prompt:
- **No two concepts may share a central object.** If one is a robot, no other may be.
- **At most ONE concept may be a literal depiction of a noun in the name.** The category deserves one obvious answer; the other eight must earn their place.
- Cover distinct *kinds* of idea per the research framework (letterform, negative space, metaphor, process, abstraction, heritage, category-break, etc.), not distinct arrangements.
- Never propose anything resembling a famous existing logo; keep the existing famous-name refusal.
- If the brief is thin, reason from what the business must be true of rather than inventing facts.

Validate the returned set in code: nine concepts, unique titles, no repeated central object (compare `mark` text for the same head noun), at most one literal. If validation fails, ask once more with the failures named; if it fails again, keep the best of what came back and say so.

### 2. Draw the concept, not the style

`basePrompt()` changes so the image model receives the **concept's `mark`** as the subject and the concept's `style` as the arrangement. The brand facts stay for spelling and colour. The mood stays. The style list remains in `lib/logo.ts` but is now chosen per concept rather than fixed one-per-slot.

### 3. Tell the client the idea — this is the point

Every place a concept appears, its **title and story appear with it**:
- On each card in the directions grid: the title in bold, the story beneath in the app's normal body voice. Not a tooltip, not hidden.
- In the refine stage, the chosen concept's story stays visible so the customer keeps the thread.
- On the **presentation page**, the story is presented properly — this is the moment that justifies the price. Title, story, then the mark shown in use.
- In the kit's README/text file, so it survives download.
- Stored on the project so it is there when they come back, and carried onto the saved brand.

Write the story in the app's voice: plain, specific, no jargon, no "elevate" or "synergy". Two sentences. It must say what the mark IS and why it means THIS business.

### 4. Keep what works

Refine-by-sentence, three free rounds, the kit, save-as-brand, the spelling gate, famous-name refusal, pricing — all unchanged. The timeline gains nothing; the concept step happens inside "Directions" and should show a brief "Working out nine ideas…" state before the images start.

### 5. Cost and honesty

One extra `gpt-4o` call per project (cents). Record it in the job's `spend` breakdown via `lib/cogs.ts` like every other call. If the concept step fails entirely, fall back to today's style-only behaviour rather than failing the project, and note it in the report.

## Test — this is the acceptance test, not a smoke test

Run the **exact failing brief**: name "BotMakers", tagline "AI Powered Software and Web Solutions", what they do "AI powered software and web solutions", mood Modern.

Then judge the result honestly, the way the owner did:
1. Print the nine concept titles and stories. **At most one may involve a robot.** If two or more do, the variety rule failed — fix it before shipping.
2. Generate the nine images. Save them and LOOK at them yourself (Read tool). Count how many are a literal robot beside the name. The number to beat is five.
3. Save a contact sheet to `C:\Users\tdani\AppData\Local\Temp\claude\C--dev-1---PrismGraphs\b49a578b-8a92-4baa-9740-01972f39bb4f\scratchpad\logo-concepts-after.png` and screenshots of the grid showing the stories.

Report under 300 words: the nine concept titles and one-line stories verbatim, how many drew a robot (before: 5 of 9), where the story appears for the customer, what the concept step cost, screenshot paths, commits, deployment status, anything left undone.

## 6. Save for later — required at every stage

The owner's rule, and it applies to this build and to the app generally: **at every stage of any build, a customer must be able to stop and come back.** A logo project is the clearest case — nine concepts, three rounds, a final. Nobody finishes that in one sitting, and losing it would be losing something they paid $149 for.

For Logo Studio specifically:
- A **Save for later** button on every stage (brief, directions, each round, final), saving the whole project: the brief, the concepts with their stories, every image made so far, which direction was taken, every round's variations, and where they had got to.
- On returning to `/logo`, an unfinished project is offered plainly: *"BotMakers — Round 2 of 3, saved Tuesday. Pick up where you left off"*, alongside "Start a new project".
- Saving must be explicit AND automatic: save on every stage change as well, so a closed tab loses nothing. The button exists so the customer can see it is safe.
- Nothing is charged again to resume. The project keeps its paid status.
- Projects live in the Library alongside designs, so there is one place to find your work.

Check the rest of the app for the same gap while you are here and note (do not necessarily fix) which other flows lose work if the customer leaves: New Design, Thumbnails, Slide Decks, PowerPoint, Sizes. Report what you found. The recently added back-button drafts cover a browser Back only, not a customer who closes the tab and returns tomorrow.
