import React from 'react'
import D from '../public/road8/durations.json'
import { RoadmapEpisode, framesFor, buildPanels, EpisodeMeta, Cap } from './RoadmapEngine'

const caps: Record<number, Cap> = {
  0: { kicker: 'Apex Roadmap · Episode 8', head: 'The Insurance Side.', accent: 'Insurance Side.' },
  5: { kicker: 'Build A Team', head: 'Earn On Their Production.' },
  7: { kicker: 'Run Both', head: 'Two Income Streams.' },
  8: { kicker: 'For Licensed Agents', head: 'A Great Year Awaits.' },
}
const panelMap = buildPanels({
  howpaid: { kind: 'statement', kicker: 'How You’re Paid', text: 'A commission on **every policy** you write.' },
  rate: { kind: 'statement', kicker: 'Your Commission', text: 'A share of **first-year premium** — and it **grows as you rank up.**' },
  carriers: { kind: 'statement', kicker: 'Direct With Carriers', text: 'Contracted directly — commissions paid **straight to you.**' },
  ownbook: { kind: 'statement', kicker: 'You Own Your Book', text: 'The business you write is **yours** — it stays with you as you grow.' },
  climb: { kind: 'statement', kicker: 'How You Climb', text: 'By writing **consistent, quality** business — production & persistency.' },
})
const meta: EpisodeMeta = {
  dir: 'road8', seriesTag: 'Apex Roadmap', episodeLabel: 'Episode 8 · Insurance',
  introHead: 'The Insurance Side', endHead: 'Higher Rates. Your Book. Your Team.', endAccent: 'Your Team.', endUrl: 'reachtheapex.net',
  finaleCap: { kicker: 'Next Up', head: 'The Comp Plan, Fast.', accent: 'Fast.' },
}
export const ROAD8_FRAMES = framesFor((D as any).vo)
export const RoadmapEp8: React.FC = () => <RoadmapEpisode data={D as any} caps={caps} panelMap={panelMap} meta={meta} />
