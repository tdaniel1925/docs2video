import { createHref } from '../../../_lib/create-sources'

/*
 * THE START CARDS at the top of Home — the sibling apps open on "what do you
 * want to make?", not on a list. Each card opens step 1 with its source
 * already chosen (/create?source=…); the commercial has its own maker.
 * A guard test checks every link lands on a source step 1 understands.
 */
export type StartCard = {
  key: 'document' | 'website' | 'idea' | 'commercial'
  title: string
  text: string
  href: string
}

export const START_CARDS: StartCard[] = [
  { key: 'document', title: 'From a document', text: 'A PDF, Word file or PowerPoint — up to 5 files.', href: createHref('upload') },
  { key: 'website', title: 'From a website', text: 'Paste a link and it reads the page for you.', href: createHref('url') },
  { key: 'idea', title: 'From an idea', text: 'Describe it in a sentence and AI writes it.', href: createHref('ai') },
  { key: 'commercial', title: 'A commercial', text: 'A short ad from a website, a PDF, your own words or an idea.', href: '/create/commercial' },
]

/** The quiet line under the cards, for people who already have the words. */
export const PASTE_HREF = createHref('paste')
