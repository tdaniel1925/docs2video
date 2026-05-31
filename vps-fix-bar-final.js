/**
 * VPS: Fix bottom bar — fully opaque, bold font, correct position.
 * Also update slide prompt instruction to leave bottom 100px empty.
 */
const fs = require('fs')
const serverPath = '/app/server.js'
let c = fs.readFileSync(serverPath, 'utf8')
let changes = 0

// Fix 1: Update bar drawbox to be fully opaque (no alpha) and use bold font
const oldBar = '@0.85:t=fill'
if (c.includes(oldBar)) {
  c = c.replace(oldBar, ':t=fill')
  changes++
  console.log('1. Made bar fully opaque (removed @0.85)')
}

const oldFont = 'DejaVuSans.ttf'
if (c.includes(oldFont)) {
  c = c.replace(new RegExp(oldFont, 'g'), 'DejaVuSans-Bold.ttf')
  changes++
  console.log('2. Changed to bold font (DejaVuSans-Bold)')
}

// Fix 3: Change bar height from 80 to 100 and adjust text position
const oldBarHeight = 'y=ih-80:w=iw:h=80'
if (c.includes(oldBarHeight)) {
  c = c.replace(oldBarHeight, 'y=ih-100:w=iw:h=100')
  changes++
  console.log('3. Changed bar height from 80 to 100px')
}

const oldTextY = ':y=h-50:'
if (c.includes(oldTextY)) {
  c = c.replace(oldTextY, ':y=h-55:')
  changes++
  console.log('4. Adjusted text y position for 100px bar')
}

// Fix 5: Increase font size slightly
const oldFontSize = 'fontsize=20'
if (c.includes(oldFontSize)) {
  c = c.replace(oldFontSize, 'fontsize=22')
  changes++
  console.log('5. Increased font size to 22')
}

if (changes > 0) {
  fs.writeFileSync(serverPath, c)
  console.log('\nDone! ' + changes + ' changes.')
} else {
  console.log('\nNo changes needed.')
}
console.log('Run: docker restart docs2video-service')
