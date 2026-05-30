/**
 * VPS: Switch from Gemini 3.1 Flash to Gemini 3 Pro Image
 * Better quality, better text, slightly more expensive but worth it.
 * Also improves cover prompts for more sophisticated designs.
 */
const fs = require('fs')
const serverPath = '/app/server.js'
let c = fs.readFileSync(serverPath, 'utf8')
let changes = 0

// Replace all gemini-3.1-flash-image with gemini-3-pro-image
const oldModel = 'gemini-3.1-flash-image'
const newModel = 'gemini-3-pro-image'
const count = (c.match(new RegExp(oldModel, 'g')) || []).length
if (count > 0) {
  c = c.replace(new RegExp(oldModel, 'g'), newModel)
  changes++
  console.log('1. Switched ' + count + ' instances from ' + oldModel + ' to ' + newModel)
} else {
  console.log('1. SKIP: ' + oldModel + ' not found')
}

// Also improve the cover background prompt
const oldCoverPrompt = "Create a stunning illustrated background for a video title card"
if (c.includes(oldCoverPrompt)) {
  c = c.replace(
    "Create a stunning illustrated background for a video title card. 1920x1080. ' + styleHint + ' Use brand colors: primary ' + brandColors.primary + ', secondary ' + brandColors.secondary + '. Center area should be clean/dark for logo placement. NO TEXT NO LOGOS. Pure artwork.'",
    "Create a premium, sophisticated video title card background. 1920x1080 landscape. Dynamic gradient background using brand colors primary ' + brandColors.primary + ' and secondary ' + brandColors.secondary + '. Include: layered translucent curved shapes creating depth, subtle glossy/reflective elements, soft glowing light effects from one corner, abstract flowing ribbons or waves. The design should feel luxurious and polished — like a Fortune 500 keynote opening. Clean center area for text overlay. NO TEXT NO LOGOS NO WORDS. Pure artwork.'"
  )
  changes++
  console.log('2. Improved cover background prompt')
} else {
  console.log('2. SKIP: cover prompt not found exactly')
}

// Improve closing background prompt
const oldClosingPrompt = "Create a stunning illustrated background for a video closing card"
if (c.includes(oldClosingPrompt)) {
  c = c.replace(
    "Create a stunning illustrated background for a video closing card. 1920x1080. ' + styleHint + ' Use brand colors: primary ' + brandColors.primary + ', secondary ' + brandColors.secondary + '. Center area clean for logo/contact overlay. Warm, inviting. NO TEXT NO LOGOS. Pure artwork.'",
    "Create a premium video closing card background. 1920x1080 landscape. Dynamic gradient using brand colors primary ' + brandColors.primary + ' and secondary ' + brandColors.secondary + '. Include: warm glowing light effects, layered translucent shapes, soft flowing elements suggesting completion and invitation. Mirror the cover slide aesthetic. Clean center for text overlay. NO TEXT NO LOGOS NO WORDS. Pure artwork.'"
  )
  changes++
  console.log('3. Improved closing background prompt')
} else {
  console.log('3. SKIP: closing prompt not found exactly')
}

if (changes > 0) {
  fs.writeFileSync(serverPath, c)
  console.log('\nDone! ' + changes + ' changes.')
} else {
  console.log('\nNo changes made.')
}
console.log('Run: docker restart docs2video-service')
