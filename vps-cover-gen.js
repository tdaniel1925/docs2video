/**
 * VPS: Generate cover + closing slides on VPS
 *
 * Adds a generateCoverSlide function and calls it for the first and last slides
 * instead of using the normal AI image generation prompts.
 *
 * Uses OpenAI gpt-image-2 for background + Sharp for logo/text composite.
 */
const fs = require('fs')
const serverPath = '/app/server.js'
let c = fs.readFileSync(serverPath, 'utf8')
let changes = 0

// PATCH 1: Add the generateCoverSlide function before the generate handler
const pipelineMarker = '// FULL PIPELINE'
const pipelineIdx = c.indexOf(pipelineMarker)

if (pipelineIdx === -1) {
  // Try alternate
  const alt = 'FULL PIPELINE:'
  const altIdx = c.indexOf(alt)
  if (altIdx === -1) {
    console.log('ERROR: Could not find pipeline marker')
    process.exit(1)
  }
}

// Find a good insertion point — before the generate route handler
// Insert the cover generation function
const coverFn = `
// --- COVER SLIDE GENERATION ---
async function generateCoverSlide(opts) {
  const { title, companyName, logoUrl, brandColors, stylePrompt, type, contactInfo } = opts
  const OpenAI = (await import('openai')).default
  const sharp = (await import('sharp')).default
  const oi = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const bgPrompt = type === 'cover'
    ? 'Create a stunning vibrant illustrated background for a premium video title card. 1920x1080 landscape. ' + (stylePrompt || '') + ' Use brand colors prominently: primary ' + (brandColors?.primary || '#1B365D') + ', secondary ' + (brandColors?.secondary || '#4A90D9') + '. Rich depth, layered composition, dramatic lighting. Abstract shapes and visual metaphors. The CENTER should have lighter/clearer space for a logo. NO TEXT NO LOGOS NO WORDS. Pure illustrated artwork.'
    : 'Create a stunning illustrated background for a video closing card. 1920x1080 landscape. ' + (stylePrompt || '') + ' Use brand colors: primary ' + (brandColors?.primary || '#1B365D') + ', secondary ' + (brandColors?.secondary || '#4A90D9') + '. Warm hopeful conclusion — open door with warm light, path to bright horizon. CENTER should have clear space for logo and contact info. NO TEXT NO LOGOS NO WORDS. Pure illustrated artwork.'

  const bgRes = await oi.images.generate({ model: 'gpt-image-2', prompt: bgPrompt, size: '1536x1024', quality: 'high', n: 1 })
  let bgBuf = Buffer.from(bgRes.data[0].b64_json, 'base64')
  bgBuf = await sharp(bgBuf).resize(1920, 1080, { fit: 'cover' }).png().toBuffer()

  const composites = []

  // Load logo if available
  let logoH = 0
  let logoTop = 340
  if (logoUrl) {
    try {
      let logoBuf = null
      if (logoUrl.startsWith('data:')) {
        logoBuf = Buffer.from(logoUrl.split(',')[1], 'base64')
      } else {
        const logoRes = await fetch(logoUrl, { signal: AbortSignal.timeout(10000) })
        if (logoRes.ok) logoBuf = Buffer.from(await logoRes.arrayBuffer())
      }
      if (logoBuf) {
        const resized = await sharp(logoBuf).resize(550, null, { fit: 'inside' }).png().toBuffer()
        const meta = await sharp(resized).metadata()
        const lw = meta.width || 550
        logoH = meta.height || 220
        logoTop = type === 'cover' ? Math.round((1080 - logoH) / 2) - 60 : Math.round((1080 - logoH) / 2) - 80

        // Shadow behind logo for contrast
        const shadow = Buffer.from('<svg width="' + (lw + 80) + '" height="' + (logoH + 60) + '"><defs><filter id="b"><feGaussianBlur stdDeviation="20"/></filter></defs><rect x="10" y="10" width="' + (lw + 60) + '" height="' + (logoH + 40) + '" rx="20" fill="rgba(0,0,0,0.4)" filter="url(#b)"/></svg>')
        composites.push({ input: shadow, top: logoTop - 20, left: Math.round((1920 - lw) / 2) - 40 })
        composites.push({ input: resized, top: logoTop, left: Math.round((1920 - lw) / 2) })
      }
    } catch (e) { console.log('[cover] Logo load failed:', e.message?.slice(0, 80)) }
  }

  // Title/text overlay
  const textY = logoUrl && logoH > 0 ? logoTop + logoH + 50 : 420
  const safeTitle = (title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const safeName = (companyName || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  let svgText = ''
  if (type === 'cover') {
    svgText = '<svg width="1920" height="1080"><text x="960" y="' + textY + '" font-family="Arial,sans-serif" font-size="38" font-weight="800" fill="white" text-anchor="middle" letter-spacing="1">' + safeTitle + '</text>'
    if (companyName && !logoUrl) {
      svgText += '<text x="960" y="' + (textY + 50) + '" font-family="Arial,sans-serif" font-size="26" font-weight="600" fill="white" opacity="0.85" text-anchor="middle">' + safeName + '</text>'
    }
    svgText += '</svg>'
  } else {
    const contactParts = []
    if (companyName) contactParts.push(companyName)
    if (contactInfo?.website) contactParts.push(contactInfo.website)
    if (contactInfo?.phone) contactParts.push(contactInfo.phone)
    if (contactInfo?.email) contactParts.push(contactInfo.email)
    const contactStr = contactParts.join('  \\u00B7  ').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    svgText = '<svg width="1920" height="1080"><text x="960" y="' + textY + '" font-family="Arial,sans-serif" font-size="44" font-weight="800" fill="white" text-anchor="middle">Thank You</text><text x="960" y="' + (textY + 55) + '" font-family="Arial,sans-serif" font-size="24" font-weight="700" fill="white" opacity="0.9" text-anchor="middle">Ready to take the next step?</text>'
    if (contactStr) {
      svgText += '<rect x="360" y="' + (textY + 80) + '" width="1200" height="50" rx="8" fill="rgba(0,0,0,0.3)"/><text x="960" y="' + (textY + 112) + '" font-family="Arial,sans-serif" font-size="20" font-weight="600" fill="white" opacity="0.8" text-anchor="middle">' + contactStr + '</text>'
    }
    svgText += '</svg>'
  }
  composites.push({ input: Buffer.from(svgText), top: 0, left: 0 })

  return sharp(bgBuf).composite(composites).png().toBuffer()
}
// --- END COVER SLIDE GENERATION ---

`

