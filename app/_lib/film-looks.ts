// Pure data shared by the browser (step 3) and the server (generate-video, the draft save): the film engine's
// twelve looks. No imports, safe anywhere. The ids are the film themes in remotion/src/film/theme.ts (a test keeps
// the two lists the same).
//
// A film look is saved on the draft as `filmLook`, next to the kit look nearest to it (`kitLook`). The kit look
// still decides what the kit decides (the music feel, the fallback engine's colors), so every kit path stays valid.

export const FILM_LOOK_IDS = ['slides', 'editorial', 'bright', 'infographic', 'midnight', 'heritage', 'warm', 'bold', 'mint', 'swiss', 'luxury', 'night'] as const
export type FilmLookId = typeof FILM_LOOK_IDS[number]
export const isFilmLookId = (v: unknown): v is FilmLookId => typeof v === 'string' && (FILM_LOOK_IDS as readonly string[]).includes(v)

type KitLookNear = 'animated-slides' | 'editorial' | 'bright'
export type FilmLook = { id: FilmLookId; name: string; short: string; tagline: string; kitLook: KitLookNear }

export const FILM_LOOKS: FilmLook[] = [
  { id: 'slides', name: 'Animated slides', kitLook: 'animated-slides', short: 'Deep navy and gold, numbers that land', tagline: 'Deep navy and gold. Big numbers count up and land on the word, the camera moves through each scene.' },
  { id: 'editorial', name: 'Editorial', kitLook: 'editorial', short: 'Cream paper, serif headlines', tagline: 'Cream paper, a serif headline and calm green ink: a magazine page that moves.' },
  { id: 'bright', name: 'Bright', kitLook: 'bright', short: 'Bright, friendly colors', tagline: 'Warm cream with coral, teal and gold, soft shapes in the air. Friendly and energetic.' },
  { id: 'infographic', name: 'Infographic', kitLook: 'bright', short: 'Big numbers, cards and charts', tagline: 'White and blue on a fine grid. Numbers, cards and charts take the lead.' },
  { id: 'midnight', name: 'Midnight', kitLook: 'animated-slides', short: 'Dark navy and luminous gold', tagline: 'Dark navy with luminous gold and a serif headline. Evening polish.' },
  { id: 'heritage', name: 'Heritage', kitLook: 'editorial', short: 'Cream, navy and gold, engraved', tagline: 'Cream, navy and gold inside an engraved frame. Weight for financial documents.' },
  { id: 'warm', name: 'Warm Editorial', kitLook: 'editorial', short: 'Cream and terracotta', tagline: 'Cream and terracotta with rounded cards. Friendly and human.' },
  { id: 'bold', name: 'Corporate Bold', kitLook: 'bright', short: 'Navy and red', tagline: 'Navy and red, strong capitals and a navy band. Sharp business energy.' },
  { id: 'mint', name: 'Fresh Mint', kitLook: 'bright', short: 'Cream and mint green', tagline: 'Cream and mint green with soft shapes. Light and hopeful.' },
  { id: 'swiss', name: 'Swiss Corporate', kitLook: 'bright', short: 'White, blue, an exact grid', tagline: 'White and blue on an exact grid, a running index line. Precise and calm.' },
  { id: 'luxury', name: 'Luxury Gold', kitLook: 'animated-slides', short: 'Black, cream and gold', tagline: 'Warm black, cream and gold with fine gold rules. Quiet luxury.' },
  { id: 'night', name: 'Cinematic Night', kitLook: 'animated-slides', short: 'Night city, amber, widescreen', tagline: 'A night city behind every scene, amber light and widescreen bars. The film look.' },
]

/** Step-3 card id for a film look, and back. */
export const filmCardId = (id: FilmLookId) => `film-${id}`
export function filmLookForCard(card: unknown): FilmLookId | null {
  const s = String(card ?? '')
  return s.startsWith('film-') && isFilmLookId(s.slice(5)) ? (s.slice(5) as FilmLookId) : null
}
/** What step 3 saves for a film card. */
export function filmStyleForCard(card: unknown): { videoStyle: 'kit'; kitLook: KitLookNear; filmLook: FilmLookId } | null {
  const id = filmLookForCard(card)
  if (!id) return null
  return { videoStyle: 'kit', kitLook: FILM_LOOKS.find((l) => l.id === id)!.kitLook, filmLook: id }
}
/** The film look a saved draft draws with: its own pick, else the film look of its kit look. */
export function filmLookForDraft(draft: { filmLook?: unknown; kitLook?: unknown } | null | undefined): FilmLookId | null {
  if (isFilmLookId(draft?.filmLook)) return draft!.filmLook as FilmLookId
  const k = String(draft?.kitLook ?? '')
  return k === 'animated-slides' ? 'slides' : k === 'editorial' ? 'editorial' : k === 'bright' ? 'bright' : null
}
