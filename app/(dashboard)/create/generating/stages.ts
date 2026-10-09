// The real stages of making something, read from the project's status (which
// the render service and the presentation builder write as they work). Pure,
// so the guard test can check every status maps to a stage.

import type { Stage } from '../_components/workspace/Stages'

const VIDEO: (Stage & { statuses: string[] })[] = [
  { key: 'start', label: 'Getting started', statuses: ['pending', 'starting', 'queued'] },
  { key: 'script', label: 'Writing the script', statuses: ['scripting'] },
  { key: 'voice', label: 'Recording the voice', statuses: ['generating_audio'] },
  { key: 'scenes', label: 'Drawing the scenes', statuses: ['generating_slides'] },
  { key: 'assemble', label: 'Putting it together', statuses: ['assembling', 'processing', 'rendering'] },
]

const PRESENTATION: (Stage & { statuses: string[] })[] = [
  { key: 'start', label: 'Getting started', statuses: ['pending', 'starting', 'queued', 'scripting'] },
  { key: 'voice', label: 'Recording the voice', statuses: ['generating_audio'] },
  { key: 'build', label: 'Building the slides', statuses: ['generating_slides', 'assembling', 'processing', 'rendering'] },
]

export function waitingStages(opts: { status: string; outputType: string; detail: string; slidesLook: boolean }): { stages: Stage[]; current: number } {
  // The Animated slides look does everything in one long job on the render
  // service, and may first wait for a free spot — name what is really happening.
  if (opts.slidesLook && (opts.outputType === 'video' || !opts.outputType)) {
    const stages = [
      { key: 'queued', label: 'Waiting for a free spot' },
      { key: 'build', label: 'Writing, recording and rendering your slides' },
    ]
    return { stages, current: /waiting in line/i.test(opts.detail) ? 0 : 1 }
  }
  let list = opts.outputType === 'interactive' || opts.outputType === 'deck' ? PRESENTATION : VIDEO
  // A slide deck is silent — it never records a voice.
  if (opts.outputType === 'deck') list = list.filter((s) => s.key !== 'voice')
  const at = list.findIndex((s) => s.statuses.includes(opts.status))
  const current = opts.status === 'completed' ? list.length : Math.max(0, at)
  return { stages: list.map(({ key, label }) => ({ key, label })), current }
}
