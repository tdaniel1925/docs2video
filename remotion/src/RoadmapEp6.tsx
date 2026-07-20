import React from 'react'
import D from '../public/road6/durations.json'
import { RoadmapEpisode, framesFor, buildPanels, EpisodeMeta, Cap } from './RoadmapEngine'

const caps: Record<number, Cap> = {
  0: { kicker: 'Apex Roadmap · Episode 6', head: 'The Products: Docs2Video.', accent: 'Docs2Video.' },
  2: { kicker: 'Upload A PDF', head: 'Out Comes A Video.' },
  8: { kicker: 'Show One Sample', head: 'It Sells Itself.' },
}
const panelMap = buildPanels({
  whatis: { kind: 'statement', kicker: 'What Is Docs2Video?', text: 'Turns any document into a **branded, narrated video** in minutes.' },
  how: { kind: 'statement', kicker: 'How It Works', text: 'No cameras. No editing. **Just upload** — the A.I. does the rest.' },
  tiers: { kind: 'statement', kicker: 'Four Tiers', text: 'From **starter** to **enterprise** — it fits any size business.' },
  who: { kind: 'bullets', kicker: 'Who Needs It', items: ['Insurance agents', 'Real estate', 'Any business that explains to clients'] },
  pitch: { kind: 'statement', kicker: 'Your Pitch', text: 'Turn boring paperwork into **videos clients actually watch.**' },
  recurring: { kind: 'statement', kicker: 'Recurring Income', text: 'A monthly subscription — **recurring income** on every account.' },
})
const meta: EpisodeMeta = {
  dir: 'road6', seriesTag: 'Apex Roadmap', episodeLabel: 'Episode 6 · Docs2Video',
  introHead: 'The Products: Docs2Video', endHead: 'Paperwork Into Videos That Sell.', endAccent: 'That Sell.', endUrl: 'reachtheapex.net',
  finaleCap: { kicker: 'Next Up', head: 'Meet Jordyn.', accent: 'Jordyn.' },
}
export const ROAD6_FRAMES = framesFor((D as any).vo)
export const RoadmapEp6: React.FC = () => <RoadmapEpisode data={D as any} caps={caps} panelMap={panelMap} meta={meta} />
