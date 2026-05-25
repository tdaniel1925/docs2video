import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST /api/extract-logo-colors
 * Accepts { imageUrl: string } or { imageBase64: string }
 * Uses Sharp to extract dominant colors from a logo image.
 * Returns { primary, secondary, accent, background, text }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { imageUrl, imageBase64 } = body as { imageUrl?: string; imageBase64?: string }

  if (!imageUrl && !imageBase64) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  try {
    const sharpMod = await import('sharp')
    const sharp = sharpMod.default ?? sharpMod

    // Get image buffer
    let buffer: Buffer
    if (imageBase64) {
      const base64Clean = imageBase64.replace(/^data:image\/\w+;base64,/, '')
      buffer = Buffer.from(base64Clean, 'base64')
    } else {
      const res = await fetch(imageUrl!, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error('Failed to fetch image')
      buffer = Buffer.from(await res.arrayBuffer())
    }

    // Resize to small sample for faster processing
    const sample = await sharp(buffer)
      .resize(100, 100, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const { data: pixels, info } = sample
    const { width, height, channels } = info

    // Count color frequencies (quantize to reduce noise)
    const colorCounts = new Map<string, { r: number; g: number; b: number; count: number }>()

    for (let i = 0; i < pixels.length; i += channels) {
      const r = Math.round(pixels[i] / 16) * 16
      const g = Math.round(pixels[i + 1] / 16) * 16
      const b = Math.round(pixels[i + 2] / 16) * 16

      // Skip near-white and near-black (backgrounds)
      const brightness = (r + g + b) / 3
      if (brightness > 240 || brightness < 15) continue

      const key = `${r},${g},${b}`
      const existing = colorCounts.get(key)
      if (existing) {
        existing.count++
      } else {
        colorCounts.set(key, { r, g, b, count: 1 })
      }
    }

    // Sort by frequency
    const sorted = [...colorCounts.values()].sort((a, b) => b.count - a.count)

    if (sorted.length === 0) {
      return NextResponse.json({
        primary: '#1B365D',
        secondary: '#4A90D9',
        accent: '#FFB347',
        background: '#FFFFFF',
        text: '#1A1A1A',
      })
    }

    // Pick top colors, ensuring they're visually distinct
    function toHex(r: number, g: number, b: number): string {
      return '#' + [r, g, b].map(c => Math.min(255, Math.max(0, c)).toString(16).padStart(2, '0')).join('')
    }

    function colorDistance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
      return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
    }

    function getBrightness(c: { r: number; g: number; b: number }): number {
      return (c.r * 299 + c.g * 587 + c.b * 114) / 1000
    }

    // Primary = most frequent non-background color
    const primary = sorted[0]

    // Secondary = next most frequent that's visually different from primary
    let secondary = sorted[1] ?? primary
    for (const c of sorted.slice(1)) {
      if (colorDistance(c, primary) > 60) { secondary = c; break }
    }

    // Accent = next different from both primary and secondary
    let accent = sorted[2] ?? secondary
    for (const c of sorted.slice(2)) {
      if (colorDistance(c, primary) > 60 && colorDistance(c, secondary) > 60) { accent = c; break }
    }

    // Background = determine if logo is on dark or light bg
    // Use the most common near-white or near-black pixel
    let bgBright = 0, bgDark = 0
    for (let i = 0; i < pixels.length; i += channels) {
      const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3
      if (brightness > 200) bgBright++
      if (brightness < 50) bgDark++
    }
    const isDarkLogo = getBrightness(primary) < 128
    const background = bgDark > bgBright ? '#0a1628' : '#FFFFFF'
    const text = background === '#FFFFFF' ? '#1A1A1A' : '#FFFFFF'

    return NextResponse.json({
      primary: toHex(primary.r, primary.g, primary.b),
      secondary: toHex(secondary.r, secondary.g, secondary.b),
      accent: toHex(accent.r, accent.g, accent.b),
      background,
      text,
    })
  } catch (err) {
    console.error('[extract-logo-colors] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Color extraction failed' }, { status: 500 })
  }
}
