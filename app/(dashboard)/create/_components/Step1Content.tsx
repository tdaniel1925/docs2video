'use client'

import { useState, useRef, useEffect } from 'react'
import { ClipboardPaste, Globe, Sparkles, Upload, type LucideIcon } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { uploadAndExtract, uploadAndExtractMany } from './uploadAndExtract'
import ClientPicker, { type PickedClient } from './ClientPicker'
import ReadReview, { type Figure } from './ReadReview'
import { methodFromSource } from '../../../_lib/create-sources'
import { normalizeUrl, tidyUrlInput } from '../../../_lib/normalize-url'
import type { VideoBrief } from '../../../_lib/types'
import { Button, Choices, Note } from '../../../_components/kit'
import Workspace from './workspace/Workspace'
import MainAction, { type Missing } from './workspace/MainAction'
import Stages, { type Stage as ReadStage } from './workspace/Stages'
import { sourceLabel } from './workspace/facts'
import { usePriceQuote } from './make/usePriceQuote'

type OutputType = 'video' | 'interactive'
type InputMethod = 'url' | 'upload' | 'text' | 'idea' | null
/* form → reading (real stages) → review ("Here's what we read") → step 2 */
type Phase = 'form' | 'reading' | 'review'

// Parse an API response defensively. When a serverless function times out or
// crashes, Vercel returns a PLAIN-TEXT error page ("An error occurred…") — a
// blind res.json() then surfaces "Unexpected token 'A' … is not valid JSON" to
// the user. Read as text, try JSON, and fall back to a friendly message.
async function parseApiResponse(res: Response, friendly: string): Promise<Record<string, unknown>> {
  const text = await res.text()
  try { return JSON.parse(text) } catch {
    throw new Error(friendly)
  }
}

const CONTENT_METHODS: { id: Exclude<InputMethod, null>; label: string; desc: string; Icon: LucideIcon }[] = [
  { id: 'url', label: 'Website URL', desc: 'Pull from a web page', Icon: Globe },
  { id: 'upload', label: 'Upload file', desc: 'PDF, Word, or PowerPoint', Icon: Upload },
  { id: 'text', label: 'Paste text', desc: 'Paste your own content', Icon: ClipboardPaste },
  { id: 'idea', label: 'AI writes it', desc: 'Describe it, AI drafts it', Icon: Sparkles },
]

/** The real stages of reading, for the way the content is coming in. Each is
 *  ticked when that call actually finishes — never by a timer. */
function readingStages(method: InputMethod, files: number): ReadStage[] {
  const first: ReadStage[] =
    method === 'upload' ? [{ key: 'upload', label: files > 1 ? `Uploading and reading your ${files} files` : 'Uploading your file' }, ...(files > 1 ? [] : [{ key: 'read', label: 'Reading it' }])]
      : method === 'url' ? [{ key: 'read', label: 'Reading the website' }]
        : method === 'text' ? [{ key: 'read', label: 'Reading your text' }]
          : [{ key: 'read', label: 'Writing the content' }]
  return [
    ...first,
    { key: 'save', label: 'Saving your project' },
    ...(files > 1 ? [{ key: 'compare', label: 'Comparing your documents' }] : []),
    { key: 'brief', label: 'Finding the one point and the numbers' },
  ]
}

