import React from 'react'
import D from '../public/road2/durations.json'
import { RoadmapEpisode, framesFor, Panel, Statement, Steps, TwoCol, Big, Lead, C, EpisodeMeta, Cap } from './RoadmapEngine'

const { NAVY, RED, GREEN, INK, SOFT, WHITE, FONT } = C

/* captions on the scene beats (0,3,9) */
const caps: Record<number, Cap> = {
  0: { kicker: 'Apex Roadmap · Episode 2', head: 'Get Set Up To Earn.', accent: 'To Earn.' },
  3: { kicker: 'Your Starting Ladder', head: 'Licensed Runs Both.' },
}

/* data panels (beats 1,2,4,5,6,7,8) */
const P_sponsor: React.FC = () => <Statement kicker="Referral-Based" foot="Your sponsor is on your team to help you win."><span style={{ color: RED }}>You joined through your sponsor</span> — the person who introduced you to Apex.</Statement>
const P_licpath: React.FC = () => <TwoCol kicker="You Chose Your Path" foot="Both are welcome — it sets which ladder you start on." left={{ t: 'Non-Licensed', s: 'Technology' }} right={{ t: 'Licensed', s: 'Insurance + Tech' }} joiner="/" />
const P_profile: React.FC = () => <Steps kicker="Step 1 · Complete Your Profile" foot="A complete profile builds trust with your prospects." items={['Add your photo', 'Add your phone number', 'Fill in your details']} />
const P_getpaid: React.FC = () => <Steps kicker="Step 2 · Set Up How You Get Paid" foot="No delays — your commissions reach you." items={['Add your payment information', 'Submit your tax form']} />
const P_backoffice: React.FC = () => <Panel kicker="Step 3 · Explore Your Back Office" foot="Everything you need is in one place."><div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>{['Your Team', 'Compensation', 'Commissions', 'Products', 'Training'].map((t, i) => <div key={i} style={{ background: i % 2 ? RED : NAVY, color: WHITE, fontFamily: FONT, fontWeight: 800, fontSize: 34, padding: '16px 30px', borderRadius: 10 }}>{t}</div>)}</div></Panel>
const P_first48: React.FC = () => <Panel kicker="The Most Important Part" foot="Three actions set the tone for everything that follows."><Big color={RED} size={230}>48</Big><Lead size={44}>your first hours in business</Lead></Panel>
const P_threesteps: React.FC = () => <Steps kicker="Your First 48 Hours" foot="Do these, and you're in business." items={['Finish your setup', 'Choose your path & learn your products', 'Write your list — everyone who wants more']} />

const panelMap: Record<string, React.FC> = { sponsor: P_sponsor, licpath: P_licpath, profile: P_profile, getpaid: P_getpaid, backoffice: P_backoffice, first48: P_first48, threesteps: P_threesteps }

const meta: EpisodeMeta = {
  dir: 'road2', seriesTag: 'Apex Roadmap', episodeLabel: 'Episode 2 · Enrollment',
  introHead: 'Enrollment & First Steps', endHead: "You're Not Just Signed Up — You're In Business.", endAccent: "In Business.", endUrl: 'reachtheapex.net',
  finaleCap: { kicker: 'Next Up', head: 'Your Back Office Tour.', accent: 'Back Office Tour.' },
}

export const ROAD2_FRAMES = framesFor((D as any).vo)
export const RoadmapEp2: React.FC = () => <RoadmapEpisode data={D as any} caps={caps} panelMap={panelMap} meta={meta} />
