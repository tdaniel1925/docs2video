// EP 4 — CHOOSE YOUR PATH. Distinct imagery: two-roads / signpost / climbing motif.
import { generate, PAPER } from './roadmap-gen-lib.mjs'
const BEATS = [
  ["Now the big question — which path do you start on? Let's make it simple.", 'S'],                                             // 0 scene
  ["Remember, Apex gives you two ladders. Technology, and Insurance. You can run one, or both.", 'twoladders'],                  // 1 panel
  ["The Technology path is open to everyone. No license needed. You start earning right away.", 'techpath'],                     // 2 panel
  ["You put Apex's A.I. tools in the hands of businesses, and earn on every subscription.", 'S'],                                // 3 scene
  ["The Insurance path is for licensed agents. If you're licensed, you can sell policies too.", 'inspath'],                      // 4 panel
  ["Not licensed yet? No problem. Start on Technology today, and get licensed when you're ready.", 'start'],                     // 5 panel
  ["Here's the simple rule. Start where you can win this week, and add the second ladder later.", 'rule'],                       // 6 panel
  ["Whatever you choose, the team you build carries across. You're never starting over.", 'S'],                                  // 7 scene
  ["So pick your starting ladder, and commit to it. Momentum beats perfection.", 'S'],                                          // 8 scene
  ["Path chosen? Great. Next, we dive into the products you'll offer. Let's go.", 'S'],                                         // 9 scene
]
const SCENE_PROMPTS = {
  0: `${PAPER} A red paper figure standing at a tall navy paper signpost with two blank paper arrow signs pointing opposite ways.`,
  3: `${PAPER} A red paper hand passing a small glowing navy paper app tile to a paper shopkeeper behind a paper counter, offering a tool.`,
  7: `${PAPER} A red paper figure carrying a small navy paper team of figures on a paper platform between two paper ladders, team carries across.`,
  8: `${PAPER} A determined red paper figure planting a small red paper flag at the base of a tall navy paper ladder, committing.`,
  9: `${PAPER} A red paper figure walking toward a display of three glowing navy paper product boxes on paper pedestals, the products ahead.`,
}
await generate({ dir: 'road4', beats: BEATS, scenePrompts: SCENE_PROMPTS,
  musicPrompt: 'Motivating, decisive, warm corporate underscore, forward momentum, steady build, sits under narration, instrumental.' })
