// EP 3 — YOUR BACK OFFICE TOUR. Distinct imagery: paper dashboard/control-room motif.
import { generate, PAPER } from './roadmap-gen-lib.mjs'
const BEATS = [
  ["Let's take a tour of your back office — your command center for the whole business.", 'S'],                                  // 0 scene
  ["This is your home base. Everything you need to run and grow your Apex business lives right here.", 'S'],                     // 1 scene
  ["First, your dashboard. It shows your progress at a glance — your rank, your volume, and your next goal.", 'dashboard'],      // 2 panel
  ["Next, your team view. See everyone you've brought in and everyone they've brought in, all in one tree.", 'team'],           // 3 panel
  ["Your compensation section breaks down exactly how you earn and what you've earned so far.", 'comp'],                        // 4 panel
  ["Your commissions page shows every payment, clearly itemized, so you always know where you stand.", 'commissions'],          // 5 panel
  ["The products area is where you find everything you can offer, ready to share with a click.", 'products'],                    // 6 panel
  ["And the training center — right here — holds this whole roadmap and every resource you'll need.", 'training'],              // 7 panel
  ["Spend a few minutes clicking around. The more familiar it feels, the faster you'll move.", 'S'],                            // 8 scene
  ["That's your back office. Next, we'll help you choose your path. Let's keep going.", 'S'],                                   // 9 scene
]
const SCENE_PROMPTS = {
  0: `${PAPER} A red paper figure standing before a large navy paper control panel wall covered in blank paper dials and screens, a command center.`,
  1: `${PAPER} A cozy navy paper home-office desk built of layered paper with a blank paper monitor and a red paper chair, a home base.`,
  8: `${PAPER} A red paper hand with a paper cursor arrow clicking across a grid of blank navy paper tiles, exploring an interface.`,
  9: `${PAPER} A red paper figure standing at a fork of two navy paper roads splitting toward a cream horizon, choosing a path ahead.`,
}
await generate({ dir: 'road3', beats: BEATS, scenePrompts: SCENE_PROMPTS,
  musicPrompt: 'Bright, clean, modern corporate underscore for a product tour, curious and confident, steady, sits under narration, instrumental.' })
