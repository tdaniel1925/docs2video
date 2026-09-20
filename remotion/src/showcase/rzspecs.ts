import type { ToolSpec } from './RzTool'

/* Specs for the Restylez tool explainers. Shot names + box keys come from
 * scripts/rz-tools-capture.mjs. Heads use *asterisks* for the blue accent. */

export const SIZES: ToolSpec = {
  id: 'rzsizes', url: 'restylez.app/sizes',
  cta: { head: 'One design. Every size.', url: 'restylez.app/sizes' },
  beats: [
    { shot: '1-empty', focus: 'page_top', bias: 0, kicker: 'Sizes', head: 'Every size of a design — *in one go.*', stamp: 'PNG + print PDF', stampColor: '#14161a' },
    { shot: '1-empty', focus: 'picked', bias: -60, fade: '2-picked', fadeAt: 0.45, cursor: 'picked', click: true, clickAt: 0.4, kicker: 'Step 1', head: 'Pick a design — *or drop one in.*' },
    { shot: '2-picked', focus: 'printkit', bias: 40, cursor: 'printkit', click: true, clickAt: 0.45, fade: '3-kit', fadeAt: 0.5, zoom: 1.15, kicker: 'Step 2', head: 'Choose sizes — *or grab a whole kit.*', stamp: 'Print · social · event', stampColor: '#2e6be6' },
    { shot: '3-kit', focus: 'make', bias: 60, cursor: 'make', cursorFrom: 'printkit', click: true, clickAt: 0.35, fade: '4-working', fadeAt: 0.42, zoom: 1.12, kicker: 'Step 3', head: 'Hit *Make sizes.* Each one is rebuilt for its shape.', stamp: 'Small formats keep the headline', stampAt: 0.7 },
    { shot: '5-result', focus: 'results', bias: 120, zoom: 1.08, kicker: 'Step 4', head: 'Download as *PNG or print-ready PDF.*', stamp: 'Saved to your library', stampColor: '#14161a' },
    { kind: 'cta', head: '' },
  ],
}

export const DECK: ToolSpec = {
  id: 'rzdeck', url: 'restylez.app/deck',
  cta: { head: 'A whole deck, in minutes.', url: 'restylez.app/deck' },
  beats: [
    { shot: '1-empty', focus: 'page_top', kicker: 'Slide Decks', head: 'Build a whole slide deck — *in any look.*' },
    { shot: '1-empty', focus: 'textarea', bias: -20, zoom: 1.15, type: { box: 'textarea', text: 'A 6-slide pitch for Forge Fitness: a six-week strength program. Cover, the problem, the program, coaches, results (3,105 members, 96% finished), and how to join.', cps: 3.2 }, cursor: 'plan', cursorFrom: 'textarea', click: true, clickAt: 0.86, fade: '2-typed', fadeAt: 0.3, kicker: 'Step 1', head: 'Say what it’s about — *or paste a document.*' },
    { shot: '3-plan', focus: 'plan', bias: 120, zoom: 1.06, kicker: 'Step 2', head: 'Check the plan. *Add, move, or let AI write it.*', stamp: 'One point per line', stampColor: '#14161a', stampAt: 0.5 },
    { shot: '3-plan', focus: 'build', bias: -160, fade: '4-look', fadeAt: 0.45, cursor: 'look', click: true, clickAt: 0.4, kicker: 'Step 3', head: 'Drop in *the look to copy.*', stamp: 'A slide · a flyer · anything', stampColor: '#2e6be6' },
    { shot: '4-look', focus: 'build', bias: -100, cursor: 'build', cursorFrom: 'look', click: true, clickAt: 0.35, fade: '5-working', fadeAt: 0.42, zoom: 1.08, kicker: 'Step 4', head: 'Build the deck. *Charts stay charts, numbers stay exact.*', stamp: 'Every slide in that look', stampAt: 0.7 },
    { shot: '6-result', focus: 'deck', bias: 260, zoom: 1.05, kicker: 'Step 5', head: 'Fix any slide by chat, *then download.*', stamp: 'Saved to your library', stampColor: '#14161a' },
    { kind: 'cta', head: '' },
  ],
}

