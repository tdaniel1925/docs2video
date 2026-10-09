import { redirect } from 'next/navigation'
import { requireAdmin } from '../../_lib/admin'
import AdminShell from './_components/AdminSidebar'
import LightOnly from '../../_components/LightOnly'

// Server-side gate for every /admin page. The layout used to be a client
// component, so non-admins got the whole admin shell (and each page's code)
// before the data calls were refused. Now non-admins never receive it.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin()
  if (!admin) redirect('/dashboard')
  // Admin isn't checked in dark mode: it stays light (UI round C).
  return <AdminShell><LightOnly />{children}</AdminShell>
}
