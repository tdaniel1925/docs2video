/**
 * THE CREATE FLOW'S FRAME. One centred, wide column — no step list on the
 * left and no "so far" panel on the right (owner-approved sketch, 2026-10-09).
 * The three steps live in the focus header at the top (Header.tsx), and each
 * step ends in one bar fixed to the bottom of the screen (BottomBar.tsx):
 * the price on the left, the one main button on the right.
 *
 * Drafts are saved to the account as you go and wait on Home.
 */
export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return <div className="cf-shell">{children}</div>
}
