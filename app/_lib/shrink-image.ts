/**
 * Shrink a picture in the browser before it is posted to an upload route.
 *
 * The photo/logo routes take the file in the request body, and Vercel stops a
 * body at ~4.5 MB — while a phone photo is often 3–8 MB. Without this, an
 * agent's headshot straight off an iPhone failed with "File must be under 4MB".
 *
 * PNG and WebP stay PNG so a logo keeps its transparent background (the old
 * settings-only version turned every big logo into a JPEG with a black box).
 * Anything that can't be decoded is returned unchanged for the server to judge.
 */
export async function shrinkImageForUpload(file: File, maxDim: number, maxBytes = 3_500_000): Promise<File> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/') || file.type === 'image/svg+xml') return file
  if (file.size <= maxBytes && file.size < 500_000) return file

  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => resolve(null)
    el.src = URL.createObjectURL(file)
  })
  if (!img) return file
  URL.revokeObjectURL(img.src)

  const keepAlpha = file.type === 'image/png' || file.type === 'image/webp'
  let dim = Math.min(maxDim, Math.max(img.width, img.height))
  for (let attempt = 0; attempt < 4; attempt++) {
    const scale = Math.min(1, dim / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    const type = keepAlpha ? 'image/png' : 'image/jpeg'
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.88))
    if (!blob) return file
    if (blob.size <= maxBytes || attempt === 3) {
      if (blob.size >= file.size && file.size <= maxBytes) return file
      return new File([blob], file.name.replace(/\.[^.]+$/, keepAlpha ? '.png' : '.jpg'), { type })
    }
    dim = Math.round(dim * 0.7)
  }
  return file
}
