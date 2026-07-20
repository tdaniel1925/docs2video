import React from 'react'
import D from '../public/road16/durations.json'
import { RoadmapEpisode, framesFor, buildPanels, EpisodeMeta, Cap } from './RoadmapEngine'

const caps: Record<number, Cap> = {
  0: { kicker: 'Apex Roadmap · Episode 16', head: 'Rank Up & Earn.', accent: '& Earn.' },
  7: { kicker: 'Consistency', head: 'Is The Whole Game.' },
  8: { kicker: 'The Full Roadmap', head: 'Day One To Leading A Team.' },
}
const panelMap = buildPanels({
  targets: { kind: 'twocol', kicker: 'Every Rank Has A Target', left: { t: 'Personal', s: 'your volume' }, right: { t: 'Group', s: 'your team’s' }, foot: 'Hit both to promote.' },
  unlock: { kind: 'statement', kicker: 'Promote', text: 'Unlock **deeper levels** of override income on your team.' },
  levels: { kind: 'statement', kicker: 'Earn Deeper', text: 'The higher your rank, the **more levels** you get paid on.' },
  bonus: { kind: 'statement', kicker: 'Milestones', text: 'Each new rank pays a **one-time bonus** — a reward for the climb.', foot: 'Illustrative.' },
  extra: { kind: 'statement', kicker: 'Insurance Side', text: 'Staying productive can trigger extra **weekly & team bonuses** too.' },
  habit: { kind: 'statement', kicker: 'The One Habit', text: 'A little **personal production every month.** That drives it all.' },
})
const meta: EpisodeMeta = {
  dir: 'road16', seriesTag: 'Apex Roadmap', episodeLabel: 'Episode 16 · Rank Up',
  introHead: 'Rank Up & Earn', endHead: 'Take The First Step. Keep Climbing.', endAccent: 'Keep Climbing.', endUrl: 'reachtheapex.net',
  finaleCap: { kicker: 'Welcome To Apex', head: 'See You At The Top.', accent: 'The Top.' },
}
export const ROAD16_FRAMES = framesFor((D as any).vo)
export const RoadmapEp16: React.FC = () => <RoadmapEpisode data={D as any} caps={caps} panelMap={panelMap} meta={meta} />
