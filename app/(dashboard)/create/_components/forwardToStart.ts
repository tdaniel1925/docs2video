import { redirect } from 'next/navigation'

/**
 * The 4-step create flow starts at /create. The old first screens — the
 * "What do you want to create?" chooser and the separate "Who's this for?"
 * page — now forward there, keeping the parameters old links still carry
 * (clients page "Send video", the signup email, saved bookmarks).
 */
export async function forwardToStart(searchParams: Promise<Record<string, string | string[] | undefined>>): Promise<never> {
  const sp = await searchParams
  const q = new URLSearchParams()
  for (const key of ['clientId', 'type', 'for', 'id']) {
    const v = sp[key]
    if (typeof v === 'string' && v) q.set(key, v)
  }
  const qs = q.toString()
  redirect(qs ? `/create?${qs}` : '/create')
}
