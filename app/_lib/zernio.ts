/**
 * Zernio social-publishing client. ONE master API key (ZERNIO_API_KEY) manages
 * many PROFILES — one profile per client (tenant). Each profile holds one
 * connected account per platform. Everything is scoped by profileId.
 *
 * Docs: https://docs.zernio.com  ·  base https://zernio.com/api/v1
 * Replaces the previous AyrShare integration.
 */

const BASE = (process.env.ZERNIO_API_BASE || 'https://zernio.com/api/v1').replace(/\/$/, '')

export type ZernioPlatform =
  | 'twitter' | 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube'
  | 'pinterest' | 'reddit' | 'bluesky' | 'threads' | 'telegram' | 'snapchat' | 'whatsapp' | 'discord'

export interface ZernioAccount {
  accountId: string
  platform: ZernioPlatform
  name?: string
  avatarUrl?: string
}

export interface ZernioPostInput {
  profileId: string
  content: string
  /** Target specific accounts; if omitted, Zernio auto-resolves the profile's accounts. */
  platforms?: { platform: ZernioPlatform; accountId: string }[]
  /** Media as PUBLIC URLs (Zernio fetches them). Images and/or a video mp4 URL. */
  mediaUrls?: string[]
  videoUrl?: string
  /** YouTube needs these when posting a video. */
  youtube?: { title?: string; description?: string; visibility?: 'public' | 'unlisted' | 'private' }
  /** ISO 8601 local datetime + timezone to schedule; omit both + publishNow for a draft. */
  scheduledFor?: string
  timezone?: string
  publishNow?: boolean
}

function apiKey(): string {
  const k = process.env.ZERNIO_API_KEY
  if (!k) throw new Error('ZERNIO_API_KEY not configured')
  return k
}

async function zfetch<T>(path: string, init?: RequestInit & { query?: Record<string, string | undefined> }): Promise<T> {
  const url = new URL(BASE + path)
  if (init?.query) for (const [k, v] of Object.entries(init.query)) if (v != null) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    signal: AbortSignal.timeout(30000),
  })
  const text = await res.text()
  let body: any = {}
  try { body = text ? JSON.parse(text) : {} } catch { body = { error: text.slice(0, 200) } }
  if (!res.ok) throw new Error(body.error || body.message || `Zernio ${res.status}: ${text.slice(0, 160)}`)
  return body as T
}

/** Create a profile for a client (tenant). Returns its id to store on the user. */
export async function createProfile(name: string, description?: string): Promise<string> {
  const r = await zfetch<{ profile?: { _id?: string }; _id?: string }>('/profiles', {
    method: 'POST',
    body: JSON.stringify({ name, description: description || '' }),
  })
  const id = r.profile?._id || (r as any)._id
  if (!id) throw new Error('Zernio createProfile: no profile id returned')
  return id
}

/**
 * Start a HEADLESS connect flow for one platform under a client's profile.
 * Returns the authUrl to redirect the client's browser to. They return to
 * `redirectUrl` with { tempToken, userProfile, connect_token, step, platform }.
 */
export async function getConnectUrl(opts: {
  platform: ZernioPlatform; profileId: string; redirectUrl: string; headless?: boolean
}): Promise<string> {
  const r = await zfetch<{ authUrl: string }>(`/connect/${opts.platform}`, {
    method: 'GET',
    query: {
      profileId: opts.profileId,
      redirect_url: opts.redirectUrl,
      headless: (opts.headless ?? true) ? 'true' : undefined,
    },
  })
  return r.authUrl
}

/** Headless step: list the pages/orgs/boards the user can attach for this platform. */
export async function listSelectablePages(opts: {
  platform: ZernioPlatform; profileId: string; tempToken: string
}): Promise<any[]> {
  const r = await zfetch<{ pages?: any[]; items?: any[] }>(`/connect/${opts.platform}/select-page`, {
    method: 'GET',
    query: { profileId: opts.profileId, tempToken: opts.tempToken },
  })
  return r.pages || r.items || []
}

/** Headless step: finalize the connection by selecting a page/account. */
export async function selectPage(opts: {
  platform: ZernioPlatform; profileId: string; pageId: string; tempToken: string
  userProfile: unknown; redirectUrl?: string
}): Promise<{ accountId?: string }> {
  const r = await zfetch<{ account?: { accountId?: string } }>(`/connect/${opts.platform}/select-page`, {
    method: 'POST',
    body: JSON.stringify({
      profileId: opts.profileId, pageId: opts.pageId, tempToken: opts.tempToken,
      userProfile: opts.userProfile, redirect_url: opts.redirectUrl,
    }),
  })
  return { accountId: r.account?.accountId }
}

/** List a profile's connected accounts (with accountIds for posting). */
export async function listAccounts(profileId: string): Promise<ZernioAccount[]> {
  const r = await zfetch<{ accounts?: ZernioAccount[] }>('/accounts', { method: 'GET', query: { profileId } })
  return r.accounts || []
}

/** Create (publish / schedule / draft) a post. */
export async function createPost(input: ZernioPostInput): Promise<{ id?: string }> {
  const media: string[] = []
  if (input.mediaUrls?.length) media.push(...input.mediaUrls)
  const body: Record<string, unknown> = {
    profileId: input.profileId,
    content: input.content,
    ...(input.platforms?.length ? { platforms: input.platforms } : {}),
    ...(media.length ? { mediaUrls: media } : {}),
    ...(input.videoUrl ? { video: input.videoUrl } : {}),
    ...(input.youtube ? { youtube: input.youtube } : {}),
    ...(input.publishNow ? { publishNow: true } : {}),
    ...(input.scheduledFor ? { scheduledFor: input.scheduledFor, timezone: input.timezone || 'UTC' } : {}),
  }
  const r = await zfetch<{ post?: { _id?: string }; _id?: string }>('/posts', {
    method: 'POST', body: JSON.stringify(body),
  })
  return { id: r.post?._id || (r as any)._id }
}

export function isZernioConfigured(): boolean {
  return !!process.env.ZERNIO_API_KEY
}
