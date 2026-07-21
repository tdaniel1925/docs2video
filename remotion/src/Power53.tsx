import React from 'react'
import D from '../public/power53/durations.json'
import { RoadmapEpisode, framesFor, buildPanels, EpisodeMeta, Cap } from './RoadmapEngine'

/* THE POWER OF 5 AND 3 — Growth Through Leadership (~6-7 min).
 * Even split: vision · process · psychology · payoff. Rep-facing; money illustrative. */

const caps: Record<number, Cap> = {
  0: { kicker: 'The Power Of 5 And 3', head: 'Build People. Build A Business.', accent: 'Build A Business.' },
  1: { kicker: 'A Human Truth', head: 'Everyone Wants To Belong.' },
  4: { kicker: 'The Real Question', head: 'Not “Sell” — “Build.”', accent: '“Build.”' },
  6: { kicker: 'Vision Needs A System', head: 'Two Numbers: 5 & 3.', accent: '5 & 3.' },
  13: { kicker: 'Not A Limit', head: 'A Launch Pad.', accent: 'A Launch Pad.' },
  14: { kicker: 'The Skill Nobody Teaches', head: 'Find & Develop Leaders.' },
  17: { kicker: 'Develop Through Conversation', head: 'Three Questions.' },
  23: { kicker: 'Pour Into People', head: 'They Become Someone New.' },
  28: { kicker: 'The Whole Path', head: 'Vision. Product. 3. 5. Develop.' },
}

const panelMap = buildPanels({
  // philosophy
  purpose: { kind: 'statement', kicker: 'What You Offer', text: 'You’re not offering a product. **You’re offering a purpose.**' },
  vision: { kind: 'statement', kicker: 'A Vision Moves Through Leaders', text: 'You can’t carry it alone — **build a team of like-minded people** to carry it with you.' },
  likeminded: { kind: 'bullets', kicker: 'Look For People Who Want To…', items: ['Build something real', 'Help other people', 'Create more for their life'] },
  // process
  fivethree: { kind: 'twocol', kicker: 'The Whole Engine', left: { t: '5', s: 'leaders' }, right: { t: '3', s: 'customers each' }, joiner: '×', foot: 'Build everything around these two numbers.' },
  step1: { kind: 'statement', kicker: 'Step 1', text: 'Become a **product of the product.** People buy your **conviction**, not the tool.' },
  step2: { kind: 'stat', kicker: 'Step 2 · Get Customers', big: '3', label: 'not thirty — small enough anyone can do it', color: '#c0272d', size: 240 },
  step3: { kind: 'stat', kicker: 'Step 3 · Develop Leaders', big: '5', label: 'who will do exactly what you did', color: '#1e3a70', size: 240 },
  step4: { kind: 'statement', kicker: 'Step 4 · Duplicate', text: 'Teach your five to **find their five.** Same simple steps, repeated.' },
  why3: { kind: 'statement', kicker: 'Why Three?', text: 'It’s **duplicatable.** Three feels possible — so people do it, and teach it.' },
  // psychology
  spot: { kind: 'bullets', kicker: 'Identify — Look For', items: ['Hungry', 'Coachable', 'Genuinely wants to help others'] },
  nochase: { kind: 'statement', kicker: 'A Leader Is Not…', text: 'Someone you drag along. **Look for the reaching — don’t chase.**' },
  q1: { kind: 'statement', kicker: 'Question One', text: '“What do you want… **for your life?**”', foot: 'The dream behind the money.' },
  q2: { kind: 'statement', kicker: 'Question Two', text: '“How do you want to **help people?**”', foot: 'This uncovers the leader inside them.' },
  q3: { kind: 'statement', kicker: 'Question Three', text: '“How much do you **want to make?**”', foot: 'Their number is what you build toward.' },
  listen: { kind: 'statement', kicker: 'Then — Listen', text: 'Really listen. **Their answers are the map.**' },
  develop: { kind: 'statement', kicker: 'Developing A Leader', text: 'Do the first few **with** them, not **for** them. Believe in them out loud.' },
  // payoff
  fourstreams: { kind: 'bullets', kicker: 'Four Ways To Earn At Once', items: ['Direct commissions — what you sell', 'Overrides — what your team sells', 'Rank bonuses — as you grow', 'Company bonus pools'] },
  mathteam: { kind: 'twocol', kicker: 'The Multiplier', left: { t: '5', s: 'you develop' }, right: { t: '+25', s: 'they develop' }, joiner: '→', foot: '30 strong — you recruited **five.**' },
  mathmoney: { kind: 'stat', kicker: 'A Silver Leader', big: '~$700', label: 'a month — most from a team you led', color: '#2f7d4f', size: 200, foot: 'Illustrative.' },
  multiply: { kind: 'statement', kicker: 'The System Duplicates', text: 'It doesn’t **add** — it **multiplies.** Your income grows even when you’re not selling.' },
})

const meta: EpisodeMeta = {
  dir: 'power53', seriesTag: 'Apex · Leadership', episodeLabel: 'Growth Through Leadership',
  introHead: 'The Power Of 5 And 3', endHead: 'Build People — And The Business Builds Itself.', endAccent: 'Builds Itself.', endUrl: 'reachtheapex.net',
  finaleCap: { kicker: 'That’s Leadership', head: 'Go Find Your Five.', accent: 'Your Five.' },
}

export const POWER53_FRAMES = framesFor((D as any).vo)
export const Power53: React.FC = () => <RoadmapEpisode data={D as any} caps={caps} panelMap={panelMap} meta={meta} />
