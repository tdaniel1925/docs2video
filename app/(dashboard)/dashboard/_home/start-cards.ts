import { createHref } from '../../../_lib/create-sources'

/*
 * THE START TILES at the top of Home — the sibling apps open on "what do you
 * want to make?", not on a list. Round B (2026-10) made them VidWiz's compact
 * quick-start tiles: icon · title · one line, three across and two rows on a
 * computer, two across on a phone. Each opens step 1 with its source already
 * chosen (/create?source=…); the commercial has its own maker; "Your brand"
 * opens Brands. A guard test checks every link lands somewhere real.
 */
export type StartCard = {
  key: 'document' | 'website' | 'idea' | 'paste' | 'commercial' | 'brand'
  title: string
  text: string
  href: string
}

export const START_CARDS: StartCard[] = [
  { key: 'document', title: 'From a document', text: 'PDF, Word or PowerPoint — up to 5 files', href: createHref('upload') },
  { key: 'website', title: 'From a website', text: 'Paste a link and it reads the page', href: createHref('url') },
  { key: 'idea', title: 'From an idea', text: 'Describe it in a sentence; AI writes it', href: createHref('ai') },
  { key: 'paste', title: 'Paste your text', text: 'Already have the words', href: createHref('paste') },
  { key: 'commercial', title: 'A commercial', text: 'A short ad from a site, a PDF or an idea', href: '/create/commercial' },
  { key: 'brand', title: 'Your brand', text: 'Logo and colours for everything you make', href: '/brands' },
]

/** Kept for links elsewhere that open step 1 on "Paste your text". */
export const PASTE_HREF = createHref('paste')
