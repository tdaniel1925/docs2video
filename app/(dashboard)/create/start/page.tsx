import { forwardToStart } from '../_components/forwardToStart'

/* The format chooser is gone: what to make (a video or a presentation) is
   picked at step 3, "Make it yours". Commercials are linked from step 1. */
export default async function CreateStartPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return forwardToStart(searchParams)
}
