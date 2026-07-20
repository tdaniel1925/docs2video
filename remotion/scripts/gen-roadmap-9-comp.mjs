// EP 9 — THE COMP PLAN, FAST. Distinct imagery: coins / ladder / paycheck motif.
// Compliance: BV = a value Apex DESIGNATES per product; never "after company costs".
import { generate, PAPER } from './roadmap-gen-lib.mjs'
const BEATS = [
  ["Let's make the compensation plan simple — just what it means for your paycheck.", 'S'],                                      // 0 scene
  ["One term to know: B.V., or Business Volume. For each product, Apex designates a Business Volume.", 'bv'],                    // 1 panel
  ["That B.V. is simply the amount your commission is based on. That's all you need to remember.", 'S'],                        // 2 scene
  ["You get paid two ways. First, a commission on the B.V. of everything you personally sell.", 'personal'],                     // 3 panel
  ["Second, override income — a share that comes back to you as your team sells too.", 'override'],                              // 4 panel
  ["As you rank up, you earn on more levels of your team, and your share grows.", 'ranks'],                                     // 5 panel
  ["Reach new ranks and you also unlock one-time bonuses along the way.", 'bonuses'],                                            // 6 panel
  ["One simple rule to stay qualified: keep a little personal volume each month.", 'qualify'],                                   // 7 panel
  ["That's it. Sell, build a team, rank up. The plan rewards all three.", 'S'],                                                 // 8 scene
  ["Now you know what you're building. Next, we learn how to actually find people. Let's go.", 'S'],                            // 9 scene
]
const SCENE_PROMPTS = {
  0: `${PAPER} A red paper figure holding a large cream paper paycheck with a navy paper coin stack beside it, getting paid.`,
  2: `${PAPER} A single glowing navy paper price tag with a cream paper coin beside it, a simple designated value.`,
  8: `${PAPER} A red paper figure climbing a navy paper ladder while cream paper coins rain gently around them, earning as you climb.`,
  9: `${PAPER} A red paper figure with a paper magnifying glass looking out over a field of small navy paper people, finding prospects.`,
}
await generate({ dir: 'road9', beats: BEATS, scenePrompts: SCENE_PROMPTS,
  musicPrompt: 'Clear, upbeat, motivating corporate underscore, simple and confident, steady, sits under narration, instrumental.' })
