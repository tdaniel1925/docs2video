import { redirect } from 'next/navigation'

/**
 * The standalone deck builder has been consolidated into the unified create
 * wizard (Slides path) so there's a single way to make any output. This route
 * now redirects there. The previous implementation is preserved in git history.
 */
export default function DeckBuilderRedirect() {
  redirect('/create?type=slides&for=general')
}
