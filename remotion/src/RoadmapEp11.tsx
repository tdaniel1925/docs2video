import React from 'react'
import D from '../public/road11/durations.json'
import { RoadmapEpisode, framesFor, buildPanels, EpisodeMeta, Cap } from './RoadmapEngine'

const caps: Record<number, Cap> = {
  0: { kicker: 'Apex Roadmap · Episode 11', head: 'The Invite.', accent: 'The Invite.' },
  7: { kicker: 'On A Yes', head: 'Send The Tool. Set A Time.' },
  8: { kicker: 'Don’t Sell', head: 'Spark Curiosity. Hand Off.' },
}
const panelMap = buildPanels({
  goal: { kind: 'statement', kicker: 'The Goal', text: 'Not to explain everything — just to **get them to take a look.**' },
  rule: { kind: 'statement', kicker: 'The Rule', text: 'Short, curious, and always **point to a tool** — a video, call, or link.' },
  warm: { kind: 'statement', kicker: 'Warm-Market Script', text: '“Hey — I’m working on something new and **thought of you.**”' },
  openclose: { kind: 'statement', kicker: 'The Ask', text: '“Would you be open to **taking a look** if it costs you nothing to check out?”' },
  dm: { kind: 'statement', kicker: 'Social / DM Script', text: '“I’m expanding my business and looking for a few **sharp people.** Interested?”' },
  pattern: { kind: 'bullets', kicker: 'The Pattern', items: ['A compliment', 'A reason', 'A simple yes-or-no question'] },
})
const meta: EpisodeMeta = {
  dir: 'road11', seriesTag: 'Apex Roadmap', episodeLabel: 'Episode 11 · The Invite',
  introHead: 'The Invite', endHead: 'Spark Curiosity. Hand Off The Tool.', endAccent: 'The Tool.', endUrl: 'reachtheapex.net',
  finaleCap: { kicker: 'Next Up', head: 'The Presentation.', accent: 'Presentation.' },
}
export const ROAD11_FRAMES = framesFor((D as any).vo)
export const RoadmapEp11: React.FC = () => <RoadmapEpisode data={D as any} caps={caps} panelMap={panelMap} meta={meta} />
