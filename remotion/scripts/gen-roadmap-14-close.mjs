// EP 14 — FOLLOW-UP & CLOSE. Distinct imagery: finish-line / signature / welcome motif.
import { generate, PAPER } from './roadmap-gen-lib.mjs'
const BEATS = [
  ["The fortune is in the follow-up. Most people say yes after the second or third touch.", 'S'],                                // 0 scene
  ["Rule one: always schedule the follow-up before you leave the conversation. Never leave it open.", 'schedule'],              // 1 panel
  ["Rule two: follow up when you say you will. Reliability builds the trust that closes.", 'reliable'],                          // 2 panel
  ["When it's time to close, keep it simple. Ask: are you ready to get started today?", 'ask'],                                  // 3 panel
  ["Then stay quiet, and let them answer. The first person to speak usually decides.", 'quiet'],                                 // 4 panel
  ["If yes, walk them through enrollment right then, step by step, so they never get stuck.", 'enroll'],                         // 5 panel
  ["If not yet, that's fine — set the next follow-up and keep the door open warmly.", 'notyet'],                                 // 6 panel
  ["The moment someone joins, welcome them and start their first forty-eight hours immediately.", 'S'],                         // 7 scene
  ["A good close isn't pressure — it's simply helping someone make a decision they already want.", 'S'],                        // 8 scene
  ["Now they're on your team. Next, we learn to duplicate — to copy this with them. Let's go.", 'S'],                           // 9 scene
]
const SCENE_PROMPTS = {
  0: `${PAPER} A red paper figure crossing a cream paper finish-line ribbon with a navy paper crowd cheering, closing the deal.`,
  7: `${PAPER} A red paper figure warmly welcoming a new navy paper figure with open arms under a cream paper banner, welcoming a new member.`,
  8: `${PAPER} A red paper hand offering a paper pen to a navy paper figure signing a glowing cream paper form, an easy decision.`,
  9: `${PAPER} Two red paper figures standing side by side becoming a mirrored pair, one copying the other, duplication.`,
}
await generate({ dir: 'road14', beats: BEATS, scenePrompts: SCENE_PROMPTS,
  musicPrompt: 'Triumphant but warm corporate underscore, satisfying resolve, uplifting, sits under narration, instrumental.' })
