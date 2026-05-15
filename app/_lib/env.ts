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
