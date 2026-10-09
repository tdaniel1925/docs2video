import AccountLayout from './AccountLayout'

// The account area's menu (round B): see settings/account-sections.ts.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AccountLayout>{children}</AccountLayout>
}