// Insert the function before the first occurrence of 'app.post'
const appPostIdx = c.indexOf("app.post('/generate'")
if (appPostIdx === -1) {
  // Try finding the route handler differently
  const routeIdx = c.indexOf("'/generate'")
  if (routeIdx > -1) {
    const insertIdx = c.lastIndexOf('\n', routeIdx - 50)
    c = c.slice(0, insertIdx) + coverFn + c.slice(insertIdx)
    changes++
    console.log('1. Added generateCoverSlide function')
  } else {
    console.log('1. SKIP: Could not find /generate route')
  }
} else {
  const insertIdx = c.lastIndexOf('\n', appPostIdx)
  c = c.slice(0, insertIdx) + coverFn + c.slice(insertIdx)
  changes++
  console.log('1. Added generateCoverSlide function')
}

// PATCH 2: Call generateCoverSlide for first and last slides
// In the batch loop, replace the cover/closing bypass with actual generation
const coverBypass = "(j === 0 && coverImageBase64) ? Promise.resolve(Buffer.from(coverImageBase64, 'base64')) : (j === slidePrompts.length - 1 && closingImageBase64) ? Promise.resolve(Buffer.from(closingImageBase64, 'base64')) :"
if (c.includes(coverBypass)) {
  const newBypass = `(j === 0) ? generateCoverSlide({ title: req.body.videoTitle || scenes[0]?.title || 'Presentation', companyName: brandName, logoUrl: req.body.logoUrl, brandColors, stylePrompt: slidePrompts[0]?.slice(0, 200) || '', type: 'cover' }) : (j === slidePrompts.length - 1) ? generateCoverSlide({ title: req.body.videoTitle || 'Thank You', companyName: brandName, logoUrl: req.body.logoUrl, brandColors, stylePrompt: slidePrompts[0]?.slice(0, 200) || '', type: 'closing', contactInfo: req.body.contactForClosing }) :`
  c = c.replace(coverBypass, newBypass)
  changes++
  console.log('2. Updated batch loop to generate cover/closing on VPS')
} else {
  console.log('2. SKIP: cover bypass pattern not found')
  // Check what the batch loop looks like
  const batchIdx = c.indexOf('batch.push(')
  if (batchIdx > -1) {
    console.log('2. Batch context:', c.substring(batchIdx, batchIdx + 200))
  }
}

if (changes > 0) {
  fs.writeFileSync(serverPath, c)
  console.log('\nDone! ' + changes + ' fixes applied.')
} else {
  console.log('\nNo changes made.')
}
console.log('Run: docker restart docs2video-service')
