/*
 * THE FILM CREW ON THE MAKING SCREEN (owner, 2026-10-18: "a set of cool
 * animations that show the video making process — a director reading, a
 * cameraman filming, editing, music, sound being made").
 *
 * Each crew card stands for a REAL step, read from what the render writes —
 * status and progress_detail (the explainer engine's words: Designing,
 * Recording the voice, Directing the motion, Composing the music, Animating
 * every scene, The final cut; the older pipelines' statuses). Nothing plays
 * on a timer. Pure, so the guard test can check every step lands on a card.
 */

export type Phase = 'director' | 'designer' | 'voice' | 'directing' | 'composer' | 'camera' | 'editor'
const ORDER: Phase[] = ['director', 'designer', 'voice', 'directing', 'composer', 'camera', 'editor']

export function phaseOf(status: string, detail: string): Phase {
  const d = detail.toLowerCase()
  if (/final cut|saving your video|cutting|mixing/.test(d)) return 'editor'
  if (/animating|rendering/.test(d) || status === 'rendering' || status === 'assembling' || status === 'processing') return 'camera'
  if (/composing|music/.test(d)) return 'composer'
  if (/directing the motion/.test(d)) return 'directing'
  if (/recording the voice|voice/.test(d) || status === 'generating_audio') return 'voice'
  if (/designing|drawing/.test(d) || status === 'generating_slides') return 'designer'
  return 'director'
}

export type CrewKey = 'director' | 'designer' | 'voice' | 'composer' | 'camera' | 'editor'
export type CrewCard = { key: CrewKey; n: string; role: string; state: 'done' | 'on' | 'next'; line: string }

const CREW: { key: CrewKey; role: string; covers: Phase[]; on: string; done: string; next: string }[] = [
  { key: 'director', role: 'The director', covers: ['director'], on: 'Reading your story and planning every scene', done: 'Read your story and planned the scenes', next: 'Reads your story and plans every scene' },
  { key: 'designer', role: 'The designer', covers: ['designer'], on: 'Drawing your scenes in your look', done: 'Drew every scene in your look', next: 'Draws each scene in your look and brand' },
  { key: 'voice', role: 'The voice', covers: ['voice'], on: 'Recording the narration', done: 'Recorded every line', next: 'Records the narration in the voice you picked' },
  { key: 'composer', role: 'The composer', covers: ['composer'], on: 'Writing the music under the voice', done: 'Scored to the length of your video', next: 'Writes music that sits under the voice' },
  { key: 'camera', role: 'The camera crew', covers: ['directing', 'camera'], on: 'Setting up the shots and filming every scene', done: 'Filmed every scene', next: 'Films each scene with its motion, in time with the voice' },
  { key: 'editor', role: 'The editor', covers: ['editor'], on: 'Cutting it together and checking it', done: 'Final cut ready', next: 'Cuts it together, mixes voice and music, checks it' },
]

/** Every card's state for where the render is. `finished` marks them all done. */
export function crewFor(status: string, detail: string, finished = false): CrewCard[] {
  const at = ORDER.indexOf(phaseOf(status, detail))
  return CREW.map((c, i) => {
    const idx = c.covers.map((p) => ORDER.indexOf(p))
    const state: CrewCard['state'] = finished || idx.every((x) => x < at) ? 'done' : idx.includes(at) || (Math.min(...idx) < at && Math.max(...idx) > at) ? 'on' : 'next'
    return { key: c.key, n: String(i + 1).padStart(2, '0'), role: c.role, state, line: state === 'on' ? `${c.on}…` : state === 'done' ? c.done : c.next }
  })
}

/** The big line: what the crew is doing now. */
export function crewHeadline(status: string, detail: string): string {
  return ({ director: 'reading your story.', designer: 'drawing your scenes.', voice: 'recording the voice.', directing: 'setting up the shots.', composer: 'scoring the music.', camera: 'filming every scene.', editor: 'cutting it together.' } as const)[phaseOf(status, detail)]
}
