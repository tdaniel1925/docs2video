// EP 16 — RANK UP & EARN THE BONUSES. Distinct imagery: summit / trophy / celebration motif.
// Compliance: rep-facing; bonuses are illustrative; BV designated.
import { generate, PAPER } from './roadmap-gen-lib.mjs'
const BEATS = [
  ["You've learned the whole system. Now let's talk about climbing — ranking up and earning more.", 'S'],                        // 0 scene
  ["Every rank has a target: your own personal volume, plus your team's group volume.", 'targets'],                             // 1 panel
  ["Hit both, and you promote — unlocking deeper levels of override income on your team.", 'unlock'],                            // 2 panel
  ["The higher your rank, the more levels of your organization you get paid on.", 'levels'],                                     // 3 panel
  ["Each new rank also pays a one-time bonus, a reward for the milestone you reached.", 'bonus'],                                // 4 panel
  ["On the insurance side, staying productive can trigger extra weekly and team bonuses too.", 'extra'],                         // 5 panel
  ["One simple habit drives it all: a little personal production every single month.", 'habit'],                                // 6 panel
  ["Consistency is the whole game. Small steps, repeated, become big ranks over time.", 'S'],                                    // 7 scene
  ["You now have the full roadmap — from day one, to your first sale, to leading a team.", 'S'],                                // 8 scene
  ["So take that first step, and keep climbing. Welcome to Apex — we'll see you at the top.", 'S'],                             // 9 scene
]
const SCENE_PROMPTS = {
  0: `${PAPER} A red paper climber figure roped to a tall navy paper mountain peak reaching into a cream paper sky, the climb.`,
  7: `${PAPER} A red paper figure taking small steady steps up a navy paper staircase, one step at a time.`,
  8: `${PAPER} A red paper figure standing over a large unrolled cream paper roadmap with a navy paper path marked across it, the full journey.`,
  9: `${PAPER} A triumphant red paper figure at a navy paper summit holding a golden cream paper trophy under a bright paper sunburst, at the top.`,
}
await generate({ dir: 'road16', beats: BEATS, scenePrompts: SCENE_PROMPTS,
  musicPrompt: 'Epic, triumphant, celebratory corporate underscore, big uplifting finish, rewarding, sits under narration, instrumental.' })
