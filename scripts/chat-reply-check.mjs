// Does the assistant ANSWER, or does it only extract fields?
//
//   node scripts/chat-reply-check.mjs
//
// The page is built to look like a conversation. It was not one: every message
// went to a field extractor that had to return design data or throw, so typing
// "all the slides look the same" produced a red box reading "no fields came
// back". A reasonable sentence got a developer's error message.
//
// The two failures this guards against:
//   1. a question or complaint returning no reply
//   2. a question SILENTLY REWRITING the design — answering "what does bleed
//      mean" by changing the customer's headline is worse than not answering
import fs from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

// Pull the live system prompt out of the route, so this tests what ships rather
// than a copy that drifts.
const route = fs.readFileSync('app/api/flyer-chat/route.ts', 'utf8')
const start = route.indexOf('const system = `')
const end = route.indexOf('`\n\n  const designs')
if (start < 0 || end < 0) { console.error('could not find the system prompt in the route'); process.exit(1) }
const system = route.slice(start + 'const system = `'.length, end)
  .replace(/\$\{FLYER_SIZES[^}]+\}/g, 'letter (Flyer 8.5x11), slide-16x9 (Slide 1920x1080)')
  .replace(/\$\{FLYER_TEMPLATES[^}]+\}/g, 'corporate (Corporate Event, business), rnb (R&B Night, nightlife)')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const FIELDS = { headline: 'Growth Summit', subhead: 'What it means for you', date: 'THURSDAY 12 SEPT' }

const CASES = [
  { msg: 'all of the slides say the same thing', why: 'a complaint', expectSameFields: true },
  { msg: 'what does bleed mean?', why: 'a question', expectSameFields: true },
  // This one returned 'not directly in this tool' and sent the customer to
  // Canva — logo upload had worked for months. Wrong answers about our own
  // features are worse than no answer.
  { msg: 'can I use my own logo?', why: 'a question', expectSameFields: true, mustMention: /upload|yes|you can|logo/i, mustNotMention: /canva|not directly|cannot|can't/i },
  { msg: 'change the date to Friday 20 September', why: 'a real change', expectSameFields: false },

  // THE ONE THAT BROKE. Asked for a way to choose, the assistant typed out
  // twenty-three formats with their pixel dimensions as a paragraph — because
  // words were the only thing it could return. It must open the picker instead,
  // and its reply must NOT be the list.
  {
    msg: 'can you offer me a way to select the files that I want to create',
    why: 'asking to choose', expectSameFields: true,
    mustShow: 'formats',
    mustNotMention: /1080|1200|2560|8\.5|11x17|\bflyer 8|numbered|1\.\s|2\.\s/i,
    maxReplyLength: 220,
  },
  {
    msg: 'what looks can I choose from?',
    why: 'asking to choose a style', expectSameFields: true,
    mustShow: 'styles',
  },
]

let bad = 0
for (const c of CASES) {
  const context = [
    `Current fields: ${JSON.stringify(FIELDS)}`,
    'Current size: slide-16x9   Current layout: corporate',
    'No designs made yet.',
    `user: ${c.msg}`,
  ].join('\n')

  const res = await client.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 1200, system,
    messages: [{ role: 'user', content: context }],
  })
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  const a = text.indexOf('{'), b = text.lastIndexOf('}')
  let out = {}
  try { out = JSON.parse(text.slice(a, b + 1)) } catch { /* prose only, which the route now keeps */ }

  const reply = String(out.reply ?? text).trim()
  const hasReply = reply.length > 3 && reply.toLowerCase() !== 'updated.'
  const same = JSON.stringify(out.fields ?? FIELDS) === JSON.stringify(FIELDS)

  console.log(`\n"${c.msg}"  (${c.why})`)
  console.log(`  reply: ${reply.slice(0, 150)}`)
  if (!hasReply) { console.log('  FAIL  no real answer'); bad++ } else console.log('  PASS  answered')

  if (c.mustShow) {
    if (out.show === c.mustShow) console.log(`  PASS  opened the ${c.mustShow} picker`)
    else { console.log(`  FAIL  should have opened "${c.mustShow}", got "${out.show ?? 'nothing'}"`); bad++ }
  }
  if (c.maxReplyLength) {
    const short = reply.length <= c.maxReplyLength
    if (short) console.log(`  PASS  reply is one line (${reply.length} chars)`)
    else { console.log(`  FAIL  reply is ${reply.length} chars — the picker should do the explaining`); bad++ }
  }
  if (c.mustMention && !c.mustMention.test(reply)) { console.log('  FAIL  did not say the feature exists'); bad++ }
  else if (c.mustMention) console.log('  PASS  described the real feature')
  if (c.mustNotMention && c.mustNotMention.test(reply)) { console.log('  FAIL  denied a feature we have'); bad++ }

  if (c.expectSameFields) {
    if (same) console.log('  PASS  left the design alone')
    else { console.log(`  FAIL  quietly changed the design to ${JSON.stringify(out.fields)}`); bad++ }
  } else {
    if (!same) console.log('  PASS  applied the change')
    else { console.log('  FAIL  ignored a real change'); bad++ }
  }
}

console.log(bad ? `\n${bad} problem(s)\n` : '\nthe chat talks back\n')
process.exit(bad ? 1 : 0)
