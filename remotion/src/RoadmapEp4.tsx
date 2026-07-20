import React from 'react'
import D from '../public/road4/durations.json'
import { RoadmapEpisode, framesFor, buildPanels, EpisodeMeta, Cap } from './RoadmapEngine'

const caps: Record<number, Cap> = {
  0: { kicker: 'Apex Roadmap · Episode 4', head: 'Choose Your Path.', accent: 'Your Path.' },
  3: { kicker: 'Technology', head: 'Put The Tools To Work.' },
  7: { kicker: 'One Team', head: 'It Carries Across.' },
  8: { kicker: 'Commit', head: 'Momentum Beats Perfection.', accent: 'Momentum' },
}
const panelMap = buildPanels({
  twoladders: { kind: 'twocol', kicker: 'Two Ladders', left: { t: 'Technology', s: 'A.I. tools' }, right: { t: 'Insurance', s: 'Life policies' }, foot: 'Run one — or both.' },
  techpath: { kind: 'statement', kicker: 'The Technology Path', text: 'Open to **everyone**. No license needed. Start earning **right away**.' },
  inspath: { kind: 'statement', kicker: 'The Insurance Path', text: 'For **licensed agents** — sell policies and earn on every one.' },
  start: { kind: 'statement', kicker: 'Not Licensed Yet?', text: 'Start on **Technology today**. Get licensed when you’re ready.' },
  rule: { kind: 'statement', kicker: 'The Simple Rule', text: 'Start where you can **win this week**. Add the second ladder later.' },
})
const meta: EpisodeMeta = {
  dir: 'road4', seriesTag: 'Apex Roadmap', episodeLabel: 'Episode 4 · Your Path',
  introHead: 'Choose Your Path', endHead: 'Pick A Lane. Start Winning.', endAccent: 'Start Winning.', endUrl: 'reachtheapex.net',
  finaleCap: { kicker: 'Next Up', head: 'Know Your Products.', accent: 'Your Products.' },
}
export const ROAD4_FRAMES = framesFor((D as any).vo)
export const RoadmapEp4: React.FC = () => <RoadmapEpisode data={D as any} caps={caps} panelMap={panelMap} meta={meta} />
