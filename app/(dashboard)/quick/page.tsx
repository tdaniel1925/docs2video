import { redirect } from 'next/navigation'

// /quick was a SEPARATE "quick mode" creation pipeline that duplicated the
// wizard's upload/extract/generate logic and posted to a different API. It had
// no entry point in the nav (0 inbound links) and drifted from the main funnel.
// Consolidated into the single funnel: any stale bookmark lands on /create/start.
// The old implementation is archived at _QuickModeLegacy.tsx.bak.
export default function Page() {
  redirect('/create/start')
}
