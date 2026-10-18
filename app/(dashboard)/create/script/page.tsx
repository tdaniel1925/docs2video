import { redirect } from 'next/navigation'

/*
 * The old "Check the story" address. The story is step 2 now (/create/story);
 * old links, bookmarks and saved "continue" links land there with every
 * parameter (id, combine, copied).
 */
export default async function Forward({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) if (typeof v === 'string') q.set(k, v)
  const qs = q.toString()
  redirect(qs ? `/create/story?${qs}` : '/create/story')
}
