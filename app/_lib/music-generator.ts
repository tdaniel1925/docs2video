import type { ExtractedPolicyData, VideoScene } from './types'
import { type ExtractedData, isInsuranceData } from './extract-types'

const KIE_API_BASE = 'https://api.kie.ai'

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
 * Generates custom music via Kie.ai Suno API.
 * Returns the audio URL on success, or null if generation fails.
 */
export async function generateCustomMusic(
  prompt: string,
  title: string = 'Background Music'
): Promise<string | null> {
  const apiKey = process.env.KIE_API_KEY
  if (!apiKey) {
    console.error('[music-generator] KIE_API_KEY not set')
    return null
  }

  try {
    // 1. Start generation
    console.log('[music-generator] Starting music generation...')
    const generateRes = await fetch(`${KIE_API_BASE}/api/suno/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        instrumental: true,
        model: 'V4',
        style: 'Corporate',
        title,
      }),
    })

    if (!generateRes.ok) {
      const errText = await generateRes.text()
      console.error(`[music-generator] Generate failed (${generateRes.status}):`, errText)
      return null
    }

    const generateData = await generateRes.json()
    const taskId = generateData.data?.task_id ?? generateData.task_id
    if (!taskId) {
      console.error('[music-generator] No task_id in response:', generateData)
      return null
    }

    console.log(`[music-generator] Task created: ${taskId}`)

    // 2. Poll for completion (every 5s, max 120s)
    const maxWait = 120_000
    const pollInterval = 5_000
    const startTime = Date.now()

    while (Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))

      const statusRes = await fetch(`${KIE_API_BASE}/api/suno/task/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      })

      if (!statusRes.ok) {
        console.error(`[music-generator] Status check failed (${statusRes.status})`)
        continue
      }

      const statusData = await statusRes.json()
      const status = statusData.data?.status ?? statusData.status

      if (status === 'completed') {
        const tracks = statusData.data?.tracks ?? statusData.tracks ?? []
        const audioUrl = tracks[0]?.audioUrl ?? tracks[0]?.audio_url
        if (audioUrl) {
          console.log(`[music-generator] Music ready: ${audioUrl}`)
          return audioUrl
        }
        console.error('[music-generator] Completed but no audioUrl found:', statusData)
        return null
      }

      if (status === 'failed') {
        console.error('[music-generator] Music generation failed:', statusData)
        return null
      }

      console.log(`[music-generator] Status: ${status} (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`)
    }

    console.error('[music-generator] Timed out after 120 seconds')
    return null
  } catch (err) {
    console.error('[music-generator] Error:', err instanceof Error ? err.message : err)
    return null
  }
}
