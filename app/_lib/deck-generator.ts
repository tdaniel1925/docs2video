/**
 * Generates PPTX files with AI-generated backgrounds + editable text.
 * Takes a deck plan (from deck-planner) and template reference images,
 * generates each slide, and assembles into a downloadable PPTX.
 */

import PptxGenJS from 'pptxgenjs'
import { GoogleGenAI } from '@google/genai'
import type { PlannedSlide } from './deck-planner'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export interface DeckGeneratorOptions {
  brandName: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  logoBuffer?: Buffer | null
  contactInfo?: { phone?: string; website?: string }
  templateImages?: Buffer[]
  /** Style direction from the slide-engine template library (getStylePrompt) */
  stylePrompt?: string
}

export async function generateDeck(
  plan: { deckTitle: string; slides: PlannedSlide[] },
  options: DeckGeneratorOptions,
  onProgress?: (pct: number) => Promise<void>,
): Promise<Buffer> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'Docs2Video'
  pptx.company = options.brandName
  pptx.title = plan.deckTitle

  const total = plan.slides.length

  for (let i = 0; i < total; i++) {
    const slide = plan.slides[i]
    const pptxSlide = pptx.addSlide()

    // Get template reference image if available
    const refImage = options.templateImages?.[slide.templateLayoutIndex]

    // Generate background with Gemini
    let bgBuffer: Buffer | null = null
    try {
      const bgPrompt = `Create a 1920x1080 editorial infographic background illustration. 16:9 aspect ratio.

This is a BACKGROUND ONLY — no text will be rendered. Text is overlaid in PowerPoint.
${refImage ? 'Match the visual style, layout feel, and design aesthetic of the attached reference slide.' : ''}
${options.stylePrompt ? `\nSTYLE DIRECTION:\n${options.stylePrompt}\n` : ''}

SLIDE PURPOSE: ${slide.layoutType} slide
TOPIC: "${slide.content.headline}"

WHAT TO CREATE:
- Beautiful abstract geometric shapes, patterns, gradients matching brand colors
- Subtle decorative elements related to the topic
- Professional editorial-quality design with depth and layering
${slide.layoutType === 'title' ? '- Grand, impactful design with clear center area for headline text' : ''}
${slide.layoutType === 'data-grid' || slide.layoutType === 'two-column' ? '- Clean structured layout with clear content zones' : ''}
${slide.layoutType === 'full-image' ? '- Rich illustrative background related to the topic' : ''}
${slide.layoutType === 'closing' ? '- Warm, inviting design with clear center for CTA text' : ''}

CLEAR ZONES (leave readable for text overlay):
- Top 15%: headline area
- Center 60%: body content area
- Bottom 80px: contact bar area

COLOR PALETTE:
- Primary: ${options.primaryColor} (dominant, 50%)
- Secondary: ${options.secondaryColor} (supporting, 35%)
- Accent: ${options.accentColor} (highlights, 15%)

CRITICAL:
- NO text of any kind — no headlines, labels, numbers, words, letters
- NO logos, brand marks, or company names
- Pure visual background design only
- Make it beautiful, modern, magazine-quality`

      const parts: any[] = [{ text: bgPrompt }]
      if (refImage) {
        parts.push({ inlineData: { mimeType: 'image/png', data: refImage.toString('base64') } })
      }

      const response = await genai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: [{ role: 'user', parts }],
        config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '2K' } } } as any,
      })

      const responseParts = response.candidates?.[0]?.content?.parts ?? []
      for (const rp of responseParts) {
        if (rp.inlineData) {
          bgBuffer = Buffer.from(rp.inlineData.data!, 'base64')
          break
        }
      }
    } catch (err) {
      console.error(`[deck-gen] Background ${i + 1} failed:`, err)
    }

    // Fallback: plain gradient background
    if (!bgBuffer) {
      const sharpMod = await import('sharp')
      const sharp = sharpMod.default ?? sharpMod
      bgBuffer = await sharp({
        create: { width: 1920, height: 1080, channels: 4, background: { r: 240, g: 244, b: 248, alpha: 1 } },
      }).png().toBuffer()
    }

    // Set background
    pptxSlide.background = { data: `image/png;base64,${bgBuffer.toString('base64')}` }

    // Generate content image if needed
    if (slide.content.imagePrompt) {
      try {
        const imgResponse = await genai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: [{ role: 'user', parts: [{ text: `Create a clean illustration: ${slide.content.imagePrompt}. Style: flat editorial, no text, brand colors ${options.primaryColor} ${options.secondaryColor} ${options.accentColor}. 640x480 pixels.` }] }],
          config: { responseFormat: { image: { aspectRatio: '4:3', imageSize: '1024' } } } as any,
        })
        const imgParts = imgResponse.candidates?.[0]?.content?.parts ?? []
        for (const rp of imgParts) {
          if (rp.inlineData) {
            pptxSlide.addImage({
              data: `image/png;base64,${rp.inlineData.data}`,
              x: 7.5, y: 1.5, w: 5.0, h: 3.75,
              sizing: { type: 'contain', w: 5.0, h: 3.75 },
            })
            break
          }
        }
      } catch { /* skip content image */ }
    }

    // Add editable text boxes
    const c = slide.content
    const pc = options.primaryColor.replace('#', '')
    const isTitle = slide.layoutType === 'title' || i === 0
    const isClosing = slide.layoutType === 'closing' || i === total - 1

    // Headline
    pptxSlide.addText(c.headline, {
      x: isTitle ? 1.5 : 0.8, y: isTitle ? 2.0 : 0.4,
      w: isTitle ? 10.3 : 11.7, h: isTitle ? 1.5 : 0.9,
      fontSize: isTitle ? 36 : 28,
      fontFace: 'Arial',
      color: pc,
      bold: true,
      align: isTitle ? 'center' : 'left',
      valign: 'middle',
    })

    // Subheadline
    if (c.subheadline) {
      pptxSlide.addText(c.subheadline, {
        x: isTitle ? 2.0 : 0.8, y: isTitle ? 3.5 : 1.3,
        w: isTitle ? 9.3 : 11.7, h: 0.6,
        fontSize: isTitle ? 18 : 16,
        fontFace: 'Arial',
        color: '666666',
        align: isTitle ? 'center' : 'left',
      })
    }

    // Body blocks
    if (c.bodyBlocks.length > 0 && !isTitle) {
      const rows = c.bodyBlocks.map(point => ({
        text: point,
        options: { fontSize: 15, fontFace: 'Arial', color: '333333', bullet: { type: 'bullet' as const }, paraSpaceAfter: 8 },
      }))
      pptxSlide.addText(rows, {
        x: 0.8, y: c.subheadline ? 2.0 : 1.5,
        w: c.imagePrompt ? 6.0 : 11.7, h: 4.0,
        valign: 'top',
      })
    }

    // Stats
    if (c.stats && c.stats.length > 0) {
      const perRow = Math.min(c.stats.length, 4)
      const sw = 10.0 / perRow
      c.stats.forEach((stat, j) => {
        const col = j % perRow
        const row = Math.floor(j / perRow)
        pptxSlide.addText(stat.value, {
          x: 1.5 + col * sw, y: 2.0 + row * 2.0, w: sw - 0.4, h: 0.8,
          fontSize: 30, fontFace: 'Arial', color: options.accentColor.replace('#', ''),
          bold: true, align: 'center', valign: 'bottom',
        })
        pptxSlide.addText(stat.label, {
          x: 1.5 + col * sw, y: 2.8 + row * 2.0, w: sw - 0.4, h: 0.5,
          fontSize: 13, fontFace: 'Arial', color: '777777', align: 'center', valign: 'top',
        })
      })
    }

    // Logo on cover + closing
    if (options.logoBuffer && (isTitle || isClosing)) {
      pptxSlide.addImage({
        data: `image/png;base64,${options.logoBuffer.toString('base64')}`,
        x: 0.4, y: 0.3, w: 2.0, h: 0.7,
        sizing: { type: 'contain', w: 2.0, h: 0.7 },
      })
    }

    // Contact bar
    const barParts: string[] = []
    if (options.brandName) barParts.push(options.brandName)
    if (options.contactInfo?.phone) barParts.push(options.contactInfo.phone)
    if (options.contactInfo?.website) barParts.push(options.contactInfo.website)
    if (barParts.length > 0) {
      pptxSlide.addText(barParts.join('  |  '), {
        x: 0, y: 6.9, w: '100%', h: 0.6,
        align: 'center', fontSize: 11, color: 'FFFFFF', fontFace: 'Arial',
        fill: { color: pc },
      })
    }

    if (onProgress) await onProgress(Math.round(((i + 1) / total) * 100))
  }

  const output = await pptx.write({ outputType: 'nodebuffer' }) as Buffer
  return Buffer.from(output)
}
