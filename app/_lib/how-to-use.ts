// =============================================================================
// "HOW TO USE" — the steps for each screen, in one place.
//
// The sibling apps each have a "How to use" button on every tool. Ours sits in
// the top bar and opens the guide for the screen you're on. Every guide here
// is written from what that screen SAYS today: words in **double stars** are
// the screen's own words (a heading, a button), shown in bold. A test
// (tests/how-to-use.test.ts) checks that each bold phrase really appears in
// the files listed in `sources`, and that every route exists — so when a
// screen's words change, this file has to change with it.
//
// Plain words, short steps, numbered. Prices are never typed here.
// =============================================================================

import { NAMES, KIND_NAMES } from './names'

export type HowToGuide = {
  /** Shown as the pop-up's title. */
  title: string
  /** One line under the title: what this screen is for. */
  intro: string
  /** Numbered steps. **bold** = the screen's own words. */
  steps: string[]
  /**
   * A short video for this screen, when one is recorded. None are yet; the
   * pop-up shows nothing in its place until this is set.
   */
  video?: { src: string; title: string }
  /** The Help Center article that goes deeper. */
  helpHref: string
  /**
   * Questions people ask on this screen. The help assistant opens with these
   * as one-tap suggestions when it's opened here (HelpChatWidget), so they
   * should be things this screen really does.
   */
  asks: string[]
  /** The files that draw this screen — where the bold words must appear. */
  sources: string[]
}

export type HowToEntry = HowToGuide & {
  /** Addresses this guide is for. `[id]` stands for any one segment. */
  routes: string[]
}

const LIBRARY_TABS = ['All', ...(['video', 'presentation', 'deck', 'graphic'] as const).map((k) => KIND_NAMES[k].many)]
  .map((t) => `**${t}**`).join(', ')

