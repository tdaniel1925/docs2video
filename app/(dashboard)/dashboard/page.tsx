import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../_lib/supabase/server'
import { getBrand } from '../../_lib/brand-server'
import { getBalance } from '../../_lib/credits'
import { getUserTier } from '../../_lib/pricing'
import { planLabel } from '../../_lib/names'
import { Button, Card, CardIcon, CardTitle, CardText, CardGo, Chip, EmptyState, Note, kitButtonClass, type ChipTone } from '../../_components/kit'
import Greeting from './_home/Greeting'
import { loadHomeData, type ProjectRow } from './_home/load'
import { discardDraft } from './_home/actions'
import type { ActionCard, Tone } from './_home/derive'
import { DiscardButton } from './_home/DiscardButton'
import { START_CARDS, PASTE_HREF, type StartCard } from './_home/start-cards'
import s from './_home/home.module.css'

// Loom walkthrough — set NEXT_PUBLIC_GETTING_STARTED_VIDEO to a real Loom embed
// URL to show the link in the welcome line. Unset → no link (avoids a dead
// placeholder link for every new user).
const GETTING_STARTED_VIDEO = process.env.NEXT_PUBLIC_GETTING_STARTED_VIDEO || ''
const HAS_GETTING_STARTED_VIDEO = GETTING_STARTED_VIDEO.includes('loom.com/embed/') && !GETTING_STARTED_VIDEO.includes('YOUR_LOOM_ID')

/*
 * HOME, in the order the sibling apps use: what do you want to make (start
 * cards) → who needs you today (the action cards) → your projects. A new
 * account sees the start cards and a short welcome — the cards ARE the
 * explainer, so there's no separate 4-step list any more.
 */
