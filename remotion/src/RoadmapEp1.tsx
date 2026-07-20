import React from 'react'
import D from '../public/road1/durations.json'
import { RoadmapEpisode, framesFor, Panel, Statement, Steps, TwoCol, Big, Lead, C, EpisodeMeta, Cap } from './RoadmapEngine'

const { NAVY, RED, GREEN, INK, SOFT, WHITE, FONT } = C

/* captions on the scene beats (0,2,3,9) */
const caps: Record<number, Cap> = {
  0: { kicker: 'Apex Roadmap · Episode 1', head: 'Welcome To Apex.', accent: 'Apex.' },
  2: { kicker: 'Path One · Technology', head: 'Open To Everyone.' },
  3: { kicker: 'Path Two · Insurance', head: 'For Licensed Agents.' },
}

/* data panels (beats 1,4,5,6,7,8) */
const P_twopaths: React.FC = () => <TwoCol kicker="Two Businesses, One Roof" foot="Run one — or run both." left={{ t: 'Technology', s: 'A.I. tools' }} right={{ t: 'Insurance', s: 'Life policies' }} />
const P_mission: React.FC = () => <Statement kicker="The Apex Belief" foot="We win by helping people win."><span style={{ color: NAVY }}>Every agent</span> in this industry is our customer — <span style={{ color: RED }}>whether they join us or not.</span></Statement>
const P_earn: React.FC = () => <TwoCol kicker="You Earn Two Ways" foot="Do both, and your income compounds." left={{ t: 'You Sell', s: 'personal sales' }} right={{ t: 'Team Sells', s: 'override income' }} />
const P_first48: React.FC = () => <Panel kicker="Your First 48 Hours" foot="The people who start fast are the ones who succeed."><Big color={RED} size={230}>48</Big><Lead size={44}>hours that set the tone</Lead></Panel>
const P_threesteps: React.FC = () => <Steps kicker="Start Here — 3 Actions" foot="You don't need to know everything. Just start." items={['Complete your profile & set up how you get paid', 'Pick your path — Technology, Insurance, or both', 'Make your list of people to talk to']} />
const P_series: React.FC = () => <Panel kicker="Your Roadmap Ahead" foot="One step at a time — this series is your map."><div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>{['Products', 'Compensation', 'The Invite', 'The Presentation', 'The Close', 'Build A Team'].map((t, i) => <div key={i} style={{ background: i % 2 ? RED : NAVY, color: WHITE, fontFamily: FONT, fontWeight: 800, fontSize: 34, padding: '16px 30px', borderRadius: 10 }}>{t}</div>)}</div></Panel>

const panelMap: Record<string, React.FC> = { twopaths: P_twopaths, mission: P_mission, earn: P_earn, first48: P_first48, threesteps: P_threesteps, series: P_series }

const meta: EpisodeMeta = {
  dir: 'road1', seriesTag: 'Apex Roadmap', episodeLabel: 'Episode 1 · Getting Started',
  introHead: 'Welcome To Apex', endHead: 'Your Journey Starts Now.', endAccent: 'Starts Now.', endUrl: 'reachtheapex.net',
  finaleCap: { kicker: 'Take The First Step', head: "Welcome To The Team.", accent: 'The Team.' },
}

export const ROAD1_FRAMES = framesFor((D as any).vo)
export const RoadmapEp1: React.FC = () => <RoadmapEpisode data={D as any} caps={caps} panelMap={panelMap} meta={meta} />
