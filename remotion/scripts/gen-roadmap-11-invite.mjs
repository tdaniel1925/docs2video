// EP 11 — THE INVITE (SCRIPTS). Distinct imagery: outreach / phone / DM motif.
import { generate, PAPER } from './roadmap-gen-lib.mjs'
const BEATS = [
  ["The invite is the most important skill in this business. Let's make it simple and repeatable.", 'S'],                        // 0 scene
  ["The goal of an invite is not to explain everything. It's just to get them to take a look.", 'goal'],                         // 1 panel
  ["Keep it short, keep it curious, and always point to a tool — a video, a call, or a link.", 'rule'],                          // 2 panel
  ["Here's a warm-market script: Hey, I'm working on something new and thought of you.", 'warm'],                               // 3 panel
  ["Would you be open to taking a look if it doesn't cost you anything to check it out?", 'openclose'],                          // 4 panel
  ["For social or a D.M.: I'm expanding my business and looking for a few sharp people. Interested?", 'dm'],                     // 5 panel
  ["Notice the pattern — a compliment, a reason, and a simple yes-or-no question.", 'pattern'],                                  // 6 panel
  ["When they say yes, send the tool immediately, and set a time to follow up.", 'S'],                                          // 7 scene
  ["Don't sell in the invite. Your only job is to spark curiosity and hand off the tool.", 'S'],                                // 8 scene
  ["Once they've looked, it's time to present. That's next. Let's go.", 'S'],                                                   // 9 scene
]
const SCENE_PROMPTS = {
  0: `${PAPER} A red paper figure cheerfully handing a glowing cream paper ticket to a navy paper figure, an invitation.`,
  7: `${PAPER} A red paper hand sending a glowing navy paper message envelope flying toward a small paper phone, sending a tool.`,
  8: `${PAPER} A single bright cream paper spark or firefly glowing above a red paper figure's open hand, sparking curiosity.`,
  9: `${PAPER} A red paper presenter figure gesturing toward a large blank navy paper presentation board, about to present.`,
}
await generate({ dir: 'road11', beats: BEATS, scenePrompts: SCENE_PROMPTS,
  musicPrompt: 'Bright, confident, conversational corporate underscore, friendly momentum, steady, sits under narration, instrumental.' })
