// EP 10 — BUILD YOUR LIST & YOUR STORY. Distinct imagery: list / people / story motif.
import { generate, PAPER } from './roadmap-gen-lib.mjs'
const BEATS = [
  ["Every business starts the same way — with a list of people and a story worth sharing.", 'S'],                               // 0 scene
  ["First, your list. Write down everyone you know. Don't pre-judge who's interested — just write.", 'list'],                    // 1 panel
  ["Think in circles: family, friends, coworkers, and anyone whose number is in your phone.", 'circles'],                        // 2 panel
  ["Aim for at least one hundred names. Your list is the fuel for your whole business.", 'hundred'],                             // 3 panel
  ["Next, your story. People don't join a company — they join a person with a why.", 'S'],                                      // 4 scene
  ["Your story is three simple parts: where you were, what you found, and where you're going.", 'story3'],                       // 5 panel
  ["Keep it under sixty seconds. Honest and short beats polished and long, every time.", 'sixty'],                              // 6 panel
  ["Practice it out loud until it feels natural. Your story is your most powerful tool.", 'S'],                                  // 7 scene
  ["A full list and a clear story — that's a business ready to launch.", 'S'],                                                  // 8 scene
  ["Next, we learn exactly how to invite people to take a look. Let's go.", 'S'],                                               // 9 scene
]
const SCENE_PROMPTS = {
  0: `${PAPER} A red paper figure holding a long unrolling cream paper scroll of blank paper names beside a navy paper crowd.`,
  4: `${PAPER} A red paper figure telling a story, a glowing cream paper speech bubble rising from them toward a listening navy paper figure.`,
  7: `${PAPER} A red paper figure practicing in front of a navy paper mirror, rehearsing confidently.`,
  8: `${PAPER} A red paper rocket made of layered paper on a navy paper launch pad, a business ready to launch.`,
  9: `${PAPER} A red paper hand extending a glowing cream paper invitation card toward a curious navy paper figure.`,
}
await generate({ dir: 'road10', beats: BEATS, scenePrompts: SCENE_PROMPTS,
  musicPrompt: 'Warm, personal, encouraging corporate underscore, human and hopeful, steady, sits under narration, instrumental.' })
