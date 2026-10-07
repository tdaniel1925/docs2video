'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { uploadAndExtract, uploadAndExtractMany } from './uploadAndExtract'
import ClientPicker, { type PickedClient } from './ClientPicker'
type OutputType = 'video' | 'pptx' | 'pdf' | 'interactive' | 'deck'
type InputMethod = 'url' | 'upload' | 'text' | 'idea' | null
type Stage = 'idle' | 'extracting'


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

const CONTENT_METHODS: { id: InputMethod; label: string; desc: string }[] = [
  { id: 'url', label: 'Website URL', desc: 'Pull from a web page' },
  { id: 'upload', label: 'Upload file', desc: 'PDF, Word, or PowerPoint' },
  { id: 'text', label: 'Paste text', desc: 'Paste your own content' },
  { id: 'idea', label: 'AI writes it', desc: 'Describe it, AI drafts it' },
]

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
  // "Duplicate" on a finished project links here as ?duplicate=<id>. Nothing
  // used to read it, so the user got this screen blank. The copy is made on
  // the server (owner only), then the copy opens on the story step.
  const duplicateOf = searchParams.get('duplicate') || undefined
  const [copying, setCopying] = useState(!!duplicateOf)
  const copyStarted = useRef(false)
  // Output type is chosen in Step 1 (/create/start) and passed via ?type.
  // "slides" maps to the existing pptx pipeline; the result page offers both
  // PDF and PowerPoint downloads. Default to video.
  const wizType = searchParams.get('type')
  const isSlides = wizType === 'slides'
  const [outputType, setOutputType] = useState<OutputType>(
    wizType === 'interactive' ? 'interactive' : wizType === 'deck' ? 'deck' : isSlides ? 'pptx' : 'video'
  )
  const [recipientName, setRecipientName] = useState('')
  const [clientName, setClientName] = useState<string | null>(null) // bound client (read-only display)
  const [draftRestored, setDraftRestored] = useState(false) // gate client-name fetch behind draft restore

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
          if (d.outputType) setOutputType(d.outputType)
          if (d.purpose) setPurpose(prev => prev || d.purpose)
          if (d.recipientName) setRecipientName(prev => prev || d.recipientName)
          // Restore the "who is this for?" choice so Back doesn't re-ask it:
          // a saved clientId → client; else the draft has been through Step 1
          // already, so treat as general (no re-prompt).
          if (!clientIdParam && !forGeneralParam) {
            if (d.clientId) setRestoredClientId(d.clientId as string)
            else setRestoredGeneral(true)
          }
        }
        setDraftRestored(true)
      })
      .catch(() => { if (!cancelled) setDraftRestored(true) })
    return () => { cancelled = true }
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
  const [purpose, setPurpose] = useState('')
  const [method, setMethod] = useState<InputMethod>(null)
  const [urlInput, setUrlInput] = useState('')
  const [textInput, setTextInput] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  // Multi-file: names of all selected files (fileName above keeps the first for
  // existing single-file copy). When length > 1 the combine flow kicks in.
  const [fileNames, setFileNames] = useState<string[]>([])
  const [stage, setStage] = useState<Stage>('idle')
  const [stageMsg, setStageMsg] = useState('')
  const [progressPct, setProgressPct] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // Carries multi-file extractions from handleNext → createDraftAndRedirect
  // without re-threading every call site. Empty for single-file/url/text/idea.
  const extractedDocsRef = useRef<{ fileName?: string; data: Record<string, unknown> }[]>([])

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

  async function createDraftAndRedirect(
    extractedData: Record<string, unknown>,
    autoBrandInfo: Record<string, unknown> | null,
  ) {
    setStageMsg('Setting up your project...')
    setStage('extracting')
    // Carry the source PDF path/name (set by uploadAndExtract for pdf uploads)
    // into the draft so the Theme step can offer a client-download toggle.
    const sourcePdf: { sourcePdfPath?: string; sourcePdfName?: string } = (extractedData?._sourcePdfPath && extractedData?._sourcePdfName)
      ? { sourcePdfPath: extractedData._sourcePdfPath as string, sourcePdfName: extractedData._sourcePdfName as string }
      : {}
    try {
      let draftData: { videoId: string; error?: string }
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
          setError(err.error || 'Failed to update project')
          setStage('idle')
          return
        }
        draftData = { videoId: existingDraftId }
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
        draftData = await draftRes.json()
        if (!draftRes.ok) {
          // Show the server's actual error — a generic "credits" message here
          // once masked a tier-gate bug for 9 days
          setError(draftData.error || (draftRes.status === 402 ? 'Not enough credits. Upgrade your plan or buy more credits.' : 'Failed to create project'))
          setStage('idle')
          return
        }
      }

      // Multi-file: run the AI combine pass (reasons across all docs + the
      // user's instruction) to produce one unified brief BEFORE the brief step.
      // Every file's content is already in the draft either way; if the
      // comparison itself fails, the Brief step SAYS so (it used to be ignored,
      // and the user got a single-file brief with no explanation).
      let combineFailed = false
      if (extractedDocsRef.current.length > 1) {
        setStageMsg('Comparing your documents…')
        try {
          const cr = await fetch('/api/combine-docs', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId: draftData.videoId }),
          })
          combineFailed = !cr.ok
        } catch { combineFailed = true }
      }
      const combineFlag = combineFailed ? '&combine=failed' : ''

      // After extraction → step 2, the story (key points + scenes on one screen).
      router.push(`/create/script?id=${draftData.videoId}${combineFlag}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStage('idle')
    }
  }

  async function handleNext() {
    setError(null)

    if (!purpose.trim()) { setError('Describe what you want first'); return }
    // Require an explicit content source — no silent fall-through to AI (audit #3).
    if (!method) { setError('Pick where your content comes from (or choose "AI writes it")'); return }
    if (method === 'url' && !urlInput.trim()) { setError('Paste a URL to continue'); return }
    if (method === 'text' && textInput.trim().length < 50) { setError('Paste at least 50 characters'); return }
    if (method === 'upload' && !fileRef.current?.files?.[0]) { setError('Select a file to continue'); return }

    setStage('extracting')
    setProgressPct(5)
    setStageMsg('Starting...')

    // Simulate progress while waiting for API calls
    const progressTimer = setInterval(() => {
      setProgressPct(prev => {
        if (prev < 30) return prev + 3
        if (prev < 60) return prev + 2
        if (prev < 85) return prev + 1
        return Math.min(prev + 0.5, 95)
      })
    }, 1000)

    try {
      // Extract content based on method
      let extractedData: Record<string, unknown> | null = null
      let autoBrandInfo: Record<string, unknown> | null = null

      if (method === 'url') {
        setStageMsg('Connecting to website...')
        setProgressPct(5)
        const scrapeTimers = [
          setTimeout(() => { setStageMsg('Reading page content...'); setProgressPct(20) }, 3000),
          setTimeout(() => { setStageMsg('Extracting brand info...'); setProgressPct(40) }, 8000),
          setTimeout(() => { setStageMsg('Almost there...'); setProgressPct(60) }, 15000),
        ]
        let cleanUrl = urlInput.trim()
        if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = `https://${cleanUrl}`
        const res = await fetch('/api/extract-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: cleanUrl }),
        })
        scrapeTimers.forEach(t => clearTimeout(t))
        const result = await parseApiResponse(res, 'That website took too long to read (it may be blocking automated access). Try again — or copy the page text and use "Paste text" instead.')
        if (!res.ok) throw new Error((result.error as string) || 'Extraction failed')
        const { suggestedTheme, autoBrandId, autoLogoUrl, autoBrandInfo: abi, ...contentData } = result as any
        extractedData = contentData as Record<string, unknown>
        if (abi) autoBrandInfo = abi as Record<string, unknown>
        if (autoBrandId) extractedData['_autoBrandId'] = autoBrandId
        if (suggestedTheme?.prompt) extractedData['_customStylePrompt'] = suggestedTheme.prompt
      } else if (method === 'text') {
        setStageMsg('Analyzing text...')
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textInput.trim(), purpose: purpose.trim() }),
        })
        const result = await parseApiResponse(res, 'Analysis took too long. Try again, or shorten the pasted text.')
        if (!res.ok) throw new Error((result.error as string) || 'Extraction failed')
        extractedData = result
      } else if (method === 'upload') {
        const files = Array.from(fileRef.current?.files || [])
        if (files.length === 0) throw new Error('No file selected')
        if (files.length === 1) {
          setStageMsg('Uploading file...')
          extractedData = await uploadAndExtract(files[0], purpose.trim())
          extractedDocsRef.current = []
        } else {
          // Multi-file: extract each, stash the array for the combine pass.
          const docs = await uploadAndExtractMany(files, purpose.trim(), (done, total) => {
            setStageMsg(done < total ? `Reading file ${done + 1} of ${total}…` : 'Analyzing all files…')
          })
          extractedDocsRef.current = docs
          extractedData = docs[0]?.data || {}
        }
      } else {
        setStageMsg('AI is writing content...')
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idea: purpose.trim(), purpose: purpose.trim() }),
        })
        // Parsed defensively like the other paths (see Quick mode above).
        const result = await parseApiResponse(res, 'Writing the content took too long. Please try again, or paste your own text instead.')
        if (!res.ok) throw new Error((result.error as string) || 'Content generation failed')
        extractedData = result
      }

      if (!extractedData) throw new Error('No content could be extracted')

      // All methods go straight to draft creation → styling step
      clearInterval(progressTimer)

      // Create draft video record
      clearInterval(progressTimer)
      setProgressPct(98)
      await createDraftAndRedirect(extractedData, autoBrandInfo)
    } catch (err) {
      clearInterval(progressTimer)
      setProgressPct(0)
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStage('idle')
    }
  }

  if (copying) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
        <div role="status" style={{ padding: '28px 24px', borderRadius: 10, border: '1px solid var(--border)', background: 'white', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 14px' }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Copying your project…</div>
          <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 4, lineHeight: 1.5 }}>
            The story, look, voice and brand come with it. Nothing is charged.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em' }}>What&rsquo;s this about?</h1>
        <p style={{ fontSize: 15, color: 'var(--ink-light)', margin: '6px 0 0' }}>Three questions. Nothing is made or charged until step 3.</p>
      </div>

      {/* WHO IT'S FOR — asked once, for every kind of output, and reused on
          the cover, the send email and the share page. */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 8 }}>
          Who is it for?
        </label>
        <ClientPicker
          value={clientId ? { clientId, name: clientName || recipientName || 'Selected client' } : forGeneral ? { clientId: null, name: '' } : null}
          onPick={(c) => {
            setPicked(c)
            setClientName(c?.clientId ? c.name : null)
            setRecipientName(c?.clientId ? c.name : '')
          }}
        />
      </div>

      {/* Purpose input */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 8 }}>
          What should it get them to do?
        </label>
        <textarea
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder={outputType === 'video' ? 'e.g. "Explain our services to potential clients" or "Train new agents on this product"' : outputType === 'pptx' ? 'e.g. "Summarize this report for executives" or "Create a sales pitch deck"' : 'e.g. "Turn this document into a client-ready PDF" or "Create a printable summary"'}
          rows={3}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            fontSize: 15,
            fontFamily: 'inherit',
            resize: 'vertical',
            background: 'var(--bg)',
          }}
        />
      </div>

      {/* Content source — guided question, not a bare button row */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>
          Where should the content come from?
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 12 }}>
          Pick one — we&rsquo;ll read it and plan the story from it.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {CONTENT_METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => { setMethod(m.id); setError(null) }}
              style={{
                flex: '1 1 160px',
                textAlign: 'left',
                padding: '10px 14px',
                borderRadius: 8,
                border: method === m.id ? '2px solid var(--mint)' : '1px solid var(--border)',
                background: method === m.id ? 'var(--mint-light, #f0fae4)' : 'var(--bg)',
                cursor: 'pointer',
                color: 'var(--ink)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700 }}>{m.label}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 2 }}>{m.desc}</div>
            </button>
          ))}
        </div>

        {/* URL input */}
        {method === 'url' && (
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com"
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              fontSize: 15,
              background: 'var(--bg)',
            }}
          />
        )}

        {/* File upload */}
        {method === 'upload' && (
          <div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.docx,.pptx,.txt,.csv,.xlsx"
              onChange={(e) => {
                const names = Array.from(e.target.files || []).map((f) => f.name)
                setFileNames(names)
                setFileName(names[0] || null)
              }}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                width: '100%',
                padding: '24px',
                borderRadius: 10,
                border: '2px dashed var(--border)',
                background: 'var(--bg-soft)',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {fileNames.length > 1 ? (
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                  {fileNames.length} files selected
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-light)', marginTop: 4 }}>
                    {fileNames.join(' · ')}
                  </div>
                </div>
              ) : fileName ? (
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{fileName}</div>
              ) : (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                    Click to upload
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>
                    Up to 5 files · PDF, DOCX, PPTX, TXT, CSV, XLSX
                  </div>
                </div>
              )}
            </button>
          </div>
        )}

        {/* Text paste */}
        {method === 'text' && (
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste your content here (at least 50 characters)"
            rows={6}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'vertical',
              background: 'var(--bg)',
            }}
          />
        )}

        {/* AI writes it — no extra input needed */}
        {method === 'idea' && (
          <div style={{
            padding: 16,
            borderRadius: 10,
            background: 'var(--bg-soft)',
            border: '1px solid var(--border-light)',
            fontSize: 13,
            color: 'var(--ink-light)',
          }}>
            AI will generate content based on your description above.
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 8,
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          color: '#DC2626',
          fontSize: 13,
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Extracting state */}
      {stage === 'extracting' && (
        <div style={{
          padding: '28px 24px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'white',
          textAlign: 'center',
          marginBottom: 16,
        }}>
          {/* Percentage display */}
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em', marginBottom: 8 }}>
            {progressPct}%
          </div>
          {/* Progress bar */}
          <div style={{
            width: '100%', height: 8, background: 'var(--border)', borderRadius: 4,
            overflow: 'hidden', marginBottom: 16,
          }}>
            <div style={{
              width: `${progressPct}%`, height: '100%', background: '#C7E8A8',
              borderRadius: 4, transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{stageMsg}</div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => router.push('/dashboard')}
          disabled={stage === 'extracting'}
          style={{
            padding: '14px 20px',
            borderRadius: 10,
            border: '1.5px solid var(--border)',
            background: 'white',
            color: 'var(--ink-soft)',
            fontSize: 14,
            fontWeight: 600,
            cursor: stage === 'extracting' ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleNext}
          disabled={stage === 'extracting'}
          style={{
            flex: 1,
            padding: '14px 24px',
            borderRadius: 10,
            border: 'none',
            background: stage === 'extracting' ? 'var(--border)' : 'var(--ink)',
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            cursor: stage === 'extracting' ? 'not-allowed' : 'pointer',
          }}
        >
          {stage === 'extracting' ? 'Reading…' : 'Read it and plan the story →'}
        </button>
      </div>
      {/* Other things this account can make — they used to be cards on a
          separate chooser page before this one. */}
      <div style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 14, textAlign: 'center' }}>
        Making something else? <a href="/design" style={{ color: 'var(--primary, #2563eb)', fontWeight: 600 }}>Custom graphics</a>
        {' · '}<a href="/create/commercial" style={{ color: 'var(--primary, #2563eb)', fontWeight: 600 }}>A commercial</a>
      </div>
    </div>
  )
}
