import React from 'react'
import D from '../public/road13/durations.json'
import { RoadmapEpisode, framesFor, buildPanels, EpisodeMeta, Cap } from './RoadmapEngine'

const caps: Record<number, Cap> = {
  0: { kicker: 'Apex Roadmap · Episode 13', head: 'Handling Objections.', accent: 'Objections.' },
  7: { kicker: 'Usually', head: 'They Just Need One More Piece.' },
  8: { kicker: 'Stay Calm, Stay Kind', head: 'Point To The Next Step.' },
}
const panelMap = buildPanels({
  rule: { kind: 'statement', kicker: 'The Golden Rule', text: 'Never argue. **Agree, reassure, redirect** to the next step.' },
  pyramid: { kind: 'statement', kicker: '“Is this a pyramid?”', text: '“No — you earn by selling **real products** people actually use.”' },
  time: { kind: 'statement', kicker: '“I don’t have time.”', text: '“That’s exactly why it fits — it’s built to **start small, on your schedule.**”' },
  money: { kind: 'statement', kicker: '“I don’t have the money.”', text: '“I understand — that’s the **reason many people start,** to change that.”' },
  think: { kind: 'statement', kicker: '“Let me think about it.”', text: '“Totally fair — what’s the **one thing** you’d want to be sure of?”' },
  pattern: { kind: 'bullets', kicker: 'The Pattern', items: ['Acknowledge the concern', 'Reassure honestly', 'Guide back to a decision'] },
})
const meta: EpisodeMeta = {
  dir: 'road13', seriesTag: 'Apex Roadmap', episodeLabel: 'Episode 13 · Objections',
  introHead: 'Handling Objections', endHead: 'Questions In Disguise — Not Rejection.', endAccent: 'Not Rejection.', endUrl: 'reachtheapex.net',
  finaleCap: { kicker: 'Next Up', head: 'Follow-Up & Close.', accent: '& Close.' },
}
export const ROAD13_FRAMES = framesFor((D as any).vo)
export const RoadmapEp13: React.FC = () => <RoadmapEpisode data={D as any} caps={caps} panelMap={panelMap} meta={meta} />
