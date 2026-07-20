// EP 15 — DUPLICATION. Distinct imagery: copies / dominoes / growth motif.
import { generate, PAPER } from './roadmap-gen-lib.mjs'
const BEATS = [
  ["Duplication is the secret to real, lasting income. Let's learn how to copy yourself.", 'S'],                                 // 0 scene
  ["Your job as a sponsor is simple: get your new person to their first sale, fast.", 'firstsale'],                              // 1 panel
  ["A quick first win creates belief, and belief creates momentum that lasts.", 'belief'],                                       // 2 panel
  ["Don't do it for them. Do it with them, so they learn to do it without you.", 'withthem'],                                    // 3 panel
  ["Teach the exact same simple steps you learned — list, invite, present, follow up.", 'samesteps'],                            // 4 panel
  ["When your steps are simple enough to copy, your team grows on its own.", 'S'],                                              // 5 scene
  ["This is the power of duplication: you help a few, and they help a few, and it multiplies.", 'multiply'],                     // 6 panel
  ["Aim to make yourself unnecessary. A leader who isn't needed has built something real.", 'S'],                               // 7 scene
  ["Keep it simple, keep it duplicatable, and your organization will grow beyond you.", 'S'],                                   // 8 scene
  ["Finally, let's tie it together — how you rank up and earn the bonuses. Let's go.", 'S'],                                    // 9 scene
]
const SCENE_PROMPTS = {
  0: `${PAPER} A single red paper figure casting several identical navy paper figure shadows behind it, copying yourself.`,
  5: `${PAPER} A field of navy paper dominoes toppling in a chain from one red paper domino, a self-spreading chain reaction.`,
  7: `${PAPER} A red paper leader figure stepping back proudly as a navy paper team works on its own, a leader not needed.`,
  8: `${PAPER} A small red paper seed growing into a large navy paper tree full of small paper figures, organic growth.`,
  9: `${PAPER} A red paper figure climbing the final rungs of a tall navy paper ladder toward a cream paper crown, ranking up.`,
}
await generate({ dir: 'road15', beats: BEATS, scenePrompts: SCENE_PROMPTS,
  musicPrompt: 'Building, inspiring, expansive corporate underscore, sense of growth and momentum, sits under narration, instrumental.' })
