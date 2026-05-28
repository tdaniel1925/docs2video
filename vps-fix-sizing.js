/**
 * Fix: Wrong video size + double bars
 *
 * Problem: Images generated at 1536x1024, scaled to 1920x980, then padded
 * to 1920x1080 with a bar — creating double bars and wrong sizing.
 *
 * Solution:
 * 1. Generate images at 1536x1024 (OpenAI's closest to 16:9)
 * 2. Scale to 1920x1080 (full HD, no padding gap)
 * 3. Overlay bar ON TOP of the bottom 100px (not pad extra space)
 */
const fs = require('fs')
let c = fs.readFileSync('/app/server.js', 'utf8')
let changes = 0

// Fix 1: Change the vf filter from 1920:980 back to 1920:1080
// The 980 height was creating the gap for the bar, but we want the bar
// overlaid on top of the image instead
const old980 = "scale=1920:980:force_original_aspect_ratio=decrease,pad=1920:980:(ow-iw)/2:(oh-ih)/2"
while (c.includes(old980)) {
  c = c.replace(old980, "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2")
  changes++
}
if (changes > 0) {
  console.log('1. Fixed video filter: 1920x1080 (was 1920x980) — ' + changes + ' instances')
  changes = 1 // count as one fix
} else {
  console.log('1. SKIP: 1920:980 filter not found')
}

// Fix 2: Fix the bar compositing to overlay on top of the image
// Instead of padding to 1080 and adding bar below, draw bar directly
// on the bottom 100px of the existing 1080p video
const oldBarFilter = /pad=1920:1080:0:0:color=[^,]+,drawtext/g
const oldBarPad = 'pad=1920:1080:0:0:color='
if (c.includes(oldBarPad)) {
  // The current bar code pads video from 980 to 1080 with a colored bar,
  // then draws text. Since we're now at 1080 already, change to:
  // Draw a colored rectangle at the bottom + text overlay
  const oldBarSection = /\[0:v\]pad=1920:1080:0:0:color=([^,]+),drawtext=text='([^']*?)':fontsize=(\d+):fontcolor=([^:]+):x=\(w-text_w\)\/2:y=(\d+):fontfile=([^\[]+)\[v\]/
  const match = c.match(oldBarSection)
  if (match) {
    const [full, barColor, barText, fontSize, fontColor, yPos, fontFile] = match
    // Replace with: drawbox for background + drawtext for content
    const newFilter = `[0:v]drawbox=x=0:y=ih-100:w=iw:h=100:color=${barColor}:t=fill,drawtext=text='${barText}':fontsize=${fontSize}:fontcolor=${fontColor}:x=(w-text_w)/2:y=h-60:fontfile=${fontFile}[v]`
    c = c.replace(full, newFilter)
    changes++
    console.log('2. Fixed bar overlay: drawbox on bottom 100px instead of pad')
  } else {
    console.log('2. SKIP: bar filter regex did not match')
    // Try simpler approach — just fix the y position and remove pad
    // Since video is already 1080, just remove the pad operation
    console.log('2. Attempting simple pad removal...')
    if (c.includes('pad=1920:1080:0:0')) {
      c = c.replace(/pad=1920:1080:0:0:color=[^,]+,/g, '')
      changes++
      console.log('2. Removed pad operation — drawtext will overlay directly on 1080p')
    }
  }
} else {
  console.log('2. SKIP: bar pad pattern not found')
}

// Fix 3: Fix the drawtext y position — should be at h-60 (center of bottom 100px)
// Currently at y=990 which was for the 980+pad layout
const oldY990 = ':y=990:'
if (c.includes(oldY990)) {
  while (c.includes(oldY990)) {
    c = c.replace(oldY990, ':y=h-60:')
  }
  changes++
  console.log('3. Fixed drawtext y position to h-60 (center of bottom 100px)')
} else {
  console.log('3. SKIP: y=990 not found')
}

if (changes > 0) {
  fs.writeFileSync('/app/server.js', c)
  console.log('\nDone! ' + changes + ' fixes applied.')
} else {
  console.log('\nNo changes made.')
}
console.log('Run: docker restart docs2video-service')
