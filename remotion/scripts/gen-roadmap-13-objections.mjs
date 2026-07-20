// EP 13 — HANDLING OBJECTIONS. Distinct imagery: bridge / wall / handshake motif.
import { generate, PAPER } from './roadmap-gen-lib.mjs'
const BEATS = [
  ["Objections aren't rejection — they're just questions in disguise. Let's handle the common ones.", 'S'],                      // 0 scene
  ["The golden rule: never argue. Agree, reassure, and redirect to the next step.", 'rule'],                                     // 1 panel
  ["Is this a pyramid? Answer calmly: No — you earn by selling real products people actually use.", 'pyramid'],                  // 2 panel
  ["I don't have time. Reply: That's exactly why this fits — it's built to start small, on your schedule.", 'time'],             // 3 panel
  ["I don't have the money. Reply: I understand — that's the reason many people start, to change that.", 'money'],               // 4 panel
  ["Let me think about it. Reply: Totally fair — what's the one thing you'd want to be sure of?", 'think'],                      // 5 panel
  ["Notice the pattern: acknowledge the concern, then gently guide back to a decision.", 'pattern'],                             // 6 panel
  ["Most objections just mean they need one more piece of information or reassurance.", 'S'],                                    // 7 scene
  ["Stay calm, stay kind, and keep pointing to the next simple step.", 'S'],                                                    // 8 scene
  ["Once the questions are answered, it's time to follow up and close. That's next. Let's go.", 'S'],                           // 9 scene
]
const SCENE_PROMPTS = {
  0: `${PAPER} A red paper figure calmly building a small paper bridge across a navy paper gap toward a cream paper figure, bridging concerns.`,
  7: `${PAPER} A red paper figure handing a single glowing cream paper puzzle piece to a navy paper figure who is nodding, one more piece.`,
  8: `${PAPER} A warm paper handshake between a red paper hand and a navy paper hand over a cream paper background, calm agreement.`,
  9: `${PAPER} A red paper figure checking a cream paper follow-up calendar with a small navy paper checkmark, following up.`,
}
await generate({ dir: 'road13', beats: BEATS, scenePrompts: SCENE_PROMPTS,
  musicPrompt: 'Calm, steady, reassuring corporate underscore, patient and warm, gentle, sits under narration, instrumental.' })
