/**
 * VPS: Fix covers — Gemini generates everything including text.
 * No more Sharp text overlay. Company name + title baked into the artwork.
 */
const fs = require('fs')
const serverPath = '/app/server.js'
let c = fs.readFileSync(serverPath, 'utf8')
let changes = 0

// Find and replace the entire generateCover function
const coverStart = c.indexOf('async function generateCover(type)')
if (coverStart === -1) { console.log('ERROR: generateCover not found'); process.exit(1) }

// Find the end — look for the next function or BATCH_SIZE
const coverEnd = c.indexOf('const BATCH_SIZE', coverStart)
if (coverEnd === -1) { console.log('ERROR: cannot find end of generateCover'); process.exit(1) }

const newCover = `async function generateCover(type) {
      const { GoogleGenAI } = require('@google/genai')
      const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
      const styleHint = typeof slidePrompts[0] === 'string' ? slidePrompts[0].slice(0, 200) : ''
      const companyText = (brandName || '').toUpperCase()
      const titleText = videoTitle || 'Professional Video Presentation'

      let coverPrompt = ''
      if (type === 'cover') {
        coverPrompt = styleHint + ' 1920x1080 landscape. This is a VIDEO COVER SLIDE — the opening frame of a premium professional video. Create a sophisticated design with: dynamic gradient background using brand colors primary ' + brandColors.primary + ' and secondary ' + brandColors.secondary + '. Include layered translucent shapes, soft glowing light effects, and flowing visual elements creating depth. Display this text exactly as written, large and centered: Company name "' + companyText + '" — large, bold, prominent. Title: "' + titleText + '" — medium size below company name. Subtitle: "A Personalized Video Presentation" — smaller, below title. Beautiful typography integrated into the artwork. The design should feel like a Fortune 500 keynote opening. No logos. No brand marks.'
      } else {
        const contactParts = []
        if (brandName) contactParts.push(brandName)
        if (contactForClosing.website) contactParts.push(contactForClosing.website)
        if (contactForClosing.phone) contactParts.push(contactForClosing.phone)
        if (contactForClosing.email) contactParts.push(contactForClosing.email)
        const contactStr = contactParts.join('  |  ')

        coverPrompt = styleHint + ' 1920x1080 landscape. This is a VIDEO CLOSING SLIDE — the final frame. Create a design matching the cover slide aesthetic with: dynamic gradient background using brand colors primary ' + brandColors.primary + ' and secondary ' + brandColors.secondary + '. Warm, inviting feel. Display this text exactly: "THANK YOU" — large, bold, centered. Below: "Ready to take the next step?" — medium. ' + (companyText ? 'Company: "' + companyText + '" — prominent.' : '') + (contactStr ? ' Contact info at bottom: "' + contactStr + '" — clean, readable.' : '') + ' Beautiful typography. No logos.'
      }

      try {
        const result = await genai.models.generateContent({
          model: 'gemini-3-pro-image',
          contents: 'Generate this image: ' + coverPrompt,
          config: { responseModalities: ['IMAGE', 'TEXT'] },
        })
        for (const part of result.candidates[0].content.parts) {
          if (part.inlineData) {
            const sharp = (await import('sharp')).default
            const buf = Buffer.from(part.inlineData.data, 'base64')
            return sharp(buf).resize(1920, 1080, { fit: 'cover' }).png().toBuffer()
          }
        }
        throw new Error('No image in response')
      } catch (e) {
        console.error('[' + videoId + '] Cover gen failed:', e.message?.slice(0, 80))
        // Fallback: generate a simple solid color cover
        const sharp = (await import('sharp')).default
        return sharp({ create: { width: 1920, height: 1080, channels: 3, background: brandColors.primary || '#1B365D' } }).png().toBuffer()
      }
    }

    `

c = c.substring(0, coverStart) + newCover + c.substring(coverEnd)
changes++
console.log('1. Replaced generateCover — all Gemini, no Sharp text')

fs.writeFileSync(serverPath, c)
console.log('Done! ' + changes + ' changes. Restart: docker restart docs2video-service')
