/**
 * The DIRECTOR — turns a compact scene description into a timed shot: which
 * figures/objects are on stage, how they enter, and what action they perform
 * on which beat. This is the "describe the motion, get choreography" layer.
 *
 * In production an LLM emits this JSON from the script scene (same pattern as
 * the narrative-first script generator). Here the shots are authored to prove
 * the loop end-to-end. Each field maps to a rig parameter in the composition.
 */

export type Entrance = 'walkInLeft' | 'walkInRight' | 'riseUp' | 'popIn' | 'slideDown'
export type Action = 'idle' | 'point' | 'wave' | 'present' | 'handoff' | 'react' | 'celebrate'

export type ActorSpec = {
  kind: 'person'
  skin: string; shirt: string
  x: number; y: number; scale: number
  entrance: Entrance
  action: Action
  actionAt: number   // frames into the scene
  flip?: boolean
}
export type PropSpec = {
  kind: 'doc' | 'chart' | 'check' | 'send'
  x: number; y: number; scale: number
  entrance: Entrance
  /** progress-driving frames: [startFrame, endFrame] over the scene */
  animate?: [number, number]
  animAt?: number
}
export type Shot = {
  id: string
  durationInFrames: number
  caption: string
  captionColor?: string
  captionAt: number
  actors: ActorSpec[]
  props: PropSpec[]
}

const BLUE = '#2d6a9f', ORANGE = '#f5a623', TEAL = '#2d9f8a', PLUM = '#7a5aa0'
const SK1 = '#f2c9a0', SK2 = '#c98a5e', SK3 = '#8d5a3c'

// ── the 30-second storyboard (6 shots × ~5s) for the Docs2Video explainer ──
export const STORYBOARD: Shot[] = [
  {
    id: 'problem', durationInFrames: 150, caption: 'Your documents go unread.', captionColor: ORANGE, captionAt: 20,
    actors: [{ kind: 'person', skin: SK1, shirt: BLUE, x: 720, y: 430, scale: 1.1, entrance: 'walkInLeft', action: 'react', actionAt: 55 }],
    props: [{ kind: 'doc', x: 1150, y: 470, scale: 1.1, entrance: 'popIn', animate: [30, 30] }],
  },
  {
    id: 'upload', durationInFrames: 150, caption: 'Upload any document…', captionColor: BLUE, captionAt: 16,
    actors: [{ kind: 'person', skin: SK2, shirt: TEAL, x: 620, y: 430, scale: 1.1, entrance: 'riseUp', action: 'handoff', actionAt: 45 }],
    props: [{ kind: 'doc', x: 1080, y: 460, scale: 1.2, entrance: 'slideDown', animate: [60, 120], animAt: 0 }],
  },
  {
    id: 'transform', durationInFrames: 150, caption: '…AI turns it into video.', captionColor: ORANGE, captionAt: 16,
    actors: [{ kind: 'person', skin: SK1, shirt: BLUE, x: 500, y: 440, scale: 1.0, entrance: 'popIn', action: 'present', actionAt: 30 }],
    props: [{ kind: 'doc', x: 1120, y: 440, scale: 1.5, entrance: 'popIn', animate: [30, 110], animAt: 0 }],
  },
  {
    id: 'send', durationInFrames: 150, caption: 'Send it in one click.', captionColor: BLUE, captionAt: 16,
    actors: [{ kind: 'person', skin: SK3, shirt: PLUM, x: 640, y: 430, scale: 1.1, entrance: 'walkInRight', action: 'point', actionAt: 40 }],
    props: [{ kind: 'send', x: 1120, y: 440, scale: 1.6, entrance: 'riseUp' }],
  },
  {
    id: 'track', durationInFrames: 150, caption: 'Watch them watch.', captionColor: ORANGE, captionAt: 16,
    actors: [{ kind: 'person', skin: SK2, shirt: TEAL, x: 500, y: 470, scale: 1.0, entrance: 'popIn', action: 'present', actionAt: 30 }],
    props: [{ kind: 'chart', x: 1080, y: 470, scale: 1.4, entrance: 'riseUp', animate: [30, 120], animAt: 0 }],
  },
  {
    id: 'close', durationInFrames: 180, caption: 'Docs2Video — every doc, worth watching.', captionColor: BLUE, captionAt: 40,
    actors: [{ kind: 'person', skin: SK1, shirt: BLUE, x: 760, y: 500, scale: 1.0, entrance: 'riseUp', action: 'celebrate', actionAt: 30 }],
    props: [{ kind: 'check', x: 1120, y: 380, scale: 1.6, entrance: 'popIn', animate: [24, 96], animAt: 0 }],
  },
]

export const STORY_TOTAL = STORYBOARD.reduce((a, s) => a + s.durationInFrames, 0)
export function shotStarts(): number[] {
  const out: number[] = []; let t = 0
  for (const s of STORYBOARD) { out.push(t); t += s.durationInFrames }
  return out
}