export const PPTX: ToolSpec = {
  id: 'rzpptx', url: 'restylez.app/powerpoint',
  cta: { head: 'Your deck. Your words. Still editable.', url: 'restylez.app/powerpoint' },
  beats: [
    { shot: '1-choose', focus: 'page_top', kicker: 'PowerPoint Editor & Customizer', head: 'Edit a PowerPoint — *keep it editable.*' },
    { shot: '1-choose', focus: 'editfinished', bias: 0, cursor: 'editfinished', click: true, clickAt: 0.5, fade: '2-empty', fadeAt: 0.6, fadeFocus: 'page_top', kicker: 'Step 1', head: 'Edit a finished deck — *or build from a template you bought.*', url: 'restylez.app/powerpoint' },
    { shot: '2-empty', focus: 'page_top', fade: '3-read', fadeAt: 0.4, fadeFocus: 'textarea', zoom: 1.05, kicker: 'Step 2', head: 'Drop in the PowerPoint. *It reads every slide.*', stamp: 'Ready to edit', stampColor: '#2e6be6', stampAt: 0.65, url: 'restylez.app/pptx' },
    { shot: '3-read', focus: 'textarea', bias: 0, zoom: 1.15, type: { box: 'textarea', text: 'Change the client name to Harbor Life Group and every date to October 2026.', cps: 2.8 }, cursor: 'apply', cursorFrom: 'textarea', click: true, clickAt: 0.85, fade: '4-typed', fadeAt: 0.5, kicker: 'Step 3', head: 'Say what to change — *then apply.*', url: 'restylez.app/pptx' },
    { shot: '5-result', focus: 'download', bias: 0, cursor: 'download', click: true, clickAt: 0.6, zoom: 1.1, kicker: 'Step 4', head: 'Download — *a real, editable .pptx.*', stamp: 'Still editable', url: 'restylez.app/pptx' },
    { kind: 'cta', head: '' },
  ],
}

export const EDIT: ToolSpec = {
  id: 'rzedit', url: 'restylez.app/edit',
  cta: { head: 'Small fixes. No redesign.', url: 'restylez.app/library' },
  beats: [
    { shot: '1-library', focus: 'page_top', kicker: 'The Editor', head: 'Fix a detail — *without a redesign.*', url: 'restylez.app/library' },
    { shot: '1-library', focus: 'edit', bias: 0, cursor: 'edit', click: true, clickAt: 0.5, fade: '2-editor', fadeAt: 0.6, fadeFocus: 'page_top', kicker: 'Step 1', head: 'Open any design — *press Edit.*', url: 'restylez.app/library' },
    { shot: '2-editor', focus: 'textarea', bias: 0, zoom: 1.15, type: { box: 'textarea', text: 'Make the headline bigger and change 6AM DAILY to 5:30AM DAILY.', cps: 2.6 }, kicker: 'Step 2', head: 'Say what to fix — *in plain words.*', stamp: 'Plain words', stampColor: '#14161a', stampAt: 0.75 },
    { shot: '3-typed', focus: 'fix', bias: 0, cursor: 'fix', cursorFrom: 'textarea', click: true, clickAt: 0.4, fade: '4-working', fadeAt: 0.45, zoom: 1.1, kicker: 'Step 3', head: 'Hit *Fix it.* About a minute later, only that detail changed.', stamp: 'About a minute', stampColor: '#14161a', stampAt: 0.7 },
    { shot: '5-result', focus: 'result', bias: 60, cursor: 'keep', click: true, clickAt: 0.7, zoom: 1.06, kicker: 'Step 4', head: 'Keep the version you like — *every round is saved.*', stamp: 'Nothing else moved' },
    { kind: 'cta', head: '' },
  ],
}