export const HOW_TO: HowToEntry[] = [
  {
    routes: ['/dashboard'],
    title: 'Home',
    intro: 'Start something new, and see who needs you today.',
    steps: [
      'To start something new, pick a card under **Start something new**: **From a document**, **From a website**, **From an idea** or **A commercial**. Step 1 opens with that choice already made.',
      'Under **Today’s clients** are the people who need you — someone who **Clicked to book**, **Watched it**, or hasn’t opened it yet. Each card has the next thing to do, like **Send the follow-up**.',
      '**Projects** lists your latest work and where each one is at. Press **Continue** on a draft or **Open** on the rest. **See all** opens your Library.',
      '**This month** counts emails sent, projects watched and clicks to book a call, plus the credits you have left.',
      'Your credits are the gold box at the top. Press it to top up. New here? You can make your first project and see a free preview before you add a card — the note at the top says **Try it before you add a card.**',
    ],
    helpHref: '/help/getting-started',
    asks: ['How do I make my first video?', 'Do I need a card to try it?', 'What does a video cost?', 'What do the cards under Today’s clients mean?'],
    sources: ['app/(dashboard)/dashboard/page.tsx', 'app/(dashboard)/dashboard/_home/start-cards.ts', 'app/(dashboard)/dashboard/_home/derive.ts'],
  },
  {
    routes: ['/create'],
    title: 'Step 1 — What it’s about',
    intro: 'Three questions. Nothing is made or charged until step 3.',
    steps: [
      'Under **Who is it for?**, pick one of your clients, add a new one, or choose **No client — general**.',
      'Under **What should it get them to do?**, say the goal in a sentence.',
      'Under **Where should the content come from?**, pick **Website URL**, **Upload file** (up to 5 files), **Paste text** or **AI writes it** — then add the link, the file or the text.',
      'Press **Read it and plan the story →**. If something is missing, the button says what — press **Show me** to jump to it. While it reads, each stage gets a tick as it really finishes.',
      '**Here’s what we read** shows **What it says**, **The one point** and **The numbers we’ll use** — exactly as they’ll go into the story. Fix anything that’s off (or **Remove** a number), then press **Looks right — write the story →**. **← Change what I gave you** goes back. **Your video so far**, beside the page, keeps every choice and the price.',
      'Making custom graphics or a commercial instead? Use the links under **Making something else?**',
    ],
    helpHref: '/help/creating-videos',
    asks: ['Which files can I upload?', 'Can it read my website instead?', 'Is anything charged on this step?', 'What if it read a number wrong?'],
    sources: [
      'app/(dashboard)/create/_components/Step1Content.tsx',
      'app/(dashboard)/create/_components/ClientPicker.tsx',
      'app/(dashboard)/create/_components/ReadReview.tsx',
      'app/(dashboard)/create/_components/workspace/MainAction.tsx',
      'app/(dashboard)/create/_components/workspace/SoFarPanel.tsx',
    ],
  },
  {
    routes: ['/create/script', '/create/brief'],
    title: 'Step 2 — Check the story',
    intro: 'Read what it will say and change anything. This step is free.',
    steps: [
      'Pick the **Length**: **Short**, **Standard** or **Detailed**. If the story is already written, it offers **Rewrite at this length**.',
      'Read **The one point** — the single thing your client should take away.',
      'Change any scene by typing in it. **More — words on screen, ask AI, preview** shows the words on the slide and **Preview slide**.',
      'To change the whole story, type what you want under **Change it by asking** (or press **Make it shorter** or **Simpler words**) and press **Send**. **Undo that change** puts it back.',
      'When it reads right, press **Looks right — pick the look →**. If it can’t be pressed yet, the line under it says why.',
    ],
    helpHref: '/help/creating-videos',
    asks: ['How do I change a scene?', 'What do Short, Standard and Detailed mean?', 'Can I undo a change?', 'Does rewriting the story cost anything?'],
    sources: [
      'app/(dashboard)/create/script/page.tsx',
      'app/(dashboard)/create/_components/story/LengthPicker.tsx',
      'app/(dashboard)/create/_components/story/lengths.ts',
      'app/(dashboard)/create/_components/story/OnePoint.tsx',
      'app/(dashboard)/create/_components/story/SceneCard.tsx',
      'app/(dashboard)/create/_components/story/AskPanel.tsx',
    ],
  },
  {
    routes: ['/create/theme'],
    title: 'Step 3 — Make it yours',
    intro: 'Pick what to send, the look and the voice. The price is on the button.',
    steps: [
      'The line at the top shows the brand it will use. Press **Change** to pick another. No brand yet? Press **Add your brand**: type your name, upload your logo and pick your colours right here — **Fill in from it** reads them from your website. **Save my brand** keeps it for every new project.',
      'Under **What do you want to send?**, pick **Narrated video**, **Interactive presentation** or **Slide deck**. Each shows what it costs.',
      'Pick **The look**. For a video or presentation, pick **The voice** too — press ▶ to hear one. A video can also have **Background music**.',
      'Optional: open **For your client (optional)** to write **A note to your client**.',
      'Press **See a free preview** to see the first scene in your look and hear the voice — free, a few a day, no card needed. Then check **The price** and press **Make it**. The price is on the button, and **This is the only button that spends credits.** No card yet? Make it takes you to add one, then brings you back.',
    ],
    helpHref: '/help/creating-videos',
    asks: ['How do I add my logo?', 'Which look should I pick?', 'Is the preview free?', 'Why does Make it ask for a card?'],
    sources: [
      'app/(dashboard)/create/theme/page.tsx',
      'app/(dashboard)/create/_components/make/AddBrandPiece.tsx',
      'app/(dashboard)/create/_components/make/FirstScenePreview.tsx',
      'app/(dashboard)/create/_components/make/Pickers.tsx',
      'app/(dashboard)/create/_components/make/PricePanel.tsx',
      'app/(dashboard)/create/_components/workspace/SoFarPanel.tsx',
    ],
  },
  {
    routes: ['/create/generating'],
    title: 'Step 4 — Send it',
    intro: 'Your project is being made. Then you send it.',
    steps: [
      'The list shows each real stage — a tick when it’s done, and what is happening right now (like “Drawing scene 3 of 6”). **This usually takes** **about 3–5 minutes** — the Slide Deck look takes about 10.',
      '**You can close this page** — **we’ll email you when it’s ready**. It keeps going and lands in your Library, and Home shows it under **Finished while you were away**.',
      'When it’s done, its page opens on its own, at **Ready to send**.',
      'There you check what your client will see, write **A short note**, and press **Send to** your client — or **or copy the link** to send it yourself.',
    ],
    helpHref: '/help/sharing-videos',
    asks: ['How long does it take?', 'Can I close this page?', 'What if it fails?', 'How do I send it when it’s done?'],
    sources: ['app/(dashboard)/create/generating/page.tsx', 'app/(dashboard)/videos/[id]/send/ReadyToSend.tsx', 'app/(dashboard)/dashboard/page.tsx'],
  },
  {
    routes: ['/videos/[id]'],
    title: 'Your finished project',
    intro: 'Send it first. Then change it, see who watched, or download it.',
    steps: [
      '**Ready to send** shows exactly what your client will see. **What’s left** lists anything missing from their page — press one to fix it.',
      'Write **A short note**, then press **Send to** your client. Or use **or copy the link**, or **Copy the email** to send it from your own inbox.',
      '**Ask for a change**: pick **This scene** or the whole thing and say what you want. It opens the right editor for this project and shows the price before anything is rebuilt.',
      '**Who watched** lists each person you sent it to and how far they got. **Download** has the files this project has; **More** has Rename, **Duplicate**, **Social posts** and Delete.',
      'On a paid plan, **Quote / Invoice** adds a quote with a pay button, and **Follow-Up Plan** writes follow-up emails.',
    ],
    helpHref: '/help/sharing-videos',
    asks: ['How do I send this to my client?', 'How do I change one scene?', 'Can I download it as an MP4?', 'How do I see who watched it?'],
    sources: [
      'app/(dashboard)/videos/[id]/page.tsx',
      'app/(dashboard)/videos/[id]/send/ReadyToSend.tsx',
      'app/(dashboard)/videos/[id]/send/WhatsLeft.tsx',
      'app/(dashboard)/videos/[id]/change/ChangeBar.tsx',
      'app/(dashboard)/videos/[id]/viewing/ClientViewing.tsx',
      'app/(dashboard)/videos/[id]/result/ResultHeader.tsx',
      'app/(dashboard)/videos/[id]/result/DownloadsMenu.tsx',
      'app/(dashboard)/videos/[id]/extras/MoreForThis.tsx',
    ],
  },
  {
    routes: ['/videos'],
    title: NAMES.library,
    intro: 'Everything you’ve made, in one list.',
    steps: [
      `Use the tabs — ${LIBRARY_TABS} — to show one kind.`,
      'Each row shows what it is, who it’s for, whether it’s ready, the credits it used and the date.',
      'Press **Open** to see one, send it or download it. **Delete** removes a video (it asks first).',
      'Older work is on the next pages: change **Per page:** or press **Next →**.',
      `**${NAMES.newButton}** starts something new.`,
    ],
    helpHref: '/help',
    asks: ['How do I find an older project?', 'How do I make a copy of one?', 'Can I get my credits back if one failed?'],
    sources: ['app/(dashboard)/videos/page.tsx', 'app/(dashboard)/videos/LibraryTable.tsx'],
  },
  {
    routes: ['/brands', '/brands/new', '/brands/[id]'],
    title: NAMES.brands,
    intro: 'Your logo and colors, or your name and photo — added to everything you make.',
    steps: [
      'A brand is a **Company** (logo and colors) or a **Person** (name, role and photo). It goes on your covers, closing slides and client pages.',
      `Press **${NAMES.newBrand}**. For a company, **Import from website** and **Analyze brand** can fill it in for you.`,
      'Fill in the details. Tick **Set as default brand** to use it on every new project, then press **Create brand →**.',
      'Click a brand to change it, then press **Save changes →**. The × on a brand’s card deletes it (it asks first).',
    ],
    helpHref: '/help/brands',
    asks: ['What’s the difference between a Company and a Person?', 'Why doesn’t my logo show?', 'How do I make one brand the default?'],
    sources: ['app/(dashboard)/brands/page.tsx', 'app/(dashboard)/brands/new/page.tsx', 'app/(dashboard)/brands/[id]/page.tsx'],
  },
  {
    routes: ['/clients', '/clients/[id]'],
    title: NAMES.clients,
    intro: 'The people you send to, and what they’ve done with it.',
    steps: [
      'Press **Add Client**, type their **Name** (email, company and phone if you have them) and press **Save Client**. Have a list? Use **Import CSV**.',
      'Use the search box and the filters to find someone.',
      'On a row, **View** opens their page, **Send Video** starts a project for them and **Email** writes to them.',
      'A client’s page has **Activity**, **Videos**, **Emails** and **Payments**. Keep notes with **Add Note**, or press **Create Video for This Client**.',
    ],
    helpHref: '/help',
    asks: ['How do I import my client list?', 'How do I send a client a video?', 'Where do I see what a client watched?'],
    sources: ['app/(dashboard)/clients/page.tsx', 'app/(dashboard)/clients/[id]/page.tsx'],
  },
  {
    routes: ['/settings'],
    title: 'Settings',
    intro: 'Your details, your connections and your plan.',
    steps: [
      '**Profile** — your name, company, phone and role (press **Save changes**), your sign-in email and password, and your photos.',
      '**Integrations** — connect your email so sends come from you, and add your Stripe payment link and your booking link (Calendly, Cal.com or Google Calendar). Links must start with https://.',
      '**Subscription** — your credits (**Buy credits**), your plan (**Manage billing & invoices**) and the plans you can switch to.',
      '**Re-run Setup Wizard** walks you through setup again.',
    ],
    helpHref: '/help/account',
    asks: ['How do I send emails from my own address?', 'How do I add my booking link?', 'How do I change my plan?'],
    sources: ['app/(dashboard)/settings/page.tsx'],
  },
]

