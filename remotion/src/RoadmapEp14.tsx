import React from 'react'
import D from '../public/road14/durations.json'
import { RoadmapEpisode, framesFor, buildPanels, EpisodeMeta, Cap } from './RoadmapEngine'

const caps: Record<number, Cap> = {
  0: { kicker: 'Apex Roadmap · Episode 14', head: 'Follow-Up & Close.', accent: '& Close.' },
  7: { kicker: 'The Moment They Join', head: 'Start Their First 48.' },
  8: { kicker: 'Not Pressure', head: 'Help Them Decide.' },
}
const panelMap = buildPanels({
  schedule: { kind: 'statement', kicker: 'Rule One', text: 'Always **schedule the follow-up** before you leave. Never leave it open.' },
  reliable: { kind: 'statement', kicker: 'Rule Two', text: 'Follow up **when you say you will.** Reliability builds trust.' },
  ask: { kind: 'statement', kicker: 'The Close', text: '“Are you **ready to get started** today?”' },
  quiet: { kind: 'statement', kicker: 'Then Stay Quiet', text: 'Let them answer. The **first to speak** usually decides.' },
  enroll: { kind: 'statement', kicker: 'On A Yes', text: 'Walk them through enrollment **right then** — so they never get stuck.' },
  notyet: { kind: 'statement', kicker: 'On A “Not Yet”', text: 'Set the **next follow-up** and keep the door open warmly.' },
})
const meta: EpisodeMeta = {
  dir: 'road14', seriesTag: 'Apex Roadmap', episodeLabel: 'Episode 14 · Close',
  introHead: 'Follow-Up & Close', endHead: 'The Fortune Is In The Follow-Up.', endAccent: 'The Follow-Up.', endUrl: 'reachtheapex.net',
  finaleCap: { kicker: 'Next Up', head: 'Duplication.', accent: 'Duplication.' },
}
export const ROAD14_FRAMES = framesFor((D as any).vo)
export const RoadmapEp14: React.FC = () => <RoadmapEpisode data={D as any} caps={caps} panelMap={panelMap} meta={meta} />
