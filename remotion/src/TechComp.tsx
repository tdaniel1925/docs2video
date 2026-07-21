import React from 'react'
import D from '../public/techcomp/durations.json'
import { RoadmapEpisode, framesFor, buildPanels, EpisodeMeta, Cap } from './RoadmapEngine'

/* DETAILED TECHNOLOGY COMPENSATION PLAN (~6 min). Exact figures (verified vs spec
 * + code). Rep-facing: no waterfall/company cut; BV = designated; examples = illustrative. */

const caps: Record<number, Cap> = {
  0: { kicker: 'Apex · Technology Plan', head: 'The Complete Walkthrough.', accent: 'Walkthrough.' },
  1: { kicker: 'The Big Picture', head: 'Put The Tools To Work.' },
  7: { kicker: 'How You Get Paid', head: 'You Earn Two Ways.', accent: 'Two Ways.' },
  23: { kicker: 'The Override Schedule', head: 'How Deep You Earn.' },
  34: { kicker: 'The Technology Plan', head: 'Nine Ranks. Seven Levels. No Ceiling.', accent: 'No Ceiling.' },
}

const panelMap = buildPanels({
  zero: { kind: 'stat', kicker: 'Free To Start', big: '$0', label: 'to begin — no license required', color: '#c0272d', size: 260, foot: 'Open to everyone.' },
  // BV
  bvterm: { kind: 'statement', kicker: 'The Key Term', text: 'Business Volume — **B.V.** — the base of every commission.' },
  bvdef: { kind: 'statement', kicker: 'What B.V. Is', text: 'For every product, Apex **designates a Business Volume** — the amount your commission is based on.' },
  bvprod1: { kind: 'statement', kicker: 'Docs2Video · B.V.', text: 'From **9 B.V.** on Starter, up to **122 B.V.** on Enterprise.' },
  bvprod2: { kind: 'twocol', kicker: 'SmartViewz · B.V.', left: { t: '69 BV', s: 'SmartViewz' }, right: { t: '32 BV', s: 'SmartViewz Lite' }, joiner: '·', foot: 'Every product has its own designated B.V.' },
  // two ways
  way1: { kind: 'statement', kicker: 'Way One · Personal', text: 'A commission on the **B.V. of everything you personally sell.**' },
  way2: { kind: 'statement', kicker: 'Way Two · Override', text: 'A share that comes back to you **as your team sells** too.' },
  both: { kind: 'twocol', kicker: 'Two Ways At Once', left: { t: 'You Sell', s: 'personal' }, right: { t: 'Team Sells', s: 'override' }, foot: 'Do both — your income **compounds.**' },
  // ranks
  ranks9: { kind: 'ranks9', kicker: 'Technology · 9 Ranks', foot: 'Starter → **Elite**' },
  targets: { kind: 'twocol', kicker: 'Every Rank Has A Target', left: { t: 'Personal', s: 'your volume' }, right: { t: 'Group', s: 'your team’s' }, foot: 'Hit **both** to promote.' },
  // per-rank cards (exact PV/GV + bonus)
  rk_starter: { kind: 'rankcard', rank: 'Starter', pv: '0', gv: '0', kicker: 'Rank 1 · Everyone Begins Here', foot: 'No requirements · earns on **Level 1**' },
  rk_bronze: { kind: 'rankcard', rank: 'Bronze', pv: '150', gv: '300', bonus: '$250', kicker: 'Rank 2' },
  rk_silver: { kind: 'rankcard', rank: 'Silver', pv: '500', gv: '1,500', bonus: '$1,000', kicker: 'Rank 3' },
  rk_gold: { kind: 'rankcard', rank: 'Gold', pv: '1,200', gv: '5,000', bonus: '$3,000', kicker: 'Rank 4', leg: '+ 1 sponsored Bronze' },
  rk_plat: { kind: 'rankcard', rank: 'Platinum', pv: '2,500', gv: '15,000', bonus: '$7,500', kicker: 'Rank 5', leg: '+ 2 sponsored Silvers' },
  rk_ruby: { kind: 'rankcard', rank: 'Ruby', pv: '4,000', gv: '30,000', bonus: '$12,000', kicker: 'Rank 6', leg: '+ 2 sponsored Golds' },
  rk_diamond: { kind: 'rankcard', rank: 'Diamond', pv: '5,000', gv: '50,000', bonus: '$18,000', kicker: 'Rank 7' },
  rk_crown: { kind: 'rankcard', rank: 'Crown', pv: '6,000', gv: '75,000', bonus: '$22,000', kicker: 'Rank 8' },
  rk_elite: { kind: 'rankcard', rank: 'Elite', pv: '8,000', gv: '120,000', bonus: '$30,000', kicker: 'Rank 9 · The Top' },
  bonustotal: { kind: 'stat', kicker: 'One-Time Rank Bonuses', big: '$93,750', label: 'in bonuses · Starter → Elite', color: '#1e3a70', size: 180, foot: 'Paid once per rank · illustrative total' },
  // override schedule
  l1: { kind: 'stat', kicker: 'Level 1 · Enrollment Override', big: '30%', label: 'on everyone you personally bring in — always', color: '#c0272d', size: 240 },
  depth: { kind: 'twocol', kicker: 'Depth Grows With Rank', left: { t: '1 Level', s: 'Starter' }, right: { t: '7 Levels', s: 'Elite' }, joiner: '→', foot: 'The higher your rank, the deeper you earn.' },
  schedule: { kind: 'schedule', kicker: 'Full Override Schedule · L1–L7', foot: 'At **Ruby & above**, you earn on the entire pool.' },
  // two trees
  twotrees: { kind: 'twocol', kicker: 'Two Connected Trees', left: { t: 'Enrollment', s: 'Level 1' }, right: { t: 'Team', s: 'Levels 2–7' }, foot: 'Together they make your income.' },
  enrolltree: { kind: 'stat', kicker: 'Enrollment Tree', big: '30%', label: 'on everyone you personally sponsor', color: '#c0272d', size: 220 },
  teamtree: { kind: 'statement', kicker: 'Team Tree', text: 'Pays **Levels 2 through 7** — deeper into your organization, based on your rank.' },
  nodouble: { kind: 'statement', kicker: 'Clean & Simple', text: 'No one is paid twice for the same sale. **Each level counted once.**' },
  // 90 days
  day30: { kind: 'stat', kicker: 'Month One', big: 'Sell', label: 'focus on your own volume', color: '#1e3a70', size: 200 },
  day60: { kind: 'statement', kicker: 'Month Two', text: 'Sponsor a few people → group volume climbs → **promote to Bronze** + first bonus.', foot: 'Illustrative.' },
  day90: { kind: 'statement', kicker: 'Month Three', text: 'Team producing → reach **Silver** → earning **three levels deep.**', foot: 'Illustrative.' },
  compound: { kind: 'statement', kicker: 'The Pattern', text: 'Personal sales fund your start; **your team makes it compound.**' },
  // worked example
  ex_personal: { kind: 'stat', kicker: 'Example · Your Sales', big: '10', label: 'SmartViewz subscriptions in a month', color: '#1e3a70', size: 220 },
  ex_personal2: { kind: 'stat', kicker: 'Your Personal B.V.', big: '690 BV', label: 'your commission is paid on all of it', color: '#c0272d', size: 190, foot: 'Illustrative.' },
  ex_team: { kind: 'stat', kicker: 'Example · Your Team', big: '20', label: 'active people, ~300 B.V. each', color: '#1e3a70', size: 220 },
  ex_team2: { kind: 'stat', kicker: 'Team B.V. / Month', big: '6,000 BV', label: 'flowing up through your override levels', color: '#2f7d4f', size: 180, foot: 'On top of your own · illustrative.' },
  // qualify
  qualify: { kind: 'stat', kicker: 'To Earn Overrides', big: '50 PV', label: 'personal volume, every month', color: '#1e3a70', size: 220 },
  grace: { kind: 'stat', kicker: 'Miss A Month?', big: '30 days', label: 'grace period to get back on track', color: '#c0272d', size: 200 },
  permanent: { kind: 'statement', kicker: 'Your Highest Rank', text: 'Once you reach it, that achievement is **yours for life.**' },
})

const meta: EpisodeMeta = {
  dir: 'techcomp', seriesTag: 'Technology Compensation', episodeLabel: 'The Complete Plan',
  introHead: 'The Technology Comp Plan', endHead: 'Sell The Tools. Build Your Team. Climb.', endAccent: 'Climb.', endUrl: 'reachtheapex.net',
  finaleCap: { kicker: 'Welcome To Apex', head: 'Start Today. Keep Climbing.', accent: 'Keep Climbing.' },
}

export const TECHCOMP_FRAMES = framesFor((D as any).vo)
export const TechComp: React.FC = () => <RoadmapEpisode data={D as any} caps={caps} panelMap={panelMap} meta={meta} />
