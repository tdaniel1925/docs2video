const fs = require('fs')
let code = fs.readFileSync('/tmp/server.js', 'utf8')

// Replace the Sharp logo composite with bigger logo + glow background
const old = `          // Composite actual logo on top with Sharp
          if (logoBase64) {
            try {
              const sharp = require('sharp')
              const logoBuf = Buffer.from(logoBase64, 'base64')
              const logoResized = await sharp(logoBuf)
                .resize(200, 120, { fit: 'inside', withoutEnlargement: true })
                .png()
                .toBuffer()
              const logoMeta = await sharp(logoResized).metadata()
              const lw = logoMeta.width || 200
              slideBuf = await sharp(slideBuf)
                .composite([{ input: logoResized, top: 40, left: 1920 - lw - 40 }])
                .png()
                .toBuffer()`

const replacement = `          // Composite actual logo on top with Sharp — with glow background
          if (logoBase64) {
            try {
              const sharp = require('sharp')
              const logoBuf = Buffer.from(logoBase64, 'base64')
              const logoResized = await sharp(logoBuf)
                .resize(280, 160, { fit: 'inside', withoutEnlargement: true })
                .png()
                .toBuffer()
              const logoMeta = await sharp(logoResized).metadata()
              const lw = logoMeta.width || 280
              const lh = logoMeta.height || 160
              // Create a semi-transparent glow/shadow behind the logo
              const glowPadding = 16
              const glowW = lw + glowPadding * 2
              const glowH = lh + glowPadding * 2
              const glowBg = await sharp({
                create: { width: glowW, height: glowH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.35 } }
              }).png().toBuffer()
              const logoWithGlow = await sharp(glowBg)
                .blur(8)
                .composite([{ input: logoResized, top: glowPadding, left: glowPadding }])
                .png()
                .toBuffer()
              slideBuf = await sharp(slideBuf)
                .composite([{ input: logoWithGlow, top: 24, left: 1920 - glowW - 24 }])
                .png()
                .toBuffer()`

if (code.includes('resize(200, 120')) {
  code = code.replace(old, replacement)
  console.log('SUCCESS: Bigger logo with glow')
} else if (code.includes('resize(140, 80')) {
  // Try old size
  code = code.replace(old.replace('200, 120', '140, 80').replace('lw || 200', 'lw || 140'), replacement)
  console.log('SUCCESS: Bigger logo with glow (from 140x80)')
} else {
  console.log('ERROR: Could not find logo composite block')
  // Show what's there
  const idx = code.indexOf('Composite actual logo')
  if (idx > -1) console.log('Found at:', code.slice(idx, idx + 200))
}

fs.writeFileSync('/tmp/server.js', code, 'utf8')
