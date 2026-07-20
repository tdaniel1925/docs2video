import React from 'react'
import D from '../public/road3/durations.json'
import { RoadmapEpisode, framesFor, buildPanels, EpisodeMeta, Cap } from './RoadmapEngine'

const caps: Record<number, Cap> = {
  0: { kicker: 'Apex Roadmap · Episode 3', head: 'Your Back Office Tour.', accent: 'Back Office Tour.' },
  1: { kicker: 'Your Home Base', head: 'Everything In One Place.' },
  8: { kicker: 'Get Familiar', head: 'Click Around & Explore.' },
}
const panelMap = buildPanels({
  dashboard: { kind: 'statement', kicker: 'Your Dashboard', text: 'See your **rank**, your **volume**, and your **next goal** — all at a glance.', foot: 'Your progress, front and center.' },
  team: { kind: 'statement', kicker: 'Your Team View', text: 'Everyone you brought in, and everyone **they** brought in — one clear tree.', foot: 'Your whole organization, mapped.' },
  comp: { kind: 'statement', kicker: 'Compensation', text: 'Exactly **how you earn** and **what you’ve earned** so far.' },
  commissions: { kind: 'statement', kicker: 'Commissions', text: 'Every payment, **clearly itemized**. Always know where you stand.' },
  products: { kind: 'statement', kicker: 'Products', text: 'Everything you can offer, **ready to share** with a click.' },
  training: { kind: 'statement', kicker: 'Training Center', text: 'This whole **roadmap** and every resource you’ll need.', foot: 'You’re here right now.' },
})
const meta: EpisodeMeta = {
  dir: 'road3', seriesTag: 'Apex Roadmap', episodeLabel: 'Episode 3 · Back Office',
  introHead: 'Your Back Office Tour', endHead: 'Your Command Center Is Ready.', endAccent: 'Ready.', endUrl: 'reachtheapex.net',
  finaleCap: { kicker: 'Next Up', head: 'Choose Your Path.', accent: 'Your Path.' },
}
export const ROAD3_FRAMES = framesFor((D as any).vo)
export const RoadmapEp3: React.FC = () => <RoadmapEpisode data={D as any} caps={caps} panelMap={panelMap} meta={meta} />
