/**
 * Pre-flight script validator — catches bad scripts before video assembly.
 * Returns errors (block generation) and warnings (log but proceed).
 */

export interface ValidationError {
  code: string
  scene?: number
  message: string
}

export interface ValidationResult {
  ok: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

const BANNED_PHRASES = [
  /\bclick here\b/i,
  /\bscroll down\b/i,
  /\bfill out the form\b/i,
  /\bsee below\b/i,
  /\bthe link above\b/i,
]

const TTS_MAX_CHARS = 4000

import { PHONE_REGEX } from './phone-utils'

const DISCLAIMER_KEYWORDS = [
  'disclaimer',
  'not a guarantee',
  'does not guarantee',
  'consult',
  'subject to',
  'terms and conditions',
  'coverage may vary',
  'policy terms',
]

export function validateScript(
  scenes: any[],
  options: {
    industry?: string
    contactInfo?: { phone?: string; email?: string; website?: string }
    detailLevel?: 'quick' | 'standard' | 'detailed'
    requireDisclaimer?: boolean
  } = {}
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  // --- ERRORS (block generation) ---

  // 1. Minimum scene count
  if (!scenes || scenes.length < 2) {
    errors.push({
      code: 'MIN_SCENES',
      message: `Script must have at least 2 scenes (got ${scenes?.length ?? 0})`,
    })
    // Can't validate individual scenes if array is empty/missing
    if (!scenes || scenes.length === 0) {
      return { ok: false, errors, warnings }
    }
  }

  let totalNarrationLength = 0

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    const sceneNum = i + 1

    // 2. Narration required
    if (!scene.narration || typeof scene.narration !== 'string' || !scene.narration.trim()) {
      errors.push({
        code: 'MISSING_NARRATION',
        scene: sceneNum,
        message: `Scene ${sceneNum} is missing narration`,
      })
    } else {
      const narrationLen = scene.narration.trim().length
      totalNarrationLength += narrationLen

      // 5. Single scene TTS limit
      if (narrationLen > TTS_MAX_CHARS) {
        errors.push({
          code: 'NARRATION_TOO_LONG',
          scene: sceneNum,
          message: `Scene ${sceneNum} narration is ${narrationLen} chars (max ${TTS_MAX_CHARS})`,
        })
      }
    }

    // 3. Title required
    if (!scene.title || typeof scene.title !== 'string' || !scene.title.trim()) {
      errors.push({
        code: 'MISSING_TITLE',
        scene: sceneNum,
        message: `Scene ${sceneNum} is missing a title`,
      })
    }

    // 4. Slide prompt required
    if (!scene.slidePrompt && !scene.slideData) {
      // slideData is the modern equivalent of slidePrompt — accept either
      errors.push({
        code: 'MISSING_SLIDE_PROMPT',
        scene: sceneNum,
        message: `Scene ${sceneNum} is missing slidePrompt or slideData`,
      })
    }
  }

  // 6. Disclaimer check for insurance
  if (options.requireDisclaimer) {
    const allNarration = scenes.map((s: any) => (s.narration || '').toLowerCase()).join(' ')
    const hasDisclaimer = DISCLAIMER_KEYWORDS.some((kw) => allNarration.includes(kw))
    if (!hasDisclaimer) {
      errors.push({
        code: 'MISSING_DISCLAIMER',
        message: 'Insurance videos require disclaimer text in at least one scene',
      })
    }
  }

  // 7. Total narration minimum
  if (totalNarrationLength > 0 && totalNarrationLength < 100) {
    errors.push({
      code: 'NARRATION_TOO_SHORT_TOTAL',
      message: `Total narration is only ${totalNarrationLength} chars (minimum 100)`,
    })
  }

  // --- WARNINGS (log but proceed) ---

  const seenTitles = new Set<string>()

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    const sceneNum = i + 1
    const narration = (scene.narration || '').trim()

    // 1. Banned phrases
    for (const pattern of BANNED_PHRASES) {
      if (pattern.test(narration)) {
        warnings.push({
          code: 'BANNED_PHRASE',
          scene: sceneNum,
          message: `Scene ${sceneNum} contains web-only phrase: "${narration.match(pattern)?.[0]}"`,
        })
      }
    }

    // 2. Suspiciously short narration
    if (narration.length > 0 && narration.length < 20) {
      warnings.push({
        code: 'SHORT_NARRATION',
        scene: sceneNum,
        message: `Scene ${sceneNum} narration is only ${narration.length} chars (suspiciously short)`,
      })
    }

    // 3. Approaching TTS limit
    if (narration.length > 3000 && narration.length <= TTS_MAX_CHARS) {
      warnings.push({
        code: 'LONG_NARRATION',
        scene: sceneNum,
        message: `Scene ${sceneNum} narration is ${narration.length} chars (approaching ${TTS_MAX_CHARS} limit)`,
      })
    }

    // 4. Contact info mismatch — phone numbers
    if (options.contactInfo?.phone) {
      const providedDigits = options.contactInfo.phone.replace(/\D/g, '')
      const foundPhones = narration.match(PHONE_REGEX)
      if (foundPhones) {
        for (const found of foundPhones) {
          const foundDigits = found.replace(/\D/g, '')
          if (foundDigits !== providedDigits && !providedDigits.endsWith(foundDigits) && !foundDigits.endsWith(providedDigits)) {
            warnings.push({
              code: 'CONTACT_MISMATCH',
              scene: sceneNum,
              message: `Scene ${sceneNum} contains phone "${found}" which doesn't match provided "${options.contactInfo.phone}"`,
            })
          }
        }
      }
    }

    // 6. Duplicate titles
    const title = (scene.title || '').trim().toLowerCase()
    if (title && seenTitles.has(title)) {
      warnings.push({
        code: 'DUPLICATE_TITLE',
        scene: sceneNum,
        message: `Scene ${sceneNum} has duplicate title: "${scene.title}"`,
      })
    }
    if (title) seenTitles.add(title)
  }

  // 5. Too many scenes
  if (scenes.length > 12) {
    warnings.push({
      code: 'TOO_MANY_SCENES',
      message: `Script has ${scenes.length} scenes (unusually long video)`,
    })
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  }
}
