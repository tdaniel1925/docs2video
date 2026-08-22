'use client'

/**
 * Shrink an uploaded image IN THE BROWSER before it's stored.
 *
 * WHY THIS EXISTS. The wizard keeps its whole state — including uploaded
 * reference art, logos and photos — as base64 data URLs in ONE localStorage
 * entry, and that store is how state survives moving from Step 2 to Step 3
 * (each step is its own page that re-reads localStorage on load). A single
 * phone photo as full-size base64 can be many megabytes; a couple of them blow
 * past the ~5 MB localStorage limit, setItem throws, and the save is silently
 * lost — so the next page opens with the reference and logo GONE. That's the
 * "Step 2 didn't remember what I uploaded" bug.
 *
 * Capping the longest edge and re-encoding keeps every upload small enough to
 * persist, while staying more than sharp enough: the reference is used for
 * STYLE only, and logos/photos are redrawn or placed at modest sizes.
 */
export async function downscaleDataUrl(
  dataUrl: string,
  maxEdge = 1280,
  quality = 0.85,
): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = dataUrl
    })
    const w = img.naturalWidth || img.width
    const h = img.naturalHeight || img.height
    if (!w || !h) return dataUrl
    // Already small enough? Leave it be (avoids needless re-encode blur).
    if (Math.max(w, h) <= maxEdge && dataUrl.length < 700_000) return dataUrl

    const scale = Math.min(1, maxEdge / Math.max(w, h))
    const cw = Math.max(1, Math.round(w * scale))
    const ch = Math.max(1, Math.round(h * scale))
    const canvas = document.createElement('canvas')
    canvas.width = cw; canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUrl
    ctx.drawImage(img, 0, 0, cw, ch)

    // A PNG keeps transparency (logos, QR); a photo is smaller as JPEG.
    const isPng = dataUrl.startsWith('data:image/png')
    const out = isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality)
    // If the "shrunk" version somehow got bigger, keep the original.
    return out.length < dataUrl.length ? out : dataUrl
  } catch {
    return dataUrl // never block an upload because shrinking failed
  }
}
