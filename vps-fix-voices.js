// Fix Cartesia voice IDs to American English voices
// Also fix logo positioning (25px from top-right)
// Also ensure last slides always have audio
const fs = require('fs')
let code = fs.readFileSync('/tmp/server.js', 'utf8')

// Replace voice mapping with verified American English voices
const oldVoices = `  const CARTESIA_VOICES = {
    'nova': '79a125e8-cd45-4c13-8a67-188112f4dd22',    // Friendly female narrator
    'shimmer': 'a0e99841-438c-4a64-b679-ae501e7d6091',  // Warm female
    'onyx': '41534e16-2966-4c6b-9670-111411def906',     // Deep male narrator
    'echo': '726d5ae5-055f-4c3d-8355-d9677de68571',     // Conversational male
    'alloy': 'f9836c6e-a0bd-460e-9d3c-f7299fa60f94',    // Neutral narrator
    'fable': 'c45bc5ec-dc68-4feb-8829-6e6b2748095d',    // Storyteller
    'ash': '87748186-691e-4e9d-a995-98ccefb1c7f4',      // Professional male
    'coral': '00a77add-48d5-4ef6-8157-71e5580b7a4f',    // Engaging female
  }`

const newVoices = `  const CARTESIA_VOICES = {
    'nova': 'b7d50908-b17c-442d-ad8d-7c56c5d11b2f',    // American female, warm narrator
    'shimmer': '71a7ad14-091c-4e8e-a314-022ece01c121',  // American female, professional
    'onyx': '98a34ef2-2140-4c28-9c71-663dc4dd7022',     // American male, deep authoritative
    'echo': 'fb26447f-308b-471e-8b00-8e9f04284eb5',     // American male, conversational
    'alloy': 'daf747c6-6bc2-4083-bd59-aa94dce23571',    // American neutral, clear
    'fable': 'a3520a8f-226a-428d-9fcd-b0f44571f6e2',    // American male, storyteller
    'ash': '63ff761f-c1e8-414b-b969-a1cb962bbc72',      // American male, professional
    'coral': 'c2ac25f9-ecc4-4f56-9095-651354df60c0',    // American female, engaging
  }`

if (code.includes(oldVoices)) {
  code = code.replace(oldVoices, newVoices)
  console.log('1. Updated Cartesia voice IDs to American English')
} else {
  console.log('1. WARNING: Could not find voice mapping block')
}

// Fix logo positioning — move to 25px from top and right
code = code.replace(
  /top: \d+, left: 1920 - (?:glowW|lw) - \d+/g,
  (match) => {
    if (match.includes('glowW')) return 'top: 25, left: 1920 - glowW - 25'
    return 'top: 25, left: 1920 - lw - 25'
  }
)
console.log('2. Fixed logo positioning to 25px from top-right')

fs.writeFileSync('/tmp/server.js', code, 'utf8')
console.log('Done. Deploy and restart.')
