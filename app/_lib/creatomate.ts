/**
 * Creatomate render client — pipeline v2 video assembly.
 * Builds a RenderScript JSON source from finished slide images + narration
 * audio, and starts a render. Creatomate never designs anything; it only
 * sequences the Gemini slides with the TTS audio and encodes the MP4.
 */

// v1 is the stable raw-source API. v2 ignores source-level output_format and
// renders a JPEG preview — verified empirically 2026-06-11.
const RENDERS_URL = 'https://api.creatomate.com/v1/renders'
const SCENE_FADE_SEC = 0.5
const CLOSING_HOLD_SEC = 0.75

export interface RenderScene {
  imageUrl: string
  audioUrl: string
  /** Narration duration in seconds (drives the slide duration) */
  duration: number
}

export interface RenderMetadata {
  videoId: string
  userId: string
  deductedCost: number
}

export function buildRenderSource(scenes: RenderScene[], musicUrl?: string | null) {
  const elements: Record<string, unknown>[] = []
  let t = 0

  scenes.forEach((scene, i) => {
    const isLast = i === scenes.length - 1
    const slideDuration = scene.duration + (isLast ? CLOSING_HOLD_SEC : 0)

    elements.push({
      type: 'image',
      track: 1,
      source: scene.imageUrl,
      time: t,
      duration: slideDuration,
      // fit defaults to cover; slides are already 16:9
      animations: i > 0
        ? [{ time: 0, duration: SCENE_FADE_SEC, easing: 'quadratic-out', type: 'fade' }]
        : undefined,
    })
    elements.push({
      type: 'audio',
      track: 2,
      source: scene.audioUrl,
      time: t,
      duration: scene.duration,
    })
    t += slideDuration
  })

  if (musicUrl) {
    elements.push({
      type: 'audio',
      track: 3,
      source: musicUrl,
      time: 0,
      duration: t,
      volume: '15%',
      audio_fade_out: 2,
    })
  }

  return {
    output_format: 'mp4',
    width: 1920,
    height: 1080,
    duration: t,
    elements,
  }
}

function getApiKey(): string {
  const key = process.env.CREATOMATE_API_KEY
  if (!key) throw new Error('CREATOMATE_API_KEY is not set')
  return key
}

export async function startRender(
  source: ReturnType<typeof buildRenderSource>,
  metadata: RenderMetadata
): Promise<{ id: string }> {
  const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com'}/api/webhooks/creatomate`
  const res = await fetch(RENDERS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      source,
      webhook_url: webhookUrl,
      metadata: JSON.stringify(metadata),
    }),
    signal: AbortSignal.timeout(30000),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Creatomate render request failed (HTTP ${res.status}): ${text.slice(0, 300)}`)
  }
  const data = JSON.parse(text)
  const render = Array.isArray(data) ? data[0] : data
  if (!render?.id) throw new Error('Creatomate response missing render id')
  return { id: render.id }
}

/**
 * Fetches a render by id. The webhook handler uses this to verify status
 * server-to-server instead of trusting the (unsigned) webhook payload.
 */
export async function getRender(id: string): Promise<{
  id: string
  status: string
  url?: string
  metadata?: string
  error_message?: string
}> {
  const res = await fetch(`${RENDERS_URL}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Creatomate getRender failed (HTTP ${res.status})`)
  return res.json()
}
