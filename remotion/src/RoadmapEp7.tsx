import React from 'react'
import D from '../public/road7/durations.json'
import { RoadmapEpisode, framesFor, buildPanels, EpisodeMeta, Cap } from './RoadmapEngine'

const caps: Record<number, Cap> = {
  0: { kicker: 'Apex Roadmap · Episode 7', head: 'The Products: Jordyn.', accent: 'Jordyn.' },
  2: { kicker: 'Not A Chatbot', head: 'It Learns Your Business.' },
  4: { kicker: 'Every Morning', head: 'A Briefing That Matters.' },
  8: { kicker: 'Your Pitch', head: 'It Runs Your Day.' },
}
const panelMap = buildPanels({
  whatis: { kind: 'statement', kicker: 'What Is Jordyn?', text: 'An A.I. assistant with a **brain for your business** — industry-ready on day one.' },
  features: { kind: 'bullets', kicker: 'What It Does', items: ['Reads & manages your email', 'Answers the phone', 'Builds your pipeline automatically'] },
  who: { kind: 'bullets', kicker: 'Who It’s For', items: ['Agents', 'Realtors', 'Attorneys — anyone buried in follow-up'] },
  value: { kind: 'stat', kicker: 'The Value', big: '~8 hrs', label: 'given back every week', color: '#2f7d4f', foot: 'Roughly $2,000 in time · illustrative' },
  recurring: { kind: 'stat', kicker: 'The Plan', big: '$149', label: 'per month — recurring income for you', color: '#1e3a70' },
})
const meta: EpisodeMeta = {
  dir: 'road7', seriesTag: 'Apex Roadmap', episodeLabel: 'Episode 7 · Jordyn',
  introHead: 'The Products: Jordyn', endHead: 'An Assistant That Runs Your Day.', endAccent: 'Runs Your Day.', endUrl: 'reachtheapex.net',
  finaleCap: { kicker: 'Next Up', head: 'The Insurance Side.', accent: 'Insurance Side.' },
}
export const ROAD7_FRAMES = framesFor((D as any).vo)
export const RoadmapEp7: React.FC = () => <RoadmapEpisode data={D as any} caps={caps} panelMap={panelMap} meta={meta} />
