import { forwardToStart } from '../_components/forwardToStart'

/* "Who's this for?" is now the first question on /create itself, asked once. */
export default async function ClientStepPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return forwardToStart(searchParams)
}
