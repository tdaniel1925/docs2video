// EP 6 — THE PRODUCTS: DOCS2VIDEO. Distinct imagery: film / transformation motif.
import { generate, PAPER } from './roadmap-gen-lib.mjs'
const BEATS = [
  ["Next product: Docs2Video. This one is easy to love and easy to sell.", 'S'],                                                 // 0 scene
  ["Docs2Video turns any document into a branded, narrated explainer video in minutes.", 'whatis'],                             // 1 panel
  ["A business uploads a P.D.F., and out comes a polished video with a voice, visuals, and their brand.", 'S'],                  // 2 scene
  ["No cameras, no editing, no film crew. Just upload, and the A.I. does the rest.", 'how'],                                     // 3 panel
  ["It comes in four tiers, from a starter plan to enterprise, so it fits any size business.", 'tiers'],                        // 4 panel
  ["Who needs it? Insurance agents, real estate, any business that explains things to clients.", 'who'],                         // 5 panel
  ["Your pitch: turn boring paperwork into videos clients actually watch. That's the hook.", 'pitch'],                          // 6 panel
  ["Like SmartViewz, it's a monthly subscription — recurring income on every account you open.", 'recurring'],                   // 7 panel
  ["Show a prospect one sample video, and it often sells itself.", 'S'],                                                        // 8 scene
  ["That's Docs2Video. Now, a brand-new addition to the family — Jordyn. Let's go.", 'S'],                                      // 9 scene
]
const SCENE_PROMPTS = {
  0: `${PAPER} A red paper figure proudly presenting a navy paper movie clapperboard, film and video craft.`,
  2: `${PAPER} A navy paper PDF document sliding into a paper machine and emerging as a glowing cream paper video screen, transformation.`,
  8: `${PAPER} A small paper audience of navy figures watching a glowing cream paper screen in delight, a captivating video.`,
  9: `${PAPER} A red paper figure shaking hands with a friendly glowing navy paper assistant character, meeting a new AI helper.`,
}
await generate({ dir: 'road6', beats: BEATS, scenePrompts: SCENE_PROMPTS,
  musicPrompt: 'Playful, bright, cinematic-lite corporate underscore, upbeat and friendly, sits under narration, instrumental.' })
