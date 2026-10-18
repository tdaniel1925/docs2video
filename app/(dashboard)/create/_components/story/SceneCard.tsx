'use client'

import SceneEditChat from '../../../../_components/SceneEditChat'
import { clock, sceneSeconds } from './bookends'

interface Props {
  scene: any
  index: number
  outputType: string
  saved: boolean
  open: boolean
  onToggle: () => void
  /** instant = save now (a click), not after typing stops */
  onChange: (updated: any, instant?: boolean) => void
  onPreview: () => void
  sourceData?: unknown
  dragging: boolean
  onDragStart: () => void
  onDrop: () => void
  onDragEnd: () => void
  /** Shown inside step 2's editor, where the compact cards do the moving. */
  noDrag?: boolean
}

const label: React.CSSProperties = {
  fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--ink-light)', marginBottom: 4,
  textTransform: 'uppercase', letterSpacing: '0.05em',
}

/**
 * One scene of the story: its title, what the voice says, and how long it
 * runs — all editable in place. "More" opens the on-screen words (headline,
 * numbers, bullet points), the per-scene AI helper and a slide preview.
 */
export default function SceneCard({
  scene, index, outputType, saved, open, onToggle, onChange, onPreview, sourceData,
  dragging, onDragStart, onDrop, onDragEnd, noDrag,
}: Props) {
  const sd = scene.slideData || {}
  const bullets: any[] = sd.bullets || []
  const stats: any[] = sd.stats || []
  const role = scene._role as ('cover' | 'closing' | undefined)
  const isBookend = role === 'cover' || role === 'closing'
  const spoken = outputType === 'video' || outputType === 'pptx'
  const narration = String(scene.narration || '')
  const setSlide = (patch: Record<string, unknown>, instant?: boolean) =>
    onChange({ ...scene, slideData: { ...sd, ...patch } }, instant)

  return (
    <div
      draggable={!isBookend && !noDrag}
      onDragStart={() => { if (!isBookend && !noDrag) onDragStart() }}
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{
        marginBottom: noDrag ? 0 : 10, borderRadius: 10, background: 'var(--bg-card)',
        border: dragging ? '2px solid var(--accent-ink)' : '1px solid var(--border-light)',
        opacity: dragging ? 0.6 : 1, transition: 'opacity 0.2s, border-color 0.2s',
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--space-3)', padding: '14px 16px 10px', alignItems: 'flex-start' }}>
        <span
          title={isBookend || noDrag ? undefined : 'Drag to move this scene'}
          style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: 2,
            background: isBookend ? 'var(--ink)' : 'var(--surface)', color: isBookend ? 'var(--bg-card)' : 'var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 'var(--fs-caption)', cursor: isBookend || noDrag ? 'default' : 'grab',
          }}
        >{index + 1}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 4 }}>
            {isBookend && (
              <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-soft)', background: 'var(--surface)', padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                {role === 'cover' ? 'Opening' : 'Closing'}
              </span>
            )}
            <input
              type="text"
              aria-label={`Scene ${index + 1} title`}
              value={scene.title || ''}
              onChange={e => onChange({ ...scene, title: e.target.value })}
              style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: 'var(--fs-body)', flex: 1, minWidth: 0, outline: 'none', color: 'var(--ink)', fontFamily: 'inherit', padding: 0 }}
            />
            {saved && <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--mint-darker)', fontWeight: 600 }}>Saved</span>}
            {spoken && <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-light)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{clock(sceneSeconds(scene))}</span>}
          </div>

          {spoken ? (
            <textarea
              aria-label={outputType === 'video' ? `What the voice says in scene ${index + 1}` : `Speaker notes for slide ${index + 1}`}
              value={narration}
              onChange={e => onChange({ ...scene, narration: e.target.value })}
              placeholder={outputType === 'pptx' ? 'Speaker notes for this slide (optional)' : 'What the voice says'}
              rows={Math.max(2, Math.ceil(narration.length / 80))}
              style={{
                width: '100%', resize: 'vertical', border: '1px solid transparent', borderRadius: 8,
                padding: '6px 8px', marginLeft: -8, fontSize: 'var(--fs-ui)', lineHeight: 1.55, color: 'var(--ink-soft)',
                fontFamily: 'inherit', outline: 'none', background: 'var(--bg-soft)',
              }}
            />
          ) : (
            <input
              type="text"
              aria-label={`Scene ${index + 1} headline`}
              value={sd.headline || scene.title || ''}
              onChange={e => setSlide({ headline: e.target.value })}
              placeholder="Slide headline"
              style={{ width: '100%', border: '1px solid transparent', borderRadius: 8, padding: '6px 8px', marginLeft: -8, fontSize: 'var(--fs-ui)', color: 'var(--ink-soft)', fontFamily: 'inherit', outline: 'none', background: 'var(--bg-soft)' }}
            />
          )}

          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            style={{ background: 'none', border: 'none', padding: '6px 0 0', fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--ink-light)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {open ? 'Less' : 'More — words on screen, ask AI, preview'}
          </button>
        </div>
      </div>

      {open && (
        <div style={{ padding: '0 16px 14px 56px' }}>
          <div style={label}>Words on screen</div>
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-soft)', border: '1px solid var(--border-light)', fontSize: 'var(--fs-small)' }}>
            {spoken && (
              <input
                type="text"
                value={sd.headline || scene.title || ''}
                onChange={e => setSlide({ headline: e.target.value })}
                placeholder="Slide headline"
                style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: 'var(--fs-ui)', width: '100%', outline: 'none', color: 'var(--ink)', fontFamily: 'inherit', marginBottom: 6 }}
              />
            )}
            {role === 'closing' && (
              <input
                type="text"
                value={sd.cta || ''}
                onChange={e => setSlide({ cta: e.target.value })}
                placeholder="Closing line on screen (e.g. Reach out to take the next step)"
                style={{ border: '1px solid var(--border-light)', borderRadius: 6, background: 'var(--bg-card)', fontSize: 'var(--fs-caption)', width: '100%', outline: 'none', color: 'var(--ink-soft)', fontFamily: 'inherit', marginBottom: 6, padding: '6px 8px' }}
              />
            )}

            {!isBookend && (
              <>
                {stats.length > 0 && (
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 8 }}>
                    {stats.map((st: any, j: number) => (
                      <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', padding: '2px 6px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 'var(--fs-caption)' }}>
                        <input
                          type="text" value={st.value || ''} placeholder="number"
                          onChange={e => setSlide({ stats: stats.map((s: any, k: number) => k === j ? { ...s, value: e.target.value } : s) })}
                          style={{ border: 'none', background: 'transparent', fontSize: 'var(--fs-caption)', fontWeight: 700, width: 64, outline: 'none', color: 'var(--ink)', fontFamily: 'inherit' }}
                        />
                        <input
                          type="text" value={st.label || ''} placeholder="what it is"
                          onChange={e => setSlide({ stats: stats.map((s: any, k: number) => k === j ? { ...s, label: e.target.value } : s) })}
                          style={{ border: 'none', background: 'transparent', fontSize: 'var(--fs-caption)', width: 80, outline: 'none', color: 'var(--ink-soft)', fontFamily: 'inherit' }}
                        />
                        <button
                          type="button" title="Remove number"
                          onClick={() => setSlide({ stats: stats.filter((_: any, k: number) => k !== j) }, true)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-light)', fontSize: 'var(--fs-small)', lineHeight: 1, padding: 0 }}
                        >&times;</button>
                      </span>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setSlide({ stats: [...stats, { value: '', label: '' }] }, true)}
                  style={{ border: '1px dashed var(--border)', background: 'none', borderRadius: 6, padding: '2px 8px', fontSize: 'var(--fs-caption)', color: 'var(--ink-light)', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}
                >+ Add number</button>

                {bullets.map((b: any, j: number) => (
                  <div key={j} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ color: 'var(--accent-ink)', fontSize: 'var(--fs-caption)' }}>&#9679;</span>
                    <input
                      type="text"
                      value={typeof b === 'string' ? b : b?.text || ''}
                      onChange={e => { const nb = [...bullets]; nb[j] = e.target.value; setSlide({ bullets: nb }) }}
                      style={{ border: 'none', background: 'transparent', fontSize: 'var(--fs-caption)', flex: 1, outline: 'none', color: 'var(--ink-soft)', fontFamily: 'inherit' }}
                    />
                    <button
                      type="button" title="Remove point"
                      onClick={() => setSlide({ bullets: bullets.filter((_: any, k: number) => k !== j) }, true)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-light)', fontSize: 'var(--fs-ui)', lineHeight: 1, padding: 0 }}
                    >&times;</button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setSlide({ bullets: [...bullets, ''] }, true)}
                  style={{ border: '1px dashed var(--border)', background: 'none', borderRadius: 6, padding: '2px 8px', fontSize: 'var(--fs-caption)', color: 'var(--ink-light)', cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}
                >+ Add point</button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 8, flexWrap: 'wrap' }}>
            <SceneEditChat
              scene={scene}
              outputType={outputType}
              sourceData={sourceData}
              onApply={(updatedScene) => onChange(updatedScene, true)}
            />
            <button
              type="button"
              onClick={onPreview}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', fontSize: 'var(--fs-caption)', color: 'var(--ink-light)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
            >
              Preview slide
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
