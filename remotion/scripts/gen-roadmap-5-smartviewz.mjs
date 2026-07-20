// EP 5 — THE PRODUCTS: SMARTVIEWZ. Distinct imagery: data-dashboard / insight motif.
import { generate, PAPER } from './roadmap-gen-lib.mjs'
const BEATS = [
  ["Let's talk about your first product to know cold — SmartViewz.", 'S'],                                                       // 0 scene
  ["SmartViewz is an A.I. intelligence platform built for life and annuity agents.", 'whatis'],                                 // 1 panel
  ["It turns an agent's messy spreadsheets and data into a clean, living dashboard.", 'S'],                                     // 2 scene
  ["It surfaces revenue insights, flags compliance issues, and answers questions about their book.", 'features'],               // 3 panel
  ["Think of it as a smart co-pilot that already understands the insurance business.", 'S'],                                    // 4 scene
  ["Who's it for? Any life or annuity agent drowning in data who wants clarity and time back.", 'who'],                         // 5 panel
  ["Your pitch is simple: stop guessing, start seeing. SmartViewz shows agents what's really happening.", 'pitch'],             // 6 panel
  ["It's a monthly subscription, so every agent you sign becomes recurring income for you.", 'recurring'],                       // 7 panel
  ["Know the problem it solves, and you'll sell it with confidence.", 'S'],                                                     // 8 scene
  ["That's SmartViewz. Next up, a product that turns documents into video. Let's go.", 'S'],                                    // 9 scene
]
const SCENE_PROMPTS = {
  0: `${PAPER} A red paper analyst figure gazing up at a giant navy paper dashboard made of blank paper charts and gauges glowing softly.`,
  2: `${PAPER} A messy pile of crumpled navy paper spreadsheets transforming into one clean glowing cream paper screen, order from chaos.`,
  4: `${PAPER} A friendly red paper robot co-pilot figure sitting beside a paper agent at a navy paper desk, an AI assistant.`,
  8: `${PAPER} A confident red paper figure holding up a glowing cream paper lightbulb over a navy paper book, clarity and insight.`,
  9: `${PAPER} A navy paper document scroll morphing into a small paper film reel with a red play triangle, document to video.`,
}
await generate({ dir: 'road5', beats: BEATS, scenePrompts: SCENE_PROMPTS,
  musicPrompt: 'Sleek, intelligent, modern tech underscore, calm confidence, subtle pulse, sits under narration, instrumental.' })
