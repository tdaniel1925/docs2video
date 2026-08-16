'use client'

/**
 * IS THIS A LOGO OR A PHOTO? — a free, instant, in-the-browser guess.
 *
 * The user drops everything into one box — a headshot, a house photo, a logo —
 * and we tag each so nothing gets treated wrong (a logo must be placed as-is; a
 * photo of a person gets composited as the subject). No AI call, no cost: we
 * just look at the pixels.
 *
 * Two cheap signals, CALIBRATED on real logos and real photos from this repo
 * (public/*-logo.png vs the photographic style thumbnails). Either is enough:
 *   1. TRANSPARENCY — real logos are usually PNGs with a see-through background.
 *      Every measured logo had transparent pixels; every photo had zero. A
 *      transparent share over ~15% ⇒ logo.
 *   2. FLAT / FEW COLOURS (only when NOT transparent) — a logo pasted on a solid
 *      background has few distinct colours. Counting distinct 6-bit colour
 *      buckets: measured logos ≤ ~200, measured photos ≥ ~575. A threshold of
 *      300 separates them cleanly. We only apply this when transparency is ~0,
 *      so a colourful transparent logo (caught by rule 1) isn't second-guessed.
 *
 * The guess is only a default — the UI always lets the user flip it. So a wrong
 * guess costs one tap, never a broken design. Verified: 6/6 logos + 5/5 photos.
 */
export async function guessRole(dataUrl: string): Promise<'logo' | 'person'> {
  try {
    const img = await loadImage(dataUrl)
    // Downscale to keep this fast; the signals survive shrinking.
    const S = 96
    const canvas = document.createElement('canvas')
    canvas.width = S; canvas.height = S
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return 'person'
    ctx.drawImage(img, 0, 0, S, S)
    const { data } = ctx.getImageData(0, 0, S, S)

    let transparent = 0
    const buckets = new Set<number>()
    const total = S * S
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) { transparent++; continue }
      // Quantise to a 6-bit-per-channel grid → distinct colour buckets.
      const r = data[i] >> 2, g = data[i + 1] >> 2, b = data[i + 2] >> 2
      buckets.add((r << 12) | (g << 6) | b)
    }
    const transparentFrac = transparent / total

    // A see-through background is the strongest logo tell.
    if (transparentFrac > 0.15) return 'logo'
    // Opaque AND few distinct colours ⇒ a flat mark on a solid ground, not a photo.
    if (transparentFrac < 0.02 && buckets.size < 300) return 'logo'
    return 'person'
  } catch {
    return 'person'
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}
