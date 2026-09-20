/**
 * Logo enhancement via the render service's rembg endpoint (self-hosted U2-Net background
 * removal). Used when Sharp's flat-color knockout can't cleanly separate a logo
 * from a busy/photo/gradient background.
 *
 * GRACEFUL: returns null if that endpoint isn't deployed yet, is unhealthy,
 * or errors — the caller then falls back to the Sharp result / reject flow. So
 * this can ship before the render service side exists; it just no-ops until then.
 */

const RENDER_URL = process.env.VIDEO_ASSEMBLY_URL
const SECRET = process.env.VIDEO_ASSEMBLY_SECRET

/**
 * Send a logo to the render service for background removal. Returns a transparent PNG
 * Buffer, or null if enhancement is unavailable/failed.
 */
export async function enhanceLogo(input: Buffer): Promise<Buffer | null> {
  if (!RENDER_URL || !SECRET) return null
  try {
    const res = await fetch(`${RENDER_URL.replace(/\/$/, '')}/process-logo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': SECRET },
      body: JSON.stringify({ imageBase64: input.toString('base64') }),
      signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { pngBase64?: string }
    if (!json.pngBase64) return null
    return Buffer.from(json.pngBase64, 'base64')
  } catch {
    return null
  }
}
