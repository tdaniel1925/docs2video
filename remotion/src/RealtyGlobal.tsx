import React from 'react'
import D from '../public/realty/durations.json'
import { RoadmapEpisode, framesFor, buildPanels, EpisodeMeta, Cap } from './RoadmapEngine'

/* Torn-paper brand video for Realty Firm Global, LLC (DFW real estate brokerage). */

const caps: Record<number, Cap> = {
  0: { kicker: 'Realty Firm Global', head: 'Your Move Made Easy.', accent: 'Made Easy.' },
  2: { kicker: 'Dallas–Fort Worth', head: 'Your Local Experts.' },
  6: { kicker: 'Never Alone', head: 'A Team Behind You.' },
  10: { kicker: 'Ready To Move?', head: "Let's Find Your Home.", accent: 'Your Home.' },
}

const panelMap = buildPanels({
  streamlined: { kind: 'statement', kicker: 'Our Promise', text: 'We’ve **streamlined the process** of buying or selling — to make it easier for you.' },
  services: { kind: 'bullets', kicker: 'How We Help', items: ['Buying your next home', 'Selling for top value', 'Knowing what your home is worth'] },
  data: { kind: 'statement', kicker: 'Great Decisions Start Here', text: 'The most **up-to-date market data** for your neighborhood.' },
  valuation: { kind: 'twocol', kicker: 'Know Your Number', left: { t: 'Instant', s: 'valuation' }, right: { t: 'Market', s: 'snapshot' }, foot: 'The numbers, at your fingertips.' },
  network: { kind: 'bullets', kicker: 'A Trusted Network', items: ['Inspectors & contractors', 'Lenders, title & escrow', 'Designers & service pros'] },
  reviews: { kind: 'statement', kicker: 'Our Clients Say It Best', text: 'Knowledgeable, caring pros who make it **stress-free.**' },
  why: { kind: 'bullets', kicker: 'Why Realty Firm Global', items: ['Local expertise', 'Honest guidance', 'A team that has your back'] },
})

const meta: EpisodeMeta = {
  dir: 'realty', seriesTag: 'Realty Firm Global', episodeLabel: 'Richardson · Dallas–Fort Worth',
  introHead: 'Buying Or Selling A Home?', endHead: 'Contact Us Today. Let’s Make Your Move.', endAccent: 'Your Move.', endUrl: 'realtyfirmglobal.com',
  finaleCap: { kicker: 'Realty Firm Global', head: 'Welcome Home.', accent: 'Home.' },
}

export const REALTY_FRAMES = framesFor((D as any).vo)
export const RealtyGlobal: React.FC = () => <RoadmapEpisode data={D as any} caps={caps} panelMap={panelMap} meta={meta} />
