/**
 * MONEY AND SAFETY GUARDS FOR THE RENDER SERVICE (audit 2026-10-09).
 *
 * 1. completeIfRunning — a finished render may only mark its video 'completed'
 *    while the row is STILL running. If the app already failed it (the
 *    stuck-video cron, Restart, a refund), the late finish is logged and the
 *    owner is told, but the row is left alone — otherwise the customer gets
 *    the video AND their money back.
 *
 * 2. guardedFetch — fetch a URL that came from a request (a website to read,
 *    a music track, a logo, a photo) WITHOUT letting it reach our own network:
 *    loopback, private ranges, link-local (169.254.x.x — where the ECS task's
 *    credentials live), or anything that is not a plain public address. Every
 *    redirect hop is checked again. Same rules as the app's safeFetch
 *    (app/_lib/brand-scraper.ts) and net-guard (app/_lib/net-guard.ts).
 *
 * Plain CommonJS with no package imports, so it loads anywhere (server.js,
 * commercial.js, tests).
 */
const { lookup } = require('dns/promises')
const { isIP } = require('net')

const RUNNING_STATUSES = ['pending', 'starting', 'scripting', 'generating_slides', 'generating_audio', 'assembling', 'queued', 'processing', 'rendering']

/**
 * Write the completion fields only if the video is still running.
 * Returns true when the row was marked, false when it was left alone (late
 * finish) or the write failed. Never throws.
 */
async function completeIfRunning(sb, videoId, fields, opts = {}) {
  const tag = opts.tag || 'render'
  const report = typeof opts.report === 'function' ? opts.report : () => Promise.resolve()
  try {
    const { data, error } = await sb.from('videos').update(fields).eq('id', videoId).in('status', RUNNING_STATUSES).select('id')
    if (error) {
      console.error(`[${tag} ${videoId}] completion write failed: ${error.message}`)
      await Promise.resolve(report({ source: tag, videoId, userId: opts.userId, stage: 'completion-write', message: `Could not mark the video finished: ${error.message}` })).catch(() => {})
      return false
    }
    if (!data || data.length === 0) {
      console.warn(`[${tag} ${videoId}] finished, but the video is no longer running (failed / refunded / restarted) — NOT marking it completed`)
      await Promise.resolve(report({ source: tag, videoId, userId: opts.userId, stage: 'late-finish', message: 'A render finished after its video had already been failed or refunded. It was NOT marked completed (no free video). Check the row if the customer asks.' })).catch(() => {})
      return false
    }
    return true
  } catch (e) {
    console.error(`[${tag} ${videoId}] completion write crashed: ${e && e.message}`)
    return false
  }
}

// ── address rules ──────────────────────────────────────────────────────────
function ipv4ToInt(ip) { return ip.split('.').reduce((acc, p) => (acc << 8) + (Number(p) & 255), 0) >>> 0 }
function inV4(ip, cidr) {
  const [base, bitsStr] = cidr.split('/')
  const bits = Number(bitsStr)
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask)
}
const PRIVATE_V4 = [
  '0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16', '172.16.0.0/12',
  '192.0.0.0/24', '192.0.2.0/24', '192.168.0.0/16', '198.18.0.0/15', '198.51.100.0/24',
  '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4',
]

/** True for any address that is not a normal public internet address. */
function isPrivateAddress(ip) {
  const kind = isIP(ip)
  if (kind === 4) return PRIVATE_V4.some((c) => inV4(ip, c))
  if (kind === 6) {
    const v = ip.toLowerCase().replace(/^\[|\]$/g, '')
    if (v === '::' || v === '::1') return true
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateAddress(mapped[1])
    if (/^f[cd]/.test(v)) return true
    if (/^fe[89ab]/.test(v)) return true
    if (/^ff/.test(v)) return true
    if (v.startsWith('64:ff9b:')) return true
    if (v.startsWith('2001:db8')) return true
    return false
  }
  return true
}

const defaultResolve = (host) => lookup(host, { all: true, verbatim: true })

/** Is this a public http(s) URL whose host resolves ONLY to public addresses? */
async function isSafePublicUrl(rawUrl, resolve = defaultResolve) {
  let url
  try { url = new URL(String(rawUrl)) } catch { return false }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return false
  if (isIP(host)) return !isPrivateAddress(host)
  try {
    const addrs = await resolve(host)
    return Array.isArray(addrs) && addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address))
  } catch {
    return false
  }
}

/**
 * fetch() for a URL that came from outside. Same arguments and result as
 * fetch; THROWS 'blocked address' for an unsafe hop (so existing try/catch
 * around a fetch handles it like any other failed download). `data:` URLs are
 * passed straight through — they can't reach a network.
 */
async function guardedFetch(rawUrl, init = {}, opts = {}) {
  const resolve = opts.resolve || defaultResolve
  const doFetch = opts.fetch || fetch
  const maxHops = opts.maxHops || 5
  const s = String(rawUrl || '')
  if (s.startsWith('data:')) return doFetch(s, init)
  let current = s
  for (let hop = 0; hop <= maxHops; hop++) {
    if (!(await isSafePublicUrl(current, resolve))) {
      const e = new Error(`blocked address: ${safeHost(current)}`)
      e.code = 'BLOCKED_ADDRESS'
      throw e
    }
    const res = await doFetch(current, { ...init, redirect: 'manual' })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers && typeof res.headers.get === 'function' ? res.headers.get('location') : null
      if (!loc) return res
      current = new URL(loc, current).toString()
      continue
    }
    return res
  }
  throw new Error('too many redirects')
}

function safeHost(u) { try { return new URL(u).hostname } catch { return 'invalid url' } }

module.exports = { RUNNING_STATUSES, completeIfRunning, isPrivateAddress, isSafePublicUrl, guardedFetch }
