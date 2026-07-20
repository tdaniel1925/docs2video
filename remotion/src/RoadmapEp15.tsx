import React from 'react'
import D from '../public/road15/durations.json'
import { RoadmapEpisode, framesFor, buildPanels, EpisodeMeta, Cap } from './RoadmapEngine'

const caps: Record<number, Cap> = {
  0: { kicker: 'Apex Roadmap · Episode 15', head: 'Duplication.', accent: 'Duplication.' },
  5: { kicker: 'Simple Enough To Copy', head: 'Your Team Grows Itself.' },
  7: { kicker: 'Make Yourself', head: 'Unnecessary.' },
  8: { kicker: 'Keep It Simple', head: 'It Grows Beyond You.' },
}
const panelMap = buildPanels({
  firstsale: { kind: 'statement', kicker: 'Your Job As Sponsor', text: 'Get your new person to their **first sale, fast.**' },
  belief: { kind: 'statement', kicker: 'Why It Matters', text: 'A quick first win creates **belief** — and belief creates **momentum.**' },
  withthem: { kind: 'statement', kicker: 'The Key', text: 'Don’t do it **for** them. Do it **with** them — so they learn to do it alone.' },
  samesteps: { kind: 'bullets', kicker: 'Teach The Same Steps', items: ['List', 'Invite', 'Present', 'Follow up'] },
  multiply: { kind: 'statement', kicker: 'The Power', text: 'You help a few, **they help a few** — and it multiplies.' },
})
const meta: EpisodeMeta = {
  dir: 'road15', seriesTag: 'Apex Roadmap', episodeLabel: 'Episode 15 · Duplication',
  introHead: 'Duplication', endHead: 'Simple Enough To Copy. Big Enough To Last.', endAccent: 'To Last.', endUrl: 'reachtheapex.net',
  finaleCap: { kicker: 'Finale', head: 'Rank Up & Earn.', accent: '& Earn.' },
}
export const ROAD15_FRAMES = framesFor((D as any).vo)
export const RoadmapEp15: React.FC = () => <RoadmapEpisode data={D as any} caps={caps} panelMap={panelMap} meta={meta} />