export default function Step1Content() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clientIdParam = searchParams.get('clientId') || undefined
  // Step 1 (client page) passes ?for=general when the user chose "Skip — make a
  // general video", so Step 2 doesn't re-ask "Who is this for?".
  const forGeneralParam = searchParams.get('for') === 'general'
  // When the user hits BACK from a later step we arrive as /create?id=X with none
  // of the client params — restore them from the draft so we don't re-ask "Who is
  // this for?" and lose their earlier choice.
  const [restoredClientId, setRestoredClientId] = useState<string | undefined>(undefined)
  const [restoredGeneral, setRestoredGeneral] = useState(false)
  /* WHO IT'S FOR, chosen on this screen (the separate /create/client page is
     gone). undefined = not touched here, so the URL / restored draft wins. */
  const [picked, setPicked] = useState<PickedClient | null | undefined>(undefined)
  const clientId = picked !== undefined ? (picked?.clientId ?? undefined) : (clientIdParam || restoredClientId)
  const forGeneral = picked !== undefined ? picked?.clientId === null : (forGeneralParam || restoredGeneral)
  // If we arrived back here from a later step, a draft already exists — reuse it
  // instead of creating a second orphaned row.
  const existingDraftId = searchParams.get('id') || undefined
  // ?review=1: the content was read and the draft has its summary — reopen
  // "Here's what we read" (a reload there used to drop you back on the form).
  const reviewParam = searchParams.get('review') === '1'
  const combineParam = searchParams.get('combine') === 'failed'
  // "Duplicate" on a finished project links here as ?duplicate=<id>. Nothing
  // used to read it, so the user got this screen blank. The copy is made on
  // the server (owner only), then the copy opens on the story step.
  const duplicateOf = searchParams.get('duplicate') || undefined
  const [copying, setCopying] = useState(!!duplicateOf)
  const copyStarted = useRef(false)
  // ?type=interactive starts a presentation; anything else is a video.
  // Old links with ?type=deck or ?type=slides (slide decks, PowerPoint/PDF)
  // start a video now — Docs2Video no longer makes those (videos-only.ts).
  const wizType = searchParams.get('type')
  const [outputType, setOutputType] = useState<OutputType>(wizType === 'interactive' ? 'interactive' : 'video')
  const [recipientName, setRecipientName] = useState('')
  const [clientName, setClientName] = useState<string | null>(null) // bound client (read-only display)
  const [draftRestored, setDraftRestored] = useState(false) // gate client-name fetch behind draft restore

  const [purpose, setPurpose] = useState('')
  // Home's start cards link here as ?source=upload|url|paste|ai — start with
  // that answer already picked (app/_lib/create-sources.ts).
  const [method, setMethod] = useState<InputMethod>(() => methodFromSource(searchParams.get('source')))
  const [urlInput, setUrlInput] = useState('')
  const [textInput, setTextInput] = useState('')
  // Names of all selected files. More than one → the combine flow kicks in.
  const [fileNames, setFileNames] = useState<string[]>([])
  const [phase, setPhase] = useState<Phase>('form')
  const [stages, setStages] = useState<ReadStage[]>([])
  const [stageIdx, setStageIdx] = useState(0)
  const [stageDetail, setStageDetail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // Carries multi-file extractions from handleNext → createDraftAndRedirect
  // without re-threading every call site. Empty for single-file/url/text/idea.
  const extractedDocsRef = useRef<{ fileName?: string; data: Record<string, unknown> }[]>([])

  // "Here's what we read"
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [brief, setBrief] = useState<VideoBrief | null>(null)
  const [summary, setSummary] = useState('')
  const [point, setPoint] = useState('')
  const [figures, setFigures] = useState<Figure[]>([])
  const [combineFailed, setCombineFailed] = useState(combineParam)
  const [savingReview, setSavingReview] = useState(false)
  const [savedSource, setSavedSource] = useState<string | null>(null)
  const { quote, loading: quoteLoading } = usePriceQuote(reviewId)

  // Set once the summary is on screen, so a later reload of the draft (the
  // address changes to ?review=1) never wipes edits already made.
  const reviewOpen = useRef(false)

  function openReview(id: string, b: VideoBrief | null) {
    reviewOpen.current = true
    setReviewId(id)
    setBrief(b)
    setSummary(b?.summary ?? '')
    setPoint(b?.angle ?? '')
    setFigures((b?.figures ?? []).map((f) => ({ label: f.label ?? '', value: f.value ?? '' })))
    setPhase('review')
  }

  // Restore-on-return runs FIRST and wins (it reflects the user's last edit).
  // The clientId name-fetch only fills in when the draft had nothing (gated on
  // draftRestored) — avoids the two effects racing (audit #8).
  useEffect(() => {
    if (!existingDraftId) { setDraftRestored(true); return }
    let cancelled = false
    fetch(`/api/videos/draft?videoId=${existingDraftId}`)
      .then(r => r.ok ? r.json() : null)
      .then(video => {
        const d = video?.draft_data
        if (cancelled) return
        if (d) {
          if (d.outputType) setOutputType(d.outputType === 'interactive' ? 'interactive' : 'video')
          if (d.purpose) setPurpose(prev => prev || d.purpose)
          if (d.recipientName) setRecipientName(prev => prev || d.recipientName)
          if (d.contentMethod) setMethod(prev => prev || d.contentMethod)
          setSavedSource(sourceLabel(d.contentMethod, {
            fileNames: Array.isArray(d.extractedDocs) && d.extractedDocs.length > 1 ? d.extractedDocs.map((x: { fileName?: string }) => x.fileName || '') : d.sourcePdfName ? [d.sourcePdfName] : [],
            title: d.extractedData?.title ?? null,
          }))
          // Restore the "who is this for?" choice so Back doesn't re-ask it:
          // a saved clientId → client; else the draft has been through Step 1
          // already, so treat as general (no re-prompt).
          if (!clientIdParam && !forGeneralParam) {
            if (d.clientId) setRestoredClientId(d.clientId as string)
            else setRestoredGeneral(true)
          }
          if (reviewParam && !reviewOpen.current && !Array.isArray(d.scenes)) openReview(existingDraftId, d.brief && !d.briefSkipped ? d.brief : null)
        }
        setDraftRestored(true)
      })
      .catch(() => { if (!cancelled) setDraftRestored(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingDraftId])

  // Came from "Who's this for?" with a client — fetch the bound client's name
  // for the read-only confirmation chip. Only sets recipientName if still empty
  // after any draft restore, so a user-edited draft value is never overwritten.
  useEffect(() => {
    if (!clientId || !draftRestored) return
    let cancelled = false
    fetch(`/api/clients/${clientId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const name = data?.client?.name
        if (!cancelled && name) {
          setClientName(name)
          setRecipientName(prev => prev || name)
        }
      })
      .catch(() => { /* non-fatal */ })
    return () => { cancelled = true }
  }, [clientId, draftRestored])

  // DUPLICATE: ask the server for the copy, then open it. The ref stops a
  // second copy when the effect runs twice; replace() keeps Back (and a
  // reload) from making another one.
  useEffect(() => {
    if (!duplicateOf || copyStarted.current) return
    copyStarted.current = true
    ;(async () => {
      try {
        const res = await fetch('/api/videos/draft/duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: duplicateOf }),
        })
        const data = await parseApiResponse(res, 'We couldn’t copy that project just now.')
        if (!res.ok || typeof data.next !== 'string') {
          throw new Error(typeof data.error === 'string' ? data.error : 'We couldn’t copy that project just now.')
        }
        router.replace(data.next)
      } catch (err) {
        setError(`${err instanceof Error ? err.message : 'We couldn’t copy that project just now.'} You can start a new one here.`)
        setCopying(false)
        router.replace('/create')
      }
    })()
  }, [duplicateOf, router])

  /** The first answer still missing, and where it is on the screen. */
  function missingAnswer(): Missing | null {
    if (!purpose.trim()) return { reason: 'Describe what you want first', target: 's1-goal' }
    if (!method) return { reason: 'Pick where your content comes from (or choose "AI writes it")', target: 's1-source' }
    if (method === 'url' && !urlInput.trim()) return { reason: 'Type or paste a website to continue', target: 's1-url' }
    if (method === 'url' && !normalizeUrl(urlInput)) return { reason: 'That doesn’t look like a website — try something like yourcompany.com', target: 's1-url' }
    if (method === 'text' && textInput.trim().length < 50) return { reason: 'Paste at least 50 characters', target: 's1-text' }
    if (method === 'upload' && fileNames.length === 0) return { reason: 'Select a file to continue', target: 's1-file' }
    return null
  }

  async function createDraftAndReview(
    extractedData: Record<string, unknown>,
    autoBrandInfo: Record<string, unknown> | null,
    next: (key: string, detail?: string | null) => void,
  ) {
    next('save')
    // Carry the source PDF path/name (set by uploadAndExtract for pdf uploads)
    // into the draft so the Theme step can offer a client-download toggle.
    const sourcePdf: { sourcePdfPath?: string; sourcePdfName?: string } = (extractedData?._sourcePdfPath && extractedData?._sourcePdfName)
      ? { sourcePdfPath: extractedData._sourcePdfPath as string, sourcePdfName: extractedData._sourcePdfName as string }
      : {}
    let videoId: string
    if (existingDraftId) {
      // Reuse the existing draft — update it rather than spawning a new row
      const patchRes = await fetch('/api/videos/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: existingDraftId,
          updates: {
            outputType,
            purpose: purpose.trim(),
            recipientName: recipientName.trim() || undefined,
            clientId,
            extractedData,
            contentMethod: method || 'idea',
            // Coming back with a DIFFERENT source: clear what no longer
            // applies — the old PDF (null = "no source PDF") and the old
            // multi-file list (empty = single source, no extra-file charge).
            ...(sourcePdf.sourcePdfPath ? sourcePdf : { sourcePdfPath: null }),
            ...(extractedDocsRef.current.length > 1
              ? { extractedDocs: extractedDocsRef.current, combineInstruction: purpose.trim() }
              : { extractedDocs: [] }),
            ...(extractedData?.classification ? { classification: extractedData.classification } : {}),
          },
        }),
      })
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update project')
      }
      videoId = existingDraftId
    } else {
      const draftRes = await fetch('/api/videos/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outputType,
          purpose: purpose.trim(),
          recipientName: recipientName.trim() || undefined,
          clientId,
          extractedData,
          contentMethod: method || 'idea',
          autoBrandInfo,
          ...sourcePdf,
          ...(extractedDocsRef.current.length > 1 ? { extractedDocs: extractedDocsRef.current, combineInstruction: purpose.trim() } : {}),
          ...(extractedData?.classification ? { classification: extractedData.classification } : {}),
        }),
      })
      const draftData = await draftRes.json().catch(() => ({}))
      if (!draftRes.ok) {
        // Show the server's actual error — a generic "credits" message here
        // once masked a tier-gate bug for 9 days
        throw new Error(draftData.error || (draftRes.status === 402 ? 'Not enough credits. Upgrade your plan or buy more credits.' : 'Failed to create project'))
      }
      videoId = draftData.videoId
    }

    // Multi-file: run the AI combine pass (reasons across all docs + the
    // user's instruction) to produce one unified brief BEFORE the summary.
    // Every file's content is already in the draft either way; if the
    // comparison itself fails, the story step SAYS so.
    let failed = false
    if (extractedDocsRef.current.length > 1) {
      next('compare')
      try {
        const cr = await fetch('/api/combine-docs', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId }),
        })
        failed = !cr.ok
      } catch { failed = true }
    }
    setCombineFailed(failed)

    // THE SUMMARY. The same call step 2 used to make on arrival — made here
    // instead, so the person checks it before the story is written. It saves
    // the summary on the draft, and step 2 reuses it (no second call).
    next('brief')
    let b: VideoBrief | null = null
    try {
      const r = await fetch('/api/brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId }) })
      const d = await r.json().catch(() => ({}))
      b = d?.brief ?? null
    } catch { b = null }

    openReview(videoId, b)
    // The address now names the draft, so a reload (or "Change what I gave
    // you" and reading again) updates this project instead of making another.
    router.replace(`/create?id=${videoId}&review=1${failed ? '&combine=failed' : ''}`, { scroll: false })
  }

  async function handleNext() {
    setError(null)
    const missing = missingAnswer()
    if (missing) { setError(missing.reason); return }

    const files = Array.from(fileRef.current?.files || [])
    const list = readingStages(method, method === 'upload' ? files.length : 0)
    setStages(list)
    setStageIdx(0)
    setStageDetail(null)
    setPhase('reading')
    const next = (key: string, detail: string | null = null) => {
      const i = list.findIndex((s) => s.key === key)
      if (i >= 0) setStageIdx(i)
      setStageDetail(detail)
    }

    try {
      // Extract content based on method
      let extractedData: Record<string, unknown> | null = null
      let autoBrandInfo: Record<string, unknown> | null = null

      if (method === 'url') {
        // No one has to type https:// (normalize-url.ts).
        const cleanUrl = normalizeUrl(urlInput)
        if (!cleanUrl) throw new Error('That doesn’t look like a website — try something like yourcompany.com')
        next('read', cleanUrl.replace(/^https?:\/\//i, ''))
        const res = await fetch('/api/extract-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: cleanUrl }),
        })
        const result = await parseApiResponse(res, 'That website took too long to read (it may be blocking automated access). Try again — or copy the page text and use "Paste text" instead.')
        if (!res.ok) throw new Error((result.error as string) || 'Extraction failed')
        const { suggestedTheme, autoBrandId, autoLogoUrl: _logo, autoBrandInfo: abi, ...contentData } = result as any
        extractedData = contentData as Record<string, unknown>
        if (abi) autoBrandInfo = abi as Record<string, unknown>
        if (autoBrandId) extractedData['_autoBrandId'] = autoBrandId
        if (suggestedTheme?.prompt) extractedData['_customStylePrompt'] = suggestedTheme.prompt
      } else if (method === 'text') {
        next('read')
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textInput.trim(), purpose: purpose.trim() }),
        })
        const result = await parseApiResponse(res, 'Analysis took too long. Try again, or shorten the pasted text.')
        if (!res.ok) throw new Error((result.error as string) || 'Extraction failed')
        extractedData = result
      } else if (method === 'upload') {
        if (files.length === 0) throw new Error('No file selected')
        if (files.length === 1) {
          extractedData = await uploadAndExtract(files[0], purpose.trim(), (p) => next(p === 'uploading' ? 'upload' : 'read', files[0].name))
          extractedDocsRef.current = []
        } else {
          // Multi-file: extract each, stash the array for the combine pass.
          const docs = await uploadAndExtractMany(files, purpose.trim(), (done, total) => {
            next('upload', done < total ? `File ${done + 1} of ${total}` : `All ${total} files read`)
          })
          extractedDocsRef.current = docs
          extractedData = docs[0]?.data || {}
        }
      } else {
        next('read')
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idea: purpose.trim(), purpose: purpose.trim() }),
        })
        const result = await parseApiResponse(res, 'Writing the content took too long. Please try again, or paste your own text instead.')
        if (!res.ok) throw new Error((result.error as string) || 'Content generation failed')
        extractedData = result
      }

      if (!extractedData) throw new Error('No content could be extracted')
      await createDraftAndReview(extractedData, autoBrandInfo, next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('form')
    }
  }

  /** "Looks right": keep any edits to the summary, then write the story. */
  async function confirmReview() {
    if (!reviewId || savingReview) return
    setSavingReview(true)
    setError(null)
    try {
      if (brief) {
        const edited: VideoBrief = {
          ...brief,
          summary: summary.trim() || brief.summary,
          angle: point.trim() || brief.angle,
          figures: figures.map((f) => ({ label: f.label.trim(), value: f.value.trim() })).filter((f) => f.value),
        }
        const res = await fetch('/api/videos/draft', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: reviewId, updates: { brief: edited } }),
        })
        if (!res.ok) throw new Error('We couldn’t save your changes. Please try again.')
      }
      router.push(`/create/script?id=${reviewId}${combineFailed ? '&combine=failed' : ''}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t save your changes. Please try again.')
      setSavingReview(false)
    }
  }

  const pickedName = clientId ? (clientName || recipientName || 'Selected client') : forGeneral ? 'No client — general' : null
  const liveSource = sourceLabel(method, { fileNames, url: urlInput.trim() || undefined })
  const shownSource = phase === 'review' && savedSource ? savedSource : liveSource
  const review = reviewId ? quote?.options?.[quote.current as keyof typeof quote.options] : null
  const soFar = {
    client: pickedName,
    source: shownSource,
    point: phase === 'review' ? (point.trim() || null) : null,
    output: outputType,
    look: null,
    voice: null,
    length: null,
    price: reviewId
      ? { kind: 'quote' as const, credits: review?.total ?? null, free: review?.free, loading: quoteLoading }
      : { kind: 'later' as const },
  }

  if (copying) {
    return (
      <Workspace soFar={soFar}>
        <div role="status" className="kit-card s1-center">
          <div className="spinner" style={{ margin: '0 auto 14px' }} />
          <p className="s1-title-sm">Copying your project…</p>
          <p className="s1-hint">The story, look, voice and brand come with it. Nothing is charged.</p>
        </div>
      </Workspace>
    )
  }

  if (phase === 'review') {
    return (
      <Workspace
        soFar={soFar}
        side={
          <MainAction onClick={() => void confirmReview()} disabled={savingReview} busy={savingReview} note="Free — nothing is charged until step 3.">
            {savingReview ? 'Saving…' : 'Looks right — write the story →'}
          </MainAction>
        }
      >
        <div className="s1-page">
          <h1 className="s1-title">Here’s what we read</h1>
          <p className="s1-lead">Check it before we write the story. Change anything that’s off.</p>
          {error ? <Note tone="stop">{error}</Note> : null}
          <ReadReview
            brief={brief}
            summary={summary}
            setSummary={setSummary}
            point={point}
            setPoint={setPoint}
            figures={figures}
            setFigures={setFigures}
            hasQuestions={!!brief?.clarifyingQuestions?.length}
          />
          <div className="s1-actions">
            <Button variant="secondary" onClick={() => { reviewOpen.current = false; setPhase('form'); setError(null) }}>← Change what I gave you</Button>
          </div>
        </div>
      </Workspace>
    )
  }

  const reading = phase === 'reading'
  const missing = reading ? null : missingAnswer()

  return (
    <Workspace
      soFar={soFar}
      side={
        <MainAction onClick={() => void handleNext()} disabled={reading} busy={reading} missing={missing} note="Free — nothing is made or charged until step 3.">
          {reading ? 'Reading…' : 'Read it and plan the story →'}
        </MainAction>
      }
    >
      <div className="s1-page">
        <h1 className="s1-title">What&rsquo;s this about?</h1>
        <p className="s1-lead">Three questions. Nothing is made or charged until step 3.</p>

        {/* WHO IT'S FOR — asked once, for every kind of output, and reused on
            the cover, the send email and the share page. */}
        <div className="s1-block" id="s1-client">
          <span className="s1-label">Who is it for?</span>
          <ClientPicker
            value={clientId ? { clientId, name: clientName || recipientName || 'Selected client' } : forGeneral ? { clientId: null, name: '' } : null}
            onPick={(c) => {
              setPicked(c)
              setClientName(c?.clientId ? c.name : null)
              setRecipientName(c?.clientId ? c.name : '')
            }}
          />
        </div>

        <div className="s1-block" id="s1-goal">
          <label className="s1-label" htmlFor="s1-goal-box">What should it get them to do?</label>
          <textarea
            id="s1-goal-box"
            className="ws-input"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder='e.g. "Explain our services to potential clients" or "Train new agents on this product"'
            rows={3}
            disabled={reading}
          />
        </div>

        <div className="s1-block" id="s1-source">
          <Choices
            legend={<>Where should the content come from? <span className="s1-hint s1-hint-inline">Pick one — we&rsquo;ll read it and plan the story from it.</span></>}
            className="s1-sources"
            name="content-source"
            value={method}
            onChange={(m) => { setMethod(m); setError(null) }}
            choices={CONTENT_METHODS.map((m) => ({ value: m.id, label: m.label, hint: m.desc, icon: <m.Icon size={20} />, disabled: reading }))}
          />

          {method === 'url' && (
            <input id="s1-url" type="text" inputMode="url" autoComplete="url" className="ws-input s1-gap" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onBlur={() => setUrlInput((v) => tidyUrlInput(v))} placeholder="yourcompany.com" aria-label="Website address" disabled={reading} />
          )}

          {method === 'upload' && (
            <div className="s1-gap">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".pdf,.docx,.pptx,.txt,.csv,.xlsx"
                onChange={(e) => setFileNames(Array.from(e.target.files || []).map((f) => f.name))}
                style={{ display: 'none' }}
              />
              <button id="s1-file" type="button" className="s1-drop" onClick={() => fileRef.current?.click()} disabled={reading}>
                {fileNames.length > 1 ? (
                  <>
                    <span className="s1-drop-title">{fileNames.length} files selected</span>
                    <span className="s1-hint">{fileNames.join(' · ')}</span>
                  </>
                ) : fileNames.length === 1 ? (
                  <span className="s1-drop-title">{fileNames[0]}</span>
                ) : (
                  <>
                    <span className="s1-drop-title">Click to upload</span>
                    <span className="s1-hint">Up to 5 files · PDF, DOCX, PPTX, TXT, CSV, XLSX</span>
                  </>
                )}
              </button>
            </div>
          )}

          {method === 'text' && (
            <textarea id="s1-text" className="ws-input s1-gap" value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Paste your content here (at least 50 characters)" rows={6} disabled={reading} />
          )}

          {method === 'idea' && (
            <p className="s1-hint s1-gap">AI will generate content based on your description above.</p>
          )}
        </div>

        {error ? <Note tone="stop">{error}</Note> : null}

        {/* Reading: the real stages, each ticked as it really finishes. */}
        {reading ? (
          <div className="kit-card s1-reading" role="status" aria-live="polite">
            <p className="s1-title-sm">Reading what you gave us</p>
            <Stages stages={stages} current={stageIdx} detail={stageDetail} label="Reading your content" />
            <p className="s1-hint">Usually under a minute. A long document or a slow website can take a little longer.</p>
          </div>
        ) : null}

        <div className="s1-actions">
          <Button variant="quiet" onClick={() => router.push('/dashboard')} disabled={reading}>Cancel</Button>
          {/* Other things this account can make — they used to be cards on a
              separate chooser page before this one. */}
          <span className="s1-hint">
            Making a commercial instead? <a href="/create/commercial">Start a commercial</a>
          </span>
        </div>
      </div>
    </Workspace>
  )
}
