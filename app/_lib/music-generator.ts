import { GoogleGenAI } from '@google/genai'
import type { ExtractedPolicyData, VideoScene } from './types'
import { type ExtractedData, isInsuranceData } from './extract-types'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

/**
 * Analyzes content and creates a music generation prompt for Suno AI.
 */
export function buildMusicPrompt(
  data: ExtractedPolicyData | ExtractedData,
  scenes: VideoScene[]
): string {
  const isInsurance = isInsuranceData(data)
  const title = isInsurance ? (data as ExtractedPolicyData).policyType : (data as ExtractedData).title
  const source = isInsurance ? (data as ExtractedPolicyData).carrier : (data as ExtractedData).source
  const titleLower = (title ?? '').toLowerCase()
  const sourceLower = (source ?? '').toLowerCase()

  // Combine title + source + sections for keyword detection
  const allText = [
    titleLower,
    sourceLower,
    ...(!isInsurance ? (data as ExtractedData).sections.map(s => s.title.toLowerCase()) : []),
  ].join(' ')

  let stylePrompt: string

  if (isInsurance || allText.includes('insurance') || allText.includes('policy') || allText.includes('life')) {
    stylePrompt = 'Gentle piano with soft strings, warm and reassuring, professional corporate tone, slow tempo'
  } else if (allText.includes('financ') || allText.includes('business') || allText.includes('invest') || allText.includes('bank') || allText.includes('revenue')) {
    stylePrompt = 'Modern ambient corporate, subtle synth pads, confident and sophisticated'
  } else if (allText.includes('educat') || allText.includes('learn') || allText.includes('school') || allText.includes('training') || allText.includes('course')) {
    stylePrompt = 'Light acoustic guitar, friendly and approachable, medium tempo'
  } else if (allText.includes('tech') || allText.includes('software') || allText.includes('digital') || allText.includes('ai') || allText.includes('cloud')) {
    stylePrompt = 'Clean electronic ambient, modern and innovative, medium-upbeat tempo'
  } else {
    // Default: warm corporate
    stylePrompt = 'Gentle ambient piano with subtle pads, professional and warm, medium tempo'
  }

  const durationEstimate = scenes.length * 25
  stylePrompt += `. Instrumental only, no vocals, background music suitable for narration overlay. Target duration: approximately ${durationEstimate} seconds`

  return stylePrompt
}

/**
 * Generates custom background music via Google Lyria 2.
 * Returns the audio buffer on success, or null if generation fails.
 * Uses the same Gemini API key — no additional service needed.
 */
export async function generateCustomMusic(
  prompt: string,
  _title: string = 'Background Music'
): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.error('[music-generator] GEMINI_API_KEY not set')
    return null
  }

  try {
    console.log('[music-generator] Generating music via Lyria 2...')

    const response = await genai.models.generateContent({
      model: 'lyria-2',
      contents: [{
        role: 'user',
        parts: [{ text: prompt }],
      }],
      config: {
        responseModalities: ['AUDIO'],
      } as any,
    })

    // Extract audio data from response
    const parts = response.candidates?.[0]?.content?.parts ?? []
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith('audio/')) {
        const buffer = Buffer.from(part.inlineData.data!, 'base64')
        if (buffer.length < 1000) {
          console.error(`[music-generator] Audio too small: ${buffer.length} bytes`)
          return null
        }

        // Upload to Supabase storage and return the URL
        const { createAdminClient } = await import('./supabase/admin')
        const admin = createAdminClient()
        const fileName = `music/lyria-${Date.now()}.wav`
        const { error: uploadError } = await admin.storage
          .from('videos')
          .upload(fileName, buffer, { contentType: part.inlineData.mimeType, upsert: true })

        if (uploadError) {
          console.error('[music-generator] Upload failed:', uploadError.message)
          return null
        }

        const { data: urlData } = admin.storage.from('videos').getPublicUrl(fileName)
        console.log(`[music-generator] Music ready: ${urlData.publicUrl}`)
        return urlData.publicUrl
      }
    }

    console.error('[music-generator] No audio data in Lyria response')
    return null
  } catch (err) {
    console.error('[music-generator] Error:', err instanceof Error ? err.message : err)
    return null
  }
}
