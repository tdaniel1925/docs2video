import React from 'react'
import D from '../public/road9/durations.json'
import { RoadmapEpisode, framesFor, buildPanels, EpisodeMeta, Cap } from './RoadmapEngine'

const caps: Record<number, Cap> = {
  0: { kicker: 'Apex Roadmap · Episode 9', head: 'The Comp Plan, Fast.', accent: 'Fast.' },
  2: { kicker: 'That’s All B.V. Is', head: 'The Base Of Your Pay.' },
  8: { kicker: 'Sell · Build · Rank Up', head: 'The Plan Rewards All Three.' },
}
const panelMap = buildPanels({
  bv: { kind: 'statement', kicker: 'One Term: B.V.', text: 'For each product, Apex **designates a Business Volume.**' },
  personal: { kind: 'statement', kicker: 'Way One', text: 'A commission on the **B.V. of everything you personally sell.**' },
  override: { kind: 'statement', kicker: 'Way Two', text: 'Override income — a share as **your team sells** too.' },
  ranks: { kind: 'statement', kicker: 'As You Rank Up', text: 'You earn on **more levels** of your team, and your share **grows.**' },
  bonuses: { kind: 'statement', kicker: 'Milestones', text: 'Reach new ranks and unlock **one-time bonuses** along the way.', foot: 'Illustrative.' },
  qualify: { kind: 'statement', kicker: 'Stay Qualified', text: 'Keep **a little personal volume** each month. That’s the rule.' },
})
const meta: EpisodeMeta = {
  dir: 'road9', seriesTag: 'Apex Roadmap', episodeLabel: 'Episode 9 · Comp Plan',
  introHead: 'The Comp Plan, Fast', endHead: 'Sell. Build. Rank Up.', endAccent: 'Rank Up.', endUrl: 'reachtheapex.net',
  finaleCap: { kicker: 'Next Up', head: 'Find Your People.', accent: 'Your People.' },
}
export const ROAD9_FRAMES = framesFor((D as any).vo)
export const RoadmapEp9: React.FC = () => <RoadmapEpisode data={D as any} caps={caps} panelMap={panelMap} meta={meta} />
