import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createOAuthState, verifyOAuthState } from '../app/_lib/oauth-state'
import { encryptSecret, decryptSecret, isEncrypted } from '../app/_lib/secret-box'
import { checkSmtpTarget, isPrivateAddress } from '../app/_lib/net-guard'
import { cleanWebLink } from '../app/_lib/url-validate'
import { safeNextPath } from '../app/_lib/safe-redirect'

const USER = '11111111-1111-1111-1111-111111111111'
const OTHER = '22222222-2222-2222-2222-222222222222'

describe('OAuth state (Gmail / Outlook connect)', () => {
  const saved = { ...process.env }
  beforeEach(() => { process.env.OAUTH_STATE_SECRET = 'test-secret-for-state-signing' })
  afterEach(() => { process.env = { ...saved } })

  it('accepts a fresh state from the same browser and user', () => {
    const { state, nonce } = createOAuthState(USER, 'google')
    const r = verifyOAuthState(state, { provider: 'google', cookieNonce: nonce, sessionUserId: USER })
    expect(r.ok).toBe(true)
  })

  it('rejects the old attack: a bare user id as state', () => {
    const r = verifyOAuthState(USER, { provider: 'google', cookieNonce: 'x', sessionUserId: USER })
    expect(r.ok).toBe(false)
  })

  it('rejects a state for another user, even with a valid signature', () => {
    const { state, nonce } = createOAuthState(OTHER, 'google')
    const r = verifyOAuthState(state, { provider: 'google', cookieNonce: nonce, sessionUserId: USER })
    expect(r).toEqual({ ok: false, reason: 'wrong_user' })
  })

  it('rejects with no signed-in session', () => {
    const { state, nonce } = createOAuthState(USER, 'google')
    expect(verifyOAuthState(state, { provider: 'google', cookieNonce: nonce, sessionUserId: null }).ok).toBe(false)
  })

  it('rejects a missing or different nonce cookie (single use, same browser)', () => {
    const { state } = createOAuthState(USER, 'google')
    expect(verifyOAuthState(state, { provider: 'google', cookieNonce: undefined, sessionUserId: USER })).toEqual({ ok: false, reason: 'nonce_mismatch' })
    expect(verifyOAuthState(state, { provider: 'google', cookieNonce: 'nope', sessionUserId: USER })).toEqual({ ok: false, reason: 'nonce_mismatch' })
  })

  it('rejects tampering, the wrong provider, and expiry', () => {
    const { state, nonce } = createOAuthState(USER, 'google')
    const [body, sig] = state.split('.')
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), u: OTHER })).toString('base64url')
    expect(verifyOAuthState(`${forged}.${sig}`, { provider: 'google', cookieNonce: nonce, sessionUserId: OTHER })).toEqual({ ok: false, reason: 'bad_signature' })
    expect(verifyOAuthState(state, { provider: 'microsoft', cookieNonce: nonce, sessionUserId: USER })).toEqual({ ok: false, reason: 'wrong_provider' })
    expect(verifyOAuthState(state, { provider: 'google', cookieNonce: nonce, sessionUserId: USER, now: Date.now() + 11 * 60_000 })).toEqual({ ok: false, reason: 'expired' })
  })

  it('a state signed with another secret fails', () => {
    const { state, nonce } = createOAuthState(USER, 'google')
    process.env.OAUTH_STATE_SECRET = 'different'
    expect(verifyOAuthState(state, { provider: 'google', cookieNonce: nonce, sessionUserId: USER }).ok).toBe(false)
  })
})

