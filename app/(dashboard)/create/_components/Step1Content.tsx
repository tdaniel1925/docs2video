'use client'

import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { uploadAndExtract, uploadAndExtractMany, MAX_FILES } from './uploadAndExtract'
import ClientPicker, { type PickedClient } from './ClientPicker'
import { methodFromSource } from '../../../_lib/create-sources'
import { normalizeUrl, tidyUrlInput } from '../../../_lib/normalize-url'
import { Note } from '../../../_components/kit'
import BottomBar from './workspace/BottomBar'
import { type Missing } from './workspace/MainAction'
import Stages, { type Stage as ReadStage } from './workspace/Stages'

/*
 * STEP 1 — "Your content" (/create).
 *
 * Opens on what was picked on Home (/create?source=upload|url|paste|ai;
 * a document when nothing was picked): "Add your document." with a big drop
 * box, and chips to switch to a website, pasted text or an idea. Then two
 * optional answers side by side: who it's FOR and the GOAL.
 *
 * "Read it →" (the bottom bar) reads the content, saves the draft and finds
 * the one point and the numbers — then step 2 opens, where they're checked
 * and edited next to the story. Nothing is charged here.
 */

type OutputType = 'video' | 'interactive'
type InputMethod = 'url' | 'upload' | 'text' | 'idea' | null
type Method = Exclude<InputMethod, null>
type Phase = 'form' | 'reading'

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

/** The headline for each way in, and the chip that switches to it. */
const METHODS: Record<Method, { lead: string; word: string; chip: string }> = {
  upload: { lead: 'Add your', word: 'document.', chip: 'Use a document' },
  url: { lead: 'Add your', word: 'website.', chip: 'Use a website' },
  text: { lead: 'Paste your', word: 'text.', chip: 'Paste text' },
  idea: { lead: 'Describe your', word: 'idea.', chip: 'Describe an idea' },
}
const METHOD_ORDER: Method[] = ['upload', 'url', 'text', 'idea']

const ACCEPT = '.pdf,.docx,.pptx,.txt,.csv,.xlsx'

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

