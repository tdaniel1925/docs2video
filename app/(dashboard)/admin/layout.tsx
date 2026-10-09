import { redirect } from 'next/navigation'
import { requireAdmin } from '../../_lib/admin'
import AdminShell from './_components/AdminSidebar'

// Server-side gate for every /admin page. The layout used to be a client
// component, so non-admins got the whole admin shell (and each page's code)
// before the data calls were refused. Now non-admins never receive it.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin()
  if (!admin) redirect('/dashboard')
  // Follows the light/dark choice like the rest of the app (checked in dark
  // 2026-10-09; it used to stay light).
  return <AdminShell>{children}</AdminShell>
}
