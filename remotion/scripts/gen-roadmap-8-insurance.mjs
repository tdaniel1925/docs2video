// EP 8 — THE INSURANCE SIDE. Distinct imagery: shield / policy / carriers motif.
// Compliance: rep-facing, no waterfall/company cut. Commissions from first-year premium %.
import { generate, PAPER } from './roadmap-gen-lib.mjs'
const BEATS = [
  ["If you're a licensed agent, the Insurance side is a powerful second income. Let's cover it.", 'S'],                          // 0 scene
  ["On this side, you sell life insurance and earn a commission on every policy you write.", 'howpaid'],                         // 1 panel
  ["Your commission is a share of the first-year premium — and that share grows as you rank up.", 'rate'],                       // 2 panel
  ["You're contracted directly with top carriers, so your commissions are paid straight to you.", 'carriers'],                   // 3 panel
  ["And the business you write is yours. You own your book — it stays with you as you grow.", 'ownbook'],                        // 4 panel
  ["Build a team of agents, and you earn override income on their production too.", 'S'],                                        // 5 scene
  ["You climb by writing consistent, quality business — production and persistency.", 'climb'],                                  // 6 panel
  ["It pairs perfectly with the tech side: same team, two income streams.", 'S'],                                               // 7 scene
  ["If you're licensed, this is where a great month becomes a great year.", 'S'],                                               // 8 scene
  ["That's the Insurance side. Next, a quick tour of how you actually get paid. Let's go.", 'S'],                               // 9 scene
]
const SCENE_PROMPTS = {
  0: `${PAPER} A confident red paper insurance agent figure standing beside a large protective navy paper shield, licensed and ready.`,
  5: `${PAPER} A red paper leader figure with a growing navy paper team of small agent figures fanning out behind, building a team.`,
  7: `${PAPER} A red paper figure standing between two navy paper income streams of paper coins flowing upward into their hands.`,
  8: `${PAPER} A red paper figure at the summit of a navy paper mountain at cream sunrise, arms raised, a great year.`,
  9: `${PAPER} A navy paper hand placing a stack of cream paper dollar bills into a red paper figure's open palm, getting paid.`,
}
await generate({ dir: 'road8', beats: BEATS, scenePrompts: SCENE_PROMPTS,
  musicPrompt: 'Confident, trustworthy, warm corporate underscore, steady and reassuring, sits under narration, instrumental.' })
