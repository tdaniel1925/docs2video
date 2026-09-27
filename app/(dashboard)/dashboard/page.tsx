import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../_lib/supabase/server'
import { getBrand } from '../../_lib/brand-server'
import { getBalance } from '../../_lib/credits'
import Greeting from './_home/Greeting'
import { loadHomeData, type ProjectRow } from './_home/load'
import { discardDraft } from './_home/actions'
import type { ActionCard } from './_home/derive'
import s from './_home/home.module.css'

// Loom walkthrough — set NEXT_PUBLIC_GETTING_STARTED_VIDEO to a real Loom embed
// URL to show the link on the first-visit card. Unset → no link (avoids a dead
// placeholder link for every new user).
const GETTING_STARTED_VIDEO = process.env.NEXT_PUBLIC_GETTING_STARTED_VIDEO || ''
const HAS_GETTING_STARTED_VIDEO = GETTING_STARTED_VIDEO.includes('loom.com/embed/') && !GETTING_STARTED_VIDEO.includes('YOUR_LOOM_ID')

const PAID = ['starter', 'pro', 'professional', 'active', 'business', 'enterprise']

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
  const isPaid = PAID.includes(status)
  const isPastDue = status === 'past_due'
  const isTrial = !isPaid && !isPastDue && !profile?.referred_by
  const planName = status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ') : 'Free'
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
        <div>
          <Greeting firstName={firstName} className={s.hello} />
          <p className={s.sub}>{subline}</p>
        </div>
        <Link href="/create" className="btn btn-primary">+ New project</Link>
      </div>

      {isPastDue && (
        <div className={`${s.banner} ${s.bannerWarn}`}>
          <p><strong>Your last payment didn’t go through.</strong> Update your card so nothing stops.</p>
          <Link href="/settings" className="btn btn-sm btn-primary">Update card</Link>
        </div>
      )}
      {isTrial && (
        <div className={`${s.banner} ${credits <= 0 ? s.bannerWarn : s.bannerInfo}`}>
          <p>
            {credits <= 0
              ? <><strong>Out of credits.</strong> Top up or pick a plan to keep making.</>
              : <><strong>Free credits:</strong> {credits.toLocaleString()} left.</>}
          </p>
          <Link href="/pricing" className="btn btn-sm btn-primary">{credits <= 0 ? 'Choose a plan' : 'Upgrade'}</Link>
        </div>
      )}

      {home.cards.length > 0 && (
        <div className={s.cards}>
          {home.cards.map(c => <Card key={c.key} card={c} />)}
        </div>
      )}

      <div className={s.grid}>
        <div>
          {home.hasAnyProject ? (
            <>
              <div className={s.sectionHead}>
                <h2>Projects</h2>
                {home.totalProjects > home.projects.length && (
                  <Link href="/videos">See all {home.totalProjects} →</Link>
                )}
              </div>
              <Projects rows={home.projects} />
            </>
          ) : (
            <FirstVisit />
          )}
        </div>

        <aside className={s.rail}>
          <Link href="/create" className={s.drop}>
            <h3>Start from a document</h3>
            <p>Have a PDF, Word file or PowerPoint? Start a project and add it on the first screen.</p>
            <span className={s.dropZone}>Choose a file →</span>
          </Link>

          <div className={s.box}>
            <h3>This month</h3>
            {home.hasAnyProject && (
              <>
                <Stat label="Emails sent" value={home.month.sent} />
                <Stat label="Projects watched" value={home.month.watched} />
                <Stat label="Clicked to book a call" value={home.month.bookingClicks} />
              </>
            )}
            <Stat label="Credits left" value={credits} />
            <p className={s.boxNote}>
              {planName} plan · <Link href="/pricing">Plans &amp; credits</Link>
            </p>
          </div>
        </aside>
      </div>
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

function Card({ card }: { card: ActionCard }) {
  const tone = card.kind === 'not_opened' ? s.cardQuiet : card.kind === 'booked' ? s.cardBooked : ''
  return (
    <div className={`${s.card} ${tone}`}>
      <span className={s.eyebrow}>{card.eyebrow}</span>
      <p className={s.cardTitle}><strong>{card.who}</strong>{card.what}</p>
      <p className={s.cardDetail}>{card.detail}</p>
      <div className={s.cardActions}>
        <Link href={card.primary.href} className="btn btn-sm btn-primary">{card.primary.label}</Link>
        {card.secondary && (
          card.secondary.href.startsWith('tel:')
            ? <a href={card.secondary.href} className="btn btn-sm btn-soft">{card.secondary.label}</a>
            : <Link href={card.secondary.href} className="btn btn-sm btn-soft">{card.secondary.label}</Link>
        )}
      </div>
    </div>
  )
}

function Projects({ rows }: { rows: ProjectRow[] }) {
  if (rows.length === 0) {
    return <div className={`${s.table} ${s.empty}`}>Nothing here yet.</div>
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
          <span role="cell" style={{ minWidth: 0, display: 'flex' }}>
            {r.external
              ? <a href={r.href} target="_blank" rel="noopener noreferrer" className={s.name}>{r.name}</a>
              : <Link href={r.href} className={s.name}>{r.name}</Link>}
          </span>
          <span role="cell" className={s.muted}>{r.client ?? 'No client'}</span>
          <span role="cell" className={s.muted}>{r.made}</span>
          <span role="cell"><span className={`${s.pill} ${s[`tone-${r.status.tone}`]}`}>{r.status.label}</span></span>
          <span role="cell" className={s.rowActions}>
            {r.draftId ? (
              <>
                <Link href={r.href} className="btn btn-sm btn-soft">Continue</Link>
                <form action={discardDraft.bind(null, r.draftId)}>
                  <button type="submit" className={s.discard}>Discard</button>
                </form>
              </>
            ) : r.external ? (
              <a href={r.href} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-soft">Open</a>
            ) : (
              <Link href={r.href} className="btn btn-sm btn-soft">Open</Link>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

function FirstVisit() {
  return (
    <div className={s.start}>
      <h2>Make your first video</h2>
      <p>Four short steps. Nothing is made or charged until you say so.</p>
      <ol className={s.steps}>
        <li><span className={s.num}>1</span><span><b>What it’s about.</b> Pick the client, then add a document, a web link, or describe it.</span></li>
        <li><span className={s.num}>2</span><span><b>Check the story.</b> Read what it will say and change anything.</span></li>
        <li><span className={s.num}>3</span><span><b>Make it yours.</b> Pick the look and the voice.</span></li>
        <li><span className={s.num}>4</span><span><b>Send it.</b> Share the link and see when they watch.</span></li>
      </ol>
      <div className={s.startActions}>
        <Link href="/create" className="btn btn-primary">Start your first project</Link>
        {HAS_GETTING_STARTED_VIDEO && (
          <a href={GETTING_STARTED_VIDEO.replace('/embed/', '/share/')} target="_blank" rel="noopener noreferrer">Watch the 2-minute walkthrough</a>
        )}
        <Link href="/help/getting-started">Read the getting-started guide</Link>
      </div>
    </div>
  )
}
