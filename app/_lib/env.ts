function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) {
    console.warn(`[env] Missing required environment variable: ${name}`)
  }
  return val ?? ''
}

export const env = {
  GEMINI_API_KEY: requireEnv('GEMINI_API_KEY'),
  SUPABASE_URL: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  SUPABASE_ANON_KEY: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  OPENAI_API_KEY: requireEnv('OPENAI_API_KEY'),
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? '',
  IMAGE_MODEL: process.env.IMAGE_MODEL ?? 'gemini-3-pro-image-preview',
}

/**
 * Env vars that MUST be set for the money/auth/render paths to work in prod
 * (audit M3). Surfaced by /api/health so a misconfigured deploy is visible
 * instead of 500-ing at checkout time. Keep in sync with .env.local.example.
 */
export const REQUIRED_GO_LIVE_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_STARTER',
  'STRIPE_PRICE_PRO',
  'STRIPE_PRICE_BUSINESS',
  'STRIPE_PRICE_ENTERPRISE',
  'STRIPE_PRICE_CREDIT_PACK_2500',
  'STRIPE_PRICE_CREDIT_PACK_7500',
  'STRIPE_PRICE_CREDIT_PACK_18000',
  'VIDEO_ASSEMBLY_URL',
  'CRON_SECRET',
] as const

/** Return the names of any required go-live env vars that are unset/empty. */
export function missingRequiredEnv(): string[] {
  return REQUIRED_GO_LIVE_ENV.filter((name) => !(process.env[name] || '').trim())
}
