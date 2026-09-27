import IndustryPage, { industryMetadata } from '../../../_components/IndustryPage'

// Copy lives in app/_lib/industry-pages.ts (true claims only).
export const metadata = industryMetadata('legal')

export default function Page() {
  return <IndustryPage slug="legal" />
}
