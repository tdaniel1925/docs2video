import JSZip from 'jszip'
import { GoogleGenAI } from '@google/genai'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export interface SlideLayout {
  index: number
  classification: string
  description: string
  suggestedContent: string
  imageBuffer?: Buffer
  textContent?: string
}

export interface TemplateAnalysis {
  totalSlides: number
  layouts: SlideLayout[]
}

/**
 * Extract text content from a PPTX slide XML string.
 * Finds all <a:t> text run elements and joins them.
 */
function extractTextFromSlideXml(xml: string): string {
  const textRuns: string[] = []
  const regex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(xml)) !== null) {
    textRuns.push(match[1])
  }
  return textRuns.join(' ').trim()
}

/**
 * Parse relationship file to find image references for a slide.
 * Returns an array of image target paths (e.g. "../media/image1.png").
 */
function extractImageTargets(relsXml: string): string[] {
  const targets: string[] = []
  const regex =
    /<Relationship[^>]+Type="[^"]*\/image"[^>]+Target="([^"]+)"[^>]*\/?>/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(relsXml)) !== null) {
    targets.push(match[1])
  }
  return targets
}

/**
 * Resolve a relative target path from a slide rels file to the actual zip path.
 * e.g. "../media/image1.png" resolved from "ppt/slides/_rels/" -> "ppt/media/image1.png"
 */
function resolveMediaPath(target: string): string {
  // Targets are relative to ppt/slides/, so "../media/image1.png" -> "ppt/media/image1.png"
  return target.replace(/^\.\.\//, 'ppt/')
}

/**
 * Classify a single slide layout using Gemini 2.5 Flash.
 */
async function classifySlide(
  slideIndex: number,
  imageBuffer: Buffer | undefined,
  textContent: string | undefined
): Promise<SlideLayout> {
  const prompt = `Classify this presentation slide. Return ONLY valid JSON (no markdown, no code fences) with these exact fields:
{
  "classification": one of: "title", "content", "two-column", "data-grid", "full-image", "quote", "comparison", "timeline", "section-divider", "closing",
  "description": "one sentence describing the slide design",
  "suggestedContent": "what type of content fits best: headline, body, stats, image, quote, etc."
}`

  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = []

  if (imageBuffer) {
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: imageBuffer.toString('base64'),
      },
    })
    parts.push({
      text: `${prompt}${textContent ? `\n\nSlide also contains this text: "${textContent}"` : ''}`,
    })
  } else if (textContent) {
    parts.push({
      text: `${prompt}\n\nThe slide contains this text content: "${textContent}"`,
    })
  } else {
    parts.push({
      text: `${prompt}\n\nThis slide appears to be blank or has no extractable content. Classify it based on that.`,
    })
  }

  try {
    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts }],
    })

    const rawText = response.text ?? ''
    // Strip markdown code fences if present
    const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return {
      index: slideIndex,
      classification: parsed.classification || 'content',
      description: parsed.description || 'Unknown slide layout',
      suggestedContent: parsed.suggestedContent || 'body',
      imageBuffer,
      textContent: textContent || undefined,
    }
  } catch (error) {
    // Fallback classification if AI call fails
    return {
      index: slideIndex,
      classification: 'content',
      description: 'Could not classify slide — defaulting to content layout',
      suggestedContent: 'body',
      imageBuffer,
      textContent: textContent || undefined,
    }
  }
}

/**
 * Analyze a PPTX template file buffer.
 * Unzips the file, extracts slide content and images, then classifies each layout using Gemini.
 */
export async function analyzeTemplate(
  pptxBuffer: Buffer
): Promise<TemplateAnalysis> {
  const zip = await JSZip.loadAsync(pptxBuffer)

  // Find all slide files, sorted by slide number
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/)![1], 10)
      const numB = parseInt(b.match(/slide(\d+)\.xml/)![1], 10)
      return numA - numB
    })

  const layouts: SlideLayout[] = []

  for (let i = 0; i < slideFiles.length; i++) {
    const slidePath = slideFiles[i]
    const slideNum = parseInt(slidePath.match(/slide(\d+)\.xml/)![1], 10)

    // Read slide XML and extract text
    const slideXml = await zip.files[slidePath].async('text')
    const textContent = extractTextFromSlideXml(slideXml)

    // Check for relationship file to find linked images
    const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`
    let imageBuffer: Buffer | undefined

    if (zip.files[relsPath]) {
      const relsXml = await zip.files[relsPath].async('text')
      const imageTargets = extractImageTargets(relsXml)

      // Use the first available image from the slide
      for (const target of imageTargets) {
        const mediaPath = resolveMediaPath(target)
        if (zip.files[mediaPath]) {
          imageBuffer = Buffer.from(
            await zip.files[mediaPath].async('arraybuffer')
          )
          break
        }
      }
    }

    const layout = await classifySlide(i, imageBuffer, textContent || undefined)
    layouts.push(layout)
  }

  return {
    totalSlides: slideFiles.length,
    layouts,
  }
}
