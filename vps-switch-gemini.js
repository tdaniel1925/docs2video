/**
 * VPS: Switch image generation from OpenAI gpt-image-2 to Gemini 3.1 Flash
 *
 * Replaces the generateOneSlide function and cover generation to use
 * Gemini 3.1 Flash Image instead of OpenAI. 75% cheaper per image.
 *
 * Also removes logo from covers — uses company name text only.
 */
const fs = require('fs')
const serverPath = '/app/server.js'
let c = fs.readFileSync(serverPath, 'utf8')
let changes = 0

// PATCH 1: Replace generateOneSlide to use Gemini 3.1 Flash
const oldGenSlide = 'async function generateOneSlide(idx) {'
const genSlideIdx = c.indexOf(oldGenSlide)
if (genSlideIdx === -1) { console.log('ERROR: generateOneSlide not found'); process.exit(1) }

// Find the end of generateOneSlide — it ends with a closing brace before generateCover or BATCH_SIZE
const genSlideEnd = c.indexOf('async function generateCover', genSlideIdx)
const altEnd = c.indexOf('const BATCH_SIZE', genSlideIdx)
const endIdx = genSlideEnd > -1 ? genSlideEnd : altEnd
if (endIdx === -1) { console.log('ERROR: cannot find end of generateOneSlide'); process.exit(1) }

const newGenSlide = `async function generateOneSlide(idx) {
      const prompt = slidePrompts[idx]
      const promptText = typeof prompt === 'string' ? prompt : prompt[0]
      const { GoogleGenAI } = require('@google/genai')
      const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const result = await genai.models.generateContent({
            model: 'gemini-3.1-flash-image',
            contents: 'Generate this image: ' + promptText,
            config: { responseModalities: ['IMAGE', 'TEXT'] },
          })
          for (const part of result.candidates[0].content.parts) {
            if (part.inlineData) {
              return Buffer.from(part.inlineData.data, 'base64')
            }
          }
          throw new Error('No image in response')
        } catch (e) {
          console.error('[' + videoId + '] Slide ' + (idx+1) + ' attempt ' + attempt + ' (Gemini):', (e.message || '').slice(0, 80))
          if (attempt === 2) return await generateFallbackSlide(scenes[idx]?.title || 'Slide', idx + 1, slidePrompts.length)
          await new Promise(r => setTimeout(r, 2000))
        }
      }
    }

    `

c = c.substring(0, genSlideIdx) + newGenSlide + c.substring(endIdx)
changes++
console.log('1. Replaced generateOneSlide with Gemini 3.1 Flash')

// PATCH 2: Replace generateCover to use Gemini + no logo (text only)
const oldGenCover = 'async function generateCover(type) {'
const genCoverIdx = c.indexOf(oldGenCover)
if (genCoverIdx === -1) { console.log('2. SKIP: generateCover not found'); }
else {
  // Find end of generateCover
  const coverEnd = c.indexOf('const BATCH_SIZE', genCoverIdx)
  if (coverEnd === -1) { console.log('2. SKIP: cannot find end of generateCover'); }
  else {
    const newGenCover = `async function generateCover(type) {
      const sharp = (await import('sharp')).default
      const { GoogleGenAI } = require('@google/genai')
      const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

      const styleHint = typeof slidePrompts[0] === 'string' ? slidePrompts[0].slice(0, 200) : ''
      const bgPrompt = type === 'cover'
        ? 'Create a stunning illustrated background for a video title card. 1920x1080 landscape. ' + styleHint + ' Use brand colors: primary ' + brandColors.primary + ', secondary ' + brandColors.secondary + '. Full canvas artwork, dramatic and cinematic. NO TEXT NO LOGOS NO WORDS.'
        : 'Create a stunning illustrated background for a video closing card. 1920x1080 landscape. ' + styleHint + ' Use brand colors: primary ' + brandColors.primary + ', secondary ' + brandColors.secondary + '. Warm, inviting, hopeful. Full canvas artwork. NO TEXT NO LOGOS NO WORDS.'

      let bgBuf = null
      try {
        const result = await genai.models.generateContent({
          model: 'gemini-3.1-flash-image',
          contents: 'Generate this image: ' + bgPrompt,
          config: { responseModalities: ['IMAGE', 'TEXT'] },
        })
        for (const part of result.candidates[0].content.parts) {
          if (part.inlineData) {
            bgBuf = Buffer.from(part.inlineData.data, 'base64')
            break
          }
        }
      } catch (e) {
        console.error('[' + videoId + '] Cover bg failed (Gemini):', e.message?.slice(0, 80))
      }

      if (!bgBuf) {
        // Fallback: solid brand color background
        bgBuf = await sharp({ create: { width: 1920, height: 1080, channels: 3, background: brandColors.primary || '#1B365D' } }).png().toBuffer()
      } else {
        bgBuf = await sharp(bgBuf).resize(1920, 1080, { fit: 'cover' }).png().toBuffer()
      }

      // Text-only cover — no logo, just company name + title
      const companyText = (brandName || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const titleText = (videoTitle || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

      let svgParts = ''
      if (type === 'cover') {
        svgParts += '<text x="960" y="420" font-family="Arial,sans-serif" font-size="52" font-weight="900" fill="white" text-anchor="middle" letter-spacing="2">' + companyText.toUpperCase() + '</text>'
        svgParts += '<rect x="760" y="445" width="400" height="3" fill="white" opacity="0.5"/>'
        svgParts += '<text x="960" y="500" font-family="Arial,sans-serif" font-size="28" font-weight="600" fill="white" opacity="0.85" text-anchor="middle">' + titleText + '</text>'
      } else {
        svgParts += '<text x="960" y="380" font-family="Arial,sans-serif" font-size="52" font-weight="900" fill="white" text-anchor="middle">THANK YOU</text>'
        svgParts += '<text x="960" y="440" font-family="Arial,sans-serif" font-size="24" font-weight="600" fill="white" opacity="0.8" text-anchor="middle">Ready to take the next step?</text>'
        if (companyText) {
          svgParts += '<text x="960" y="520" font-family="Arial,sans-serif" font-size="32" font-weight="700" fill="white" text-anchor="middle">' + companyText + '</text>'
        }
        const cp = [contactForClosing.website, contactForClosing.phone, contactForClosing.email].filter(Boolean)
        if (cp.length > 0) {
          const cs = cp.join('  \\u00B7  ').replace(/&/g, '&amp;').replace(/</g, '&lt;')
          svgParts += '<rect x="360" y="560" width="1200" height="40" rx="6" fill="rgba(255,255,255,0.1)"/>'
          svgParts += '<text x="960" y="585" font-family="Arial,sans-serif" font-size="18" font-weight="500" fill="white" opacity="0.7" text-anchor="middle">' + cs + '</text>'
        }
      }

      const textOverlay = Buffer.from('<svg width="1920" height="1080">' + svgParts + '</svg>')
      return sharp(bgBuf).composite([{ input: textOverlay, top: 0, left: 0 }]).png().toBuffer()
    }

    `

    c = c.substring(0, genCoverIdx) + newGenCover + c.substring(coverEnd)
    changes++
    console.log('2. Replaced generateCover with Gemini + text-only (no logo)')
  }
}

fs.writeFileSync(serverPath, c)
console.log('\\nDone! ' + changes + ' changes. Restart: docker restart docs2video-service')
