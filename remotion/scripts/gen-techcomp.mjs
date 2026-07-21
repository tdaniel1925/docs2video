// TECHNOLOGY COMPENSATION PLAN — DETAILED (~6-8 min). Torn-paper, Rachel VO, EL music.
// Writes public/techcomp/. Exact figures from APEX_COMP_ENGINE_SPEC (verified).
// COMPLIANCE (rep-facing): NEVER show the internal waterfall / company / vendor cut.
// BV = a value Apex DESIGNATES per product. Worked $ examples are ILLUSTRATIVE.
import { generate, PAPER } from './roadmap-gen-lib.mjs'

// [vo, kind]  kind 'S' = paper scene image, else a data-panel id.
// ONE IDEA = ONE SLIDE — each line talks only about its slide.
const BEATS = [
  // ---- OPEN ----
  ["Welcome to a complete walkthrough of the Apex Technology compensation plan. We'll cover every rank, every override level, and real examples of what you can earn.", 'S'], // 0
  ["Let's start with the big picture. On the Technology side, you earn by putting Apex's A.I. tools in the hands of businesses.", 'S'],                                          // 1
  ["It's open to everyone — no license required — and it costs nothing to get started.", 'zero'],                                                                               // 2
  // ---- BV ----
  ["First, one essential term: Business Volume, or B.V.", 'bvterm'],                                                                                                            // 3
  ["For every product, Apex designates a Business Volume — and that B.V. is simply the amount your commission is based on.", 'bvdef'],                                          // 4
  ["Here are the real numbers. Docs2Video ranges from nine B.V. on the starter plan up to a hundred twenty-two on enterprise.", 'bvprod1'],                                     // 5
  ["SmartViewz carries sixty-nine B.V., and SmartViewz Lite thirty-two. Every product has its own designated B.V.", 'bvprod2'],                                                // 6
  // ---- TWO WAYS ----
  ["Now, how you get paid. You earn two ways — and this is the heart of the plan.", 'S'],                                                                                       // 7
  ["Way one: a commission on the B.V. of every product you personally sell.", 'way1'],                                                                                          // 8
  ["Way two: override income — a share that comes back to you as the team you build makes sales too.", 'way2'],                                                                 // 9
  ["Do both, and your income compounds — what you sell, plus what your whole team sells.", 'both'],                                                                             // 10
  // ---- RANKS OVERVIEW ----
  ["Your earning power grows with your rank. There are nine ranks, from Starter to Elite.", 'ranks9'],                                                                          // 11
  ["Each rank has a target: your own personal volume, plus your team's group volume. Hit both, and you promote.", 'targets'],                                                   // 12
  // ---- RANK DETAIL 1 ----
  ["Let's walk them. Starter is where everyone begins — no requirements, earning on your first level.", 'rk_starter'],                                                          // 13
  ["Bronze: a hundred fifty personal, three hundred group. Reach it and earn a two hundred fifty dollar bonus.", 'rk_bronze'],                                                  // 14
  ["Silver: five hundred personal, fifteen hundred group — and a one thousand dollar rank bonus.", 'rk_silver'],                                                                // 15
  ["Gold: twelve hundred personal, five thousand group, plus one sponsored Bronze. The bonus jumps to three thousand.", 'rk_gold'],                                             // 16
  ["Platinum: twenty-five hundred personal, fifteen thousand group, two sponsored Silvers — a seventy-five hundred dollar bonus.", 'rk_plat'],                                  // 17
  ["Ruby: four thousand personal, thirty thousand group, two sponsored Golds — a twelve thousand dollar bonus.", 'rk_ruby'],                                                    // 18
  ["Diamond: five thousand personal, fifty thousand group — an eighteen thousand dollar bonus.", 'rk_diamond'],                                                                 // 19
  ["Crown: six thousand personal, seventy-five thousand group — a twenty-two thousand dollar bonus.", 'rk_crown'],                                                              // 20
  ["And Elite, the top: eight thousand personal, a hundred twenty thousand group — a thirty thousand dollar bonus.", 'rk_elite'],                                               // 21
  ["Add every rank bonus together, and that's more than ninety-three thousand dollars in bonuses along the way.", 'bonustotal'],                                                // 22
  // ---- OVERRIDE SCHEDULE ----
  ["Now the override schedule — how deep, and how much, you earn on your team.", 'S'],                                                                                          // 23
  ["Level one is your enrollment override. It pays thirty percent on everyone you personally bring in — always thirty, at every rank.", 'l1'],                                  // 24
  ["Beyond level one, higher ranks unlock deeper levels. Starter earns on one level. Elite earns on all seven.", 'depth'],                                                      // 25
  ["Here's the full schedule. As you climb, you unlock levels two through seven — and at Ruby and above, you earn on the entire pool.", 'schedule'],                            // 26
  // ---- WORKED EXAMPLE ----
  ["Let's make it real with an example. Say you personally sell ten SmartViewz subscriptions in a month.", 'ex_personal'],                                                      // 27
  ["That's six hundred ninety B.V. in personal sales — your personal commission is paid on all of it.", 'ex_personal2'],                                                        // 28
  ["Now add a team. Say twenty active people each producing around three hundred B.V. a month.", 'ex_team'],                                                                    // 29
  ["That's six thousand team B.V. flowing up through your override levels — income on top of your own.", 'ex_team2'],                                                           // 30
  // ---- QUALIFY ----
  ["To earn those overrides, one simple rule: produce at least fifty personal volume each month.", 'qualify'],                                                                  // 31
  ["Sell a little, stay qualified. Miss a month, and you have a thirty-day grace period to get back on track.", 'grace'],                                                       // 32
  ["And your highest rank is permanent — once you reach it, that achievement is yours for life.", 'permanent'],                                                                 // 33
  // ---- CLOSE ----
  ["So that's the Technology plan: sell the tools, build a team, and climb — nine ranks, seven levels deep, no ceiling.", 'S'],                                                 // 34
  ["Start today, stay consistent, and let the plan reward every step. Welcome to Apex.", 'S'],                                                                                  // 35
]

const SCENE_PROMPTS = {
  0: `${PAPER} A red paper figure standing before a giant navy paper ladder that rises into a cream sky, an epic overview of a compensation journey.`,
  1: `${PAPER} A red paper hand offering a glowing navy paper laptop with a paper spark to a paper business owner behind a counter, A.I. tools for businesses.`,
  7: `${PAPER} A red paper figure with two glowing streams of cream paper coins flowing into each hand, two ways to earn.`,
  23: `${PAPER} A red paper figure looking up at a tall navy paper pyramid of seven stacked paper tiers glowing softly, override levels stacked deep.`,
  34: `${PAPER} A red paper figure climbing high on a navy paper ladder that extends beyond the frame into a bright cream sky, no ceiling.`,
  35: `${PAPER} A triumphant red paper figure taking a confident first step onto a navy paper path of rising stepping stones toward a cream sunrise, start today.`,
}

await generate({ dir: 'techcomp', beats: BEATS, scenePrompts: SCENE_PROMPTS,
  musicPrompt: 'Confident, warm, professional corporate underscore for a detailed explainer, steady and motivating, builds gently, sits under narration, instrumental, long.' })
