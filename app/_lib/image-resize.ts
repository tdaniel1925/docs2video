/**
 * Browser-side image downscaling. Phone photos are 10-15MB and exceed the
 * platform's request-body limit (causing 413s on upload). Resizing to a sane
 * max dimension + re-encoding as JPEG keeps uploads to a few hundred KB.
 *
 * Client-only (uses Image/canvas/FileReader). Falls back to the original file
 * if anything goes wrong, so it never blocks an upload.
 */
export async function downscaleImage(file: File, maxDim = 1024, quality = 0.85): Promise<File> {
  // Only attempt for raster images we can draw to a canvas.
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file
  try {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(new Error('read failed'))
      r.readAsDataURL(file)
    })
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('decode failed'))
      i.src = dataUrl
    })
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
    // Already small enough → upload as-is.
    if (scale >= 1 && file.size <= 1_500_000) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) return file
    return new File([blob], (file.name.replace(/\.[^.]+$/, '') || 'photo') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}
