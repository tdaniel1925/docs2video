'use client'

import { useState } from 'react'

interface Scene {
  scene: number
  title: string
  narration: string
  slidePrompt: string
}

interface ScriptEditorProps {
  scenes: Scene[]
  slides: (string | null)[]
  onScenesChange: (scenes: Scene[]) => void
  onSlidesChange: (slides: (string | null)[]) => void
  onRegenerateAudio: (sceneIndex: number, newNarration: string) => Promise<void>
  onDeleteScene: (sceneIndex: number) => void
  onEditSlide: (sceneIndex: number, instruction: string) => Promise<void>
  onRedoSlide: (sceneIndex: number) => Promise<void>
}

export default function ScriptEditor({
  scenes,
  slides,
  onScenesChange,
  onSlidesChange,
  onRegenerateAudio,
  onDeleteScene,
  onEditSlide,
  onRedoSlide,
}: ScriptEditorProps) {
  const [editingSlide, setEditingSlide] = useState<number | null>(null)
  const [editInstruction, setEditInstruction] = useState('')
  const [editingLoading, setEditingLoading] = useState(false)
  const [redoingSlide, setRedoingSlide] = useState<number | null>(null)
  const [modifiedScenes, setModifiedScenes] = useState<Set<number>>(new Set())
  const [savingAudio, setSavingAudio] = useState<number | null>(null)

  function handleNarrationChange(index: number, value: string) {
    const updated = [...scenes]
    updated[index] = { ...updated[index], narration: value }
    onScenesChange(updated)
    setModifiedScenes(prev => new Set(prev).add(index))
  }

  async function handleSaveAudio(index: number) {
    setSavingAudio(index)
    try {
      await onRegenerateAudio(index, scenes[index].narration)
      setModifiedScenes(prev => {
        const next = new Set(prev)
        next.delete(index)
        return next
      })
    } finally {
      setSavingAudio(null)
    }
  }

  async function handleEditSlide(index: number) {
    if (!editInstruction.trim()) return
    setEditingLoading(true)
    try {
      await onEditSlide(index, editInstruction)
      setEditingSlide(null)
      setEditInstruction('')
    } finally {
      setEditingLoading(false)
    }
  }

  async function handleRedoSlide(index: number) {
    setRedoingSlide(index)
    try {
      await onRedoSlide(index)
    } finally {
      setRedoingSlide(null)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 24, minHeight: 500 }}>
      {/* Left column - Slide thumbnails (60%) */}
      <div style={{ width: '60%', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
        {scenes.map((scene, i) => (
          <div
            key={i}
            className="settings-card"
            style={{ padding: 16, borderRadius: 10 }}
          >
            {/* Thumbnail */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, width: 160 }}>
                {slides[i] ? (
                  <img
                    src={slides[i]!}
                    alt={`Slide ${i + 1}`}
                    style={{ width: 160, borderRadius: 8, border: '1px solid var(--border-light)' }}
                  />
                ) : (
                  <div style={{
                    width: 160, height: 90, borderRadius: 8,
                    background: 'var(--bg-soft)', border: '1px solid var(--border-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: 'var(--ink-light)',
                  }}>
                    No slide
                  </div>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                  Scene {i + 1}: {scene.title}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-soft btn-sm"
                    onClick={() => {
                      setEditingSlide(editingSlide === i ? null : i)
                      setEditInstruction('')
                    }}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6 }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-soft btn-sm"
                    onClick={() => handleRedoSlide(i)}
                    disabled={redoingSlide === i}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, opacity: redoingSlide === i ? 0.5 : 1 }}
                  >
                    {redoingSlide === i ? 'Redoing...' : 'Redo'}
                  </button>
                  {/* Reorder up/down */}
                  {i > 0 && (
                    <button
                      className="btn btn-soft btn-sm"
                      onClick={() => {
                        const updated = [...scenes]
                        const updatedSlides = [...slides]
                        ;[updated[i - 1], updated[i]] = [updated[i], updated[i - 1]]
                        ;[updatedSlides[i - 1], updatedSlides[i]] = [updatedSlides[i], updatedSlides[i - 1]]
                        onScenesChange(updated)
                        onSlidesChange(updatedSlides)
                      }}
                      style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6 }}
                      title="Move up"
                    >
                      &#9650;
                    </button>
                  )}
                  {i < scenes.length - 1 && (
                    <button
                      className="btn btn-soft btn-sm"
                      onClick={() => {
                        const updated = [...scenes]
                        const updatedSlides = [...slides]
                        ;[updated[i], updated[i + 1]] = [updated[i + 1], updated[i]]
                        ;[updatedSlides[i], updatedSlides[i + 1]] = [updatedSlides[i + 1], updatedSlides[i]]
                        onScenesChange(updated)
                        onSlidesChange(updatedSlides)
                      }}
                      style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6 }}
                      title="Move down"
                    >
                      &#9660;
                    </button>
                  )}
                  {scenes.length > 2 && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => onDeleteScene(i)}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6 }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Edit instruction input */}
            {editingSlide === i && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="input"
                  placeholder="What would you like to change?"
                  value={editInstruction}
                  onChange={e => setEditInstruction(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleEditSlide(i) }}
                  style={{ flex: 1, fontSize: 13, padding: '8px 12px', borderRadius: 8 }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleEditSlide(i)}
                  disabled={editingLoading || !editInstruction.trim()}
                  style={{ fontSize: 12, padding: '8px 14px', borderRadius: 8, opacity: editingLoading ? 0.5 : 1 }}
                >
                  {editingLoading ? 'Applying...' : 'Apply'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Right column - Script text editor (40%) */}
      <div style={{ width: '40%', display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
        <div className="wizard-card" style={{ padding: 20, borderRadius: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--ink)' }}>
            Script Editor
          </div>

          {scenes.map((scene, i) => (
            <div key={i} style={{ marginBottom: 20 }}>
              {/* Scene divider */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                paddingBottom: 6, borderBottom: '1px solid var(--border-light)',
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'var(--mint)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontWeight: 800, fontSize: 10, flexShrink: 0,
                }}>{i + 1}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
                  {scene.title}
                </span>
                {modifiedScenes.has(i) && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: 'var(--mint-darker, #2d7a4f)',
                    background: 'rgba(168,240,212,0.2)', padding: '2px 8px', borderRadius: 4,
                    marginLeft: 'auto',
                  }}>
                    modified
                  </span>
                )}
              </div>

              {/* Narration textarea */}
              <textarea
                value={scene.narration}
                onChange={e => handleNarrationChange(i, e.target.value)}
                style={{
                  width: '100%', minHeight: 80, border: '1px solid var(--border-light)',
                  borderRadius: 8, padding: '10px 12px', fontSize: 13,
                  lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit',
                  background: 'white', color: 'var(--ink)',
                }}
              />

              {/* Save button for audio regen */}
              {modifiedScenes.has(i) && (
                <button
                  className="btn btn-soft btn-sm"
                  onClick={() => handleSaveAudio(i)}
                  disabled={savingAudio === i}
                  style={{ marginTop: 6, fontSize: 11, padding: '4px 12px', borderRadius: 6, opacity: savingAudio === i ? 0.5 : 1 }}
                >
                  {savingAudio === i ? 'Regenerating audio...' : 'Save & Regenerate Audio'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
