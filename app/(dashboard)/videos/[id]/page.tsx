'use client'

// =============================================================================
// THE RESULT PAGE — one page built around sending (overhaul phase 4).
//
// Top to bottom, for a finished project:
//   1. its name, Download ▾ and More ▾            (result/ResultHeader)
//   2. Ready to send: what's left, the client's page, ONE send panel
//                                                  (send/ReadyToSend)
//   3. Ask for a change: one bar, routed to the editor that already exists
//      for this kind of project                   (change/ChangeBar)
//   4. Who watched: per email, how far they got    (viewing/ClientViewing)
//   5. More for this: Quote / Invoice, Follow-Up Plan (extras/MoreForThis)
// While it is being made, or if it failed, the page shows that instead
// (making/). This file only wires the parts together; it used to be one
// 2,700-line file with a second, older send window and three editors behind
// three differently-worded buttons.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../_lib/supabase/client'
import type { Video } from '../../../_lib/types'
// ONE definition of which scenes become slides — see visibleScenes.
import { visibleScenes } from '../../../_lib/presentation'
import { CREDIT_COSTS } from '../../../_lib/credits'
import { VIDEO_WORKING } from '../../../_lib/video-status'
import { useVideoRow } from './useVideoRow'
import MakingProgress from './making/MakingProgress'
import FailedCard from './making/FailedCard'
import ResultHeader from './result/ResultHeader'
import { RESULT_CSS } from './result/result-css'
import { isHtmlDeck, outputKind, thingWord } from './result/output'
import ReadyToSend from './send/ReadyToSend'
import ChangeBar, { type ChangeRequest, type SceneInfo } from './change/ChangeBar'
import OlderEditor, { type OlderEditorState } from './change/OlderEditor'
import { addChange, type ChangeEntry } from './change/change-log'
import FixScene, { type FixApplied, type FixStart } from './FixScene'
import ClientViewing from './viewing/ClientViewing'
import MoreForThis, { type ExtrasTab } from './extras/MoreForThis'
import type { FollowUpPlan } from './extras/FollowUpSection'

const PRO_PLANS = ['starter', 'pro', 'professional', 'active', 'business', 'enterprise']

type Notice = { type: 'error' | 'success'; message: string }

const FIX_SUMMARY: Record<FixApplied['action'], (n: number) => string> = {
  'edit-text': (n) => `Changed the words in scene ${n}`,
  rerecord: (n) => `Re-recorded the voice in scene ${n}`,
  'fix-pronunciation': (n) => `Fixed how a word is said in scene ${n}`,
}

