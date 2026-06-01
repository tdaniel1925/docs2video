import Anthropic from '@anthropic-ai/sdk'
import type { SlideLayout } from './template-analyzer'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export interface PlannedSlide {
  slideNumber: number
  templateLayoutIndex: number
  layoutType: string
  content: {
    headline: string
    subheadline?: string
    bodyBlocks: string[]
    stats?: { value: string; label: string }[]
    imagePrompt?: string
  }
  rationale: string
}

export interface DeckPlan {
  deckTitle: string
  totalSlides: number
  slides: PlannedSlide[]
}

/**
 * Create an intelligent deck plan that maps source content to template layouts.
 * Uses Claude Sonnet 4 to strategically assign content sections to the best layout types.
 */
export async function planDeck(
  sourceData: any,
  layouts: SlideLayout[],
  brandName: string
): Promise<DeckPlan> {
  const layoutSummaries = layouts.map((l) => ({
    index: l.index,
    classification: l.classification,
    description: l.description,
    suggestedContent: l.suggestedContent,
    hasImage: !!l.imageBuffer,
    textPreview: l.textContent?.slice(0, 100) || null,
  }))

  const prompt = `You are a presentation design strategist. Given this source content and these available template layouts, create the optimal deck plan.

## Brand
${brandName}

## Source Content
${JSON.stringify(sourceData, null, 2)}

## Available Template Layouts
${JSON.stringify(layoutSummaries, null, 2)}

## Instructions
- Choose which layout best communicates each content section.
- Write slide content CRAFTED for presentations — concise headlines (max 8 words), punchy stats, clear bullet points (max 6 words each).
- Include imagePrompt for any slide that would benefit from a generated illustration. The imagePrompt should describe a professional, on-brand visual.
- Every slide must have a rationale explaining why this layout was chosen for that content.
- You may reuse a layout index for multiple slides if it is the best fit.
- Order slides for maximum narrative impact: start strong, build through the middle, close memorably.
- Return ONLY valid JSON (no markdown, no code fences) matching this exact structure:

{
  "deckTitle": "string — the overall deck title",
  "totalSlides": number,
  "slides": [
    {
      "slideNumber": number (1-based),
      "templateLayoutIndex": number (index from available layouts),
      "layoutType": "string — the classification of the chosen layout",
      "content": {
        "headline": "string — max 8 words",
        "subheadline": "string or omit",
        "bodyBlocks": ["string — max 6 words each"],
        "stats": [{ "value": "string", "label": "string" }] or omit,
        "imagePrompt": "string" or omit
      },
      "rationale": "string — why this layout was chosen"
    }
  ]
}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  // Extract text from the response
  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response received from Claude')
  }

  const rawText = textBlock.text
  // Strip markdown code fences if present
  const cleaned = rawText
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim()

  const plan: DeckPlan = JSON.parse(cleaned)

  // Validate the plan structure
  if (!plan.deckTitle || !Array.isArray(plan.slides) || plan.slides.length === 0) {
    throw new Error('Invalid deck plan: missing deckTitle or slides array')
  }

  // Ensure totalSlides matches
  plan.totalSlides = plan.slides.length

  return plan
}