/** For screens without their own guide: how to get around. */
export const GETTING_AROUND: HowToGuide = {
  title: 'Getting around',
  intro: 'What the top bar does, on every screen.',
  steps: [
    `**${NAMES.newButton}** starts something new: a video, a presentation or a slide deck.`,
    `**${NAMES.library}** has everything you’ve made. **${NAMES.clients}** are the people you send to. **${NAMES.brands}** are your logos and colors.`,
    'Your credits are the gold box. Press it to top up.',
    'Press your initial at the top right for your plan, Analytics, AI Social, Affiliate Program, Settings, Help Center and Sign out.',
    'The logo takes you Home.',
  ],
  helpHref: '/help/getting-started',
  asks: ['How do I make a video?', 'What do credits cost?', 'How do I add my brand logo?', 'Can I download as PDF?'],
  sources: ['app/_lib/names.ts', 'app/_lib/brand.ts'],
}

function routeRegex(route: string): RegExp {
  const body = route.split('/').map((seg) => (seg === '[id]' ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/')
  return new RegExp(`^${body}/?$`)
}

/** The guide for this address — the screen's own, or "Getting around". */
export function howToFor(pathname: string | null | undefined): HowToGuide & { own: boolean } {
  const path = (pathname ?? '').split('?')[0]
  // /brands/new must win over /brands/[id]; exact words before [id].
  for (const exactFirst of [true, false]) {
    for (const entry of HOW_TO) {
      for (const r of entry.routes) {
        if (r.includes('[id]') === exactFirst) continue
        if (routeRegex(r).test(path)) return { ...entry, own: true }
      }
    }
  }
  return { ...GETTING_AROUND, own: false }
}

/** Splits "**bold** words" into pieces the pop-up can draw (no raw HTML). */
export function boldParts(step: string): { text: string; bold: boolean }[] {
  return step.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((p) =>
    p.startsWith('**') && p.endsWith('**') ? { text: p.slice(2, -2), bold: true } : { text: p, bold: false })
}

/**
 * WHERE THE PERSON IS, for the help assistant (app/api/help-chat). The page
 * address sent by the browser is only used to LOOK UP one of the guides above
 * — the assistant is told the guide's own words, never the raw address, so a
 * made-up address can't put words in its mouth. Returns '' for an address
 * with no guide of its own (the assistant then answers in general).
 */
export function helpContextFor(pathname: unknown): string {
  if (typeof pathname !== 'string' || pathname.length > 200) return ''
  const guide = howToFor(pathname)
  if (!guide.own) return ''
  const steps = guide.steps.map((st, i) => `${i + 1}. ${st.replace(/\*\*/g, '"')}`).join('\n')
  return `THE SCREEN THE PERSON IS ON RIGHT NOW: "${guide.title}" — ${guide.intro}
What this screen shows and how to use it (its own words in quotes):
${steps}
Answer with this screen in mind: if the question is about something here, point to it by its on-screen name. If it's about another screen, say where to go.`
}
