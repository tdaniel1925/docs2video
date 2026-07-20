import React from 'react'
import D from '../public/road12/durations.json'
import { RoadmapEpisode, framesFor, buildPanels, EpisodeMeta, Cap } from './RoadmapEngine'

const caps: Record<number, Cap> = {
  0: { kicker: 'Apex Roadmap · Episode 12', head: 'The Presentation.', accent: 'Presentation.' },
  6: { kicker: 'Be The Guide', head: 'Let The Tool Carry Details.' },
  8: { kicker: 'You’re Not Convincing', head: 'You’re Revealing.' },
}
const panelMap = buildPanels({
  three: { kind: 'bullets', kicker: 'Answer 3 Questions', items: ['What is it?', 'How do I make money?', 'How do I start?'] },
  story: { kind: 'statement', kicker: 'Start With Story', text: 'The **problem Apex solves** — and why it matters right now.' },
  show: { kind: 'statement', kicker: 'The Products', text: '**Show, don’t tell.** One sample is worth a thousand words.' },
  opp: { kind: 'statement', kicker: 'The Opportunity', text: 'The **two ways to earn** — in plain, simple language.' },
  twenty: { kind: 'stat', kicker: 'Keep It Tight', big: '<20 min', label: 'confused people never say yes', color: '#c0272d' },
  nextstep: { kind: 'statement', kicker: 'Always End Clear', text: '“Are you **ready to get started** today?”' },
})
const meta: EpisodeMeta = {
  dir: 'road12', seriesTag: 'Apex Roadmap', episodeLabel: 'Episode 12 · Present',
  introHead: 'The Presentation', endHead: 'Reveal It Clearly. Let Them Decide.', endAccent: 'Let Them Decide.', endUrl: 'reachtheapex.net',
  finaleCap: { kicker: 'Next Up', head: 'Handling Objections.', accent: 'Objections.' },
}
export const ROAD12_FRAMES = framesFor((D as any).vo)
export const RoadmapEp12: React.FC = () => <RoadmapEpisode data={D as any} caps={caps} panelMap={panelMap} meta={meta} />
