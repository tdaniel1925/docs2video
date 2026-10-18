'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import type { VideoTemplate } from '../../../../_lib/video-templates'

/**
 * THE TEMPLATES ON THE LOOK STEP (approved layout "B · One coach bar",
 * 2026-10-18): four across, each its cover, its name and three words; a tick
 * on the one chosen; the round ▶ opens its four scenes large — a cover, a
 * key figure, a side-by-side scene and the closing — drawn by the engine
 * itself from made-up sample words.
 */
export function TemplatePicker({ templates, value, onChange }: {
  templates: VideoTemplate[]
  value: string | null
  onChange: (id: VideoTemplate['id']) => void
}) {
  const [open, setOpen] = useState<{ t: VideoTemplate; from: HTMLElement | null } | null>(null)
  return (
    <>
      <div className="cf-tpls" role="radiogroup" aria-label="Templates">
        {templates.map((t) => (
          <div key={t.id} className="cf-tpl-wrap">
            <button type="button" role="radio" aria-checked={value === t.id} className="cf-tpl" onClick={() => onChange(t.id)} data-template={t.id}>
              {/* eslint-disable-next-line @next/next/no-img-element -- the template's own sample cover */}
              <img className="cf-tpl-thumb" src={t.scenes[0].src} alt="" loading="lazy" />
              {value === t.id ? <span className="cf-tpl-tick" aria-hidden="true"><Check size={14} strokeWidth={3} /></span> : null}
              <span className="cf-tpl-cap">
                <span className="cf-tpl-name">{t.name}</span>
                <span className="cf-tpl-tag">{t.tagline}</span>
              </span>
            </button>
            <button type="button" className="cf-tpl-play" onClick={(e) => setOpen({ t, from: e.currentTarget })} aria-label={`See ${t.name}’s four scenes`} data-template-scenes={t.id}>
              <Play size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      {open ? <TemplateScenes template={open.t} chosen={value === open.t.id} onChoose={() => { onChange(open.t.id); const from = open.from; setOpen(null); from?.focus() }} onClose={() => { const from = open.from; setOpen(null); from?.focus() }} /> : null}
    </>
  )
}

/**
 * A TEMPLATE'S FOUR SCENES, large, in a dialog: focus on Close, Tab kept
 * inside, ← and → step through, Escape or the backdrop closes it.
 */
function TemplateScenes({ template, chosen, onChoose, onClose }: { template: VideoTemplate; chosen: boolean; onChoose: () => void; onClose: () => void }) {
  const [i, setI] = useState(0)
  const closeRef = useRef<HTMLButtonElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const n = template.scenes.length
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'ArrowRight') setI((k) => (k + 1) % n)
      if (e.key === 'ArrowLeft') setI((k) => (k + n - 1) % n)
      if (e.key === 'Tab' && boxRef.current) {
        const f = [...boxRef.current.querySelectorAll<HTMLElement>('button')]
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, n])
  const s = template.scenes[i]
  return (
    <div className="cf-sample-dialog" onClick={onClose} data-template-dialog>
      <div ref={boxRef} className="cf-sample-box" role="dialog" aria-modal="true" aria-label={`${template.name}: four scenes`} onClick={(e) => e.stopPropagation()}>
        <div className="cf-sample-head">
          <b>{template.name}</b>
          <span>{s.label} · {i + 1} of {n}. Sample names and figures are made up.</span>
          <button ref={closeRef} type="button" className="cf-sample-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="cf-tpl-stage">
          {/* eslint-disable-next-line @next/next/no-img-element -- a sample scene of this template */}
          <img src={s.src} alt={`${template.name}: ${s.label}`} />
          <button type="button" className="cf-tpl-step is-prev" onClick={() => setI((k) => (k + n - 1) % n)} aria-label="Previous scene"><ChevronLeft size={20} aria-hidden="true" /></button>
          <button type="button" className="cf-tpl-step is-next" onClick={() => setI((k) => (k + 1) % n)} aria-label="Next scene"><ChevronRight size={20} aria-hidden="true" /></button>
        </div>
        <div className="cf-tpl-strip">
          {template.scenes.map((x, k) => (
            <button key={x.src} type="button" className="cf-tpl-mini" aria-pressed={k === i} onClick={() => setI(k)} aria-label={x.label}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a sample scene */}
              <img src={x.src} alt="" loading="lazy" />
            </button>
          ))}
          <button type="button" className="kit-btn kit-btn--primary kit-btn--sm cf-tpl-use" onClick={onChoose} disabled={chosen}>{chosen ? 'Chosen' : `Use ${template.name}`}</button>
        </div>
      </div>
    </div>
  )
}
