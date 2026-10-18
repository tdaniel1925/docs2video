import type { SupabaseClient } from '@supabase/supabase-js'
import { encryptSecret } from './secret-box'

/** Outlook connect needs all three; production has been missing them. */
export function microsoftConfigured(): boolean {
  return !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && process.env.MICROSOFT_REDIRECT_URI)
}

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

/** Make `id` the user's only default sending connection. */
export async function makeOnlyDefault(admin: SupabaseClient, userId: string, id: string): Promise<void> {
  await admin.from('email_connections').update({ is_default: false }).eq('user_id', userId).neq('id', id)
  await admin.from('email_connections').update({ is_default: true }).eq('user_id', userId).eq('id', id)
}

/**
 * Save a Gmail / Outlook connection. The NEW row is written first and only
 * then are the user's older connections for the same provider removed, so a
 * failed save never leaves the user with nothing. Tokens are encrypted.
 */
export async function saveOAuthConnection(admin: SupabaseClient, input: {
  userId: string
  provider: 'google' | 'microsoft'
  emailAddress: string
  accessToken: string
  refreshToken?: string | null
  expiresInSeconds?: number | null
}): Promise<void> {
  const expiresAt = new Date(Date.now() + (Number(input.expiresInSeconds) || 3600) * 1000).toISOString()
  const { data, error } = await admin.from('email_connections').insert({
    user_id: input.userId,
    provider: input.provider,
    email_address: input.emailAddress,
    access_token: encryptSecret(input.accessToken),
    refresh_token: encryptSecret(input.refreshToken ?? null),
    token_expires_at: expiresAt,
    is_default: false,
  }).select('id').single()
  if (error || !data) throw new Error(`Could not save the ${input.provider} connection: ${error?.message ?? 'no row returned'}`)

  await admin.from('email_connections').delete()
    .eq('user_id', input.userId).eq('provider', input.provider).neq('id', data.id)
  await makeOnlyDefault(admin, input.userId, data.id)
}
