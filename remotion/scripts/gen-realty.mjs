// TORN-PAPER VIDEO — Realty Firm Global, LLC (DFW real estate brokerage).
// Content from realtyfirmglobal.com/about. Torn-paper (FLUX), Rachel VO, EL music.
import { generate, PAPER } from './roadmap-gen-lib.mjs'

// [vo, kind]  'S' = paper scene image, else data-panel id. ONE IDEA = ONE SLIDE.
const BEATS = [
  ["Buying or selling a home is one of the biggest moves of your life. It should feel exciting — not overwhelming.", 'S'],                          // 0 scene
  ["At Realty Firm Global, we've streamlined the entire process to make buying or selling a home easier for you.", 'streamlined'],                   // 1 panel
  ["We're a full-service brokerage right here in the Dallas–Fort Worth area — from Frisco and Plano to Prosper, Celina, and beyond.", 'S'],          // 2 scene
  ["Whether you're buying, selling, or just curious what your home is worth, we're here to guide every step.", 'services'],                          // 3 panel
  ["Great decisions start with great data. We give you the most up-to-date market insights for your neighborhood.", 'data'],                         // 4 panel
  ["Want to know your home's value right now? Our instant valuation and market snapshots put the numbers at your fingertips.", 'valuation'],         // 5 panel
  ["And you're never doing it alone. We've built a team of vetted industry experts to support you.", 'S'],                                          // 6 scene
  ["Inspectors, contractors, lenders, title and escrow, designers — a trusted network, all in one place.", 'network'],                              // 7 panel
  ["Our clients say it best: knowledgeable, caring professionals who make the whole process stress-free.", 'reviews'],                              // 8 panel
  ["Local expertise. Honest guidance. A team that truly has your back.", 'why'],                                                                    // 9 panel
  ["Ready to make your move? Contact Realty Firm Global today, and let's find out how we can help.", 'S'],                                          // 10 scene
]

const SCENE_PROMPTS = {
  0: `${PAPER} A cozy cream and navy paper family home with a red paper roof and a small red paper SOLD-style sign in the yard, a warm welcoming house, real estate.`,
  2: `${PAPER} A cut-paper suburban neighborhood skyline of navy and cream paper houses under a bright cream sky, a Texas community, rows of homes.`,
  6: `${PAPER} A red paper real estate agent figure standing confidently beside a small navy paper team of expert figures, a supportive team.`,
  10: `${PAPER} A red paper hand offering a small navy paper house key to a happy cream paper family, handing over the keys, closing the deal.`,
}

await generate({ dir: 'realty', beats: BEATS, scenePrompts: SCENE_PROMPTS,
  musicPrompt: 'Warm, friendly, trustworthy corporate underscore for a real-estate brand video, welcoming and uplifting, gentle acoustic feel, sits under narration, instrumental.' })