describe('secret-box encryption at rest', () => {
  const saved = process.env.DATA_ENCRYPTION_KEY
  afterEach(() => { if (saved === undefined) delete process.env.DATA_ENCRYPTION_KEY; else process.env.DATA_ENCRYPTION_KEY = saved })

  it('round-trips and does not store plaintext when a key is set', () => {
    process.env.DATA_ENCRYPTION_KEY = 'k'.repeat(40)
    const enc = encryptSecret('hunter2')!
    expect(isEncrypted(enc)).toBe(true)
    expect(enc).not.toContain('hunter2')
    expect(decryptSecret(enc)).toBe('hunter2')
  })

  it('reads old plaintext rows unchanged', () => {
    process.env.DATA_ENCRYPTION_KEY = 'k'.repeat(40)
    expect(decryptSecret('legacy-plain')).toBe('legacy-plain')
    expect(decryptSecret(null)).toBeNull()
  })

  it('keeps working (plaintext) with no key, and refuses to guess with the wrong key', () => {
    delete process.env.DATA_ENCRYPTION_KEY
    expect(encryptSecret('abc')).toBe('abc')
    process.env.DATA_ENCRYPTION_KEY = 'a'.repeat(40)
    const enc = encryptSecret('abc')!
    process.env.DATA_ENCRYPTION_KEY = 'b'.repeat(40)
    expect(() => decryptSecret(enc)).toThrow()
  })
})

describe('SMTP host check (SSRF)', () => {
  const pub = async () => [{ address: '142.250.1.108' }]
  const priv = async () => [{ address: '10.0.0.5' }]

  it('flags private, loopback, link-local and metadata addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1']) {
      expect(isPrivateAddress(ip), ip).toBe(true)
    }
    for (const ip of ['8.8.8.8', '142.250.1.108', '2607:f8b0:4004:c07::6c']) {
      expect(isPrivateAddress(ip), ip).toBe(false)
    }
  })

  it('allows a public mail server on a mail port', async () => {
    const r = await checkSmtpTarget('smtp.gmail.com', 587, pub)
    expect(r).toEqual({ ok: true, address: '142.250.1.108', hostname: 'smtp.gmail.com' })
  })

  it('blocks internal hosts, names that resolve inside, and non-mail ports', async () => {
    expect((await checkSmtpTarget('localhost', 587, pub)).ok).toBe(false)
    expect((await checkSmtpTarget('169.254.169.254', 587, pub)).ok).toBe(false)
    expect((await checkSmtpTarget('mail.evil.test', 587, priv)).ok).toBe(false)
    expect((await checkSmtpTarget('smtp.gmail.com', 6379, pub)).ok).toBe(false)
    expect((await checkSmtpTarget('smtp.gmail.com', '587abc', pub)).ok).toBe(false)
    expect((await checkSmtpTarget('host/path', 587, pub)).ok).toBe(false)
  })
})

describe('booking / payment link check', () => {
  it('accepts web links and adds https when missing', () => {
    expect(cleanWebLink('https://calendly.com/me')).toBe('https://calendly.com/me')
    expect(cleanWebLink('calendly.com/me')).toBe('https://calendly.com/me')
    expect(cleanWebLink('')).toBe('')
  })
  it('rejects script and data links', () => {
    expect(cleanWebLink('javascript:alert(1)')).toBeNull()
    expect(cleanWebLink('JavaScript:alert(1)')).toBeNull()
    expect(cleanWebLink('data:text/html,hi')).toBeNull()
    expect(cleanWebLink('https://user:pw@evil.com')).toBeNull()
  })
})

describe('in-app redirect targets', () => {
  it('only allows plain in-app paths', () => {
    expect(safeNextPath('/dashboard')).toBe('/dashboard')
    expect(safeNextPath('/create/theme?x=1')).toBe('/create/theme?x=1')
    expect(safeNextPath('//evil.com')).toBe('/dashboard')
    expect(safeNextPath('/\\evil.com')).toBe('/dashboard')
    expect(safeNextPath('https://evil.com')).toBe('/dashboard')
    expect(safeNextPath('javascript:alert(1)')).toBe('/dashboard')
    expect(safeNextPath(null, '/setup')).toBe('/setup')
  })
})
