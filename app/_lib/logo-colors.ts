/**
 * Client-side helper to extract colors from a logo image.
 * Calls the /api/extract-logo-colors endpoint.
 */
export async function extractLogoColors(imageUrl: string): Promise<{
  primary: string
  secondary: string
  accent: string
  background: string
  text: string
} | null> {
  try {
    const res = await fetch('/api/extract-logo-colors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
