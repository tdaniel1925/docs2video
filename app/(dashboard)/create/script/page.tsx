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
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Auto-save scenes to localStorage with debounce
  const autoSave = useCallback((updatedScenes: any[], sceneIdx: number) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
      state.scenes = updatedScenes
      localStorage.setItem('d2v_create', JSON.stringify(state))
      setSavedScene(sceneIdx)
      setTimeout(() => setSavedScene(null), 1500)
    }, 800)
  }, [])

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
          policyData: { ...state.extractedData, intentType: state.intentType },
          brandId: state.selectedBrand || state.autoBrandId,
          detailed: detailLevel === 'detailed',
          detailLevel,
          narrationStyle,
          purpose: state.purpose,
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
      if (data.scenes) {
        setScenes(data.scenes)
        autoSave(data.scenes, 0)
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
              {/* Left: Script editor */}
              <div>
                {scenes.map((scene: any, i: number) => (
                  <div key={i} style={{
                    marginBottom: 14, borderRadius: 14, padding: 18,
                    background: 'white', border: '1px solid var(--border-light)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
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
                    </div>
                    <textarea
                      value={scene.narration}
                      onChange={e => {
                        const updated = [...scenes]
                        updated[i] = { ...updated[i], narration: e.target.value }
                        setScenes(updated)
                        autoSave(updated, i)
                      }}
                      style={{
                        width: '100%', minHeight: 70, resize: 'vertical', border: '1px solid var(--border-light)',
                        borderRadius: 8, padding: 10, fontSize: 13, lineHeight: 1.6,
                        fontFamily: 'inherit', outline: 'none',
                      }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>~{Math.round((scene.narration?.split(/\s+/).length || 0) / 2.5)}s &middot; {scene.narration?.split(/\s+/).length || 0} words</span>
                      {savedScene === i && (
                        <span style={{ color: 'var(--mint-darker, #2d7a4f)', fontWeight: 600, animation: 'fadeInUp 0.3s ease' }}>
                          &#10003; Saved
                        </span>
                      )}
                    </div>
                  </div>
                ))}
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
                    <div style={{ fontSize: 13, color: 'var(--ink-light)', lineHeight: 1.6 }}>
                      <p style={{ marginBottom: 8 }}>Try:</p>
                      <div onClick={() => { setChatInput('Make all scenes shorter'); }} style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--bg-soft)', marginBottom: 6, cursor: 'pointer', fontSize: 12 }}>
                        &ldquo;Make all scenes shorter&rdquo;
                      </div>
                      <div onClick={() => { setChatInput('Add a scene about pricing'); }} style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--bg-soft)', marginBottom: 6, cursor: 'pointer', fontSize: 12 }}>
                        &ldquo;Add a scene about pricing&rdquo;
                      </div>
                      <div onClick={() => { setChatInput('Make the tone more casual'); }} style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--bg-soft)', marginBottom: 6, cursor: 'pointer', fontSize: 12 }}>
                        &ldquo;Make the tone more casual&rdquo;
                      </div>
                      <div onClick={() => { setChatInput('Rewrite scene 1 to be more engaging'); }} style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--bg-soft)', cursor: 'pointer', fontSize: 12 }}>
                        &ldquo;Rewrite scene 1 to be more engaging&rdquo;
                      </div>
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
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-light)', display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleChat() }}
                    placeholder="Tell AI what to change..."
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                      fontSize: 13, fontFamily: 'inherit', outline: 'none',
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
                      color: 'white', fontSize: 13, fontWeight: 700, cursor: chatInput.trim() ? 'pointer' : 'default',
                      fontFamily: 'inherit',
                    }}
                  >
                    &rarr;
                  </button>
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
    </div>
  )
}