export default async function HomePage() {
  // SINGLE CHOKE POINT for "where does a signed-in user land?". Login, signup,
  // the auth callback, onboarding and proxy.ts all send people to /dashboard;
  // on another storefront this bounces to that brand's home. On
  // docs2video.com brand.home IS '/dashboard', so this is a no-op there.
  const brand = await getBrand()
  if (brand.home !== '/dashboard') redirect(brand.home)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, balance, home] = await Promise.all([
    supabase.from('profiles')
      .select('full_name, subscription_status, referred_by')
      .eq('id', user.id)
      .single(),
    getBalance(user.id),
    loadHomeData(user.id),
  ])

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || null
  const status = (profile?.subscription_status ?? '').toLowerCase()
  // Paid = any status pricing.ts maps to a paid plan. A hand-typed list here
  // left out 'agency' and 'unlimited', so those customers saw the trial banner.
  const isPaid = getUserTier(status) !== 'free'
  const isPastDue = status === 'past_due'
  const isTrial = !isPaid && !isPastDue && !profile?.referred_by
  // Same words as the avatar menu (names.ts). Capitalising the raw status
  // showed things like "Agency plan" or "Past due plan".
  const plan = planLabel(status)
  const credits = balance.total

  const need = home.peopleNeedingYou
  const subline = !home.hasAnyProject
    ? 'Let’s make your first project.'
    : need > 0
      ? `${need} ${need === 1 ? 'client needs' : 'clients need'} you today.`
      : 'Nobody is waiting on you right now.'

  return (
    <div>
      <div className={s.head}>
        <Greeting firstName={firstName} className={s.hello} />
        <p className={s.sub}>{subline}</p>
      </div>

      {isPastDue && (
        <Note
          tone="warn"
          className={s.banner}
          title="Your last payment didn’t go through."
          action={<Button href="/settings" size="sm">Update card</Button>}
        >
          Update your card so nothing stops.
        </Note>
      )}
      {isTrial && (
        <Note
          tone={credits <= 0 ? 'warn' : 'info'}
          className={s.banner}
          title={credits <= 0 ? 'Out of credits.' : 'Free credits:'}
          action={<Button href="/pricing" size="sm">{credits <= 0 ? 'Choose a plan' : 'Upgrade'}</Button>}
        >
          {credits <= 0 ? 'Top up or pick a plan to keep making.' : `${credits.toLocaleString()} left.`}
        </Note>
      )}

      {/* 1. START SOMETHING NEW */}
      <section className={s.section} aria-labelledby="home-start">
        <h2 id="home-start" className={s.sectionTitle}>Start something new</h2>
        {!home.hasAnyProject && (
          <p className={s.welcome}>
            Welcome! Pick how you’d like to start. Nothing is made or charged until you press <strong>Make it</strong> on step 3.{' '}
            {HAS_GETTING_STARTED_VIDEO && (
              <><a href={GETTING_STARTED_VIDEO.replace('/embed/', '/share/')} target="_blank" rel="noopener noreferrer">Watch the 2-minute walkthrough</a>{' · '}</>
            )}
            <Link href="/help/getting-started">Read the getting-started guide</Link>
          </p>
        )}
        <ul className={s.startGrid}>
          {START_CARDS.map((c) => (
            <li key={c.key}>
              <Card href={c.href} className={s.startCard}>
                <CardIcon><StartIcon kind={c.key} /></CardIcon>
                <CardTitle>{c.title}</CardTitle>
                <CardText>{c.text}</CardText>
                <CardGo>Start →</CardGo>
              </Card>
            </li>
          ))}
        </ul>
        <p className={s.pasteLine}>
          Already have the words? <Link href={PASTE_HREF}>Paste your text</Link>
        </p>
      </section>

      {/* 2. TODAY'S CLIENTS — who clicked to book, who watched, who hasn't opened */}
      {home.cards.length > 0 && (
        <section className={s.section} aria-labelledby="home-today">
          <h2 id="home-today" className={s.sectionTitle}>Today’s clients</h2>
          <div className={s.cards}>
            {home.cards.map(c => <ActionCardView key={c.key} card={c} />)}
          </div>
        </section>
      )}

      {/* 3. PROJECTS, with "This month" beside them */}
      {home.hasAnyProject && (
        <div className={s.grid}>
          <section aria-labelledby="home-projects">
            <div className={s.sectionHead}>
              <h2 id="home-projects" className={s.sectionTitle}>Projects</h2>
              {home.totalProjects > home.projects.length && (
                <Link href="/videos">See all {home.totalProjects} →</Link>
              )}
            </div>
            <Projects rows={home.projects} />
          </section>

          <aside className={s.rail}>
            <Card>
              <h3 className={s.boxTitle}>This month</h3>
              <Stat label="Emails sent" value={home.month.sent} />
              <Stat label="Projects watched" value={home.month.watched} />
              <Stat label="Clicked to book a call" value={home.month.bookingClicks} />
              <Stat label="Credits left" value={credits} />
              <p className={s.boxNote}>
                {plan} · <Link href="/pricing">Plans &amp; credits</Link>
              </p>
            </Card>
          </aside>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className={s.stat}>
      <span>{label}</span>
      <b>{value == null ? '—' : value.toLocaleString()}</b>
    </div>
  )
}

function ActionCardView({ card }: { card: ActionCard }) {
  const tone = card.kind === 'not_opened' ? s.cardQuiet : card.kind === 'booked' ? s.cardBooked : ''
  return (
    <div className={`${s.card} ${tone}`}>
      <span className={s.eyebrow}>{card.eyebrow}</span>
      <p className={s.cardTitle}><strong>{card.who}</strong>{card.what}</p>
      <p className={s.cardDetail}>{card.detail}</p>
      <div className={s.cardActions}>
        <Button href={card.primary.href} size="sm">{card.primary.label}</Button>
        {card.secondary && (
          card.secondary.href.startsWith('tel:')
            // A phone link is not a page: a plain <a> so the phone dials.
            ? <a href={card.secondary.href} className={kitButtonClass('secondary', 'sm')}>{card.secondary.label}</a>
            : <Button href={card.secondary.href} variant="secondary" size="sm">{card.secondary.label}</Button>
        )}
      </div>
    </div>
  )
}

/** Each "where it's at" kind, as a kit chip. Booked is the best news: navy. */
const STATUS_TONE: Record<Tone, ChipTone> = {
  draft: 'neutral',
  making: 'warn',
  failed: 'stop',
  ready: 'neutral',
  sent: 'info',
  watched: 'ok',
  booked: 'strong',
}

function Projects({ rows }: { rows: ProjectRow[] }) {
  if (rows.length === 0) {
    return <EmptyState title="Nothing here yet.">Pick a card above to start your first project.</EmptyState>
  }
  return (
    <div className={s.table} role="table" aria-label="Your projects">
      <div className={s.rowHead} role="row">
        <span role="columnheader">Project</span>
        <span role="columnheader">Client</span>
        <span role="columnheader">Made</span>
        <span role="columnheader">Where it’s at</span>
        <span role="columnheader" aria-hidden="true" />
      </div>
      {rows.map(r => (
        <div key={r.key} className={s.row} role="row">
          <span role="cell" className={s.nameCell}>
            {r.external
              ? <a href={r.href} target="_blank" rel="noopener noreferrer" className={s.name}>{r.name}</a>
              : <Link href={r.href} className={s.name}>{r.name}</Link>}
          </span>
          <span role="cell" className={s.muted}>{r.client ?? 'No client'}</span>
          <span role="cell" className={s.muted}>{r.made}</span>
          <span role="cell"><Chip tone={STATUS_TONE[r.status.tone]}>{r.status.label}</Chip></span>
          <span role="cell" className={s.rowActions}>
            {r.draftId ? (
              <>
                <Button href={r.href} variant="secondary" size="sm">Continue</Button>
                <form action={discardDraft.bind(null, r.draftId)}>
                  <DiscardButton className={s.discard} />
                </form>
              </>
            ) : (
              <Button href={r.href} variant="secondary" size="sm" external={r.external}>Open</Button>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Small line pictures for the start cards (they take the card's colour). */
function StartIcon({ kind }: { kind: StartCard['key'] }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (kind) {
    case 'document':
      return <svg {...common}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>
    case 'website':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
    case 'idea':
      return <svg {...common}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z" /></svg>
    case 'commercial':
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9.5v5l4-2.5z" /></svg>
  }
}
