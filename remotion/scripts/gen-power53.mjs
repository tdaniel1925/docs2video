// THE POWER OF 5 AND 3 — Growth Through Leadership (~6-7 min).
// Torn-paper, Rachel VO, EL music. Writes public/power53/.
// Rep-facing: NO waterfall / company cut / 60-40 split. Money illustrative.
// Even 3-way split: vision · 5-and-3 process · leader psychology (3 questions) · payoff.
import { generate, PAPER } from './roadmap-gen-lib.mjs'

// [vo, kind]  'S' = paper scene image, else data-panel id. ONE IDEA = ONE SLIDE.
const BEATS = [
  // ---- THREAD 1: PHILOSOPHY / VISION ----
  ["There are two ways to grow a business. You can chase sales, one at a time, forever. Or you can build people, and let the people build the business. This is the path of a leader.", 'S'],                    // 0
  ["Here's a truth about human beings: everyone wants to be part of something bigger than themselves. Your job as a leader is to give them that.", 'S'],                                                          // 1
  ["Apex isn't just a set of tools. It's a mission — to help everyday people build real income by helping businesses grow. You're not offering a product. You're offering a purpose.", 'purpose'],                // 2
  ["But a vision doesn't move on its own. It moves through leaders. You can't carry it alone — and you're not supposed to. You build a team of like-minded people to carry it with you.", 'vision'],              // 3
  ["So the real question isn't how many can I sell. It's who can I build. A business built on people you developed will outlast anything you could sell by yourself.", 'S'],                                       // 4
  ["You're looking for like-minded people — who want to build, who want to help others, who want more for their life. Pour into them, and you don't just grow a team. You change lives.", 'likeminded'],          // 5
  // ---- THREAD 2: THE 5 AND 3 PROCESS ----
  ["Vision needs a system. And the Apex system is beautifully simple. It's built on two numbers: five, and three.", 'S'],                                                                                        // 6
  ["Five leaders. Three customers each. That's the whole engine. Everything you build, you build around those two numbers.", 'fivethree'],                                                                        // 7
  ["Step one — become a product of the product. Before you ever sell the tool, you use it. People don't buy the product. They buy your conviction.", 'step1'],                                                    // 8
  ["Step two — get three customers. Not thirty. Three. Small enough that anyone can do it, and it's the proof the model works.", 'step2'],                                                                        // 9
  ["Step three — find five leaders. Five people who will do what you just did: use the tool, get their three customers, and lead their own team.", 'step3'],                                                      // 10
  ["Step four — duplicate. You teach your five to find their five. Same simple steps, repeated down through your team.", 'step4'],                                                                                // 11
  ["Why does three matter so much? Because it's duplicatable. Big numbers scare people, and they quit. Three feels possible — so people actually do it, and teach it.", 'why3'],                                  // 12
  ["Five and three isn't a limit — it's a launch pad. Master it, teach it, and it repeats itself through your whole organization.", 'S'],                                                                         // 13
  // ---- THREAD 3: PSYCHOLOGY — IDENTIFY & DEVELOP LEADERS ----
  ["Now the most important skill of all — the one nobody teaches. How do you find those five leaders, and how do you develop them? This is where real leadership lives.", 'S'],                                   // 14
  ["First, identify. You're not looking for the loudest person in the room. You're looking for the hungry, the coachable, the ones who genuinely want to help others.", 'spot'],                                  // 15
  ["And a leader is not someone you drag along. You don't chase, convince, or beg. You look for people already reaching for more, and you offer them a path.", 'nochase'],                                        // 16
  ["Once you spot someone with potential, you develop them through conversation — not a pitch. There are three questions that change everything.", 'S'],                                                          // 17
  ["Question one: what do you want? Not from the business — for your life. More time? To be home with your kids? Get them talking about the dream behind the money.", 'q1'],                                       // 18
  ["Question two: how do you want to help? This uncovers the leader inside them. The ones who light up talking about helping others — those are your future leaders.", 'q2'],                                     // 19
  ["Question three: how much do you want to make? Get a real number. Their number tells you what to build toward, and how hard to work, together.", 'q3'],                                                        // 20
  ["Then do the hardest thing in leadership: listen. Really listen. Their answers are the map. Connect what they want to what this can do.", 'listen'],                                                           // 21
  ["Developing a leader isn't one talk. It's showing up. You do the first few with them, not for them. You believe in them out loud — before they believe in themselves.", 'develop'],                           // 22
  ["When you pour into people this way, they don't just build a business. They become someone new. And loyalty like that, money can't buy.", 'S'],                                                                // 23
  // ---- THREAD 4: THE PAYOFF (money woven in) ----
  ["So what does this build? Four ways to earn at once. Direct commissions on what you sell. Overrides on what your team sells. Rank bonuses as you grow. And a share of company bonus pools.", 'fourstreams'],   // 24
  ["Picture it. You develop five leaders. They each develop five. That's thirty people — and you personally recruited only five.", 'mathteam'],                                                                   // 25
  ["With a team that size, all modestly active, a Silver leader can earn around seven hundred dollars a month — most of it from a team you led, not sold.", 'mathmoney'],                                          // 26
  ["And that's the modest picture. Because the system duplicates, it doesn't add — it multiplies. Your income grows even when you're not the one selling.", 'multiply'],                                          // 27
  // ---- CLOSE ----
  ["So here's the whole path. Cast a vision people want to belong to. Live the product. Get your three. Find your five. And develop them with real conversations.", 'S'],                                         // 28
  ["Build people, and the business builds itself. That's leadership. That's Apex. Now — go find your five.", 'S'],                                                                                                // 29
]

const SCENE_PROMPTS = {
  0: `${PAPER} A red paper leader figure standing tall in front of a growing navy paper crowd of small figures, choosing to build people, the path of a leader.`,
  1: `${PAPER} A warm cream paper glow surrounding a group of navy paper figures joined together reaching toward a bright paper star, belonging to something bigger.`,
  4: `${PAPER} A red paper figure planting a strong navy paper tree with deep paper roots made of small figures, a business built on people.`,
  6: `${PAPER} A large glowing cream paper number five beside a paper number three made of layered navy and red paper, a simple system.`,
  13: `${PAPER} A red paper rocket lifting off a navy paper launch pad into a cream sky, a launch pad not a limit.`,
  14: `${PAPER} A red paper figure looking thoughtfully at a lineup of diverse navy paper figures, searching for hidden leaders.`,
  17: `${PAPER} Two paper figures, one red one navy, sitting across a small paper table in warm conversation, a real conversation not a pitch.`,
  23: `${PAPER} A red paper mentor figure lifting a smaller navy paper figure up onto a paper pedestal, an ordinary person becoming a leader.`,
  28: `${PAPER} A red paper figure at the head of a large branching navy paper tree of many small figures, the whole path revealed.`,
  29: `${PAPER} A confident red paper leader figure walking forward into a bright cream sunrise with a navy paper team following, go find your five.`,
}

await generate({ dir: 'power53', beats: BEATS, scenePrompts: SCENE_PROMPTS,
  musicPrompt: 'Inspiring, warm, cinematic corporate underscore for a leadership film, emotional and uplifting, steady build, sits under narration, instrumental, long.' })
