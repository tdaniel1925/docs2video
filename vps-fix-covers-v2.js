/**
 * Fix covers v2:
 * 1. Sanitize styleHint to remove carrier/product names
 * 2. Make cover work even when brandName is empty
 * 3. Use videoTitle as fallback for cover text
 */
const fs = require('fs')
const serverPath = '/app/server.js'
let c = fs.readFileSync(serverPath, 'utf8')

// Find generateCover
const coverStart = c.indexOf('async function generateCover(type)')
if (coverStart === -1) { console.log('ERROR: generateCover not found'); process.exit(1) }

const coverEnd = c.indexOf('const BATCH_SIZE', coverStart)
if (coverEnd === -1) { console.log('ERROR: end not found'); process.exit(1) }

const newCover = `async function generateCover(type) {
      const { GoogleGenAI } = require('@google/genai')
      const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

      // Sanitize style hint — remove carrier/product names that might leak
      let styleHint = typeof slidePrompts[0] === 'string' ? slidePrompts[0].slice(0, 200) : ''
      // Strip common insurance product/carrier patterns
      for (const scene of scenes) {
        if (scene.title) styleHint = styleHint.replace(new RegExp(scene.title.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'gi'), '')
      }
      // Remove anything that looks like a product name (words with + or roman numerals)
      styleHint = styleHint.replace(/[A-Z][a-zA-Z]+\\s*(\\+|Plus|Pro|Max|Ultra|III|II|IV|V)\\b/g, '')
      styleHint = styleHint.replace(/\\s{2,}/g, ' ').trim()

      const companyText = brandName || videoTitle || 'Professional Presentation'
      const titleText = videoTitle || 'Video Presentation'

      let coverPrompt = ''
      if (type === 'cover') {
        coverPrompt = 'Create a premium, sophisticated video title card. 1920x1080 landscape. ' + styleHint + ' Dynamic gradient background using brand colors primary ' + brandColors.primary + ' and secondary ' + brandColors.secondary + '. Include: layered translucent shapes creating depth, glossy elements, soft glowing light effects, flowing visual accents. Display this text EXACTLY as written, large and centered — this is critical: Company name: "' + companyText.toUpperCase() + '" in large bold prominent text. Below that: "' + titleText + '" in medium text. Below that: "A Personalized Video Presentation" in smaller text. The text MUST be readable and prominent — it is the main focus of this slide. Design should feel like a Fortune 500 keynote opening. No logos. No brand marks.'
      } else {
        const contactParts = []
        if (brandName) contactParts.push(brandName)
        if (contactForClosing.website) contactParts.push(contactForClosing.website)
        if (contactForClosing.phone) contactParts.push(contactForClosing.phone)
        if (contactForClosing.email) contactParts.push(contactForClosing.email)
        const contactStr = contactParts.join('  |  ')

        coverPrompt = 'Create a premium video closing card. 1920x1080 landscape. ' + styleHint + ' Dynamic gradient using brand colors primary ' + brandColors.primary + ' and secondary ' + brandColors.secondary + '. Warm, inviting. Display this text EXACTLY: "THANK YOU" large and bold centered. Below: "Ready to take the next step?" medium. ' + (companyText !== 'Professional Presentation' ? 'Company: "' + companyText.toUpperCase() + '" prominent. ' : '') + (contactStr ? 'Contact: "' + contactStr + '" at bottom, clean readable. ' : '') + 'Beautiful typography. No logos.'
      }

      console.log('[' + videoId + '] Cover type=' + type + ', company="' + companyText + '", title="' + titleText + '"')

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
        console.error('[' + videoId + '] Cover failed:', e.message?.slice(0, 80))
        const sharp = (await import('sharp')).default
        return sharp({ create: { width: 1920, height: 1080, channels: 3, background: brandColors.primary || '#1B365D' } }).png().toBuffer()
      }
    }

    `

c = c.substring(0, coverStart) + newCover + c.substring(coverEnd)
fs.writeFileSync(serverPath, c)
console.log('Fixed generateCover — sanitized hints, robust text, logging added')
console.log('Restart: docker restart docs2video-service')
