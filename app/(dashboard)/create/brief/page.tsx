import { redirect } from 'next/navigation'

/**
 * The brief (the key points) and the script (the scenes) are one screen now:
 * "Check the story" at /create/script. Old links and bookmarks to the brief
 * page land there, keeping the draft id and the "comparing files failed" flag.
 */
export default async function BriefPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const q = new URLSearchParams()
  for (const key of ['id', 'combine']) {
    const v = sp[key]
    if (typeof v === 'string' && v) q.set(key, v)
  }
  const qs = q.toString()
  redirect(qs ? `/create/script?${qs}` : '/create/script')
}
