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

export interface BrandOverlays {
  /** Composited as crisp text — Gemini never renders brand names */
  brandName?: string | null
  title?: string
  contactLine?: string
  primaryColor?: string
  /** Trial users get a diagonal watermark, matching the VPS FFmpeg one */
  watermark?: boolean
}

function textElement(opts: {
  text: string
  time: number
  duration: number
  y: string
  height: string
  weight: string
  background: string
}): Record<string, unknown> {
  return {
    type: 'text',
    track: 4,
    time: opts.time,
    duration: opts.duration,
    text: opts.text,
    y: opts.y,
    width: '76%',
    height: opts.height,
    x_alignment: '50%',
    y_alignment: '50%',
    font_family: 'Plus Jakarta Sans',
    font_weight: opts.weight,
    fill_color: '#FFFFFF',
    background_color: opts.background,
    background_border_radius: '10%',
    background_x_padding: '28%',
    background_y_padding: '24%',
  }
}

export function buildRenderSource(
  scenes: RenderScene[],
  musicUrl?: string | null,
  overlays?: BrandOverlays
) {
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

  // Brand text overlays on cover (first) and closing (last) slides —
  // mirrors the VPS, which composites name/title as text over decorative art.
  if (overlays && scenes.length > 0) {
    const dark = 'rgba(10,22,40,0.55)'
    const coverDur = scenes[0].duration + (scenes.length === 1 ? CLOSING_HOLD_SEC : 0)
    if (overlays.brandName) {
      elements.push(textElement({
        text: overlays.brandName, time: 0, duration: coverDur,
        y: '36%', height: '11%', weight: '800', background: dark,
      }))
    }
    if (overlays.title) {
      elements.push(textElement({
        text: overlays.title, time: 0, duration: coverDur,
        y: overlays.brandName ? '52%' : '44%', height: '8%', weight: '600', background: dark,
      }))
    }
    if (scenes.length > 1) {
      const last = scenes[scenes.length - 1]
      const lastStart = t - (last.duration + CLOSING_HOLD_SEC)
      const lastDur = last.duration + CLOSING_HOLD_SEC
      if (overlays.brandName) {
        elements.push(textElement({
          text: overlays.brandName, time: lastStart, duration: lastDur,
          y: '38%', height: '10%', weight: '800', background: dark,
        }))
      }
      if (overlays.contactLine) {
        elements.push(textElement({
          text: overlays.contactLine, time: lastStart, duration: lastDur,
          y: '53%', height: '6%', weight: '600', background: dark,
        }))
      }
    }
  }

  if (overlays?.watermark) {
    elements.push({
      type: 'text',
      track: 5,
      time: 0,
      duration: t,
      text: 'DOCS2VIDEO TRIAL',
      width: '100%',
      height: '14%',
      x_alignment: '50%',
      y_alignment: '50%',
      z_rotation: '-25°',
      font_family: 'Plus Jakarta Sans',
      font_weight: '800',
      fill_color: 'rgba(255,255,255,0.25)',
      stroke_color: 'rgba(0,0,0,0.15)',
      stroke_width: '0.3 vmin',
    })
  }

  if (musicUrl) {
    elements.push({
      type: 'audio',
      track: 3,
      source: musicUrl,
      time: 0,
      duration: t,
      volume: '10%',
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
