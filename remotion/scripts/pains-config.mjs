// Shared config for the ten Jordyn FUNNEL PAIN films.
//
// These pair 1:1 with the dropdown in `jordyn 2026/lib/funnel-pains.ts` — the
// visitor clicks "I'm drowning in email" and gets the `inbox` film. The ids
// here MUST match the ids there.
//
// Six beats, ~50s, versus the ten-beat ~85s industry films in
// verticals-config.mjs. The visitor has already told us their problem by
// clicking it, so the industry films' "generic AI is a blank box" beat is dead
// weight — beat 1 names what the pain COSTS instead, which is the thing they
// haven't admitted to themselves yet.
//
//   0  hook      — the pain, close to their own words
//   1  cost      — what it actually costs them (not "it's annoying")
//   2  turn      — Jordyn arrives (logoHead caption: logo + phrase)
//   3  does      — the specific mechanic, drawn from that pain's `building` lines
//   4  guardrail — approval / proof. Nothing sends without your OK.
//   5  finale    — handled by the composition's EndScreen ({finale: true})
//
// Beats 3 and 4 are deliberately traceable to `building[]` in funnel-pains.ts,
// which was itself vetted line-by-line against what Jordyn genuinely does. The
// build screen makes these claims ~90 seconds before the film repeats them; if
// they drift apart the visitor catches it.
//
// One hard rule: the `source` field in funnel-pains.ts carries real customer
// emails and a real client name. None of that appears here, on screen or in
// narration. It is provenance for us, not copy.
//
// Same flat-editorial art system as the industry films — identical STYLE token,
// so the two sets are visually one family.

export const STYLE = "Flat modern editorial vector illustration, soft warm muted style. Palette: warm cream #faf9f5 background, terracotta rust #c4623f, warm tan #d8a07a, sage green #b6c4a2, soft gold #e5d9a8, muted charcoal #4a3f35. Gentle soft shadows, simple rounded organic shapes, subtle film grain, calm premium, generous negative space, high-end SaaS brand illustration, soft ambient light. 16:9. NO text, NO letters, NO logos, NO words.";

// The turn beat (2) is the same idea in every film — the assistant arriving —
// so it shares one art direction with per-pain props swapped in.
//
// "no character" alone is not enough: the model reads the surrounding scenes and
// adds a cropped half-figure at the edge anyway. It has to be told twice, in the
// negative, at the end where the negatives live.
const ORB = (props) =>
  `${STYLE} A warm glowing terracotta 'brain' orb radiating gentle rays, surrounded by soft flat ${props} assembling around it in a calm arc, a helpful assistant arriving, generous space. ABSOLUTELY NO people, NO figures, NO hands, NO limbs anywhere in the frame — objects and shapes only. No readable text.`;

// Pinned by DESCRIPTION, never by instruction. The pilot opened on a woman and
// by beat 4 she was a man, so the first fix said "the SAME character in every
// scene" — and the model obediently drew three vignettes of her in one frame, a
// character sheet. Consistency has to come from the description being identical
// every time; any phrase that mentions other scenes invites a multi-panel image.
const CHAR = "a friendly professional woman with warm mid-tone skin and dark brown hair in a low bun, wearing a terracotta blazer over a cream top, simple clean flat-vector features, calm and approachable";

// Appended to every scene. Gemini will otherwise happily return a grid of
// vignettes for anything that smells like a series.
export const ONE = "ONE single continuous scene in one frame — not a grid, not multiple panels, not a character sheet, not a before-and-after split.";

