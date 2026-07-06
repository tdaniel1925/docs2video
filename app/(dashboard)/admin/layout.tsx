'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

// Admin index tabs live on /admin?tab=X — the page reads the query param.
const OVERVIEW_TABS: { tab: string; label: string }[] = [
  { tab: 'dashboard', label: 'Dashboard' },
  { tab: 'users', label: 'Users' },
  { tab: 'videos', label: 'Videos' },
  { tab: 'billing', label: 'Billing' },
  { tab: 'access', label: 'Manage Access' },
  { tab: 'audit', label: 'Audit Log' },
  { tab: 'prospects', label: 'Prospects' },
  { tab: 'settings', label: 'Settings' },
]

const GROUPS: { label: string; links: { href: string; label: string }[] }[] = [
  {
    label: 'Money',
    links: [
      { href: '/admin/costs', label: 'API Costs' },
      { href: '/admin/revenue', label: 'Revenue' },
      { href: '/admin/billing', label: 'Billing & Sales' },
      { href: '/admin/billing-health', label: 'Billing Health' },
    ],
  },
  {
    label: 'Growth',
    links: [
      { href: '/admin/campaigns', label: 'Campaigns' },
      { href: '/admin/prospects', label: 'Prospect Pipeline' },
      { href: '/admin/bulk', label: 'Bulk Generate' },
      { href: '/admin/affiliates', label: 'Affiliates' },
    ],
  },
  {
    label: 'Platform',
    links: [
      { href: '/admin/api-keys', label: 'API Keys' },
      { href: '/admin/help', label: 'Help Articles' },
      { href: '/admin/system', label: 'System Status' },
      { href: '/admin/logs', label: 'Logs' },
    ],
  },
]

function SidebarNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'dashboard'
  const onIndex = pathname === '/admin'

  return (
    <nav>
      <div className="admin-nav-group">
        <div className="admin-nav-label">Overview</div>
        {OVERVIEW_TABS.map(t => (
          <Link
            key={t.tab}
            href={t.tab === 'dashboard' ? '/admin' : `/admin?tab=${t.tab}`}
            className={`admin-nav-link ${onIndex && activeTab === t.tab ? 'active' : ''}`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {GROUPS.map(g => (
        <div className="admin-nav-group" key={g.label}>
          <div className="admin-nav-label">{g.label}</div>
          {g.links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`admin-nav-link ${pathname.startsWith(l.href) ? 'active' : ''}`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Suspense fallback={null}>
          <SidebarNav />
        </Suspense>
      </aside>
      <div className="admin-content">{children}</div>
    </div>
  )
}
