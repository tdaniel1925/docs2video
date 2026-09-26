import { forwardToStart } from '../_components/forwardToStart'

/* The format chooser is gone: what to make is picked at step 3, "Make it
   yours". Custom graphics and commercials are linked from the first screen. */
export default async function CreateStartPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return forwardToStart(searchParams)
}