export const PAINS = {
  /* ── 1 ─────────────────────────────────────────────────────────────── */
  inbox: {
    label: "drowning in email",
    tagIntro: "Your inbox, already read.",
    lines: [
      "Four hundred unread. Somewhere in there are the three that actually matter.", // 0
      "So you skim. And the one you missed turns out to be the one that counted.", // 1
      "Jordyn reads every message that came in overnight — before you open your laptop.", // 2
      "It separates what needs you from what needs nobody, and finds every thread where someone is still waiting on a reply.", // 3
      "You get a short list, in the order you should actually work it, with the replies already drafted. Nothing sends without your okay.", // 4
      "Jordyn. Your inbox, already read.", // 5
    ],
    scenes: [
      `${STYLE} ${CHAR}, at a tidy desk early in the morning, looking quietly overwhelmed as a great many soft flat envelope shapes and small notification dots float and stack around them, one large stylized inbox tray, low morning window light.`,
      `${STYLE} A single small envelope shape glowing warm terracotta, drifting away unnoticed beneath a large drift of muted grey-tan envelopes, a sense of one important thing being lost in the pile, no character, quiet and slightly melancholy, generous space.`,
      ORB("envelope shapes, a small clock, and a tidy inbox tray"),
      `${STYLE} A stream of soft flat envelopes flowing in an orderly line and separating into two neat sorted stacks — one warm and prominent, one muted and set aside — with a few turning into small organized cards, calm and mechanical, no character, no readable text.`,
      `${STYLE} ${CHAR}, calm and unhurried, reviewing a short tidy stack of three prepared reply cards floating in front of them, a small approval checkmark and a pen, morning coffee beside them, a pleased and in-control moment.`,
      `${STYLE} ${CHAR} standing calmly holding a tablet, an empty and peaceful inbox tray beside them, soft sage leaf shapes in a rounded frame behind, self-assured and relieved, generous empty cream space lower-center for a logo, optimistic finale.`,
    ],
    captions: [
      { head: "Four hundred unread.", sub: "Three of them matter." },
      { head: "So you skim.", sub: "And you miss the one that counted.", accent: "the one that counted." },
      { logoHead: "reads it first.", sub: "Every message, before you open your laptop." },
      { kicker: "What it does", head: "Sorted, not summarized.", sub: "What needs you — and who is still waiting." },
      { head: "A short list, in the right order.", sub: "Replies drafted. Nothing sends without your OK.", accent: "Nothing sends without your OK." },
      { finale: true },
    ],
  },

  /* ── 2 ─────────────────────────────────────────────────────────────── */
  followup: {
    label: "things slipping through the cracks",
    tagIntro: "Nothing slips.",
    lines: [
      "You told them you'd circle back. You meant it. That was three weeks ago.", // 0
      "Nobody chased you, so nothing happened — and it went cold without a single argument.", // 1
      "Jordyn goes looking for every promise you made and never closed.", // 2
      "It finds the threads that went quiet after you sent them, and sets the reminder you meant to set at the time.", // 3
      "A month from now it puts that follow-up back on your desk, drafted and ready. Nothing sends without your okay.", // 4
      "Jordyn. Nothing slips.", // 5
    ],
    scenes: [
      `${STYLE} ${CHAR} mid-handshake or mid-conversation with a warm speech-bubble shape floating away from them, a small soft thread or ribbon trailing off and fading, the moment a promise is made, warm and sincere.`,
      `${STYLE} A soft frayed thread or ribbon drifting apart into loose ends over a calm cream space, one small muted contact card at the far end turning cool and grey, a quiet sense of something going cold, no character, generous space, no readable text.`,
      ORB("small clock faces, a calendar page, and gentle bookmark and thread shapes"),
      `${STYLE} A flat illustration of several conversation threads laid out as soft parallel ribbons, some warm and continuing, others trailing off and being gently caught and re-tied with small bookmark and clock markers, orderly and reassuring, no readable text.`,
      `${STYLE} A calendar page turning forward with a soft glowing reminder flag landing on a future date, beneath it a neatly prepared letter card with a small approval checkmark and a pen, warm and organized, no character, no readable text.`,
      `${STYLE} ${CHAR} standing calmly holding a tablet, behind them a tidy woven pattern of complete unbroken threads in warm and sage tones inside a rounded frame, self-assured, generous empty cream space lower-center for a logo, optimistic finale.`,
    ],
    captions: [
      { head: "You said you'd circle back.", sub: "That was three weeks ago." },
      { head: "Nobody chased you.", sub: "So it went cold without a single argument.", accent: "without a single argument." },
      { logoHead: "keeps the promise.", sub: "Every one you made and never closed." },
      { kicker: "What it does", head: "Finds what went quiet.", sub: "And sets the reminder you meant to set at the time." },
      { head: "Back on your desk, drafted.", sub: "Nothing sends without your OK.", accent: "Nothing sends without your OK." },
      { finale: true },
    ],
  },

  /* ── 3 ─────────────────────────────────────────────────────────────── */
  outreach: {
    label: "starting conversations",
    tagIntro: "Outreach that sounds like you.",
    lines: [
      "You need conversations. What you don't need is another template that reads like a robot wrote it.", // 0
      "So you write them by hand, ten a week, and stop the moment things get busy.", // 1
      "Jordyn reads how you actually write to people — then drafts the first message in your voice.", // 2
      "It builds the follow-ups behind it, spaced so they never nag, and stops the whole sequence the second someone replies.", // 3
      "Every message is yours to read first. Nothing sends without your okay.", // 4
      "Jordyn. Outreach that sounds like you.", // 5
    ],
    scenes: [
      `${STYLE} A row of identical flat grey-tan message cards marching stiffly in a line, one warm terracotta card standing apart from them looking human and hand-made, a contrast between generic and personal, no character, generous space, no readable text.`,
      `${STYLE} ${CHAR} at a desk writing message cards by hand one at a time, a small finished stack beside them and a much larger untouched pile waiting, a soft clock nearby, tired but diligent, warm light.`,
      ORB("speech bubbles, a fountain pen nib, and small warm message cards"),
      `${STYLE} A flat illustration of a message card at the left connected by a soft dotted line to three evenly spaced follow-up cards, each smaller and gentler, with a warm reply bubble appearing and the remaining cards politely dissolving away, orderly and considerate, no readable text.`,
      `${STYLE} ${CHAR} calmly reviewing a small fan of prepared message cards held in front of them, a soft approval checkmark and a pen, unhurried and in control, warm and confident.`,
      `${STYLE} ${CHAR} standing calmly holding a tablet, behind them soft warm speech bubbles connecting outward into a gentle network in a rounded frame, self-assured, generous empty cream space lower-center for a logo, optimistic finale.`,
    ],
    captions: [
      { head: "You need conversations.", sub: "Not another template." },
      { head: "So you write them by hand.", sub: "Ten a week — until things get busy.", accent: "until things get busy." },
      { logoHead: "writes as you.", sub: "It has read how you actually talk to people." },
      { kicker: "What it does", head: "Follow-ups that never nag.", sub: "And stop the second someone replies." },
      { head: "Yours to read first.", sub: "Nothing sends without your OK.", accent: "Nothing sends without your OK." },
      { finale: true },
    ],
  },

  /* ── 4 ─────────────────────────────────────────────────────────────── */
  proposals: {
    label: "proposals and decks",
    tagIntro: "The deck, already built.",
    lines: [
      "The proposal takes a day and a half. Most of that is rebuilding the same eleven slides you built last month.", // 0
      "And by the time it's ready, the conversation that needed it has cooled off.", // 1
      "Jordyn already knows what you've said about your business, because it has been reading it all along.", // 2
      "It lays that out on your letterhead, in your tone, and builds the PowerPoint and the PDF together.", // 3
      "You get it back in minutes, ready to edit. Nothing goes out without your okay.", // 4
      "Jordyn. The deck, already built.", // 5
    ],
    scenes: [
      `${STYLE} ${CHAR} at a desk rebuilding a presentation, several soft flat slide rectangles floating in a repeating grid around them, a few nearly identical to each other, a soft clock showing late hours, patient but weary, warm light.`,
      `${STYLE} A finished warm document or deck shape arriving at a table where a conversation has already ended — two empty chairs and a cooling coffee cup, gentle and a little rueful, no character, generous space, no readable text.`,
      ORB("document pages, slide rectangles, and a letterhead sheet"),
      `${STYLE} A flat illustration of soft content fragments and quote marks flowing together and settling neatly onto a letterhead page, which then splits into two finished stacks side by side — a slide deck and a document — tidy and satisfying, no readable text.`,
      `${STYLE} ${CHAR} reviewing a handsomely laid-out finished deck and document on the desk in front of them, a small approval checkmark and a pen, pleased and unhurried, warm confident light.`,
      `${STYLE} ${CHAR} standing calmly holding a tablet, behind them a neat fan of finished document and slide shapes in a rounded frame with soft sage leaves, self-assured, generous empty cream space lower-center for a logo, optimistic finale.`,
    ],
    captions: [
      { head: "A day and a half.", sub: "Rebuilding the same eleven slides." },
      { head: "And by then the moment's gone.", sub: "The conversation that needed it cooled off.", accent: "cooled off." },
      { logoHead: "already knows.", sub: "It has been reading your business all along." },
      { kicker: "What it does", head: "Your letterhead. Your tone.", sub: "PowerPoint and PDF, built together." },
      { head: "Back in minutes, ready to edit.", sub: "Nothing goes out without your OK.", accent: "Nothing goes out without your OK." },
      { finale: true },
    ],
  },

  /* ── 5 ─────────────────────────────────────────────────────────────── */
  recruiting: {
    label: "growing the agency",
    tagIntro: "Every conversation, still moving.",
    lines: [
      "Growth is twenty conversations running at once, and no honest answer to where any of them stand.", // 0
      "The ones you forget are usually the ones who were closest to yes.", // 1
      "Jordyn maps every conversation you have open, and where each one actually stalled.", // 2
      "It drafts the next message for each of them, and flags the people who have gone quiet the longest.", // 3
      "You approve them in a batch, in a few minutes. Nothing sends without your okay.", // 4
      "Jordyn. Every conversation, still moving.", // 5
    ],
    scenes: [
      `${STYLE} ${CHAR} standing amid many soft floating contact cards arranged at scattered heights and distances with no clear order, looking thoughtful and slightly lost, warm and busy, generous space.`,
      `${STYLE} One warm terracotta contact card very near the top of a soft rising path, quietly fading to muted grey and slipping backward, the other cards unaware, a sense of near-miss, no character, gentle and generous space, no readable text.`,
      ORB("contact cards, a soft connecting network of lines, and a small upward arrow"),
      `${STYLE} A flat illustration of contact cards arranged into tidy labelled columns along a gentle upward path, each with a small marker showing where it paused, and a few cards glowing warm to signal attention needed, organized and clear, no readable text.`,
      `${STYLE} ${CHAR} calmly approving a neat vertical stack of prepared message cards with a series of small soft checkmarks appearing down the side, efficient and satisfied, warm light.`,
      `${STYLE} ${CHAR} standing calmly holding a tablet, behind them contact cards connected into a healthy warm network climbing gently upward inside a rounded frame, self-assured, generous empty cream space lower-center for a logo, optimistic finale.`,
    ],
    captions: [
      { head: "Twenty conversations at once.", sub: "And no honest answer on any of them." },
      { head: "The ones you forget —", sub: "are the ones who were closest to yes.", accent: "closest to yes." },
      { logoHead: "maps all of it.", sub: "Every open conversation, and where it stalled." },
      { kicker: "What it does", head: "The next message, drafted.", sub: "And the ones gone quiet longest, flagged." },
      { head: "Approve the batch in minutes.", sub: "Nothing sends without your OK.", accent: "Nothing sends without your OK." },
      { finale: true },
    ],
  },

  /* ── 6 ─────────────────────────────────────────────────────────────── */
  clients: {
    label: "knowing where things stand",
    tagIntro: "You always know where things stand.",
    lines: [
      "The phone rings, it's a client, and you have about four seconds before they know you don't remember.", // 0
      "So you stall, and you search your email, and you sound like someone who wasn't paying attention.", // 1
      "Jordyn gathers every email, file, and note for that client into one place.", // 2
      "It rebuilds the timeline of what has actually happened, and works out what is still open and who owes whom.", // 3
      "You get all of it before you pick up. Not twenty minutes after.", // 4
      "Jordyn. You always know where things stand.", // 5
    ],
    scenes: [
      `${STYLE} ${CHAR} holding a ringing stylized phone with soft sound-wave arcs, a flicker of panic in their calm posture, a few scattered document and envelope shapes drifting just out of reach, warm and tense, generous space.`,
      `${STYLE} ${CHAR} scrolling frantically through a tall column of soft muted document cards while a phone with sound waves waits beside them, a small clock ticking, flustered but sympathetic, warm light.`,
      ORB("envelopes, document pages, a folder, and a small note card"),
      `${STYLE} A flat illustration of scattered emails, files, and notes flowing together and settling into a single clean horizontal timeline ribbon with tidy markers along it, a few open items gently highlighted in warm terracotta at the end, orderly, no readable text.`,
      `${STYLE} ${CHAR} answering the phone calmly and confidently, a neat summary card floating beside them already prepared, relaxed shoulders, warm and assured light.`,
      `${STYLE} ${CHAR} standing calmly holding a tablet, behind them a clean warm timeline ribbon with tidy markers inside a rounded frame with soft sage leaves, self-assured, generous empty cream space lower-center for a logo, optimistic finale.`,
    ],
    captions: [
      { head: "Four seconds.", sub: "Before they know you don't remember." },
      { head: "So you stall and search.", sub: "And sound like you weren't paying attention.", accent: "weren't paying attention." },
      { logoHead: "has it all.", sub: "Every email, file, and note — in one place." },
      { kicker: "What it does", head: "Rebuilds the timeline.", sub: "What's still open, and who owes whom." },
      { head: "Before you pick up.", sub: "Not twenty minutes after.", accent: "Not twenty minutes after." },
      { finale: true },
    ],
  },

  /* ── 7 ─────────────────────────────────────────────────────────────── */
  social: {
    label: "never posting anything",
    tagIntro: "You post now.",
    lines: [
      "You know you should be posting. You've known that for about two years now.", // 0
      "It never reaches the top of the list, because nothing bad happens the day you skip it.", // 1
      "Jordyn reads what you have actually been working on this week.", // 2
      "It writes posts in your voice, sized for each channel, and queues them so they never need your attention again.", // 3
      "You skim them once. Nothing posts without your okay.", // 4
      "Jordyn. You post now.", // 5
    ],
    scenes: [
      `${STYLE} ${CHAR} looking at a soft empty rounded social post panel with a blinking cursor shape, a faint dusty look to it as though untouched for a long time, mildly guilty expression, warm and gentle, generous space.`,
      // A "to-do list with the post at the bottom" returns as an abstract
      // column of coloured blobs — a list minus its text is nothing. Physical
      // objects and a wide composition instead: the metaphor has to survive
      // without a single legible word.
      `${STYLE} A wide horizontal composition: a broad low pile of soft flat task cards and papers spread across the frame, and near the bottom of the pile one small warm terracotta card marked with a simple camera shape, half-buried and almost forgotten, while two or three more muted cards drift down onto the top of the pile. The important thing, buried by the urgent ones. No character, no readable text.`,
      ORB("small post cards, a camera shape, and gentle broadcast arcs"),
      `${STYLE} A flat illustration of a work-in-progress shape at the left turning into three differently sized post cards, which then slot neatly into a soft calendar queue with small scheduled markers, tidy and automatic, no readable text.`,
      `${STYLE} ${CHAR} casually skimming a small row of prepared post cards on a tablet with a soft approval checkmark, relaxed and unbothered, coffee nearby, warm light.`,
      `${STYLE} ${CHAR} standing calmly holding a tablet, behind them warm post cards radiating outward in gentle broadcast arcs inside a rounded frame, self-assured, generous empty cream space lower-center for a logo, optimistic finale.`,
    ],
    captions: [
      { head: "You know you should post.", sub: "You've known for two years." },
      { head: "It never reaches the top.", sub: "Nothing bad happens the day you skip it.", accent: "the day you skip it." },
      { logoHead: "already knows.", sub: "What you've actually been working on this week." },
      { kicker: "What it does", head: "Written and queued.", sub: "In your voice, sized for each channel." },
      { head: "Skim it once.", sub: "Nothing posts without your OK.", accent: "Nothing posts without your OK." },
      { finale: true },
    ],
  },

  /* ── 8 ─────────────────────────────────────────────────────────────── */
  phone: {
    label: "nobody answering the phone",
    tagIntro: "Every call answered.",
    lines: [
      "Someone called while you were with a client. They left a voicemail. Then they called your competitor.", // 0
      "A missed call isn't a message waiting. It's a customer, deciding.", // 1
      "Jordyn answers the phone in your business's voice, on the first ring.", // 2
      "It knows what your callers actually ask, it books the appointment, and it writes down every word.", // 3
      "The transcript is on your desk before you're out of the meeting.", // 4
      "Jordyn. Every call answered.", // 5
    ],
    scenes: [
      `${STYLE} ${CHAR} in conversation with someone across a desk while a stylized phone rings unattended nearby with soft sound-wave arcs fading into grey, warm and busy, generous space.`,
      `${STYLE} A soft warm caller figure or contact card at a fork in a gentle path, one branch cooling to muted grey and one leading warmly away, a small voicemail icon left behind and unheard, no character, quiet and decisive, no readable text.`,
      ORB("a friendly phone handset, soft sound-wave arcs, and a small calendar"),
      `${STYLE} A flat illustration of a friendly stylized phone answered by a warm glowing assistant presence, sound waves flowing into a tidy calendar with a booked slot and a neat written transcript card beside it, effortless and organized, no readable text.`,
      `${STYLE} ${CHAR} stepping out of a meeting doorway to find a neat transcript card and a booked appointment card already waiting on the desk, pleasantly surprised and relaxed, warm light.`,
      `${STYLE} ${CHAR} standing calmly holding a tablet, behind them a friendly phone with warm confident sound-wave arcs inside a rounded frame with soft sage leaves, self-assured, generous empty cream space lower-center for a logo, optimistic finale.`,
    ],
    captions: [
      { head: "They left a voicemail.", sub: "Then they called your competitor." },
      { head: "A missed call isn't a message.", sub: "It's a customer, deciding.", accent: "It's a customer, deciding." },
      { logoHead: "picks up.", sub: "In your business's voice, on the first ring." },
      { kicker: "What it does", head: "Answers. Books. Writes it down.", sub: "It knows what your callers actually ask." },
      { head: "The transcript is waiting.", sub: "Before you're out of the meeting.", accent: "Before you're out of the meeting." },
      { finale: true },
    ],
  },

  /* ── 9 ─────────────────────────────────────────────────────────────── */
  writing: {
    label: "emails taking too long",
    tagIntro: "Two minutes, not twenty.",
    lines: [
      "Twenty minutes on an email that should have taken two. You rewrote the opening line four times.", // 0
      "Do that six times a day and correspondence has quietly eaten your whole morning.", // 1
      "Jordyn has learned how you write when you're at your best.", // 2
      "Paste the rough version and it comes back clean — your voice, your rhythm, none of the twenty minutes.", // 3
      "You read it, you change what you want, you send. Nothing goes without your okay.", // 4
      "Jordyn. Two minutes, not twenty.", // 5
    ],
    scenes: [
      `${STYLE} ${CHAR} at a desk staring at a soft message card with a single line on it, several crumpled discarded versions of the same line floating gently nearby, a slow clock beside them, patient frustration, warm light.`,
      `${STYLE} A soft pie or clock shape where a large warm wedge is filled with small message-card icons, quietly consuming most of the morning, a small sun low in the corner, no character, honest and calm, generous space, no readable text.`,
      ORB("a fountain pen nib, soft message cards, and gentle handwriting flourishes"),
      `${STYLE} A flat illustration of a rough uneven message card on the left flowing through a soft warm filter and emerging on the right as a clean well-formed card, the handwriting character preserved rather than flattened, satisfying, no readable text.`,
      `${STYLE} ${CHAR} reading a finished message on a tablet with a relaxed expression, one small edit mark and an approval checkmark, a fast clock showing very little time passed, warm and easy.`,
      `${STYLE} ${CHAR} standing calmly holding a tablet, behind them clean well-formed message cards flowing away smoothly inside a rounded frame with soft sage leaves, self-assured, generous empty cream space lower-center for a logo, optimistic finale.`,
    ],
    captions: [
      { head: "Twenty minutes.", sub: "You rewrote the opening line four times." },
      { head: "Six times a day.", sub: "And correspondence ate your whole morning.", accent: "your whole morning." },
      { logoHead: "writes as you.", sub: "It learned how you write at your best." },
      { kicker: "What it does", head: "Rough in. Clean out.", sub: "Your voice, your rhythm — none of the twenty minutes." },
      { head: "Read it. Change it. Send it.", sub: "Nothing goes without your OK.", accent: "Nothing goes without your OK." },
      { finale: true },
    ],
  },

  /* ── 10 ────────────────────────────────────────────────────────────── */
  paperwork: {
    label: "endless paperwork",
    tagIntro: "The paperwork, done.",
    lines: [
      "Quotes, invoices, forms, filings. None of it is hard. All of it is yours.", // 0
      "It's the work that fills every gap between the work you actually get paid for.", // 1
      "Jordyn finds the documents you rebuild over and over again.", // 2
      "It fills them from what is already in your records, and files them where you will actually find them again.", // 3
      "You check the numbers and sign. Nothing leaves without your okay.", // 4
      "Jordyn. The paperwork, done.", // 5
    ],
    scenes: [
      `${STYLE} ${CHAR} at a desk beneath a tall neat tower of soft flat forms, invoices, and document pages, resigned but composed, everything tidy rather than chaotic, warm light, generous space.`,
      `${STYLE} A soft horizontal timeline ribbon where the warm valuable segments are small and far apart, and the long muted stretches between them are filled with small document icons, honest and quiet, no character, generous space, no readable text.`,
      ORB("form pages, an invoice, a folder, and a small stamp shape"),
      `${STYLE} A flat illustration of soft data fragments flowing out of a tidy record cabinet and settling into the blank fields of a form, which then files itself neatly into a labelled folder in an organized drawer, mechanical and satisfying, no readable text.`,
      `${STYLE} ${CHAR} calmly checking figures on a finished form with a pen and a small approval checkmark, unhurried and precise, warm confident light.`,
      `${STYLE} ${CHAR} standing calmly holding a tablet, behind them a tidy organized filing drawer and neat folders inside a rounded frame with soft sage leaves, self-assured, generous empty cream space lower-center for a logo, optimistic finale.`,
    ],
    captions: [
      { head: "None of it is hard.", sub: "All of it is yours." },
      { head: "It fills the gaps.", sub: "Between the work you actually get paid for.", accent: "you actually get paid for." },
      { logoHead: "finds the pattern.", sub: "The documents you rebuild over and over." },
      { kicker: "What it does", head: "Filled from your records.", sub: "And filed where you'll find them again." },
      { head: "Check the numbers and sign.", sub: "Nothing leaves without your OK.", accent: "Nothing leaves without your OK." },
      { finale: true },
    ],
  },
};
