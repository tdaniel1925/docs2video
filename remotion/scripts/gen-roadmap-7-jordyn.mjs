// EP 7 — THE PRODUCTS: JORDYN. Distinct imagery: AI-assistant / inbox / time-saved motif.
import { generate, PAPER } from './roadmap-gen-lib.mjs'
const BEATS = [
  ["Now meet the newest product in the Apex family — Jordyn.", 'S'],                                                            // 0 scene
  ["Jordyn is an A.I. assistant with a brain for your business — it arrives already knowing your industry.", 'whatis'],         // 1 panel
  ["Unlike a generic chatbot, Jordyn learns from a professional's real inbox and real clients.", 'S'],                          // 2 scene
  ["It reads and manages email, answers the phone, and builds a pipeline automatically.", 'features'],                          // 3 panel
  ["Every morning it delivers a briefing of what needs attention, so nothing slips.", 'S'],                                     // 4 scene
  ["Who's it for? Agents, realtors, attorneys — any busy professional buried in follow-up.", 'who'],                            // 5 panel
  ["The promise: it gives back about eight hours a week, roughly two thousand dollars in time.", 'value'],                       // 6 panel
  ["It's a hundred forty-nine a month, and like the others, recurring income for you.", 'recurring'],                            // 7 panel
  ["Your pitch: an assistant that actually runs your day, not just chats about it.", 'S'],                                      // 8 scene
  ["That's Jordyn. Now let's cover the Insurance side of the business. Let's go.", 'S'],                                        // 9 scene
]
const SCENE_PROMPTS = {
  0: `${PAPER} A warm glowing navy paper assistant character with a friendly cream paper face waving hello, a helpful AI.`,
  2: `${PAPER} A navy paper inbox tray overflowing with paper envelopes being neatly sorted by a red paper robotic hand, managing email.`,
  4: `${PAPER} A red paper figure sipping paper coffee while a navy paper assistant hands them a tidy cream paper morning briefing card.`,
  8: `${PAPER} A red paper professional relaxing in a paper chair while a navy paper assistant runs a wall of blank paper task cards behind them.`,
  9: `${PAPER} A red paper agent figure holding a navy paper shield over a small cream paper family house, insurance protection.`,
}
await generate({ dir: 'road7', beats: BEATS, scenePrompts: SCENE_PROMPTS,
  musicPrompt: 'Warm, friendly, modern assistant-tech underscore, gentle optimism, light pulse, sits under narration, instrumental.' })
