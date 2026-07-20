import React from 'react'
import D from '../public/road10/durations.json'
import { RoadmapEpisode, framesFor, buildPanels, EpisodeMeta, Cap } from './RoadmapEngine'

const caps: Record<number, Cap> = {
  0: { kicker: 'Apex Roadmap · Episode 10', head: 'Your List & Your Story.', accent: 'Your Story.' },
  4: { kicker: 'People Join People', head: 'Not Companies.' },
  7: { kicker: 'Practice Out Loud', head: 'Your Story Is Your Tool.' },
  8: { kicker: 'List + Story', head: 'A Business Ready To Launch.' },
}
const panelMap = buildPanels({
  list: { kind: 'statement', kicker: 'Step 1 · Your List', text: 'Write down **everyone you know.** Don’t pre-judge — just write.' },
  circles: { kind: 'bullets', kicker: 'Think In Circles', items: ['Family & friends', 'Coworkers', 'Everyone in your phone'] },
  hundred: { kind: 'stat', kicker: 'Your Goal', big: '100+', label: 'names — the fuel for your business', color: '#c0272d' },
  story3: { kind: 'bullets', kicker: 'Your Story · 3 Parts', items: ['Where you were', 'What you found', 'Where you’re going'] },
  sixty: { kind: 'stat', kicker: 'Keep It Short', big: '<60s', label: 'honest & short beats polished & long', color: '#1e3a70' },
})
const meta: EpisodeMeta = {
  dir: 'road10', seriesTag: 'Apex Roadmap', episodeLabel: 'Episode 10 · List & Story',
  introHead: 'Your List & Your Story', endHead: 'A Business Ready To Launch.', endAccent: 'To Launch.', endUrl: 'reachtheapex.net',
  finaleCap: { kicker: 'Next Up', head: 'The Invite.', accent: 'The Invite.' },
}
export const ROAD10_FRAMES = framesFor((D as any).vo)
export const RoadmapEp10: React.FC = () => <RoadmapEpisode data={D as any} caps={caps} panelMap={panelMap} meta={meta} />
