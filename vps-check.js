const c = require('fs').readFileSync('/app/server.js', 'utf8')
console.log('Has const brandName:', c.includes('const brandName'))
console.log('Has const brandColors:', c.includes('const brandColors'))
console.log('Has generateCoverSlide:', c.includes('generateCoverSlide'))
const idx = c.indexOf('const brandName')
if (idx > -1) console.log('brandName context:', c.substring(idx, idx + 80))
// Check if brandName is used BEFORE its definition
const firstUse = c.indexOf('brandName')
const firstDef = c.indexOf('const brandName')
console.log('First use at:', firstUse, 'First def at:', firstDef)
if (firstUse < firstDef) {
  console.log('BUG: brandName used before defined!')
  console.log('Used at:', c.substring(firstUse - 50, firstUse + 50))
}