export const LIBRARY: ToolSpec = {
  id: 'rzlibrary', url: 'restylez.app/library',
  cta: { head: 'Your work. Your money. One place.', url: 'restylez.app' },
  beats: [
    { shot: '1-list', focus: 'page_top', kicker: 'Library & Account', head: 'Where your work lives.' },
    { shot: '1-list', focus: 'firstrow', bias: -120, fade: '3-hover', fadeAt: 0.5, cursor: 'firstrow', clickAt: 0.5, zoom: 1.08, kicker: 'Library', head: 'Every remake, size and deck — *list or grid, preview on hover.*' },
    { shot: '3-hover', focus: 'firstrow', bias: -120, cursor: 'firstrow', click: true, clickAt: 0.5, zoom: 1.15, label: 'Edit · Sizes · Download · Delete', kicker: 'Library', head: 'Edit it, *make more sizes,* download, or delete.' },
    { shot: '4-account', focus: 'add50', bias: -60, cursor: 'add50', click: true, clickAt: 0.6, zoom: 1.08, kicker: 'Account', head: 'Your balance, *what things cost,* and one-click deposits.', stamp: 'From $20', stampColor: '#2e6be6', url: 'restylez.app/account' },
    { shot: '4-account', focus: 'history', bias: 120, zoom: 1.06, kicker: 'Account', head: 'Every deposit and charge listed — *no surprises.*', url: 'restylez.app/account' },
    { kind: 'cta', head: '' },
  ],
}

/*
 * THE THREE THAT HAD NO FILM.
 *
 * Logo Studio, Magic Design and Brands were the help sections whose "How to
 * Use" opened with steps and screenshots but no video. Shot names and box
 * keys come from scripts/rz-tools-capture.mjs, same as the five above. Heads
 * use *asterisks* for the blue accent.
 */

export const LOGO: ToolSpec = {
  id: 'rzlogo', url: 'restylez.app/logo',
  cta: { head: 'A logo, by talking.', url: 'restylez.app/logo' },
  beats: [
    { shot: '1-setup', focus: 'page_top', kicker: 'Create Logo', head: 'A real logo — *by describing it.*', stamp: 'No design skill', stampColor: '#14161a' },
    { shot: '1-setup', focus: 'name', bias: -40, zoom: 1.15, cursor: 'start', cursorFrom: 'name', click: true, clickAt: 0.72, fade: '2-open', fadeAt: 0.8, kicker: 'Step 1', head: 'Give it *the name,* spelled exactly right.' },
    { shot: '2-open', focus: 'say', bias: 0, zoom: 1.12, type: { box: 'say', text: 'A family bakery that only does wedding cakes. My grandmother started it in 1961 and we still use her recipes.', cps: 3.4 }, fade: '3-typed', fadeAt: 0.86, kicker: 'Step 2', head: 'Say what you do — *the way you would tell a person.*' },
    { shot: '3-typed', focus: 'send', bias: -60, cursor: 'send', cursorFrom: 'say', click: true, clickAt: 0.35, fade: '4-drawing', fadeAt: 0.45, zoom: 1.1, kicker: 'Step 3', head: 'It reads the *feeling,* not just the facts.', stamp: 'About a minute', stampColor: '#14161a', stampAt: 0.72 },
    { shot: '5-four', focus: 'four', bias: 40, zoom: 1.04, kicker: 'Step 4', head: 'Four ideas — *not one idea four times.*', stamp: 'Wordmark · crest · symbol · monogram', stampColor: '#2e6be6', stampAt: 0.55 },
    { shot: '5-four', focus: 'fourth', bias: 0, zoom: 1.18, kicker: 'Step 5', head: 'Point at one *by number.*', stamp: '“Make the 4th one green”', stampColor: '#14161a', stampAt: 0.5 },
    { shot: '7-refined', focus: 'refined', bias: 40, zoom: 1.04, kicker: 'Step 6', head: 'It changes *that one* — and keeps what you liked.', stamp: 'Changes are free', stampColor: '#2e6be6', stampAt: 0.6 },
    { kind: 'cta', head: '' },
  ],
}

