import { redirect } from 'next/navigation'
import { requireAdmin } from '../../_lib/admin'
import DevTool from './DevTool'

// /demo-slide is an INTERNAL dev tool (OpenAI-vs-Gemini image A/B test), not a
// customer feature. It has no nav entry; gate it to admins so a user who lands
// on the URL is sent to the dashboard instead of a confusing internal tool.
export default async function Page() {
  const admin = await requireAdmin()
  if (!admin) redirect('/dashboard')
  return <DevTool />
}
