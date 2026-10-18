'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import '../admin.css'

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

const tabHref = (tab: string) => (tab === 'dashboard' ? '/admin' : `/admin?tab=${tab}`)

function useCurrent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'dashboard'
  const onIndex = pathname === '/admin'
  const current = onIndex
    ? tabHref(activeTab)
    : GROUPS.flatMap((g) => g.links).find((l) => pathname.startsWith(l.href))?.href ?? ''
  return { pathname, activeTab, onIndex, current }
}

function SidebarNav() {
  const { pathname, activeTab, onIndex } = useCurrent()
  return (
    <nav aria-label="Admin">
      <div className="admin-nav-group">
        <div className="admin-nav-label">Overview</div>
        {OVERVIEW_TABS.map(t => (
          <Link
            key={t.tab}
            href={tabHref(t.tab)}
            className={`admin-nav-link ${onIndex && activeTab === t.tab ? 'active' : ''}`}
            aria-current={onIndex && activeTab === t.tab ? 'page' : undefined}
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
              aria-current={pathname.startsWith(l.href) ? 'page' : undefined}
            >
              {l.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )
}

/** Phones: the whole side menu as ONE dropdown (it used to fill the first screen). */
function PhoneNav() {
  const router = useRouter()
  const { current } = useCurrent()
  return (
    <label className="admin-phone-nav">
      <span className="admin-field-label">Admin page</span>
      <select className="input" value={current} onChange={(e) => { if (e.target.value) router.push(e.target.value) }}>
        {!current && <option value="">Pick a page…</option>}
        <optgroup label="Overview">
          {OVERVIEW_TABS.map((t) => <option key={t.tab} value={tabHref(t.tab)}>{t.label}</option>)}
        </optgroup>
        {GROUPS.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.links.map((l) => <option key={l.href} value={l.href}>{l.label}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

// The admin shell (sidebar + content). The admin CHECK happens in the server
// layout (../layout.tsx) before this is ever sent to the browser.
export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Suspense fallback={null}>
          <SidebarNav />
        </Suspense>
      </aside>
      <Suspense fallback={null}>
        <PhoneNav />
      </Suspense>
      <div className="admin-content">{children}</div>
    </div>
  )
}
