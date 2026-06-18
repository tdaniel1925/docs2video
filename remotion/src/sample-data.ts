import type { ExplainerProps } from './schema'
import { IHOSTPOKER } from './tokens'

/** Narration text per scene — also used by the TTS generator script. */
export const NARRATION_TEXT = {
  cover: "Picture the one event your guests actually talk about for years. That's what we do. iHostPoker brings the real casino floor to your party — in Houston since two thousand three.",
  pillars: "Here's why it works. Over twelve casino games, so everyone finds their table. Trained, professional dealers who run the whole night for you. And an experience built for everyone, from first-timers to high rollers.",
  stat: "More than ten thousand parties hosted. That's not a number we throw around — it's two decades of nights nobody forgets.",
  bullets: "Whatever you're planning, we've got it covered. Corporate galas, fundraisers, private parties. Full setup and breakdown handled for you. Authentic casino-grade tables. And flexible packages for any guest count.",
  closing: "Let's host yours. Book your casino night today, and give your guests a seat at the table they'll never forget.",
} as const

export const SAMPLE: ExplainerProps = {
  brandName: 'iHostPoker Casino Parties',
  theme: IHOSTPOKER,
  cover: {
    eyebrow: 'Houston · Since 2003',
    title: 'The Event Nobody Forgets',
    subtitle: 'Premium casino party rentals — trained dealers, real tables, unforgettable nights.',
  },
  pillarsTitle: 'Why it works',
  pillars: [
    { accentIndex: 0, label: 'Variety', title: '12+ Games', subhead: 'Roulette, blackjack, craps and more — a table for every guest.', icon: 'spark' },
    { accentIndex: 1, label: 'Trusted', title: 'Trained Dealers', subhead: 'Fully managed, from setup to the last hand.', icon: 'shield' },
    { accentIndex: 2, label: 'Inclusive', title: 'Everyone Plays', subhead: 'First-timers to high rollers — nobody sidelined.', icon: 'chart' },
  ],
  stat: { value: '10,000+', label: 'Parties hosted', accentIndex: 1 },
  bullets: {
    title: 'Built for every event',
    items: [
      'Corporate galas, fundraisers, and private parties',
      'Full setup and breakdown handled for you',
      'Authentic casino-grade tables and equipment',
      'Flexible packages for any guest count',
    ],
  },
  closing: { title: 'Let’s host yours', cta: 'Book your casino night today', contact: 'ihostpoker.com' },
}
