// Server-only half of the storefront switch. Kept separate from ./brand.ts
// because this imports next/headers, which cannot be pulled into a client
// component bundle — and Header.tsx (a client component) needs the Brand type.
import { headers } from 'next/headers'
import { brandFromHost, type Brand } from './brand'

/**
 * The storefront for the CURRENT request, read from the Host header.
 *
 * On Vercel the original host arrives as x-forwarded-host; `host` is checked
 * too so this also works locally and behind other proxies.
 *
 * NOTE: calling this makes the calling page dynamic (rendered per request),
 * which is unavoidable — the answer literally depends on the request.
 */
export async function getBrand(): Promise<Brand> {
  const h = await headers()
  return brandFromHost(h.get('x-forwarded-host') ?? h.get('host'))
}
