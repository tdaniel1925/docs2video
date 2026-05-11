export const INFOGRAPHIC_WIDTH = 1080
export const INFOGRAPHIC_HEIGHT = 1920

export const PLAN_LIMITS = {
  trial: { credits: 10 },
  active: { credits: 100 },
} as const

export const SUPPORTED_PDF_TYPES = ['application/pdf']
export const MAX_PDF_SIZE = 20 * 1024 * 1024 // 20MB
export const MAX_LOGO_SIZE = 5 * 1024 * 1024 // 5MB
