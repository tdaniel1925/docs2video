'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export default function ScriptPage() {
  const router = useRouter()
  const [createState, setCreateState] = useState<any>(null)
  const [detailLevel, setDetailLevel] = useState<'quick' | 'standard' | 'detailed'>('standard')
  const [narrationStyle, setNarrationStyle] = useState<'solo' | 'podcast'>('solo')
  const [scenes, setScenes] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedScene, setSavedScene] = useState<number | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatCount, setChatCount] = useState(0)
  const [templatePromptShown, setTemplatePromptShown] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [previewIdx, setPreviewIdx] = useState<number | null>(null)
  const [previewImg, setPreviewImg] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Auto-save scenes to localStorage — debounced for typing, instant for other actions
  const autoSave = useCallback((updatedScenes: any[], sceneIdx: number, instant?: boolean) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const doSave = () => {
      const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
      state.scenes = updatedScenes
      localStorage.setItem('d2v_create', JSON.stringify(state))
      setSavedScene(sceneIdx)
      setTimeout(() => setSavedScene(null), 1500)
    }
    if (instant) {
      doSave()
    } else {
      saveTimer.current = setTimeout(doSave, 800)
    }
  }, [])

  // Safety net: save scenes whenever they change
  useEffect(() => {
    if (scenes.length > 0) {
      const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
      state.scenes = scenes
      localStorage.setItem('d2v_create', JSON.stringify(state))
    }
  }, [scenes])

  useEffect(() => {
    const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
    if (!state.extractedData && !state.scenes) {
      // No data — redirect back
      router.push('/create/source')
      return
    }
    setCreateState(state)
    if (state.detailLevel) setDetailLevel(state.detailLevel)
    if (state.narrationStyle) setNarrationStyle(state.narrationStyle)
    if (state.scenes) setScenes(state.scenes)
  }, [router])

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyData: {
            ...state.extractedData,
            intentType: state.intentType,
            contactPhone: state.contactPhone,
            contactEmail: state.contactEmail,
            contactWebsite: state.contactWebsite,
          },
          brandId: state.selectedBrand || state.autoBrandId,
          detailed: detailLevel === 'detailed',
          detailLevel,
          narrationStyle,
          purpose: state.purpose,
          contactInfo: {
            phone: state.contactPhone || undefined,
            email: state.contactEmail || undefined,
            website: state.contactWebsite || undefined,
          },
          industry: state.extractedData?.industry || 'general',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Script generation failed')

      setScenes(data.scenes)
      state.scenes = data.scenes
      state.detailLevel = detailLevel
      state.narrationStyle = narrationStyle
      localStorage.setItem('d2v_create', JSON.stringify(state))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate script')
    }
    setGenerating(false)
  }

  async function handleChat() {
    if (!chatInput.trim() || chatLoading) return
    const msg = chatInput.trim()
    setChatInput('')

    // Handle template save
    if (msg === 'Yes, save as template') {
      setChatMessages(prev => [...prev, { role: 'user', text: msg }])
      const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
      const templateName = state.purpose?.slice(0, 50) || 'My template'
      // Save to localStorage templates list
      const templates = JSON.parse(localStorage.getItem('d2v_templates') || '[]')
      templates.push({
        id: Date.now().toString(),
        name: templateName,
        intentType: state.intentType,
        purpose: state.purpose,
        detailLevel,
        narrationStyle,
        createdAt: new Date().toISOString(),
      })
      localStorage.setItem('d2v_templates', JSON.stringify(templates))
      setChatMessages(prev => [...prev, { role: 'assistant', text: `Template saved as "${templateName}". Next time you create a similar video, you can load this template from the goal page.` }])
      return
    }
    if (msg === 'No thanks') {
      setChatMessages(prev => [...prev, { role: 'user', text: msg }])
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'No problem. You can always save a template later from Settings.' }])
      return
    }

    setChatMessages(prev => [...prev, { role: 'user', text: msg }])
    setChatLoading(true)
    try {
      const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
      const res = await fetch('/api/script-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, scenes, purpose: state.purpose, sourceData: state.extractedData, history: chatMessages.filter(m => !m.text.startsWith('_options_')).slice(-10) }),
      })
      const data = await res.json()
      console.log('[script-chat] Response:', JSON.stringify(data).slice(0, 500))
      if (data.scenes && Array.isArray(data.scenes) && data.scenes.length > 0) {
        // Ensure scenes have narration field
        const validScenes = data.scenes.map((s: any, idx: number) => ({
          ...s,
          scene: idx + 1,
          title: s.title || `Scene ${idx + 1}`,
          narration: s.narration || '',
          slideData: s.slideData || undefined,
          slidePrompt: s.slidePrompt || '',
          duration: s.duration || 15,
        }))
        setScenes(validScenes)
        autoSave(validScenes, 0, true)
        console.log(`[script-chat] Updated ${validScenes.length} scenes`)
        const newCount = chatCount + 1
        setChatCount(newCount)
        // After 3 AI changes, suggest saving as template
        if (newCount === 3 && !templatePromptShown) {
          setTemplatePromptShown(true)
          setTimeout(() => {
            setChatMessages(prev => [...prev, { role: 'assistant', text: '💾 You\'ve customized this script quite a bit. Want to save these preferences as a template for future videos with similar content?' }])
            setChatMessages(prev => [...prev, { role: 'assistant', text: `_options_${JSON.stringify(['Yes, save as template', 'No thanks'])}` }])
          }, 500)
        }
      }
      if (data.reply) {
        setChatMessages(prev => [...prev, { role: 'assistant', text: data.reply }])
      }
      if (data.suggestion) {
        setChatMessages(prev => [...prev, { role: 'assistant', text: `💡 ${data.suggestion}` }])
      }
      if (data.options) {
        setChatMessages(prev => [...prev, { role: 'assistant', text: `_options_${JSON.stringify(data.options)}` }])
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'Something went wrong. Try again.' }])
    }
    setChatLoading(false)
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function handlePreviewSlide(idx: number) {
    setPreviewIdx(idx)
    setPreviewImg(null)
    setPreviewLoading(true)
    try {
      const scene = scenes[idx]
      const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
      const brandColors = state.extractedData?.primaryColor ? { primary: state.extractedData.primaryColor, secondary: state.extractedData.secondaryColor || '#4A90D9' } : { primary: '#1B365D', secondary: '#4A90D9' }

      const res = await fetch('/api/style-previews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `${state.customStylePrompt || 'Modern professional style'}\nColors: primary ${brandColors.primary}, accent ${brandColors.secondary}.\nGlossy polished finish.`,
          name: scene.title,
        }),
      })
      const data = await res.json()
      if (data.previewUrl) setPreviewImg(data.previewUrl)
    } catch { /* skip */ }
    setPreviewLoading(false)
  }

  function handleContinue() {
    const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
    state.scenes = scenes
    state.detailLevel = detailLevel
    state.narrationStyle = narrationStyle
    localStorage.setItem('d2v_create', JSON.stringify(state))
    router.push('/create/options')
  }

  return (
    <div style={{
      flex: 1, padding: '40px 24px', maxWidth: scenes.length > 0 ? 1100 : 800, margin: '0 auto', width: '100%', transition: 'max-width 0.3s',
    }}>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ animation: 'fadeInUp 0.4s ease' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
          {scenes.length > 0 ? 'Your script' : 'Configure your video'}
        </h1>
        <p style={{ fontSize: 17, color: 'var(--ink-soft)', marginBottom: 40, lineHeight: 1.6 }}>
          {scenes.length > 0 ? 'Edit the narration for each scene. This is what the voice will say.' : 'Choose the length and style, then generate your script.'}
        </p>

        {scenes.length === 0 && (
          <>
            {/* Back button */}
            <button onClick={() => router.push('/create/review')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink-light)', marginBottom: 24, fontFamily: 'inherit' }}>
              &larr; Back to review
            </button>

            {/* Detail level with AI recommendation */}
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Video length</h3>
            {(() => {
              const intent = createState?.intentType || ''
              const rec: string | null = intent === 'sales' ? 'standard' : intent === 'train' ? 'detailed' : intent === 'report' ? 'standard' : intent === 'proposal' ? 'standard' : intent === 'educate' ? 'standard' : null
              const recLabel = rec === 'quick' ? 'Highlights' : rec === 'detailed' ? 'Detailed' : rec === 'standard' ? 'Standard' : null
              if (!recLabel) return null
              return (
                <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16 }}>
                  Based on your goal, we recommend <strong style={{ color: 'var(--ink)' }}>{recLabel}</strong>.
                </p>
              )
            })()}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
              {[
                { id: 'quick' as const, title: 'Highlights', desc: '30-60 seconds', sub: '3-4 slides' },
                { id: 'standard' as const, title: 'Standard', desc: '2-4 minutes', sub: '8-14 slides' },
                { id: 'detailed' as const, title: 'Detailed', desc: '5-10 minutes', sub: '15-25 slides' },
              ].map(level => (
                <button
                  key={level.id}
                  onClick={() => setDetailLevel(level.id)}
                  style={{
                    padding: '24px 20px', borderRadius: 14,
                    border: detailLevel === level.id ? '2px solid var(--mint)' : '2px solid var(--border-light)',
                    background: detailLevel === level.id ? 'rgba(168,240,212,0.06)' : 'white',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{level.title}</div>
                  <div style={{ fontSize: 14, color: 'var(--ink-light)', marginBottom: 2 }}>{level.desc}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{level.sub}</div>
                </button>
              ))}
            </div>

            {/* Narration style */}
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Narration style</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 32 }}>
              <button
                onClick={() => setNarrationStyle('solo')}
                style={{
                  padding: '24px 20px', borderRadius: 14,
                  border: narrationStyle === 'solo' ? '2px solid var(--mint)' : '2px solid var(--border-light)',
                  background: narrationStyle === 'solo' ? 'rgba(168,240,212,0.06)' : 'white',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Solo Narrator</div>
                <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5 }}>One professional voice. Clean, focused, traditional.</div>
              </button>
              <button
                onClick={() => setNarrationStyle('podcast')}
                style={{
                  padding: '24px 20px', borderRadius: 14,
                  border: narrationStyle === 'podcast' ? '2px solid var(--mint)' : '2px solid var(--border-light)',
                  background: narrationStyle === 'podcast' ? 'rgba(168,240,212,0.06)' : 'white',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Two Narrators</div>
                <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5 }}>Professional discussion format. More engaging.</div>
              </button>
            </div>

            {error && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 14, marginBottom: 20 }}>
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                width: '100%', padding: '18px', borderRadius: 12, border: 'none',
                background: 'var(--ink)', color: 'white', fontSize: 17, fontWeight: 700,
                cursor: generating ? 'wait' : 'pointer', fontFamily: 'inherit',
                opacity: generating ? 0.7 : 1, transition: 'opacity 0.2s',
              }}
            >
              {generating ? 'Generating script...' : 'Generate Script →'}
            </button>
          </>
        )}

        {/* Two-column: Script editor + AI chat */}
        {scenes.length > 0 && (
          <>
            <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 20, textAlign: 'center' }}>
              {scenes.length} scenes &middot; ~{Math.round(scenes.reduce((sum: number, s: any) => sum + (s.narration?.split(/\s+/).length || 0), 0) / 2.5)}s estimated
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
              {/* Left: Script editor — accordion with narration + slide content */}
              <div>
                {scenes.map((scene: any, i: number) => {
                  const sd = scene.slideData || {}
                  const bullets = sd.bullets || []
                  const stats = sd.stats || []
                  return (
                    <div
                      key={i}
                      draggable
                      onDragStart={() => setDragIdx(i)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => {
                        if (dragIdx === null || dragIdx === i) return
                        const updated = [...scenes]
                        const [moved] = updated.splice(dragIdx, 1)
                        updated.splice(i, 0, moved)
                        updated.forEach((s, idx) => { s.scene = idx + 1 })
                        setScenes(updated)
                        autoSave(updated, i, true)
                        setDragIdx(null)
                      }}
                      onDragEnd={() => setDragIdx(null)}
                      style={{
                        marginBottom: 12, borderRadius: 14, overflow: 'hidden',
                        background: 'white',
                        border: dragIdx === i ? '2px solid var(--mint)' : '1px solid var(--border-light)',
                        opacity: dragIdx === i ? 0.6 : 1,
                        transition: 'opacity 0.2s, border-color 0.2s',
                      }}
                    >
                      {/* Scene header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', cursor: 'grab' }}>
                        <span style={{
                          width: 26, height: 26, borderRadius: '50%', background: 'var(--mint)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: 12, flexShrink: 0,
                        }}>{i + 1}</span>
                        <input
                          type="text"
                          value={scene.title}
                          onChange={e => {
                            const updated = [...scenes]
                            updated[i] = { ...updated[i], title: e.target.value }
                            setScenes(updated)
                            autoSave(updated, i)
                          }}
                          style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: 15, flex: 1, outline: 'none', color: 'var(--ink)', fontFamily: 'inherit' }}
                        />
                        <span style={{ fontSize: 11, color: 'var(--ink-light)', whiteSpace: 'nowrap' }}>~{Math.round((scene.narration?.split(/\s+/).length || 0) / 2.5)}s</span>
                        {savedScene === i && <span style={{ fontSize: 11, color: 'var(--mint-darker, #2d7a4f)', fontWeight: 600 }}>&#10003;</span>}
                      </div>

                      {/* Narration section */}
                      <div style={{ padding: '0 16px 8px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-light)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Narration</div>
                        <textarea
                          value={scene.narration}
                          onChange={e => {
                            const updated = [...scenes]
                            updated[i] = { ...updated[i], narration: e.target.value }
                            setScenes(updated)
                            autoSave(updated, i)
                          }}
                          style={{
                            width: '100%', minHeight: 60, resize: 'vertical', border: '1px solid var(--border-light)',
                            borderRadius: 8, padding: 10, fontSize: 13, lineHeight: 1.6,
                            fontFamily: 'inherit', outline: 'none',
                          }}
                        />
                      </div>

                      {/* Slide content section */}
                      <div style={{ padding: '0 16px 12px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-light)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Slide Content</div>
                        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-soft)', border: '1px solid var(--border-light)', fontSize: 13 }}>
                          <input
                            type="text"
                            value={sd.headline || scene.title || ''}
                            onChange={e => {
                              const updated = [...scenes]
                              updated[i] = { ...updated[i], slideData: { ...sd, headline: e.target.value } }
                              setScenes(updated)
                              autoSave(updated, i)
                            }}
                            placeholder="Slide headline"
                            style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: 14, width: '100%', outline: 'none', color: 'var(--ink)', fontFamily: 'inherit', marginBottom: 6 }}
                          />
                          {stats.length > 0 && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                              {stats.map((st: any, j: number) => (
                                <span key={j} style={{ padding: '2px 8px', borderRadius: 6, background: 'white', border: '1px solid var(--border)', fontSize: 12 }}>
                                  <strong>{st.value}</strong> {st.label}
                                </span>
                              ))}
                            </div>
                          )}
                          {bullets.length > 0 ? (
                            <div>
                              {bullets.map((b: string, j: number) => (
                                <div key={j} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 3 }}>
                                  <span style={{ color: 'var(--mint)', fontSize: 10, marginTop: 3 }}>&#9679;</span>
                                  <input
                                    type="text"
                                    value={typeof b === 'string' ? b : (b as any)?.text || ''}
                                    onChange={e => {
                                      const updated = [...scenes]
                                      const newBullets = [...bullets]
                                      newBullets[j] = e.target.value
                                      updated[i] = { ...updated[i], slideData: { ...sd, bullets: newBullets } }
                                      setScenes(updated)
                                      autoSave(updated, i)
                                    }}
                                    style={{ border: 'none', background: 'transparent', fontSize: 12, flex: 1, outline: 'none', color: 'var(--ink-soft)', fontFamily: 'inherit' }}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: 'var(--ink-light)', fontStyle: 'italic' }}>No bullet points — AI will extract from narration</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePreviewSlide(i) }}
                            style={{
                              background: 'none', border: '1px solid var(--border)',
                              borderRadius: 6, padding: '3px 10px', fontSize: 11, color: 'var(--ink-light)',
                              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                            }}
                          >
                            Preview slide
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Right: AI Chat assistant */}
              <div style={{
                position: 'sticky', top: 80, borderRadius: 16,
                background: 'white', border: '1px solid var(--border-light)',
                display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 120px)',
              }}>
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Script Assistant</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-light)' }}>Ask AI to edit your script</div>
                </div>

                {/* Chat messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', minHeight: 200 }}>
                  {chatMessages.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--ink-light)', lineHeight: 1.5 }}>
                      <p style={{ marginBottom: 6, fontWeight: 600 }}>Edit:</p>
                      {['Make all scenes shorter', 'Add a scene about pricing', 'Make the tone more casual', 'Rewrite scene 1'].map(cmd => (
                        <div key={cmd} onClick={() => setChatInput(cmd)} style={{ padding: '5px 10px', borderRadius: 8, background: 'var(--bg-soft)', marginBottom: 4, cursor: 'pointer' }}>
                          {cmd}
                        </div>
                      ))}
                      <p style={{ marginBottom: 6, marginTop: 10, fontWeight: 600 }}>Quality:</p>
                      {['Review the full script', 'Check for repetition', 'Is anything missing from the source?', 'Is the CTA strong enough?'].map(cmd => (
                        <div key={cmd} onClick={() => setChatInput(cmd)} style={{ padding: '5px 10px', borderRadius: 8, background: 'var(--bg-soft)', marginBottom: 4, cursor: 'pointer' }}>
                          {cmd}
                        </div>
                      ))}
                      <p style={{ marginBottom: 6, marginTop: 10, fontWeight: 600 }}>Structure:</p>
                      {['Which scene is the longest?', 'Merge similar scenes', 'Add transition between scenes', 'How long is this video?'].map(cmd => (
                        <div key={cmd} onClick={() => setChatInput(cmd)} style={{ padding: '5px 10px', borderRadius: 8, background: 'var(--bg-soft)', marginBottom: 4, cursor: 'pointer' }}>
                          {cmd}
                        </div>
                      ))}
                      <p style={{ marginBottom: 6, marginTop: 10, fontWeight: 600 }}>Research:</p>
                      {['Look up competitor info from [url]', 'Add info from https://...', 'Compare us with [competitor.com]'].map(cmd => (
                        <div key={cmd} onClick={() => setChatInput(cmd)} style={{ padding: '5px 10px', borderRadius: 8, background: 'var(--bg-soft)', marginBottom: 4, cursor: 'pointer' }}>
                          {cmd}
                        </div>
                      ))}
                    </div>
                  )}
                  {chatMessages.map((msg, i) => {
                    // Render clickable options
                    if (msg.text.startsWith('_options_')) {
                      try {
                        const options = JSON.parse(msg.text.replace('_options_', ''))
                        return (
                          <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                            {options.map((opt: string, j: number) => (
                              <button key={j} onClick={() => { setChatInput(opt) }} style={{
                                padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
                                background: 'white', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                                color: 'var(--ink)', fontWeight: 600,
                              }}>
                                {opt}
                              </button>
                            ))}
                          </div>
                        )
                      } catch { return null }
                    }
                    return (
                      <div key={i} style={{
                        marginBottom: 10, padding: '8px 12px', borderRadius: 10,
                        background: msg.role === 'user' ? 'var(--ink)' : 'var(--bg-soft)',
                        color: msg.role === 'user' ? 'white' : 'var(--ink)',
                        fontSize: 13, lineHeight: 1.5,
                        marginLeft: msg.role === 'user' ? 40 : 0,
                        marginRight: msg.role === 'assistant' ? 40 : 0,
                      }}>
                        {msg.text}
                      </div>
                    )
                  })}
                  {chatLoading && (
                    <div style={{ fontSize: 13, color: 'var(--ink-light)', padding: '8px 0' }}>
                      Thinking...
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat input */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-light)', marginBottom: 4 }}>
                    Paste text or URLs as reference. Press Enter to send.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <textarea
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat() } }}
                      placeholder="Tell AI what to change, paste content, or drop a URL..."
                      rows={chatInput.includes('\n') || chatInput.length > 80 ? 3 : 1}
                      style={{
                        flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                        fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'none',
                        minHeight: 38, transition: 'height 0.2s',
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
                      onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    />
                    <button
                      onClick={handleChat}
                      disabled={chatLoading || !chatInput.trim()}
                      style={{
                        padding: '10px 16px', borderRadius: 8, border: 'none',
                        background: chatInput.trim() ? 'var(--ink)' : 'var(--border)',
                        color: 'white', fontSize: 13, fontWeight: 700,
                        cursor: chatInput.trim() ? 'pointer' : 'default',
                        fontFamily: 'inherit', alignSelf: 'flex-end',
                      }}
                    >
                      &rarr;
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => router.push('/create/review')} style={{
                padding: '16px 28px', borderRadius: 12, border: '2px solid var(--border)',
                background: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-soft)', fontFamily: 'inherit',
              }}>
                &larr; Back
              </button>
              <button onClick={handleContinue} style={{
                flex: 1, padding: '16px 28px', borderRadius: 12, border: 'none',
                background: 'var(--ink)', color: 'white', fontSize: 17, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Continue to options &rarr;
              </button>
            </div>
          </>
        )}
      </div>

      {/* Preview modal */}
      {previewIdx !== null && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => { setPreviewIdx(null); setPreviewImg(null) }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'relative', background: 'white', borderRadius: 16, padding: 24,
            maxWidth: 700, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Slide {(previewIdx ?? 0) + 1} Preview</div>
                <div style={{ fontSize: 13, color: 'var(--ink-light)' }}>{scenes[previewIdx ?? 0]?.title}</div>
              </div>
              <button onClick={() => { setPreviewIdx(null); setPreviewImg(null) }} style={{
                background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink-light)', padding: 4,
              }}>&times;</button>
            </div>
            {previewLoading ? (
              <div style={{ aspectRatio: '16/9', borderRadius: 10, background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" style={{ marginRight: 8 }} /> Generating preview...
              </div>
            ) : previewImg ? (
              <img src={previewImg} alt="Slide preview" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 10 }} />
            ) : (
              <div style={{ aspectRatio: '16/9', borderRadius: 10, background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-light)' }}>
                Preview failed — try again
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 10, textAlign: 'center' }}>
              This is an approximate preview. Final slides may vary slightly.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
