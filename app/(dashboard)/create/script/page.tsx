'use client'

/*
 * STEP 2 — "The story" (/create/script).
 *
 * "Here's the story.": the one point (a big card) and the numbers (big
 * tiles) we read from the content — editable, exactly as they go into the
 * story — then "N scenes · about X minutes" as title cards in two columns
 * (Edit opens the full scene editor in place), and one "Ask for a change"
 * line. Asking rewrites the whole story. Nothing here costs credits — the
 * bottom bar says "Free"; generation is paid for on step 3.
 *
 * The script is written in the BACKGROUND on the server and saved to the
 * draft, so a reload (or closing the tab) mid-write picks the job back up
 * here instead of starting again or losing it.
 *
 * The LENGTH (Short / Standard / Detailed) is chosen here too. Step 3's
 * "Change the length" link lands on it (#length). It used to have nowhere to
 * land, so every video was Standard.
 */

import { Fragment, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { VideoBrief } from '../../../_lib/types'
import { addBookends, bookendOptsFrom, keepAutoMarks, sceneSeconds } from '../_components/story/bookends'
import OnePoint from '../_components/story/OnePoint'
import AskPanel, { type AskMsg } from '../_components/story/AskPanel'
import SceneCard from '../_components/story/SceneCard'
import LengthPicker from '../_components/story/LengthPicker'
import { LENGTH_ANCHOR, lengthChange, lengthName, lengthOf, type StoryLength } from '../_components/story/lengths'
import { Note } from '../../../_components/kit'
import BottomBar from '../_components/workspace/BottomBar'
import { type Missing } from '../_components/workspace/MainAction'

type OutputType = 'video' | 'pptx' | 'pdf' | 'interactive' | 'deck'
type StoryState = 'idle' | 'writing' | 'ready' | 'failed'

/* A background job older than this is dead — the server gives up at 4 min. */
const STALE_JOB_MS = 6 * 60 * 1000

export default function ScriptPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const videoId = searchParams.get('id')
  // Set by step 1 when comparing several files failed — shown, not hidden.
  const combineFailed = searchParams.get('combine') === 'failed'
  // Set when this draft was just made by "Duplicate" on a finished project.
  const copied = searchParams.get('copied') === '1'
  /* This screen only exists for a saved draft. The old no-draft mode read a
     browser copy that nothing writes any more. */
  const isWizard = !!videoId

  const [draftLoading, setDraftLoading] = useState(true)
  const [draftData, setDraftData] = useState<any>(null)
  const draftRef = useRef<any>(null)
  const [outputType, setOutputType] = useState<OutputType>('video')
  // The length the story on screen was written at — what step 3 prices.
  const [detailLevel, setDetailLevel] = useState<StoryLength>('standard')
  // The length chip shown as chosen. It differs from detailLevel only while a
  // free rewrite is on offer; the ref lets the writer read it from callbacks.
  const [pickedLength, setPickedLength] = useState<StoryLength>('standard')
  const pickedRef = useRef<StoryLength>('standard')
  const [flashLength, setFlashLength] = useState(false)
  const [narrationStyle, setNarrationStyle] = useState<'solo' | 'podcast'>('solo')

  const [brief, setBrief] = useState<VideoBrief | null>(null)
  const [briefBuilding, setBriefBuilding] = useState(false)
  const [briefNote, setBriefNote] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [answering, setAnswering] = useState(false)
  // The point / numbers as last saved, and whether they were edited since —
  // edited after the story was written means the scenes say the old ones.
  const savedBriefRef = useRef<VideoBrief | null>(null)
  const briefRef = useRef<VideoBrief | null>(null)
  const briefChangedRef = useRef(false)
  const [briefChanged, setBriefChanged] = useState(false)
  // The scene open in the full editor (the cards show titles only).
  const [editIdx, setEditIdx] = useState<number | null>(null)

  const [scenes, setScenes] = useState<any[]>([])
  const [story, setStory] = useState<StoryState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [savedScene, setSavedScene] = useState<number | null>(null)
  /* Said out loud when a save fails, because the alternative is what this
     screen used to do: show a tick and drop the work. */
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [previewIdx, setPreviewIdx] = useState<number | null>(null)
  const [previewImg, setPreviewImg] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [chat, setChat] = useState<AskMsg[]>([])
  const [asking, setAsking] = useState(false)
  const undoRef = useRef<any[] | null>(null)
  const loadedRef = useRef(false)
  // true until the first load has decided what to do (show, resume, ask or write)
  const [booting, setBooting] = useState(true)
  useEffect(() => { briefRef.current = brief }, [brief])

  /** A point/numbers the server gave us (or that were saved): the new "as saved". */
  function takeBrief(b: VideoBrief) {
    savedBriefRef.current = b
    briefRef.current = b
    briefChangedRef.current = false
    setBriefChanged(false)
    setBrief(b)
  }

  /** The person changed the point, a number or the summary. */
  function editBrief(patch: Partial<VideoBrief>) {
    setBrief((b) => {
      const next = b ? { ...b, ...patch } : b
      briefRef.current = next
      return next
    })
    briefChangedRef.current = true
    setBriefChanged(true)
  }

  function undoBriefEdits() {
    if (savedBriefRef.current) setBrief(savedBriefRef.current)
    briefRef.current = savedBriefRef.current
    briefChangedRef.current = false
    setBriefChanged(false)
  }

  /** Save the edited point / numbers to the draft (the story writer reads them there). */
  async function saveBrief(): Promise<boolean> {
    const b = briefRef.current
    if (!videoId || !b) return true
    const clean: VideoBrief = {
      ...b,
      angle: (b.angle ?? '').trim() || savedBriefRef.current?.angle || b.angle,
      figures: (b.figures ?? []).map((f) => ({ label: (f.label ?? '').trim(), value: (f.value ?? '').trim() })).filter((f) => f.value),
    }
    try {
      const res = await fetch('/api/videos/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, updates: { brief: clean } }),
      })
      if (!res.ok) throw new Error(`brief save failed (${res.status})`)
    } catch (err) {
      console.error('[story] brief save failed:', err)
      setError('We couldn’t save your changes to the point and numbers. Please try again.')
      return false
    }
    takeBrief(clean)
    return true
  }

  /**
   * AUTO-SAVE — and the tick only appears when something was actually saved.
   *
   * The write used to sit behind a guard that skipped the paid flow while the
   * tick appeared anyway, after every edit. A customer could rewrite twelve
   * scenes, see a tick on each, refresh, and lose all of it. The tick now
   * waits for the save to come back, and a failure says so.
   */
  const autoSave = useCallback((updatedScenes: any[], sceneIdx: number, instant?: boolean) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const doSave = async () => {
      if (!isWizard) return
      /* The draft row is where the story lives. Await it, because claiming
         "saved" before the round trip is the bug this replaces. */
      try {
        const res = await fetch('/api/videos/draft', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId, updates: { scenes: updatedScenes } }),
        })
        if (!res.ok) throw new Error(`draft save failed (${res.status})`)
        setSaveError(null)
      } catch (err) {
        console.error('[story] autosave failed:', err)
        setSaveError('Your changes aren’t saving right now. Keep this tab open — don’t reload.')
        return
      }
      setSavedScene(sceneIdx)
      setTimeout(() => setSavedScene(null), 1500)
    }
    if (instant) {
      void doSave()
    } else {
      saveTimer.current = setTimeout(() => void doSave(), 800)
    }
  }, [isWizard, videoId])

  /*
   * SAFETY NET ON THE WAY OUT. The 800ms debounce can still be pending when
   * the tab closes. A beacon is queued by the browser and sent even as the
   * page dies, which a normal fetch is not. Fire-and-forget — a net under the
   * real save above, never a replacement for it.
   */
  useEffect(() => {
    const handleUnload = () => {
      if (scenes.length === 0 || !isWizard) return
      try {
        navigator.sendBeacon?.(
          '/api/videos/draft/beacon',
          new Blob([JSON.stringify({ videoId, updates: { scenes } })], { type: 'application/json' }),
        )
      } catch { /* nothing more we can do as the page dies */ }
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  })

  // Poll the draft for the background script job. Resolves with the scenes
  // (and the length they were written at) when ready, throws on failure or
  // timeout.
  async function pollForScenes(vid: string): Promise<{ scenes: any[]; detailLevel: unknown }> {
    const start = Date.now()
    const TIMEOUT_MS = 8 * 60 * 1000
    while (Date.now() - start < TIMEOUT_MS) {
      await new Promise(r => setTimeout(r, 3000))
      try {
        const res = await fetch(`/api/videos/draft?videoId=${vid}`)
        if (!res.ok) continue
        const video = await res.json()
        const d = video?.draft_data || {}
        if (d.scriptStatus === 'ready' && Array.isArray(d.scenes) && d.scenes.length > 0) return { scenes: d.scenes, detailLevel: d.detailLevel }
        if (d.scriptStatus === 'failed') throw new Error(d.scriptError || 'We couldn’t write your story just now. Please try again.')
      } catch (e) {
        if (e instanceof Error && e.message !== 'Failed to fetch') throw e
        // a blip in the connection — keep checking
      }
    }
    throw new Error('Your story is taking longer than usual. Come back to this project in a few minutes.')
  }

  /** The story on screen is now written at `len` — the length step 3 prices. */
  function settleLength(len: StoryLength) {
    draftRef.current = { ...(draftRef.current || {}), detailLevel: len }
    setDetailLevel(len)
    setPickedLength(len)
    pickedRef.current = len
  }

  /** Wait for the background job. True when a story arrived. */
  async function waitForStory(requested?: StoryLength): Promise<boolean> {
    if (!videoId) return false
    setStory('writing'); setError(null)
    try {
      const written = await pollForScenes(videoId)
      // The writer saves the length it wrote at next to the scenes — trust
      // that (it is right even when we only picked a running job back up).
      settleLength(lengthOf(written.detailLevel ?? requested))
      setScenes(addBookends(written.scenes, bookendOptsFrom(draftRef.current)))
      setStory('ready')
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We couldn’t write your story just now. Please try again.')
      setStory('failed')
      return false
    }
  }

  /** Ask the server to write the story at a length (the chip shown as chosen
   *  unless told otherwise). It uses the brief saved on the draft. True when
   *  a story arrived. */
  async function writeStory(len: StoryLength = pickedRef.current): Promise<boolean> {
    const draft = draftRef.current
    if (!videoId || !draft) return false
    // Edited point / numbers go to the draft first: the writer reads them there.
    if (briefChangedRef.current && !(await saveBrief())) return false
    setStory('writing'); setError(null)
    const extracted = draft.extractedData || draft.inlineBrand || {}
    const dl = len
    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // The draft id makes the server (a) use the brief on the draft,
          // (b) write in the background and save the scenes to the draft, and
          // (c) never hit the ~60s response limit — we poll the draft instead.
          videoId,
          policyData: {
            ...extracted,
            intentType: draft.intentType || draft.purpose,
            contactPhone: draft.contactPhone,
            contactEmail: draft.contactEmail,
            contactWebsite: draft.contactWebsite,
          },
          brandId: draft.brandId || draft.autoBrandId || null,
          detailed: dl === 'detailed',
          detailLevel: dl,
          narrationStyle: draft.narrationStyle || 'solo',
          purpose: draft.purpose,
          contactInfo: {
            phone: draft.contactPhone || undefined,
            email: draft.contactEmail || undefined,
            website: draft.contactWebsite || undefined,
          },
          industry: extracted.industry || 'general',
          classification: extracted.classification || draft.classification || null,
          outputType: draft.outputType || outputType,
        }),
      })
      const text = await res.text()
      let data: any
      try { data = JSON.parse(text) } catch { throw new Error('Something went wrong on our side — please try again.') }
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'We couldn’t write your story just now. Please try again.')
      if (data.status !== 'generating') throw new Error('We couldn’t write your story just now. Please try again.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We couldn’t write your story just now. Please try again.')
      setStory('failed')
      return false
    }
    return waitForStory(len)
  }

  /** Build the brief (the one point). Returns null if it couldn't. */
  async function buildBrief(): Promise<VideoBrief | null> {
    setBriefBuilding(true)
    try {
      const r = await fetch('/api/brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId }) })
      const d = await r.json().catch(() => ({}))
      if (d?.brief) { takeBrief(d.brief); return d.brief }
      setBriefNote('We couldn’t sum up the main point this time. The story below still uses everything you gave us.')
      return null
    } catch {
      setBriefNote('We couldn’t sum up the main point this time. The story below still uses everything you gave us.')
      return null
    } finally { setBriefBuilding(false) }
  }

  // Load the draft, then: show the saved story, pick up a story still being
  // written, or build the brief and write the story now.
  useEffect(() => {
    if (!videoId) { router.replace('/create'); return }
    if (loadedRef.current) return
    loadedRef.current = true
    ;(async () => {
      let draft: any
      try {
        const res = await fetch(`/api/videos/draft?videoId=${videoId}`)
        if (!res.ok) throw new Error('Failed to load draft')
        const video = await res.json()
        if (!video?.draft_data) throw new Error('No draft data')
        draft = { ...video.draft_data, title: video.draft_data.title || video.title }
      } catch (err) {
        console.error('[story] load draft error:', err)
        setError('We couldn’t open this project. Go back and try again.')
        setDraftLoading(false)
        return
      }
      draftRef.current = draft
      setDraftData(draft)
      setOutputType(draft.outputType || 'video')
      settleLength(lengthOf(draft.detailLevel))
      if (draft.narrationStyle) setNarrationStyle(draft.narrationStyle)

      const hasScenes = Array.isArray(draft.scenes) && draft.scenes.length > 0
      if (hasScenes) {
        setScenes(addBookends(draft.scenes, bookendOptsFrom(draft)))
        setStory('ready')
      }
      if (draft.brief && !draft.briefSkipped) takeBrief(draft.brief)
      setDraftLoading(false)

      // A story written before this screen (or with "Skip") keeps its brief
      // state as is — building a new brief now would not match the scenes.
      if (hasScenes) return

      const startedMs = typeof draft.scriptStartedAt === 'string' ? new Date(draft.scriptStartedAt).getTime() : 0
      if (draft.scriptStatus === 'generating' && startedMs && Date.now() - startedMs < STALE_JOB_MS) {
        // Reloaded mid-write: pick the running job back up.
        if (!draft.brief && !draft.briefSkipped) void buildBrief()
        await waitForStory()
        return
      }
      if (draft.scriptStatus === 'failed') {
        setError(draft.scriptError || 'We couldn’t write your story last time. Please try again.')
        setStory('failed')
        return
      }

      let b: VideoBrief | null = draft.briefSkipped ? null : (draft.brief || null)
      if (!b && !draft.briefSkipped) b = await buildBrief()
      // If the AI is unsure about something that changes the story, ask
      // first. Otherwise write the story straight away.
      if (b?.clarifyingQuestions?.length) return
      await writeStory()
    })().finally(() => setBooting(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  async function submitAnswers() {
    if (!videoId || answering) return
    const filled = Object.fromEntries(Object.entries(answers).filter(([, v]) => v && v.trim()))
    if (Object.keys(filled).length === 0) return
    setAnswering(true); setError(null)
    try {
      const res = await fetch('/api/brief', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, answers: filled }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'We couldn’t use those answers. Please try again.')
      if (d.brief) { takeBrief(d.brief); setAnswers({}) }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t use those answers. Please try again.')
      setAnswering(false)
      return
    }
    setAnswering(false)
    await writeStory()
  }

  function skipQuestions() {
    // Questions are optional — clear them on screen and write with what we have.
    if (brief) setBrief({ ...brief, clarifyingQuestions: [] })
    void writeStory()
  }

  function startOver() {
    if (story === 'writing') return
    if (scenes.length > 0 && !window.confirm('Write the story again from the start? Your changes to the scenes will be replaced.')) return
    // A save still waiting to go out would land on top of the new story.
    if (saveTimer.current) clearTimeout(saveTimer.current)
    undoRef.current = null
    setScenes([])
    void writeStory()
  }

  /*
   * THE LENGTH. With no story yet, a pick is just saved — the story will be
   * written at it. With a story, the saved length never changes on its own:
   * the pick shows a free "Rewrite at this length" offer, and the length only
   * moves once the rewritten story arrives.
   */
  function pickLength(len: StoryLength) {
    const change = lengthChange({ current: detailLevel, picked: len, hasStory: scenes.length > 0, writing: story === 'writing' })
    if (story === 'writing') return
    setPickedLength(len)
    pickedRef.current = len
    if (change !== 'save') return
    settleLength(len)
    void (async () => {
      try {
        const res = await fetch('/api/videos/draft', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId, updates: { detailLevel: len } }),
        })
        if (!res.ok) throw new Error(`length save failed (${res.status})`)
      } catch (err) {
        console.error('[story] length save failed:', err)
        setError('We couldn’t save that length just now. Please pick it again.')
      }
    })()
  }

  function keepLength() {
    setPickedLength(detailLevel)
    pickedRef.current = detailLevel
  }

  async function rewriteAtLength() {
    if (story === 'writing' || scenes.length === 0) return
    const before = scenes
    const target = pickedRef.current
    // Any save still waiting would land on top of the new story.
    if (saveTimer.current) clearTimeout(saveTimer.current)
    undoRef.current = null
    setScenes([])
    const ok = await writeStory(target)
    if (!ok) {
      // Nothing is lost: put the story back exactly as it was (and save it,
      // in case the last edit was still waiting to go out).
      setScenes(before)
      setStory('ready')
      autoSave(before, -1, true)
      setError(`We couldn’t rewrite the story as ${lengthName(target)} just now. Your story is unchanged — try again in a moment.`)
    }
  }

  /*
   * "Change it by asking". Before the story exists, the request reshapes the
   * brief (what the story will say). Once it exists, it rewrites the whole
   * story at once — one-step undo, because an instruction that lands wrong
   * should cost one click, not the user's own edits.
   */
  async function ask(instruction: string) {
    if (asking) return
    setChat(c => [...c, { role: 'user', text: instruction }])
    setAsking(true); setError(null)
    try {
      if (scenes.length > 0) {
        const before = scenes
        const r = await fetch('/api/ai-edit-scenes', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ scenes: before, instruction }),
        })
        const d = await r.json().catch(() => ({}))
        if (!r.ok || !Array.isArray(d?.scenes)) throw new Error('That change didn’t work — nothing was changed.')
        const next = addBookends(keepAutoMarks(before, d.scenes), bookendOptsFrom(draftRef.current))
        undoRef.current = before
        setScenes(next)
        autoSave(next, -1, true)
        setChat(c => [...c, { role: 'assistant', text: 'Done — I rewrote the story. Check the scenes, or undo if you liked it better before.' }])
      } else if (brief && videoId) {
        const r = await fetch('/api/brief/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId, message: instruction }),
        })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error('That change didn’t work — nothing was changed.')
        if (d.brief) takeBrief(d.brief)
        setChat(c => [...c, { role: 'assistant', text: d.reply || 'Updated what the story will cover.' }])
      }
    } catch (e) {
      setChat(c => [...c, { role: 'assistant', text: e instanceof Error ? e.message : 'That change didn’t work — nothing was changed.' }])
    } finally { setAsking(false) }
  }

  /** "Rewrite the story with it": the edited point / numbers, a new story. */
  async function rewriteWithBrief() {
    if (story === 'writing' || scenes.length === 0) return
    const before = scenes
    if (saveTimer.current) clearTimeout(saveTimer.current)
    undoRef.current = null
    setEditIdx(null)
    setScenes([])
    const ok = await writeStory()
    if (!ok) {
      setScenes(before)
      setStory('ready')
      autoSave(before, -1, true)
    }
  }

  function undoAsk() {
    if (!undoRef.current) return
    const prev = undoRef.current
    undoRef.current = null
    setScenes(prev)
    autoSave(prev, -1, true)
    setChat(c => [...c, { role: 'assistant', text: 'Put it back the way it was.' }])
  }

  function updateScene(i: number, updatedScene: any, instant?: boolean) {
    const updated = [...scenes]
    updated[i] = updatedScene
    setScenes(updated)
    autoSave(updated, i, instant)
  }

  function dropOn(i: number) {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); return }
    const role = scenes[i]?._role
    if (role === 'cover' || role === 'closing') { setDragIdx(null); return }
    // Never move a content scene before the opening or after the closing.
    const firstContent = scenes.findIndex(s => s._role !== 'cover')
    const lastContent = scenes.length - 1 - [...scenes].reverse().findIndex(s => s._role !== 'closing')
    const target = Math.min(Math.max(i, firstContent), lastContent)
    const updated = [...scenes]
    const [moved] = updated.splice(dragIdx, 1)
    updated.splice(target, 0, moved)
    updated.forEach((s, idx) => { s.scene = idx + 1 })
    setScenes(updated)
    autoSave(updated, target, true)
    setDragIdx(null)
    setOpenIdx(null)
    setEditIdx(null)
  }

  async function handlePreviewSlide(idx: number) {
    setPreviewIdx(idx)
    setPreviewImg(null)
    setPreviewLoading(true)
    try {
      const scene = scenes[idx]
      const d = draftRef.current || {}
      const ex = d.extractedData || d.inlineBrand || {}
      const colors = ex.primaryColor ? { primary: ex.primaryColor, secondary: ex.secondaryColor || '#4A90D9' } : { primary: '#1B365D', secondary: '#4A90D9' }
      const res = await fetch('/api/style-previews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `${d.customStylePrompt || 'Modern professional style'}\nColors: primary ${colors.primary}, accent ${colors.secondary}.\nGlossy polished finish.`,
          name: scene.title,
        }),
      })
      const data = await res.json()
      if (data.previewUrl) setPreviewImg(data.previewUrl)
    } catch { /* shown as "try again" below */ }
    setPreviewLoading(false)
  }

  // Arriving from step 3's "Change the length" (#length): bring the length
  // choice into view and light it up briefly, so the link lands somewhere.
  useEffect(() => {
    if (draftLoading || window.location.hash !== `#${LENGTH_ANCHOR}`) return
    const el = document.getElementById(LENGTH_ANCHOR)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlashLength(true)
    const t = setTimeout(() => setFlashLength(false), 2400)
    return () => clearTimeout(t)
  }, [draftLoading])

  // A different length is picked but the story hasn't been rewritten yet.
  // Step 3 would price the old length, so decide first.
  const lengthPending = scenes.length > 0 && pickedLength !== detailLevel

  // "Looks right" — save the story, mark the brief as approved, go to step 3.
  async function goToLook() {
    if (!videoId || scenes.length === 0 || lengthPending) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSubmitting(true)
    setError(null)
    try {
      const step = (outputType === 'video' || outputType === 'interactive') ? 5 : 4
      const updates: Record<string, unknown> = { scenes, detailLevel, narrationStyle, step }
      if (brief) { updates.brief = { ...brief, approved: true }; updates.briefSkipped = false }
      const patchRes = await fetch('/api/videos/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, updates }),
      })
      if (!patchRes.ok) throw new Error('We couldn’t save your story. Please try again.')
      router.push(`/create/theme?id=${videoId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We couldn’t save your story. Please try again.')
      setSubmitting(false)
    }
  }

  if (draftLoading) {
    return (
      <div className="cf-page">
        <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--ink-light)', fontSize: 'var(--fs-body)' }}>Loading&hellip;</div>
      </div>
    )
  }

  // Why "Pick a look" can't be pressed yet — said under it, never a silent grey button.
  const questionsWaiting = scenes.length === 0 && story !== 'writing' && !!brief?.clarifyingQuestions?.length
  const missing: Missing | null =
    story === 'writing' ? { reason: 'Your story is still being written — usually about a minute.' }
      : questionsWaiting ? { reason: 'Answer the quick questions first, or skip them.', target: 's2-point' }
        : asking ? { reason: 'Wait for your change to finish.' }
          : lengthPending ? { reason: `First rewrite the story as ${lengthName(pickedLength)}, or keep it ${lengthName(detailLevel)}.`, target: LENGTH_ANCHOR }
            : briefChanged && scenes.length > 0 ? { reason: 'First rewrite the story with your changes, or undo them.', target: 's2-point' }
              : scenes.length === 0 ? { reason: story === 'failed' ? 'The story wasn’t written — press Try again.' : 'The story isn’t written yet.', target: story === 'failed' ? 's2-error' : undefined }
                : null

  const totalSeconds = scenes.reduce((sum: number, s: any) => sum + sceneSeconds(s), 0)
  const spoken = outputType === 'video' || outputType === 'pptx'
  const minutes = Math.max(1, Math.round(totalSeconds / 60))
  const askNote = story === 'writing'
    ? 'You can ask for changes once the story is written.'
    : scenes.length === 0 && !brief
      ? 'You can ask for changes once the story is written.'
      : null

  return (
    <div className="cf-page story-page">
      <h1 className="cf-h1">
        Here&rsquo;s the <em>story.</em>
      </h1>

      {combineFailed ? (
        <Note tone="warn">
          We couldn&rsquo;t compare your files automatically this time. The story still uses all of them — ask for what to compare or focus on, below the scenes.
        </Note>
      ) : null}

      {copied ? (
        <Note tone="ok">
          This is a copy of your earlier project — the story, look, voice and brand came with it. Change anything you like. Nothing is made or charged until you press Make it on the next step.
        </Note>
      ) : null}

      <div id="s2-point" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <OnePoint
          brief={brief}
          building={briefBuilding}
          onEdit={editBrief}
          changed={briefChanged}
          writing={story === 'writing'}
          hasStory={scenes.length > 0}
          onRewrite={() => void rewriteWithBrief()}
          onUndo={undoBriefEdits}
          showQuestions={scenes.length === 0 && story !== 'writing'}
          answers={answers}
          setAnswers={setAnswers}
          answering={answering}
          onAnswer={submitAnswers}
          onSkipQuestions={skipQuestions}
        />
      </div>
      {briefNote && !brief && (
        <p className="cf-hint">{briefNote}</p>
      )}

      <div className="cf-scenes-head">
        <h2 className="cf-h2" style={{ margin: 0 }}>
          {story === 'writing' ? 'Writing the scenes…' : scenes.length > 0 ? `${scenes.length} scenes` : 'The scenes'}
          {story !== 'writing' && scenes.length > 0 && spoken && totalSeconds > 0 ? <small>about {minutes} minute{minutes === 1 ? '' : 's'}</small> : null}
        </h2>
        {draftData ? (
          <LengthPicker
            picked={pickedLength}
            storyLength={detailLevel}
            hasStory={scenes.length > 0}
            writing={story === 'writing'}
            spoken={outputType !== 'deck' && outputType !== 'pdf'}
            isVideo={outputType === 'video'}
            flash={flashLength}
            onPick={pickLength}
            onRewrite={() => void rewriteAtLength()}
            onKeep={keepLength}
          />
        ) : null}
      </div>

      {/*
        * SAVING IS BROKEN — said out loud, directly above the scenes, so it
        * sits beside the work at risk. It stays until a save succeeds.
        */}
      {saveError && (
        <div role="alert" className="kit-note kit-note--warn">
          <div className="kit-note-body"><p>{saveError}</p></div>
        </div>
      )}

      {story === 'writing' && (
        <div className="cf-card cf-reading" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="spinner" />
          <div style={{ fontSize: 'var(--fs-lead)', fontWeight: 700, color: 'var(--ink)' }}>
            {scenes.length > 0 ? 'Writing the story again…' : 'Writing your story…'}
          </div>
          <p className="cf-hint">
            This usually takes about a minute. It keeps going if you leave — come back to this project and it will be here.
          </p>
        </div>
      )}

      {!booting && draftData && story === 'idle' && scenes.length === 0 && !briefBuilding && !answering && !brief?.clarifyingQuestions?.length && (
        <div className="cf-card cf-quick">
          <span className="cf-hint">Ready when you are.</span>
          <button type="button" className="kit-btn kit-btn--secondary" onClick={() => void writeStory()}>Write the story</button>
        </div>
      )}

      {error && (
        <div id="s2-error" role="alert" className="kit-note kit-note--stop">
          <div className="kit-note-body"><p>{error}</p></div>
          {story === 'failed' && (
            <div className="kit-note-action">
              <button type="button" className="kit-btn kit-btn--secondary kit-btn--sm" onClick={() => void writeStory()}>Try again</button>
            </div>
          )}
        </div>
      )}

      {story !== 'writing' && scenes.length > 0 && (
        <>
          <ol className="cf-scenes" aria-label="The scenes">
            {scenes.map((scene: any, i: number) => {
              const role = scene._role as ('cover' | 'closing' | undefined)
              const bookend = role === 'cover' || role === 'closing'
              const open = editIdx === i
              return (
                <Fragment key={i}>
                  <li
                    className={`cf-card cf-scene ${dragIdx === i ? 'is-dragging' : ''} ${open ? 'is-open' : ''}`}
                    draggable={!bookend}
                    data-scene={i + 1}
                    onDragStart={() => { if (!bookend) setDragIdx(i) }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropOn(i)}
                    onDragEnd={() => setDragIdx(null)}
                    title={bookend ? undefined : 'Drag to move this scene'}
                  >
                    <span className="cf-scene-n">{i + 1}</span>
                    <span className="cf-scene-title">
                      {bookend ? <small>{role === 'cover' ? 'Opening' : 'Closing'}</small> : null}
                      {scene.title || 'Untitled scene'}
                    </span>
                    <button
                      type="button"
                      className="cf-scene-edit"
                      aria-expanded={open}
                      aria-label={open ? `Close scene ${i + 1}` : `Edit scene ${i + 1}`}
                      onClick={() => { setEditIdx(open ? null : i); setOpenIdx(null) }}
                    >
                      {open ? 'Done' : 'Edit'}
                    </button>
                  </li>
                  {open ? (
                    <li className="cf-scene-editor">
                      <SceneCard
                        scene={scene}
                        index={i}
                        outputType={outputType}
                        saved={savedScene === i}
                        open={openIdx === i}
                        onToggle={() => setOpenIdx(openIdx === i ? null : i)}
                        onChange={(s, instant) => updateScene(i, s, instant)}
                        onPreview={() => handlePreviewSlide(i)}
                        sourceData={draftData?.extractedData}
                        dragging={false}
                        noDrag
                        onDragStart={() => {}}
                        onDrop={() => {}}
                        onDragEnd={() => {}}
                      />
                    </li>
                  ) : null}
                </Fragment>
              )
            })}
          </ol>
          <p className="cf-hint">
            Drag a card to move a scene.{' '}
            <button type="button" className="cf-link" onClick={startOver} style={{ fontWeight: 500, color: 'var(--ink-light)' }}>
              Write it again from the start
            </button>
          </p>
        </>
      )}

      <AskPanel
        messages={chat}
        busy={asking}
        disabledNote={askNote}
        onSend={(t) => void ask(t)}
        canUndo={!!undoRef.current}
        onUndo={undoAsk}
      />

      {/* Slide preview */}
      {previewIdx !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { setPreviewIdx(null); setPreviewImg(null) }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'relative', background: 'var(--bg-card)', borderRadius: 10, padding: 24,
            maxWidth: 700, width: 'calc(100% - 32px)', boxShadow: 'var(--shadow-lg)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700 }}>Slide {previewIdx + 1} preview</div>
                <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-light)' }}>{scenes[previewIdx]?.title}</div>
              </div>
              <button type="button" aria-label="Close" onClick={() => { setPreviewIdx(null); setPreviewImg(null) }}
                style={{ background: 'none', border: 'none', fontSize: 'var(--fs-h3)', cursor: 'pointer', color: 'var(--ink-light)', padding: 4 }}>&times;</button>
            </div>
            {previewLoading ? (
              <div style={{ aspectRatio: '16/9', borderRadius: 10, background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" style={{ marginRight: 8 }} /> Making a preview&hellip;
              </div>
            ) : previewImg ? (
              <img src={previewImg} alt="Slide preview" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 10 }} />
            ) : (
              <div style={{ aspectRatio: '16/9', borderRadius: 10, background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-light)' }}>
                The preview didn&rsquo;t work — try again
              </div>
            )}
            <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-light)', marginTop: 10, textAlign: 'center' }}>
              A rough preview. The look you pick next changes the final slides.
            </p>
          </div>
        </div>
      )}

      <BottomBar
        label="Next step"
        info="Free"
        sub="Changes cost nothing"
        onMain={() => void goToLook()}
        mainLabel={submitting ? 'Saving…' : 'Pick a look →'}
        disabled={submitting}
        busy={submitting}
        missing={missing}
      />
    </div>
  )
}
