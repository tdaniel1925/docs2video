/**
 * Generates editable PPTX files with Gemini-generated backgrounds
 * and real editable text boxes on top.
 *
 * Flow:
 * 1. For each slide: Gemini generates a beautiful background image
 *    (visual design, illustrations, icons, patterns — NO text)
 * 2. pptxgenjs creates a PPTX with that image as slide background
 * 3. Text boxes are added as real editable PowerPoint elements
 * 4. Logo placed as an image element
 * 5. Output: stunning visuals + fully editable text
 */

import PptxGenJS from 'pptxgenjs'

export interface DeckSlide {
  headline: string
  subheadline?: string
  bodyPoints: string[]
  stats?: { value: string; label: string }[]
  slideType: 'cover' | 'content' | 'data' | 'quote' | 'closing'
  backgroundImage: Buffer // Gemini-generated PNG
}

export interface DeckOptions {
  brandName: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  textColor: string
  logoBuffer?: Buffer | null
  contactInfo?: { phone?: string; website?: string }
}

export async function generatePptx(
  slides: DeckSlide[],
  options: DeckOptions
): Promise<Buffer> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33" x 7.5" (widescreen 16:9)
  pptx.author = 'Docs2Video'
  pptx.company = options.brandName
  pptx.title = options.brandName + ' Presentation'

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    const pptxSlide = pptx.addSlide()

    // Set Gemini-generated image as background
    const bgBase64 = slide.backgroundImage.toString('base64')
    pptxSlide.background = {
      data: `image/png;base64,${bgBase64}`,
    }

    // Add editable text boxes based on slide type
    switch (slide.slideType) {
      case 'cover':
        addCoverText(pptxSlide, slide, options)
        break
      case 'data':
        addDataText(pptxSlide, slide, options)
        break
      case 'closing':
        addClosingText(pptxSlide, slide, options)
        break
      default:
        addContentText(pptxSlide, slide, options)
        break
    }

    // Add logo on cover and closing slides
    if (options.logoBuffer && (slide.slideType === 'cover' || slide.slideType === 'closing')) {
      const logoBase64 = options.logoBuffer.toString('base64')
      pptxSlide.addImage({
        data: `image/png;base64,${logoBase64}`,
        x: 0.4,
        y: 0.3,
        w: 2.0,
        h: 0.7,
        sizing: { type: 'contain' },
      })
    }

    // Add contact bar text on all slides
    if (options.contactInfo?.phone || options.contactInfo?.website) {
      const barParts: string[] = []
      if (options.brandName) barParts.push(options.brandName)
      if (options.contactInfo.phone) barParts.push(options.contactInfo.phone)
      if (options.contactInfo.website) barParts.push(options.contactInfo.website)

      pptxSlide.addText(barParts.join('  |  '), {
        x: 0, y: 6.9, w: '100%', h: 0.6,
        align: 'center',
        fontSize: 11,
        color: 'FFFFFF',
        fontFace: 'Arial',
        fill: { color: options.primaryColor.replace('#', '') },
      })
    }
  }

  // Generate PPTX buffer
  const output = await pptx.write({ outputType: 'nodebuffer' }) as Buffer
  return Buffer.from(output)
}

function addCoverText(
  slide: PptxGenJS.Slide,
  data: DeckSlide,
  options: DeckOptions
) {
  // Headline — large, centered
  slide.addText(data.headline, {
    x: 1.5, y: 2.0, w: 10.3, h: 1.5,
    fontSize: 36,
    fontFace: 'Arial',
    color: options.primaryColor.replace('#', ''),
    bold: true,
    align: 'center',
    valign: 'middle',
    shadow: { type: 'outer', blur: 6, offset: 2, color: '000000', opacity: 0.15 },
  })

  // Subheadline
  if (data.subheadline) {
    slide.addText(data.subheadline, {
      x: 2.0, y: 3.5, w: 9.3, h: 0.8,
      fontSize: 18,
      fontFace: 'Arial',
      color: '666666',
      align: 'center',
      valign: 'middle',
    })
  }
}

function addContentText(
  slide: PptxGenJS.Slide,
  data: DeckSlide,
  options: DeckOptions
) {
  // Headline
  slide.addText(data.headline, {
    x: 0.8, y: 0.5, w: 11.7, h: 0.8,
    fontSize: 28,
    fontFace: 'Arial',
    color: options.primaryColor.replace('#', ''),
    bold: true,
    valign: 'middle',
  })

  // Body points
  if (data.bodyPoints.length > 0) {
    const textRows = data.bodyPoints.map(point => ({
      text: point,
      options: {
        fontSize: 16,
        fontFace: 'Arial',
        color: '333333',
        bullet: { type: 'bullet' as const },
        paraSpaceAfter: 8,
      },
    }))

    slide.addText(textRows, {
      x: 0.8, y: 1.5, w: 11.7, h: 4.5,
      valign: 'top',
    })
  }
}

