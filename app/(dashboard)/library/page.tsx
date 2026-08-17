import { createClient } from '../../_lib/supabase/server'
import { redirect } from 'next/navigation'
import LibraryBrowser from './LibraryBrowser'

// =============================================================================
// My Library — browse every saved Text2Art job, grouped by PROJECT.
//
// Each project is a collapsible accordion; inside, its designs as a grid, newest
// first. Paginated (a page of projects at a time) so it never becomes an endless
// scroll. Data comes from /api/flyer-library; images are short-lived signed URLs.
// =============================================================================

export const metadata = { title: 'My Library' }

export default async function LibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/library')
  return <LibraryBrowser />
}
