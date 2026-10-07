'use client'

import { Tabs } from '../../../../_components/kit'
import QuoteSection from './QuoteSection'
import FollowUpSection, { type FollowUpPlan } from './FollowUpSection'

type Notice = (n: { type: 'error' | 'success'; message: string }) => void
export type ExtrasTab = 'quote' | 'followup'

/**
 * The page's secondary area: the paid-plan tools that used to stack under
 * the player one after another — Quote / Invoice and the Follow-Up Plan —
 * now behind two tabs. (Duplicate, Social posts, Rename and Delete are in the
 * header's More menu.) Not shown on free plans, as before.
 */
export default function MoreForThis({ videoId, thing, tab, setTab, quote, setQuote, quoteBuilderOpen, setQuoteBuilderOpen, plan, setPlan, onNotice }: {
  videoId: string
  thing: 'video' | 'presentation'
  tab: ExtrasTab
  setTab: (t: ExtrasTab) => void
  quote: any
  setQuote: (q: any) => void
  quoteBuilderOpen: boolean
  setQuoteBuilderOpen: (open: boolean) => void
  plan: FollowUpPlan | null
  setPlan: (updater: (prev: FollowUpPlan | null) => FollowUpPlan | null) => void
  onNotice: Notice
}) {
  return (
    <section className="res-card res-more" aria-label={`More for this ${thing}`} id="more-for-this">
      <h2 className="res-h2">More for this {thing}</h2>
      <Tabs<ExtrasTab>
        label="More for this"
        tabs={[{ key: 'quote', label: 'Quote / Invoice' }, { key: 'followup', label: 'Follow-Up Plan' }]}
        current={tab}
        onSelect={setTab}
      />
      {tab === 'quote' ? (
        <QuoteSection
          videoId={videoId}
          quote={quote}
          setQuote={setQuote}
          builderOpen={quoteBuilderOpen}
          setBuilderOpen={setQuoteBuilderOpen}
          onNotice={onNotice}
        />
      ) : (
        <FollowUpSection videoId={videoId} plan={plan} setPlan={setPlan} onNotice={onNotice} />
      )}
    </section>
  )
}
