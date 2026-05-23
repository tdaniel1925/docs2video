/**
 * Simple input validation utilities. No external dependencies.
 */

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function sanitizeString(str: string, maxLength = 5000): string {
  return str
    .trim()
    .replace(/\0/g, '') // remove null bytes
    .slice(0, maxLength)
}

export function validateRequired(
  fields: Record<string, unknown>,
  required: string[],
): string | null {
  for (const key of required) {
    const val = fields[key]
    if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
      return `Missing required field: ${key}`
    }
  }
  return null
}
