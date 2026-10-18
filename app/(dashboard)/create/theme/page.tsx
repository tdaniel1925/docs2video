import { redirect } from 'next/navigation'

/*
 * The old "Make it yours" address. Making happens on step 8 now
 * (/create/review); old links — and the card page's "come back here" after
 * adding a card — land there with every parameter.
 */
export default async function Forward({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) if (typeof v === 'string') q.set(k, v)
  const qs = q.toString()
  redirect(qs ? `/create/review?${qs}` : '/create/review')
}
