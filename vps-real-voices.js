const fs = require('fs')
let code = fs.readFileSync('/tmp/server.js', 'utf8')

// Replace ALL Cartesia voice ID mappings with verified real IDs
const oldPattern = /const CARTESIA_VOICES = \{[^}]+\}/
const newVoices = `const CARTESIA_VOICES = {
    'nova': 'f9fc912e-52f0-448a-8bfa-47e9ca75f25a',     // Marilyn - smooth supportive female narrator
    'shimmer': '58fbaf73-d7de-4e82-a6b3-118180e7057c',   // Janet - bright warm female
    'onyx': '8d110413-2f14-44a2-8203-2104db4340e9',      // Darren - deep friendly baritone male
    'echo': 'd46abd1d-2d02-43e8-819f-51fb652c1c61',      // Grant - reliable clear American male
    'alloy': 'cc00e582-ed66-4004-8336-0175b85c85f6',     // Dana - balanced neutral female
    'fable': 'ab109683-f31f-40d7-b264-9ec3e26fb85e',     // Russell - friendly deep mentor male
    'ash': '820a3788-2b37-4d21-847a-b65d8a68c99a',       // Tyler - direct confident male
    'coral': '829ccd10-f8b3-43cd-b8a0-4aeaa81f3b30',     // Linda - clear confident mature female
  }`

if (code.match(oldPattern)) {
  code = code.replace(oldPattern, newVoices)
  console.log('SUCCESS: Updated to verified Cartesia voice IDs')
} else {
  console.log('ERROR: Could not find CARTESIA_VOICES block')
}

fs.writeFileSync('/tmp/server.js', code, 'utf8')