export const MAGIC: ToolSpec = {
  id: 'rzmagic', url: 'restylez.app/magic',
  cta: { head: 'Your pictures. One finished piece.', url: 'restylez.app/magic' },
  beats: [
    { shot: '1-empty', focus: 'page_top', kicker: 'New Magic Design', head: 'Your words, your pictures — *one finished design.*', stamp: 'Free until you pick one', stampColor: '#2e6be6' },
    { shot: '1-empty', focus: 'goal', bias: -20, zoom: 1.14, type: { box: 'goal', text: "A flyer for Sella's Bakery to put in the window, for our wedding cake tasting day.", cps: 3.2 }, fade: '2-goal', fadeAt: 0.84, kicker: 'Step 1', head: 'Say what you are making — *like you would to a designer.*' },
    { shot: '3-words', focus: 'words', bias: 0, zoom: 1.12, kicker: 'Step 2', head: 'Then the exact words. *Every line is printed as you wrote it.*', stamp: 'No wrong prices', stampColor: '#14161a', stampAt: 0.6 },
    { shot: '4-pictures', focus: 'pictures', bias: 40, zoom: 1.06, kicker: 'Step 3', head: 'Drop in the things *you already own.*', stamp: 'Logo · photos · headshot', stampColor: '#2e6be6', stampAt: 0.5 },
    { shot: '5-ready', focus: 'three', bias: -40, cursor: 'three', click: true, clickAt: 0.4, fade: '6-drawing', fadeAt: 0.5, zoom: 1.1, kicker: 'Step 4', head: 'Three ways it could go — *free.*', stamp: 'Nothing charged', stampColor: '#14161a', stampAt: 0.72 },
    { shot: '7-three', focus: 'previews', bias: 300, zoom: 1.02, kicker: 'Step 5', head: 'Bold, warm or clean. *Pick the one you like.*' },
    { shot: '8-picked', focus: 'tweak', bias: 0, zoom: 1.1, kicker: 'Step 6', head: 'Change it *before* you pay for it.', stamp: 'Made once, correctly', stampColor: '#2e6be6', stampAt: 0.55 },
    { kind: 'cta', head: '' },
  ],
}

export const BRANDS: ToolSpec = {
  id: 'rzbrands', url: 'restylez.app/brands',
  cta: { head: 'Your logo. Your colors. Every time.', url: 'restylez.app/brands' },
  beats: [
    { shot: '1-empty', focus: 'page_top', kicker: 'Brands', head: 'Save your brand *once.*', stamp: 'Used on everything after', stampColor: '#2e6be6' },
    { shot: '1-empty', focus: 'site', bias: -40, zoom: 1.14, type: { box: 'site', text: 'botmakers.com', cps: 2.2 }, fade: '2-site', fadeAt: 0.8, kicker: 'Step 1', head: 'Paste your website — *we pull the real logo and colors.*' },
    { shot: '3-logo', focus: 'upload', bias: -40, zoom: 1.12, kicker: 'Step 2', head: 'Or upload the logo yourself. *We never invent one.*', stamp: 'Used as is', stampColor: '#14161a', stampAt: 0.55 },
    { shot: '4-filled', focus: 'save', bias: -120, cursor: 'save', cursorFrom: 'brandname', click: true, clickAt: 0.55, fade: '5-saved', fadeAt: 0.65, zoom: 1.08, kicker: 'Step 3', head: 'Name it, tick *mine to use,* and save.' },
    { shot: '5-saved', focus: 'card', bias: 60, zoom: 1.08, kicker: 'Step 4', head: 'Pick it on any deck — *your logo lands on every slide.*', stamp: 'One brand, every piece', stampColor: '#2e6be6', stampAt: 0.5 },
    { kind: 'cta', head: '' },
  ],
}
