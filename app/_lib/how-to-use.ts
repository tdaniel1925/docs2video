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

// Docs2Video makes videos and presentations (videos-only.ts); slide decks and
// graphics made before sit under "Older items", shown only when there are any.
const LIBRARY_TABS = ['All', ...(['video', 'presentation'] as const).map((k) => KIND_NAMES[k].many)]
  .map((t) => `**${t}**`).join(', ')

export const HOW_TO: HowToEntry[] = [
  {
    routes: ['/dashboard'],
    title: 'Home',
    intro: 'Start something new, and see who needs you today.',
    steps: [
      'To start something new, pick a tile under **Create**: **From a document**, **From a website**, **From an idea**, **Paste your text** or **A commercial**. Step 1 opens with that choice already made. **Your brand** opens your logos and colours.',
      'Under **Today’s clients** are the people who need you — someone who **Clicked to book**, **Watched it**, or hasn’t opened it yet. Each card has the next thing to do, like **Send the follow-up**.',
      '**Recent** lists your latest videos and presentations and where each one is at. Press **Continue** on a draft or **Open** on the rest. **See all** opens your Library — its number counts the same things as the Library’s **All** tab.',
      'The bell shows notes from the last 30 days: what’s ready, and anything that **Didn’t finish** (press it to open that video and try again). A note that repeated shows once. Older notes are under Activity.',
      '**This month** counts emails sent, projects watched and clicks to book a call, plus the credits you have left.',
      'Your credits are the gold box at the top. Press it to top up. New here? You can make your first project and see a free preview before you add a card — the line beside **Create** says **Try it before you add a card.**',
    ],
    helpHref: '/help/getting-started',
    asks: ['How do I make my first video?', 'Do I need a card to try it?', 'What does a video cost?', 'What do the cards under Today’s clients mean?'],
    sources: ['app/(dashboard)/dashboard/page.tsx', 'app/(dashboard)/dashboard/_home/start-cards.ts', 'app/(dashboard)/dashboard/_home/derive.ts'],
  },
  {
    routes: ['/create'],
    title: 'Step 1 — Your content',
    intro: 'Add what it’s about. Nothing is made or charged here.',
    steps: [
      'It opens on what you picked on Home. Drop your file in the big box (up to 5 files) — or press **Use a website**, **Paste text** or **Describe an idea** to switch.',
      'Optional: under **For**, pick one of your clients, press **+ New** to add one, or **Find** to search the rest. Under **Goal**, say what it should get them to do.',
      'Press **Read it →** in the bar at the bottom. If something is missing, the bar says what — press **Show me** to jump to it. While it reads, each stage gets a tick as it really finishes.',
      'Making a commercial instead? Press **Start a commercial**.',
    ],
    helpHref: '/help/creating-videos',
    asks: ['Which files can I upload?', 'Can it read my website instead?', 'Is anything charged on this step?', 'Do I have to pick a client?'],
    sources: [
      'app/(dashboard)/create/_components/Step1Content.tsx',
      'app/(dashboard)/create/_components/ClientPicker.tsx',
      'app/(dashboard)/create/_components/workspace/MainAction.tsx',
      'app/(dashboard)/create/_components/workspace/BottomBar.tsx',
    ],
  },
  {
    routes: ['/create/script', '/create/brief'],
    title: 'Step 2 — The story',
    intro: 'Check what it will say and change anything. This step is free.',
    steps: [
      'The big card is **The one point** — the one thing your client should take away. Under it are the numbers we’ll use, exactly as they’ll be said. Type to fix one, or press × to remove it.',
      'Pick the length beside the scenes: **Short**, **Standard** or **Detailed**. If the story is already written, it offers **Rewrite at this length**.',
      'Press **Edit** on a scene to change its words. **More — words on screen, ask AI, preview** shows the words on the slide and **Preview slide**. Drag a card to move a scene.',
      'To change the whole story, type under **Ask for a change** and press **Change**. **Undo that change** puts it back.',
      'When it reads right, press **Pick a look →** in the bar at the bottom. If it can’t be pressed yet, the line under it says why.',
    ],
    helpHref: '/help/creating-videos',
    asks: ['How do I change a scene?', 'What if a number is wrong?', 'What do Short, Standard and Detailed mean?', 'Does rewriting the story cost anything?'],
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
    title: 'Step 3 — The look',
    intro: 'Pick the look. The price and Make it are in the bar at the bottom.',
    steps: [
      'Press a look card to pick it. Each card has one short line saying what it looks like. **BEST** marks the one we recommend (**Animated slides**); **See examples** shows more of the one you picked.',
      'Picked **Drawn slides**? A **Drawing style** line appears under the cards: **3D infographic** (picked for you), **Illustrated** or **Classic**. The AI draws every slide as one picture in that style.',
      'The line under the looks shows the voice, the music and the length. Press **Change** (or open **More options**) to pick **Video** or **Presentation**, another voice (press ▶ to hear one), music, and **A note to your client**.',
      'The brand line shows the brand it will use. No brand yet? Press **Add your brand**: type your name, upload your logo and pick your colours right here — **Fill in from it** reads them from your website. **Save my brand** keeps it for every new project.',
      'Press **Free preview** to see the first scene in your look and hear the voice — free, a few a day, no card needed.',
      'The bar shows the price and what you’ll have left. Press **Make it** — the only button that spends credits. No card yet? Make it takes you to add one, then brings you back.',
    ],
    helpHref: '/help/creating-videos',
    asks: ['How do I add my logo?', 'Which look should I pick?', 'Is the preview free?', 'Why does Make it ask for a card?'],
    sources: [
      'app/(dashboard)/create/theme/page.tsx',
      'app/(dashboard)/create/_components/make/AddBrandPiece.tsx',
      'app/(dashboard)/create/_components/make/FirstScenePreview.tsx',
      'app/(dashboard)/create/_components/make/Pickers.tsx',
      // The look cards and Drawn slides' drawing-style chips are drawn from data.
      'app/(dashboard)/create/_components/make/looks.ts',
      'app/_lib/drawn-slides.ts',
    ],
  },
  {
    routes: ['/create/generating'],
    title: 'Making it',
    intro: 'Your project is being made. Then you send it.',
    steps: [
      'The list shows each real stage — a tick when it’s done, and what is happening right now (like “Drawing scene 3 of 6”). **This usually takes** **about 3–5 minutes** — the Animated slides look takes about 10.',
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
      'On a paid plan, **Quote / invoice** adds a quote with a pay button, and **Follow-up plan** writes follow-up emails.',
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
    intro: 'Your videos and presentations, as picture cards.',
    steps: [
      `Use the tabs — ${LIBRARY_TABS} — to show one kind. **All** is your videos and presentations. Slide decks and graphics made before are ONLY under **Older items** (only there when you have some); they still open, download and share.`,
      'Each card shows a picture, the name and a coloured line that says where it is: **Ready to send**, **Making…** or **Didn’t finish**, plus the date and who it’s for.',
      'Press a card to open it. On a ready video, press **Send** to go straight to sending it.',
      'Type in **Search by name or client** to find one, change the order with **Newest first**, or switch between **Cards** and **List** (it remembers your choice on this computer).',
      'To delete one, press the **…** on its card, then **Delete…** — it asks before anything is removed.',
      `Older work is on the next pages: change **Per page:** or press **Next**. **${NAMES.newButton}** starts something new.`,
    ],
    helpHref: '/help/library',
    asks: ['How do I find an older project?', 'How do I send a finished video from here?', 'How do I delete one?', 'Can I get my credits back if one failed?'],
    sources: ['app/(dashboard)/videos/page.tsx', 'app/(dashboard)/videos/library-tabs.ts', 'app/(dashboard)/videos/Library.tsx', 'app/(dashboard)/videos/CardMenu.tsx', 'app/(dashboard)/videos/LibraryTable.tsx', 'app/(dashboard)/videos/library-items.ts'],
  },
  {
    routes: ['/brands', '/brands/new', '/brands/[id]'],
    title: NAMES.brands,
    intro: 'Your logo and colors, or your name and photo — added to everything you make.',
    steps: [
      'A brand is a **Company** (logo and colors) or a **Person** (name, role and photo). It goes on your covers, closing slides and client pages.',
      `Press **${NAMES.newBrand}**. For a company, **Import from website** and **Analyze brand** can fill it in for you.`,
      'Fill in the details. Tick **Set as default brand** to use it on every new project, then press **Create brand →**.',
      'Already have a brand with that name? It says so under the name and asks once before making a second copy — **Open it** takes you to the one you have.',
      'Saved the same name more than once? The page shows one card with a button saying how many copies there are — press it to see the others. Nothing is deleted for you.',
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
      'Press **Add a client** (the first button), type their **Name** (email, company and phone if you have them) and press **Save client**. Have a list? Use **Import a CSV file**.',
      'The three boxes count your **Clients**, who you’re **In touch** with, and who was **Active this week**.',
      'Each client has a status in plain words: **New**, **In touch**, **Watched your video**, **Customer** or **Quiet lately**. Use the search box and those filters to find someone.',
      'On a client (a row, or a card on a phone), **View** opens their page, **Send a video** starts a project for them and **Email** writes to them.',
      'A client’s page has **Activity**, **Videos**, **Emails** and **Payments**. Keep notes with **Add note**, or press **Make a video for this client**.',
    ],
    helpHref: '/help',
    asks: ['How do I import my client list?', 'How do I send a client a video?', 'Where do I see what a client watched?'],
    sources: ['app/(dashboard)/clients/page.tsx', 'app/(dashboard)/clients/[id]/page.tsx', 'app/(dashboard)/clients/client-status.ts'],
  },
  {
    routes: ['/settings'],
    title: 'Settings',
    intro: 'Your account: pick a part from the menu on the left (a row at the top on a phone).',
    steps: [
      '**Profile** — your name, company, phone and role (press **Save changes**), your sign-in email and password, your photos, your API keys and **Appearance** (System, Light or Dark — Dark unless you pick otherwise; this browser only; share pages stay light). **Run the setup again** walks you through setup; **Delete account** is at the very bottom.',
      '**Billing & credits** — three boxes show your plan, your credits and what you used this period. Below them are the plans, the **Credit packs** and your invoices (**Manage billing & invoices**).',
      '**Brand kit** — your default brand: change its logo or colors, or see all your brands.',
      '**Email & sending** — connect your email so sends come from you, and add your booking link, your Stripe payment link and your view alerts. Links must start with https://.',
      '**Analytics** and **Affiliate** open in the same menu. If you have the add-on, **AI Social** is there too.',
    ],
    helpHref: '/help/account',
    asks: ['How do I send emails from my own address?', 'How do I add my booking link?', 'How do I change my plan?'],
    sources: ['app/(dashboard)/settings/page.tsx', 'app/(dashboard)/settings/BillingSection.tsx', 'app/(dashboard)/settings/account-sections.ts'],
  },
]

/** For screens without their own guide: how to get around. */
export const GETTING_AROUND: HowToGuide = {
  title: 'Getting around',
  intro: 'What the top bar does, on every screen.',
  steps: [
    `**${NAMES.newButton}** starts something new: a video or a presentation.`,
    `**${NAMES.library}** has everything you’ve made. **${NAMES.clients}** are the people you send to. **${NAMES.brands}** are your logos and colors.`,
    'Your credits are the gold box. Press it (**+ Top up**) to buy more.',
    'The bell shows the last 30 days of notes; its number is how many are new.',
    'Press your initial at the top right (**Account menu**) for your plan and shortcuts to Settings, Billing & credits, Analytics, AI Social, Affiliate, the Help Center, a Dark mode / Light mode switch and Sign out.',
    'The logo takes you Home.',
  ],
  helpHref: '/help/getting-started',
  asks: ['How do I make a video?', 'What do credits cost?', 'How do I add my brand logo?', 'Can I download as PDF?'],
  sources: ['app/_lib/names.ts', 'app/_lib/brand.ts', 'app/_components/Header.tsx'],
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
