/**
 * Source Data Fitter (F16)
 *
 * Ranks sections by importance and drops lowest-priority ones
 * to fit under the token/character limit, instead of blindly
 * chopping at 30K characters.
 */

export interface FitResult {
  fitted: any
  wasTruncated: boolean
  droppedSections: string[]
}

// Priority order: highest first. Fields not listed are kept as-is (they're small).
const PRIORITY_ORDER: string[] = [
  'title',
  'subtitle',
  'source',
  'keyMetrics',
  'sections',      // first 3 sections are higher priority (handled in logic)
  'bulletPoints',
  'additionalNotes',
  'disclaimers',
]

export function fitSourceData(data: any, maxChars: number = 30000): FitResult {
  const json = JSON.stringify(data)

  // If already under the limit, return as-is
  if (json.length <= maxChars) {
    return { fitted: data, wasTruncated: false, droppedSections: [] }
  }

  const droppedSections: string[] = []
  const fitted = { ...data }

  // Drop in reverse priority order (least important first)
  // 1. additionalNotes
  if (fitted.additionalNotes && JSON.stringify(fitted).length > maxChars) {
    droppedSections.push('additionalNotes')
    fitted.additionalNotes = []
  }

  // 2. disclaimers
  if (fitted.disclaimers && JSON.stringify(fitted).length > maxChars) {
    droppedSections.push('disclaimers')
    fitted.disclaimers = []
  }

  // 3. bulletPoints
  if (fitted.bulletPoints && JSON.stringify(fitted).length > maxChars) {
    droppedSections.push('bulletPoints')
    fitted.bulletPoints = []
  }

  // 4. Trim sections from the end (keep first 3, then drop from the back)
  if (Array.isArray(fitted.sections) && fitted.sections.length > 3 && JSON.stringify(fitted).length > maxChars) {
    // Remove sections from the end one at a time
    while (fitted.sections.length > 3 && JSON.stringify(fitted).length > maxChars) {
      const removed = fitted.sections.pop()
      droppedSections.push(`section: ${removed?.title || 'untitled'}`)
    }
  }

  // 5. If still over, trim remaining sections (indices 2, 1)
  if (Array.isArray(fitted.sections) && fitted.sections.length > 1 && JSON.stringify(fitted).length > maxChars) {
    while (fitted.sections.length > 1 && JSON.stringify(fitted).length > maxChars) {
      const removed = fitted.sections.pop()
      droppedSections.push(`section: ${removed?.title || 'untitled'}`)
    }
  }

  // 6. If STILL over, truncate the remaining section content
  if (Array.isArray(fitted.sections) && fitted.sections.length > 0 && JSON.stringify(fitted).length > maxChars) {
    const remaining = maxChars - JSON.stringify({ ...fitted, sections: [] }).length - 100
    if (remaining > 0 && fitted.sections[0]?.content) {
      fitted.sections[0].content = fitted.sections[0].content.slice(0, remaining)
      droppedSections.push('section content truncated')
    }
  }

  // 7. Last resort: truncate keyMetrics
  if (Array.isArray(fitted.keyMetrics) && JSON.stringify(fitted).length > maxChars) {
    const half = Math.ceil(fitted.keyMetrics.length / 2)
    const removed = fitted.keyMetrics.splice(half)
    droppedSections.push(`${removed.length} keyMetrics trimmed`)
  }

  return {
    fitted,
    wasTruncated: true,
    droppedSections,
  }
}