function addDataText(
  slide: PptxGenJS.Slide,
  data: DeckSlide,
  options: DeckOptions
) {
  // Headline
  slide.addText(data.headline, {
    x: 0.8, y: 0.5, w: 11.7, h: 0.8,
    fontSize: 28,
    fontFace: 'Arial',
    color: options.primaryColor.replace('#', ''),
    bold: true,
    valign: 'middle',
  })

  // Stats grid
  if (data.stats && data.stats.length > 0) {
    const statsPerRow = Math.min(data.stats.length, 4)
    const statWidth = 11.0 / statsPerRow
    data.stats.forEach((stat, j) => {
      const col = j % statsPerRow
      const row = Math.floor(j / statsPerRow)
      const x = 1.0 + col * statWidth
      const y = 1.8 + row * 2.2

      // Value
      slide.addText(stat.value, {
        x, y, w: statWidth - 0.3, h: 1.0,
        fontSize: 32,
        fontFace: 'Arial',
        color: options.accentColor.replace('#', ''),
        bold: true,
        align: 'center',
        valign: 'bottom',
      })

      // Label
      slide.addText(stat.label, {
        x, y: y + 1.0, w: statWidth - 0.3, h: 0.6,
        fontSize: 14,
        fontFace: 'Arial',
        color: '666666',
        align: 'center',
        valign: 'top',
      })
    })
  }

  // Body points below stats
  if (data.bodyPoints.length > 0) {
    const textRows = data.bodyPoints.map(point => ({
      text: point,
      options: {
        fontSize: 14,
        fontFace: 'Arial',
        color: '444444',
        bullet: { type: 'bullet' as const },
        paraSpaceAfter: 6,
      },
    }))

    slide.addText(textRows, {
      x: 0.8, y: 4.5, w: 11.7, h: 2.0,
      valign: 'top',
    })
  }
}

function addClosingText(
  slide: PptxGenJS.Slide,
  data: DeckSlide,
  options: DeckOptions
) {
  // Headline
  slide.addText(data.headline, {
    x: 1.5, y: 1.5, w: 10.3, h: 1.2,
    fontSize: 32,
    fontFace: 'Arial',
    color: options.primaryColor.replace('#', ''),
    bold: true,
    align: 'center',
    valign: 'middle',
  })

  // Key points
  if (data.bodyPoints.length > 0) {
    const textRows = data.bodyPoints.map(point => ({
      text: point,
      options: {
        fontSize: 16,
        fontFace: 'Arial',
        color: '333333',
        bullet: { type: 'bullet' as const },
        paraSpaceAfter: 8,
      },
    }))

    slide.addText(textRows, {
      x: 2.5, y: 3.0, w: 8.3, h: 3.0,
      valign: 'top',
    })
  }
}

/**
 * Generate background images for PPTX slides.
 * Tells Gemini to create beautiful visual backgrounds WITHOUT any text —
 * all text is added as editable PowerPoint elements on top.
 */
export function buildBackgroundPrompt(
  slideType: string,
  headline: string,
  primaryHex: string,
  secondaryHex: string,
  accentHex: string,
  referenceImage?: string
): string {
  return `Create a 1920x1080 presentation slide BACKGROUND ONLY. 16:9 aspect ratio.

This is a BACKGROUND IMAGE for a ${slideType} slide. Text will be overlaid separately in PowerPoint.

TOPIC/CONTEXT: "${headline}"

WHAT TO INCLUDE:
- Beautiful abstract geometric shapes, patterns, and decorative elements
- Subtle illustrations or icons related to the topic
- Gradient effects using the brand colors
- Visual depth with layering, shadows, and transparency
- Professional, editorial-quality design

WHAT TO LEAVE CLEAR (for text overlay):
${slideType === 'cover' ? '- Center area (30%-70% width, 25%-60% height) must be light/clear for headline text' : ''}
${slideType === 'content' ? '- Top area (for headline) and center-right area (for body text) must have readable background' : ''}
${slideType === 'data' ? '- Upper area for headline and center area for stats must be light/readable' : ''}
${slideType === 'closing' ? '- Center area must be clear for closing text and CTA' : ''}
- Bottom 60px for contact bar

COLOR PALETTE:
- Primary: ${primaryHex} (dominant)
- Secondary: ${secondaryHex} (supporting)
- Accent: ${accentHex} (highlights)

CRITICAL:
- Do NOT render ANY text on the image — no headlines, no labels, no numbers, no words at all
- This is purely a visual BACKGROUND — all text comes from PowerPoint
- Do NOT include any logos, brand marks, or company names
- Make it beautiful, modern, and magazine-quality
${referenceImage ? '- Use the attached reference image as style inspiration' : ''}
`.trim()
}
