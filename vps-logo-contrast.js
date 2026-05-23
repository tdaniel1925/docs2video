// VPS patch: Make logo glow contrast with logo brightness
const fs = require('fs')
let code = fs.readFileSync('/tmp/server.js', 'utf8')

const oldGlow = `              // Create a semi-transparent glow/shadow behind the logo
              const glowPadding = 16
              const glowW = lw + glowPadding * 2
              const glowH = lh + glowPadding * 2
              const glowBg = await sharp({
                create: { width: glowW, height: glowH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.35 } }
              }).png().toBuffer()`

const newGlow = `              // Detect logo brightness and create contrasting glow
              const logoStats = await sharp(logoResized).stats()
              const logoBrightness = (logoStats.dominant.r * 299 + logoStats.dominant.g * 587 + logoStats.dominant.b * 114) / 1000
              const glowPadding = 16
              const glowW = lw + glowPadding * 2
              const glowH = lh + glowPadding * 2
              // Light logo = dark glow, dark logo = light glow
              const glowR = logoBrightness > 128 ? 0 : 255
              const glowG = logoBrightness > 128 ? 0 : 255
              const glowB = logoBrightness > 128 ? 0 : 255
              const glowBg = await sharp({
                create: { width: glowW, height: glowH, channels: 4, background: { r: glowR, g: glowG, b: glowB, alpha: 0.4 } }
              }).png().toBuffer()`

if (code.includes('Create a semi-transparent glow')) {
  code = code.replace(oldGlow, newGlow)
  console.log('SUCCESS: Logo glow now adapts to logo brightness')
} else {
  console.log('ERROR: Could not find glow block')
}

fs.writeFileSync('/tmp/server.js', code, 'utf8')
