import { redirect } from 'next/navigation'
import { requireAdmin } from '../../_lib/admin'
import DevTool from './DevTool'

// /template-demo is an INTERNAL dev tool (template preview), not a customer
// feature. No nav entry; gate to admins so users who hit the URL go to the
// dashboard.
export default async function Page() {
  const admin = await requireAdmin()
  if (!admin) redirect('/dashboard')
  return <DevTool />
}
