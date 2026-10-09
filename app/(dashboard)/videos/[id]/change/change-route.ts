// =============================================================================
// "ASK FOR A CHANGE" — which editor a change goes to.
//
// There were three different editors, each behind a different button with
// different words: "Edit Video" (an older scene editor), "Fix a scene" (only
// on Animated slides look videos) and "Edit slides" (presentations). Customers had
// to know which one their project used. Now there is ONE bar with the same
// words everywhere, and this file decides where the request goes. No new AI
// editor — each route is an editor that already exists:
//
//   presentation / deck  → the slide editor (/videos/[id]/edit). Trying a
//                          change there is free; rebuilding costs credits only
//                          for slides whose spoken words change.
//   slide-deck-video     → Fix-a-Scene. Re-recording a glitch or fixing how a
//                          word is said is free; changing the words costs the
//                          'slide-scene-fix' price.
//   video with slide pictures → the older scene editor ("Edit Video" window).
//                          It is KEPT, reachable only from this bar: it is the
//                          only way to change these looks in place. It costs
//                          nothing and rebuilds the video from its slide
//                          pictures with the new voice.
//   anything else        → nothing can change it in place (no plan and no
//                          slide pictures saved), so the bar says so and
//                          offers a copy to change and make again.
//
// Every price is read from credits.ts. Pure, so the guard test can check each
// type goes to the right place.
// =============================================================================

import { CREDIT_COSTS } from '../../../../_lib/credits'
import { outputKind, slidePictures, type OutputRow } from '../result/output'

export type ChangeEditor = 'presentation-editor' | 'fix-scene' | 'older-editor' | 'remake'
export type ChangeScope = 'scene' | 'whole'

/** Fix-a-Scene's three kinds of fix (the names its API uses). */
export type FixAction = 'rerecord' | 'fix-pronunciation' | 'edit-text'

export interface Suggestion {
  label: string
  /** Text put into the request box. */
  text?: string
  /** For Fix-a-Scene: which fix it picks. */
  fix?: FixAction
  /** Credits this kind of change costs (0 = free). Undefined = see costLine. */
  credits?: number
}

export interface ChangeRoute {
  editor: ChangeEditor
  /** What the main button says. */
  button: string
  /** One plain sentence on what happens and what it costs. */
  costLine: string
  /** Which scopes the editor can take. */
  scopes: ChangeScope[]
  suggestions: Suggestion[]
  /** Is a written request sent on to the editor? (Fix-a-Scene picks a fix
   *  instead; the copy route can't take one.) */
  takesText: boolean
}

const n = (x: number) => x.toLocaleString('en-US')

export function changeRouteFor(row: OutputRow): ChangeRoute {
  const kind = outputKind(row)
  const wordsCost = CREDIT_COSTS['slide-scene-fix']

  if (kind === 'presentation' || kind === 'deck') {
    return {
      editor: 'presentation-editor',
      button: 'Try this change',
      costLine: `Trying a change is free, and you see it before anything is rebuilt. Rebuilding is free when only what the slides show changes; each slide whose spoken words change costs ${n(wordsCost)} credits.`,
      scopes: ['scene', 'whole'],
      takesText: true,
      suggestions: [
        { label: 'Shorter', text: 'Make it shorter and simpler.' },
        { label: 'Punchier headline', text: 'Make the headline punchier.' },
        { label: 'Fix a typo', text: 'Fix the typo: ' },
        { label: 'Add a slide', text: 'Add a slide about ' },
      ],
    }
  }

  if (kind === 'slide-deck-video') {
    return {
      editor: 'fix-scene',
      button: 'Fix this scene',
      costLine: `Fixing a glitch in the voice or how a word is said is free. Changing what a scene says costs ${n(wordsCost)} credits. You can hear the new voice before you apply it.`,
      // Fix-a-Scene changes one scene at a time; "Whole video" describes the
      // problem and it finds the scene.
      scopes: ['scene', 'whole'],
      takesText: true,
      suggestions: [
        { label: 'The voice glitched', fix: 'rerecord', credits: 0 },
        { label: 'A word is said wrong', fix: 'fix-pronunciation', credits: 0 },
        { label: 'Change what it says', fix: 'edit-text', credits: wordsCost },
      ],
    }
  }

  if (slidePictures(row).length > 0) {
    return {
      editor: 'older-editor',
      button: 'Open the scene editor',
      costLine: 'Free. The scene editor changes the words, order or scenes, then rebuilds the video from its slide pictures with the new voice — moving parts of this look may become still slides.',
      scopes: ['scene', 'whole'],
      takesText: false,
      suggestions: [
        { label: 'Change what it says' },
        { label: 'Remove a scene' },
        { label: 'Change the order' },
      ],
    }
  }

  return {
    editor: 'remake',
    button: 'Make a changed copy',
    costLine: `This look can’t be changed in place. Make a copy, change it in step 2, and make it again — a new video, from ${n(CREDIT_COSTS.videoQuick)} credits (step 3 shows the exact price).`,
    scopes: ['whole'],
    takesText: false,
    suggestions: [],
  }
}

/** Where the presentation editor opens for a request. */
export function presentationEditorHref(videoId: string, request: string, scope: ChangeScope, sceneIndex: number): string {
  const q = new URLSearchParams()
  if (request.trim()) q.set('ask', request.trim().slice(0, 500))
  if (scope === 'scene' && sceneIndex >= 0) q.set('slide', String(sceneIndex))
  const s = q.toString()
  return `/videos/${videoId}/edit${s ? `?${s}` : ''}`
}
