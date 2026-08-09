// Can a user's OWN photo go into the flyer instead of an invented person?
//
//   node scripts/flyer-photo-test.mjs
//
// Two things have to hold for this to be a real feature: the person must stay
// recognisably themselves, and the lettering must stay correct. Tested rather
// than assumed.
import { readFileSync, writeFileSync, existsSync } from 'fs'
import OpenAI from 'openai'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// A stand-in for "the photo the user uploaded". Generated once so the test is
// self-contained; what matters is whether the SAME face survives into the flyer.
if (!existsSync('photo-source.png')) {
  console.log('making a stand-in portrait to use as the upload…')
  const p = await ai.images.generate({
    model: 'gpt-image-2',
    prompt: 'Studio headshot photograph of a woman in her thirties with long dark curly hair, gold hoop earrings, a black blazer, neutral grey backdrop, professional lighting, looking at camera. No text.',
    size: '1024x1024', quality: 'high', n: 1,
  })
  writeFileSync('photo-source.png', Buffer.from(p.data[0].b64_json, 'base64'))
}

console.log('composing a flyer AROUND that photo…')
const { toFile } = await import('openai')
const res = await ai.images.edit({
  model: 'gpt-image-2',
  image: await toFile(readFileSync('photo-source.png'), 'photo.png', { type: 'image/png' }),
  prompt: `Design a professional nightclub event flyer, portrait poster format, print quality.

USE THE PERSON IN THE SUPPLIED PHOTOGRAPH as the headline act pictured on the flyer.
Keep her face, hair and features clearly recognisable and true to the photo — this is a
real person and she must still look like herself. Cut her out of the plain backdrop and
place her into the flyer artwork.

DESIGN STYLE: luxury R&B night. Black and gold, warm amber stage haze, gold light rays,
glamorous and expensive, glossy magazine finish.

TEXT TO RENDER — spell every word EXACTLY as written:
- Small line at top: "SATURDAY NIGHT"
- LARGE MAIN TITLE: "DJ SABLE"
- Under the title: "LIVE AT THE FOUNDRY"
- Date line: "SAT 23 AUGUST · DOORS 9PM"
- Price: "$20 COVER"
- Bottom bar: "TICKETS AT THE DOOR"

TYPOGRAPHY: main title in bold gold chrome 3D lettering with a reflective metallic finish.
Supporting text clean, high contrast, perfectly legible.

SAFE MARGINS — CRITICAL: leave a clear empty margin all round, at least 8% of the width on
the left and right and 6% of the height top and bottom. No text or face may touch any edge.`,
  size: '1024x1536', quality: 'high', n: 1,
})

writeFileSync('photo-flyer.png', Buffer.from(res.data[0].b64_json, 'base64'))
console.log('wrote photo-source.png and photo-flyer.png')