function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export default function Step1Content() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clientIdParam = searchParams.get('clientId') || undefined
  // ?for=general: an old link that chose "no client" up front.
  const forGeneralParam = searchParams.get('for') === 'general'
  // Coming back from a later step we arrive as /create?id=X with none of the
  // client params — they're restored from the draft so nothing is re-asked.
  const [restoredClientId, setRestoredClientId] = useState<string | undefined>(undefined)
  const [restoredGeneral, setRestoredGeneral] = useState(false)
  /* WHO IT'S FOR, chosen on this screen. undefined = not touched here, so the
     URL / restored draft wins. */
  const [picked, setPicked] = useState<PickedClient | null | undefined>(undefined)
  const clientId = picked !== undefined ? (picked?.clientId ?? undefined) : (clientIdParam || restoredClientId)
  const forGeneral = picked !== undefined ? picked?.clientId === null : (forGeneralParam || restoredGeneral)
  // If we arrived back here from a later step, a draft already exists — reuse it
  // instead of creating a second orphaned row.
  const existingDraftId = searchParams.get('id') || undefined
  // ?review=1 was "Here's what we read" on this screen. That check now lives
  // on step 2, next to the story — an old link lands there.
  const reviewParam = searchParams.get('review') === '1'
  const combineParam = searchParams.get('combine') === 'failed'
  // "Duplicate" on a finished project links here as ?duplicate=<id>. The copy
  // is made on the server (owner only), then the copy opens on the story step.
  const duplicateOf = searchParams.get('duplicate') || undefined
  const [copying, setCopying] = useState(!!duplicateOf)
  const copyStarted = useRef(false)
  // ?type=interactive starts a presentation; anything else is a video.
  // Old links with ?type=deck or ?type=slides (slide decks, PowerPoint/PDF)
  // start a video now — Docs2Video no longer makes those (videos-only.ts).
  const wizType = searchParams.get('type')
  const [outputType, setOutputType] = useState<OutputType>(wizType === 'interactive' ? 'interactive' : 'video')
  const [recipientName, setRecipientName] = useState('')
  const [clientName, setClientName] = useState<string | null>(null) // bound client (display)
  const [draftRestored, setDraftRestored] = useState(false) // gate client-name fetch behind draft restore
  // Came back to a project that was already read: its story is waiting.
  const [hadContent, setHadContent] = useState(false)

  // THE GOAL (optional). For "Describe an idea" the idea has its own box.
  const [purpose, setPurpose] = useState('')
  const [ideaText, setIdeaText] = useState('')
  // Home's start cards link here as ?source=upload|url|paste|ai — start with
  // that answer already picked (app/_lib/create-sources.ts). Nothing picked
  // = a document.
  const [method, setMethod] = useState<InputMethod>(() => methodFromSource(searchParams.get('source')))
  const src: Method = method ?? 'upload'
  const [urlInput, setUrlInput] = useState('')
  const [textInput, setTextInput] = useState('')
  // The files picked or dropped. More than one → the compare flow kicks in.
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [phase, setPhase] = useState<Phase>('form')
  const [stages, setStages] = useState<ReadStage[]>([])
  const [stageIdx, setStageIdx] = useState(0)
  const [stageDetail, setStageDetail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // Carries multi-file extractions from handleNext → createDraftAndRead
  // without re-threading every call site. Empty for single-file/url/text/idea.
  const extractedDocsRef = useRef<{ fileName?: string; data: Record<string, unknown> }[]>([])

  // An old "Here's what we read" link: the check is on step 2 now.
  useEffect(() => {
    if (reviewParam && existingDraftId) router.replace(`/create/script?id=${encodeURIComponent(existingDraftId)}${combineParam ? '&combine=failed' : ''}`)
  }, [reviewParam, existingDraftId, combineParam, router])

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
          if (d.contentMethod) { setMethod(prev => prev || d.contentMethod); setHadContent(true) }
          if (d.contentMethod === 'idea') {
            if (d.purpose) setIdeaText(prev => prev || d.purpose)
          } else if (d.purpose) setPurpose(prev => prev || d.purpose)
          if (d.recipientName) setRecipientName(prev => prev || d.recipientName)
          // Restore "who is it for" so Back doesn't re-ask it: a saved
          // clientId → that client; else the draft has been through step 1
          // already, so it's general.
          if (!clientIdParam && !forGeneralParam) {
            if (d.clientId) setRestoredClientId(d.clientId as string)
            else setRestoredGeneral(true)
          }
        }
        setDraftRestored(true)
      })
      .catch(() => { if (!cancelled) setDraftRestored(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingDraftId])

  // A client from the address (?clientId=…) or the draft: fetch its name for
  // the chip. Only sets recipientName if still empty after any draft restore,
  // so a user-edited draft value is never overwritten.
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
    if (src === 'url' && !urlInput.trim()) return { reason: 'Type or paste a website to continue', target: 's1-url' }
    if (src === 'url' && !normalizeUrl(urlInput)) return { reason: 'That doesn’t look like a website — try something like yourcompany.com', target: 's1-url' }
    if (src === 'text' && textInput.trim().length < 50) return { reason: 'Paste at least 50 characters', target: 's1-text' }
    if (src === 'upload' && files.length === 0) return { reason: 'Add a file to continue', target: 's1-file' }
    if (src === 'upload' && files.length > MAX_FILES) return { reason: `You can add up to ${MAX_FILES} files at once`, target: 's1-file' }
    if (src === 'idea' && !ideaText.trim()) return { reason: 'Describe your idea first', target: 's1-idea' }
    return null
  }

  /** What the story is for: the goal, or the idea itself when there's no goal. */
  function goal(): string {
    return purpose.trim() || (src === 'idea' ? ideaText.trim() : '')
  }

  async function createDraftAndRead(
    extractedData: Record<string, unknown>,
    autoBrandInfo: Record<string, unknown> | null,
    next: (key: string, detail?: string | null) => void,
  ) {
    next('save')
    // Carry the source PDF path/name (set by uploadAndExtract for pdf uploads)
    // into the draft so step 3 can offer a client-download toggle.
    const sourcePdf: { sourcePdfPath?: string; sourcePdfName?: string } = (extractedData?._sourcePdfPath && extractedData?._sourcePdfName)
      ? { sourcePdfPath: extractedData._sourcePdfPath as string, sourcePdfName: extractedData._sourcePdfName as string }
      : {}
    const why = goal()
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
            purpose: why,
            recipientName: recipientName.trim() || undefined,
            clientId,
            extractedData,
            contentMethod: src,
            // Coming back with a DIFFERENT source: clear what no longer
            // applies — the old PDF (null = "no source PDF") and the old
            // multi-file list (empty = single source, no extra-file charge).
            ...(sourcePdf.sourcePdfPath ? sourcePdf : { sourcePdfPath: null }),
            ...(extractedDocsRef.current.length > 1
              ? { extractedDocs: extractedDocsRef.current, combineInstruction: why }
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
          purpose: why,
          recipientName: recipientName.trim() || undefined,
          clientId,
          extractedData,
          contentMethod: src,
          autoBrandInfo,
          ...sourcePdf,
          ...(extractedDocsRef.current.length > 1 ? { extractedDocs: extractedDocsRef.current, combineInstruction: why } : {}),
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
    // user's goal) to produce one unified brief BEFORE the summary. Every
    // file's content is already in the draft either way; if the comparison
    // itself fails, the story step SAYS so.
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

    // THE ONE POINT AND THE NUMBERS. Saved on the draft; step 2 shows them
    // (editable) next to the story and reuses them — no second call.
    next('brief')
    try {
      await fetch('/api/brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId }) })
    } catch { /* step 2 builds it if it isn't there */ }

    router.push(`/create/script?id=${videoId}${failed ? '&combine=failed' : ''}`)
  }

  async function handleNext() {
    setError(null)
    const missing = missingAnswer()
    if (missing) { setError(missing.reason); return }

    const list = readingStages(src, src === 'upload' ? files.length : 0)
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

      if (src === 'url') {
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
      } else if (src === 'text') {
        next('read')
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textInput.trim(), purpose: purpose.trim() }),
        })
        const result = await parseApiResponse(res, 'Analysis took too long. Try again, or shorten the pasted text.')
        if (!res.ok) throw new Error((result.error as string) || 'Extraction failed')
        extractedData = result
      } else if (src === 'upload') {
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
        const idea = ideaText.trim()
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idea, purpose: purpose.trim() || idea }),
        })
        const result = await parseApiResponse(res, 'Writing the content took too long. Please try again, or paste your own text instead.')
        if (!res.ok) throw new Error((result.error as string) || 'Content generation failed')
        extractedData = result
      }

      if (!extractedData) throw new Error('No content could be extracted')
      await createDraftAndRead(extractedData, autoBrandInfo, next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('form')
    }
  }

  function addFiles(list: FileList | File[] | null) {
    const picked = Array.from(list || [])
    if (picked.length === 0) return
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`))
      return [...prev, ...picked.filter((f) => !seen.has(`${f.name}:${f.size}`))]
    })
    setError(null)
  }

  const reading = phase === 'reading'
  const pickedValue: PickedClient | null = clientId ? { clientId, name: clientName || recipientName || 'Your client' } : forGeneral ? { clientId: null, name: '' } : null

  if (copying) {
    return (
      <div className="cf-page">
        <div role="status" className="cf-card cf-reading" style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
          <p className="cf-label" style={{ justifyContent: 'center', margin: 0 }}>Copying your project…</p>
          <p className="cf-hint">The story, look, voice and brand come with it. Nothing is charged.</p>
        </div>
      </div>
    )
  }

  const missing = reading ? null : missingAnswer()
  const head = METHODS[src]

  return (
    <div className="cf-page">
      <h1 className="cf-h1">{head.lead} <em>{head.word}</em></h1>

      <div id="s1-source" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {src === 'upload' && (
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={ACCEPT}
              aria-label="Choose files"
              onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
              style={{ display: 'none' }}
            />
            <button
              id="s1-file"
              type="button"
              className={`cf-drop ${dragOver ? 'is-over' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!reading) addFiles(e.dataTransfer.files) }}
              disabled={reading}
            >
              <strong>{files.length ? 'Add another file' : 'Drop your file here'}</strong>
              <span>or click to choose · PDF, Word or PowerPoint · up to {MAX_FILES} files</span>
            </button>
            {files.length > 0 && (
              <ul className="cf-files" aria-label="Your files">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="cf-card cf-file">
                    <span className="cf-file-icon" aria-hidden="true">{(f.name.split('.').pop() || 'file').slice(0, 4)}</span>
                    <span className="cf-file-name" style={{ flex: 1 }}>{f.name} <small>· {fileSize(f.size)}</small></span>
                    <button type="button" className="cf-scene-edit" aria-label={`Remove ${f.name}`} disabled={reading} onClick={() => setFiles((list) => list.filter((_, j) => j !== i))}>
                      <X size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {files.length > 1 ? (
              <p className="cf-hint">{files.length} files — we’ll read them all and compare them. Each extra file adds to the price, shown on step 3 before anything is charged.</p>
            ) : null}
          </>
        )}

        {src === 'url' && (
          <input id="s1-url" type="text" inputMode="url" autoComplete="url" className="cf-input" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onBlur={() => setUrlInput((v) => tidyUrlInput(v))} placeholder="yourcompany.com" aria-label="Website address" disabled={reading} />
        )}

        {src === 'text' && (
          <textarea id="s1-text" className="cf-input" value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Paste your content here (at least 50 characters)" aria-label="Your text" rows={8} disabled={reading} />
        )}

        {src === 'idea' && (
          <textarea id="s1-idea" className="cf-input" value={ideaText} onChange={(e) => setIdeaText(e.target.value)} placeholder='e.g. "Why term life makes sense for young parents"' aria-label="Your idea" rows={4} disabled={reading} />
        )}

        <div className="cf-chips" role="group" aria-label="Use something else">
          {METHOD_ORDER.filter((m) => m !== src).map((m) => (
            <button key={m} type="button" className="cf-chip cf-chip--link" disabled={reading} onClick={() => { setMethod(m); setError(null) }}>
              {METHODS[m].chip}
            </button>
          ))}
        </div>
      </div>

      <div className="cf-two">
        <div id="s1-client">
          <h2 className="cf-label">For <small>optional</small></h2>
          <ClientPicker
            value={pickedValue}
            disabled={reading}
            onPick={(c) => {
              setPicked(c)
              setClientName(c?.clientId ? c.name : null)
              setRecipientName(c?.clientId ? c.name : '')
            }}
          />
        </div>
        <div id="s1-goal">
          <h2 className="cf-label"><label htmlFor="s1-goal-box">Goal</label> <small>optional</small></h2>
          <input
            id="s1-goal-box"
            className="cf-input"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. Book a review call"
            disabled={reading}
          />
        </div>
      </div>

      {hadContent && existingDraftId && !reading ? (
        <Note tone="info" action={<a className="cf-link" href={`/create/script?id=${encodeURIComponent(existingDraftId)}`}>Back to the story</a>}>
          This project has been read already. Add new content only if you want to start its story again.
        </Note>
      ) : null}

      {error ? <Note tone="stop">{error}</Note> : null}

      {/* Reading: the real stages, each ticked as it really finishes. */}
      {reading ? (
        <div className="cf-card cf-reading" role="status" aria-live="polite">
          <p className="cf-label" style={{ margin: 0 }}>Reading what you gave us</p>
          <Stages stages={stages} current={stageIdx} detail={stageDetail} label="Reading your content" />
          <p className="cf-hint">Usually under a minute. A long document or a slow website can take a little longer.</p>
        </div>
      ) : null}

      {/* Other things this account can make. */}
      <p className="cf-hint">
        Making a commercial instead? <a href="/create/commercial">Start a commercial</a>
      </p>

      <BottomBar
        label="Next step"
        info="Free"
        sub="Nothing charged yet"
        onMain={() => void handleNext()}
        mainLabel={reading ? 'Reading…' : 'Read it →'}
        disabled={reading}
        busy={reading}
        missing={missing}
      />
    </div>
  )
}
