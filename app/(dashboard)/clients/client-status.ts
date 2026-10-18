// =============================================================================
// WHAT A CLIENT'S STATUS IS CALLED — plain words, soft colours.
//
// The database keeps its words (lead / active / engaged / converted /
// inactive — the API, CSV export and filters use them). People read these
// instead: the old chips said "Inactive" in alarm red and "Converted" in
// warning amber, which read like errors (audit 2026-10-09).
// Pure, so a test can check it.
// =============================================================================

export const CLIENT_STATUSES = ['lead', 'active', 'engaged', 'converted', 'inactive'] as const
export type ClientStatus = (typeof CLIENT_STATUSES)[number]

export const STATUS_WORDS: Record<ClientStatus, string> = {
  lead: 'New',
  active: 'In touch',
  engaged: 'Watched your video',
  converted: 'Customer',
  inactive: 'Quiet lately',
}

/** The chip's look: `tone` maps to a soft class in globals.css (.cl-status). */
export const STATUS_TONE: Record<ClientStatus, 'plain' | 'blue' | 'green'> = {
  lead: 'plain',
  active: 'blue',
  engaged: 'green',
  converted: 'green',
  inactive: 'plain',
}

export function statusWords(status: string | null | undefined): string {
  return STATUS_WORDS[(status ?? '') as ClientStatus] ?? STATUS_WORDS.lead
}

export function statusTone(status: string | null | undefined): 'plain' | 'blue' | 'green' {
  return STATUS_TONE[(status ?? '') as ClientStatus] ?? 'plain'
}