export default function VideoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { video, setVideo, userPlan, watch, retry } = useVideoRow(id)

  const [notice, setNotice] = useState<Notice | null>(null)
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), notice.type === 'error' ? 12000 : 6000)
    return () => clearTimeout(t)
  }, [notice])

  // ── Quote + follow-up plan (the send panel needs the quote too) ──
  const [quote, setQuote] = useState<any>(null)
  const [plan, setPlan] = useState<FollowUpPlan | null>(null)
  const [quoteBuilderOpen, setQuoteBuilderOpen] = useState(false)
  const [extrasTab, setExtrasTab] = useState<ExtrasTab>('quote')
  useEffect(() => {
    const supabase = createClient()
    // Newest of each; .single() errored (and showed none) once there were two.
    supabase.from('follow_up_plans').select('*, emails:follow_up_emails(*)')
      .eq('video_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (data) setPlan(data as FollowUpPlan) })
    supabase.from('quotes').select('*')
      .eq('video_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (data) setQuote(data) })
  }, [id])

  // ── Scenes: for the change bar's scene list and jumping the player ──
  const previewVideoRef = useRef<HTMLVideoElement | null>(null)
  const [selectedScene, setSelectedScene] = useState(0)
  const [playerDuration, setPlayerDuration] = useState(0)
  const rawScenes = Array.isArray(video?.script) ? (video!.script as any[]) : []
  // A deck folds away a trailing "call us" scene (the closing card has the same
  // details); a video renders every scene. Same rule as visibleScenes.
  const deck = video ? isHtmlDeck(video) : false
  const scenes = deck ? visibleScenes(rawScenes as any) as any[] : rawScenes
  const slideUrls = video?.slide_urls ?? []
  const durations: number[] = video?.slide_durations ?? []

  const starts = useMemo(() => {
    // Per-scene durations when every value is a real number; else equal
    // division of the length (0 when unknown — never NaN).
    if (durations.length > 0 && durations.every((d) => Number.isFinite(d) && d >= 0)) {
      const out = [0]
      for (let i = 0; i < durations.length - 1; i++) out.push(out[i] + durations[i])
      return out
    }
    const total = playerDuration || (Number.isFinite(video?.duration) ? Number(video?.duration) : 0)
    const each = total > 0 && scenes.length > 0 ? total / scenes.length : 0
    return scenes.map((_, i) => i * each)
  }, [durations, playerDuration, video?.duration, scenes.length])

  const sceneInfo: SceneInfo[] = scenes.map((s: any, i: number) => ({
    label: s?.title || s?.slideData?.headline || s?.headline || `Scene ${i + 1}`,
    thumb: slideUrls[i] || undefined,
    start: deck ? undefined : starts[i],
  }))

  // Follow the player: the scene playing is the scene "This scene" means.
  useEffect(() => {
    const el = previewVideoRef.current
    if (!el || deck) return
    const onTime = () => {
      const t = el.currentTime
      let idx = 0
      for (let i = starts.length - 1; i >= 0; i--) { if (t >= starts[i]) { idx = i; break } }
      setSelectedScene(Math.min(idx, Math.max(0, scenes.length - 1)))
    }
    const onMeta = () => { if (Number.isFinite(el.duration)) setPlayerDuration(el.duration) }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    return () => { el.removeEventListener('timeupdate', onTime); el.removeEventListener('loadedmetadata', onMeta) }
  }, [starts, scenes.length, deck, video?.status, video?.video_url])

  // Land a touch INTO the scene so its first frame shows — clamped against the
  // NEXT scene's start, not the video's end (the old end-clamp snapped the
  // last scene back into the one before it).
  const jumpTo = useCallback((i: number) => {
    setSelectedScene(i)
    const el = previewVideoRef.current
    if (!el || deck) return
    const start = starts[i] ?? 0
    const next = starts[i + 1]
    const dur = el.duration || playerDuration || 0
    const ceiling = next != null ? next - 0.05 : (dur > 0 ? Math.max(dur - 0.05, start) : start)
    let t = Math.min(start + 0.05, ceiling)
    if (!Number.isFinite(t) || t < 0) t = Math.max(start, 0)
    el.currentTime = t
  }, [starts, playerDuration, deck])

  // ── Changes ──
  const [fixStart, setFixStart] = useState<FixStart | null>(null)
  const [older, setOlder] = useState<{ initial: OlderEditorState | null; focusScene?: number } | null>(null)
  const [changesVersion, setChangesVersion] = useState(0)
  const [viewingKey, setViewingKey] = useState(0)

  function onRequest(r: ChangeRequest) {
    if (r.editor === 'fix-scene') {
      setFixStart({ sceneIndex: r.sceneIndex, describe: r.describe, action: r.action, text: r.text })
    } else {
      setOlder({ initial: null, focusScene: r.sceneIndex })
    }
  }

  function onUndo(c: ChangeEntry) {
    if (c.kind === 'presentation') router.push(`/videos/${id}/edit?restore=${encodeURIComponent(c.id)}`)
    else if (c.kind === 'fix-scene') setFixStart({ sceneIndex: c.sceneIndex, action: 'edit-text', text: c.oldText, undo: true })
    else setOlder({ initial: c.before as OlderEditorState, focusScene: undefined })
  }

  function onFixStarted(applied: FixApplied) {
    addChange(id, {
      kind: 'fix-scene',
      summary: FIX_SUMMARY[applied.action](applied.sceneIndex + 1),
      action: applied.action,
      sceneIndex: applied.sceneIndex,
      sceneLabel: applied.sceneLabel,
      oldText: applied.action === 'edit-text' ? applied.oldText : undefined,
    })
    setChangesVersion((v) => v + 1)
    setFixStart(null)
    // The row is now being re-made; show that, and follow it until it's done.
    setVideo((prev) => (prev ? ({ ...prev, status: VIDEO_WORKING, progress_pct: 8, progress_detail: 'Applying your change…' } as Video) : prev))
    watch()
  }

  if (!video) {
    return (
      <div style={{ color: 'var(--ink-light)', padding: '64px', textAlign: 'center' }}>
        <span className="spinner lg" />
      </div>
    )
  }

  const finished = video.status === 'completed'
  const failed = video.status === 'failed'
  const thing = thingWord(video)
  const canQuote = PRO_PLANS.includes(userPlan.toLowerCase())
  const kind = outputKind(video)

  return (
    <div className="res-page" data-output={kind}>
      <style>{RESULT_CSS}</style>

      <ResultHeader video={video} setVideo={setVideo} onNotice={setNotice} />

      {/* While it's being made — or re-made after a change. */}
      {!finished && !failed && (
        <>
          <MakingProgress
            status={video.status}
            createdAt={video.created_at}
            progressDetail={video.progress_detail ?? null}
            progressPct={video.progress_pct ?? null}
            sceneCount={Array.isArray(video.script) ? video.script.length : (video.script as any)?._pipeline_input?.scenes?.length ?? 8}
          />
          <div className="res-hint" style={{ maxWidth: 640, margin: '20px auto 0', textAlign: 'center' }}>
            You can leave — we&apos;ll keep building it. You&apos;ll find it in your <a href="/videos">Library</a> when it&apos;s done.
          </div>
        </>
      )}

      {failed && <FailedCard video={video} onRetry={retry} />}

      {finished && (
        <>
          <ReadyToSend
            video={video}
            setVideo={setVideo}
            quote={quote}
            setQuote={setQuote}
            canQuote={canQuote}
            previewVideoRef={previewVideoRef}
            onSent={() => setViewingKey((k) => k + 1)}
            onAddQuote={() => {
              setExtrasTab('quote')
              setQuoteBuilderOpen(true)
              setTimeout(() => document.getElementById('more-for-this')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
            }}
          />

          <ChangeBar
            video={video}
            scenes={sceneInfo}
            selectedScene={Math.min(selectedScene, Math.max(0, sceneInfo.length - 1))}
            onPickScene={jumpTo}
            onRequest={onRequest}
            changesVersion={changesVersion}
            onUndo={onUndo}
          />

          {older && (
            <OlderEditor
              video={video}
              initial={older.initial}
              focusScene={older.focusScene}
              onClose={() => setOlder(null)}
              onError={(message) => setNotice({ type: 'error', message })}
              onSaved={(before, next) => {
                addChange(id, { kind: 'older-editor', summary: 'Changed scenes in the scene editor', before })
                setChangesVersion((v) => v + 1)
                setVideo((prev) => (prev ? ({ ...prev, ...next } as Video) : prev))
                setOlder(null)
                setNotice({ type: 'success', message: 'Your changes are in the video now.' })
              }}
            />
          )}

          <ClientViewing videoId={video.id} isDeck={deck} refreshKey={viewingKey} />

          {canQuote && (
            <MoreForThis
              videoId={video.id}
              thing={thing}
              tab={extrasTab}
              setTab={setExtrasTab}
              quote={quote}
              setQuote={setQuote}
              quoteBuilderOpen={quoteBuilderOpen}
              setQuoteBuilderOpen={setQuoteBuilderOpen}
              plan={plan}
              setPlan={(u) => setPlan((prev) => u(prev))}
              onNotice={setNotice}
            />
          )}
        </>
      )}

      {fixStart && (
        <FixScene
          videoId={video.id}
          planUrl={(video as any).slide_plan_url}
          slideUrls={slideUrls}
          script={scenes as any}
          sceneFixCost={CREDIT_COSTS['slide-scene-fix']}
          start={fixStart}
          onClose={() => setFixStart(null)}
          onStarted={onFixStarted}
        />
      )}

      {/* One message line for the whole page, pinned where it is always seen. */}
      {notice && (
        <div className="res-toast" role={notice.type === 'error' ? 'alert' : 'status'}>
          <div className={`kit-note kit-note--${notice.type === 'error' ? 'stop' : 'ok'}`}>
            <div className="kit-note-body"><p>{notice.message}</p></div>
            <div className="kit-note-action">
              <button type="button" className="kit-btn kit-btn--quiet kit-btn--sm" aria-label="Dismiss" onClick={() => setNotice(null)}>×</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
