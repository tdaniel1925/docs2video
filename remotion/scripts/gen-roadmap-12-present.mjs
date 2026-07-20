// EP 12 — THE PRESENTATION. Distinct imagery: stage / whiteboard / clarity motif.
import { generate, PAPER } from './roadmap-gen-lib.mjs'
const BEATS = [
  ["The presentation is where curiosity becomes understanding. Keep it simple and let the tools do the work.", 'S'],            // 0 scene
  ["A great presentation answers three questions: what is it, how do I make money, and how do I start.", 'three'],               // 1 panel
  ["Start with the story — the problem Apex solves and why it matters right now.", 'story'],                                     // 2 panel
  ["Then the products, briefly. Show, don't tell. One sample is worth a thousand words.", 'show'],                               // 3 panel
  ["Next, the opportunity — the two ways to earn, in plain, simple language.", 'opp'],                                          // 4 panel
  ["Keep the whole thing under twenty minutes. Confused people never say yes.", 'twenty'],                                       // 5 panel
  ["Let the video or the tool carry the details, and you stay the guide, not the expert.", 'S'],                                // 6 scene
  ["Always end with a clear next step: are you ready to get started today?", 'nextstep'],                                        // 7 panel
  ["Remember, you're not convincing — you're revealing. Show it clearly and let them decide.", 'S'],                            // 8 scene
  ["After the presentation, some will have questions. Handling those is next. Let's go.", 'S'],                                 // 9 scene
]
const SCENE_PROMPTS = {
  0: `${PAPER} A red paper presenter figure on a small navy paper stage under a soft cream paper spotlight, presenting.`,
  6: `${PAPER} A red paper guide figure pointing toward a glowing cream paper screen while a navy paper figure watches, being a guide.`,
  8: `${PAPER} A red paper hand pulling back a navy paper curtain to reveal a glowing cream paper shape, revealing not convincing.`,
  9: `${PAPER} A navy paper figure with a cream paper question mark bubble above their head, a prospect with questions.`,
}
await generate({ dir: 'road12', beats: BEATS, scenePrompts: SCENE_PROMPTS,
  musicPrompt: 'Polished, assured, warm corporate underscore, clear and steady, gentle build, sits under narration, instrumental.' })
