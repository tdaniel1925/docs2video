import { lookup } from 'dns/promises'
import { isIP } from 'net'

/**
 * Stop user-supplied mail-server settings from reaching our own network.
 *
 * The SMTP setup form connects to whatever host/port the user types. Without
 * a check, "host = 169.254.169.254" or "localhost:6379" turns the server into
 * a probe of internal services (SSRF). We only allow real mail ports, and the
 * host must resolve ONLY to public addresses. The caller then connects to the
 * address we checked (not the name again), so a DNS answer that changes
 * between check and connect can't slip through.
 */

export const ALLOWED_SMTP_PORTS = [25, 465, 587, 2525] as const

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + (Number(part) & 255), 0) >>> 0
}

function inV4(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split('/')
  const bits = Number(bitsStr)
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask)
}

const PRIVATE_V4 = [
  '0.0.0.0/8',       // "this" network
  '10.0.0.0/8',      // private
  '100.64.0.0/10',   // carrier-grade NAT
  '127.0.0.0/8',     // loopback
  '169.254.0.0/16',  // link-local (cloud metadata lives here)
  '172.16.0.0/12',   // private
  '192.0.0.0/24',    // IETF protocol assignments
  '192.0.2.0/24',    // documentation
  '192.168.0.0/16',  // private
  '198.18.0.0/15',   // benchmarking
  '198.51.100.0/24', // documentation
  '203.0.113.0/24',  // documentation
  '224.0.0.0/4',     // multicast
  '240.0.0.0/4',     // reserved + broadcast
]

/** True for any address that is not a normal public internet address. */
export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip)
  if (kind === 4) return PRIVATE_V4.some(c => inV4(ip, c))
  if (kind === 6) {
    const v = ip.toLowerCase().replace(/^\[|\]$/g, '')
    if (v === '::' || v === '::1') return true
    // IPv4-mapped (::ffff:10.0.0.1) — judge by the embedded IPv4.
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateAddress(mapped[1])
    if (/^f[cd]/.test(v)) return true           // fc00::/7 unique local
    if (/^fe[89ab]/.test(v)) return true        // fe80::/10 link-local
    if (/^ff/.test(v)) return true              // multicast
    if (v.startsWith('64:ff9b:')) return true   // NAT64 can reach IPv4 private space
    if (v.startsWith('2001:db8')) return true   // documentation
    return false
  }
  return true // not an IP at all — treat as unsafe
}

export type SmtpTargetCheck = { ok: true; address: string; hostname: string } | { ok: false; error: string }

/**
 * Check a user-entered SMTP host + port. `resolve` is injectable for tests.
 */
export async function checkSmtpTarget(
  host: unknown,
  port: unknown,
  resolve: (h: string) => Promise<{ address: string }[]> = h => lookup(h, { all: true, verbatim: true }),
): Promise<SmtpTargetCheck> {
  const p = Number(port)
  if (!Number.isInteger(p) || !(ALLOWED_SMTP_PORTS as readonly number[]).includes(p)) {
    return { ok: false, error: `Use a standard mail port (${ALLOWED_SMTP_PORTS.join(', ')}).` }
  }
  const hostname = typeof host === 'string' ? host.trim().toLowerCase().replace(/\.$/, '') : ''
  if (!hostname || hostname.length > 253 || /[\s/@:?#]/.test(hostname.replace(/^\[.*\]$/, 'ip6'))) {
    return { ok: false, error: 'Enter a valid mail server name, like smtp.example.com.' }
  }
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { ok: false, error: 'That mail server address is not allowed.' }
  }

  const literal = hostname.replace(/^\[|\]$/g, '')
  if (isIP(literal)) {
    return isPrivateAddress(literal) ? { ok: false, error: 'That mail server address is not allowed.' } : { ok: true, address: literal, hostname: literal }
  }

  let addrs: { address: string }[]
  try {
    addrs = await resolve(hostname)
  } catch {
    return { ok: false, error: 'We could not find that mail server. Check the server name.' }
  }
  if (!addrs.length) return { ok: false, error: 'We could not find that mail server. Check the server name.' }
  if (addrs.some(a => isPrivateAddress(a.address))) {
    return { ok: false, error: 'That mail server address is not allowed.' }
  }
  return { ok: true, address: addrs[0].address, hostname }
}
