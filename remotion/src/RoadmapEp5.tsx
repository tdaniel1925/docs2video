import React from 'react'
import D from '../public/road5/durations.json'
import { RoadmapEpisode, framesFor, buildPanels, EpisodeMeta, Cap } from './RoadmapEngine'

const caps: Record<number, Cap> = {
  0: { kicker: 'Apex Roadmap · Episode 5', head: 'The Products: SmartViewz.', accent: 'SmartViewz.' },
  2: { kicker: 'From Chaos To Clarity', head: 'Data Becomes A Dashboard.' },
  4: { kicker: 'A Smart Co-Pilot', head: 'It Knows Insurance.' },
  8: { kicker: 'Know The Problem', head: 'Sell With Confidence.' },
}
const panelMap = buildPanels({
  whatis: { kind: 'statement', kicker: 'What Is SmartViewz?', text: 'An **A.I. intelligence platform** built for life & annuity agents.' },
  features: { kind: 'bullets', kicker: 'What It Does', items: ['Surfaces revenue insights', 'Flags compliance issues', 'Answers questions about their book'] },
  who: { kind: 'statement', kicker: 'Who It’s For', text: 'Any agent **drowning in data** who wants clarity and time back.' },
  pitch: { kind: 'statement', kicker: 'Your Pitch', text: 'Stop guessing, **start seeing.** Show agents what’s really happening.' },
  recurring: { kind: 'statement', kicker: 'Recurring Income', text: 'A monthly subscription — every agent you sign is **recurring income**.' },
})
const meta: EpisodeMeta = {
  dir: 'road5', seriesTag: 'Apex Roadmap', episodeLabel: 'Episode 5 · SmartViewz',
  introHead: 'The Products: SmartViewz', endHead: 'Stop Guessing. Start Seeing.', endAccent: 'Start Seeing.', endUrl: 'reachtheapex.net',
  finaleCap: { kicker: 'Next Up', head: 'Docs2Video.', accent: 'Docs2Video.' },
}
export const ROAD5_FRAMES = framesFor((D as any).vo)
export const RoadmapEp5: React.FC = () => <RoadmapEpisode data={D as any} caps={caps} panelMap={panelMap} meta={meta} />
