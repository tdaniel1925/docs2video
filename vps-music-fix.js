// Fix: remove duplicate musicPublicUrl declaration
const fs = require('fs')
const path = '/app/server.js'

let code = fs.readFileSync(path, 'utf8')

// Count how many times musicPublicUrl is declared
const count = (code.match(/let musicPublicUrl = null/g) || []).length
console.log(`Found ${count} declarations of musicPublicUrl`)

if (count > 1) {
  // Remove all but the first occurrence
  let first = true
  code = code.replace(/\n\s*let musicPublicUrl = null/g, (match) => {
    if (first) { first = false; return match }
    return ''
  })
  fs.writeFileSync(path, code, 'utf8')
  console.log('Fixed: removed duplicate declaration')
} else if (count === 1) {
  console.log('Already correct - only one declaration')
} else {
  console.log('No declaration found - something else is wrong')
}
