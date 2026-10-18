'use client'

import { useEffect, useRef, useState } from 'react'
import { ImageUp, RotateCcw } from 'lucide-react'
import { Button, Dialog } from '../../_components/kit'
import { useToast } from '../../_components/Toast'
import { sizedPicture } from '../../_lib/picture-size'
import { UPLOAD_TYPES, uploadProblem } from '../../_lib/video-thumbnail'
import s from './library.module.css'

/*
 * CHANGE THUMBNAIL — the ⋯ menu on a finished video (option A, 2026-10-18).
 * A preview, the video's own scenes to pick from (the stills its render
 * saved), "Upload your own" and "Use the cover again". Save sends it to
 * /api/videos/<id>/thumbnail, which re-makes the picture at 1280×720 and puts
 * it in thumbnail_url — so the Library, the watch page, its link preview and
 * the share email all show the same picture.
 */
type Info = { current: string | null; cover: string | null; chosen: 'cover' | 'custom'; scene: number | null; scenes: { index: number; url: string }[] }
type Pick = { kind: 'cover' } | { kind: 'scene'; index: number } | { kind: 'upload'; file: File; preview: string } | null

export default function ThumbnailDialog({ videoId, title, onClose, onSaved }: { videoId: string; title: string; onClose: () => void; onSaved: () => void }) {
  const notify = useToast()
  const [info, setInfo] = useState<Info | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pick, setPick] = useState<Pick>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let live = true
    fetch(`/api/videos/${videoId}/thumbnail`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Could not load'); return j as Info })
      .then((j) => { if (live) setInfo(j) })
      .catch((e) => { if (live) setLoadError(e instanceof Error ? e.message : 'Could not load') })
    return () => { live = false }
  }, [videoId])

  // A picked upload's preview is a local object URL — freed when replaced or closed.
  useEffect(() => () => { if (pick?.kind === 'upload') URL.revokeObjectURL(pick.preview) }, [pick])

  const preview = pick?.kind === 'upload' ? pick.preview
    : pick?.kind === 'scene' ? info?.scenes.find((x) => x.index === pick.index)?.url ?? null
    : pick?.kind === 'cover' ? info?.cover ?? null
    : info?.current ?? null
  const selectedScene = pick?.kind === 'scene' ? pick.index : pick ? null : (info?.chosen === 'custom' ? info.scene : null)

  function choose(file: File | undefined) {
    if (!file) return
    const problem = uploadProblem({ type: file.type, size: file.size })
    if (problem) { setError(problem); return }
    setError(null)
    setPick({ kind: 'upload', file, preview: URL.createObjectURL(file) })
  }

  async function save() {
    if (!pick) { onClose(); return }
    setSaving(true); setError(null)
    try {
      const init: RequestInit = pick.kind === 'upload'
        ? (() => { const f = new FormData(); f.append('file', pick.file); return { method: 'POST', body: f } })()
        : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(pick.kind === 'scene' ? { action: 'scene', index: pick.index } : { action: 'cover' }) }
      const r = await fetch(`/api/videos/${videoId}/thumbnail`, init)
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Could not save')
      notify('Thumbnail saved.', 'success')
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      wide
      onClose={() => { if (!saving) onClose() }}
      title="Change thumbnail"
      sub={<>Shown in your library, on the share page, in the email and when the link is posted. “{title}”.</>}
      footer={
        <div className={s.thumbFoot}>
          <span className={s.thumbFootSide}>
            <input ref={fileRef} type="file" accept={UPLOAD_TYPES.join(',')} hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = '' }} />
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={saving}><ImageUp size={16} />Upload your own</Button>
            {info?.cover && (
              <Button variant="quiet" onClick={() => { setError(null); setPick({ kind: 'cover' }) }} disabled={saving} aria-pressed={pick?.kind === 'cover'}>
                <RotateCcw size={16} />Use the cover again
              </Button>
            )}
          </span>
          <Button onClick={save} disabled={saving || !info}>{saving ? 'Saving…' : 'Save thumbnail'}</Button>
        </div>
      }
    >
      {loadError ? (
        <p className={s.thumbError} role="alert">{loadError}</p>
      ) : !info ? (
        <p className={s.thumbHint}>Loading…</p>
      ) : (
        <div className={s.thumbPick}>
          <div className={s.thumbCol}>
            <span className="kit-label">Preview</span>
            {preview
              // eslint-disable-next-line @next/next/no-img-element -- a stored picture or a local upload preview
              ? <img className={s.thumbPreview} src={pick?.kind === 'upload' ? preview : (sizedPicture(preview, 640) ?? preview)} alt="The thumbnail as it will show" />
              : <span className={`${s.thumbPreview} ${s.thumbEmpty}`}>No picture yet</span>}
          </div>
          {info.scenes.length > 0 && (
            <div className={s.thumbCol}>
              <span className="kit-label">Pick a scene</span>
              <div className={s.thumbScenes} role="radiogroup" aria-label="Scenes from this video">
                {info.scenes.map((sc) => (
                  <button
                    key={sc.index}
                    type="button"
                    role="radio"
                    aria-checked={selectedScene === sc.index}
                    aria-label={`Scene ${sc.index + 1}`}
                    className={s.thumbScene}
                    onClick={() => { setError(null); setPick({ kind: 'scene', index: sc.index }) }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- the scene's stored still */}
                    <img src={sizedPicture(sc.url, 240) ?? sc.url} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {error && <p className={s.thumbError} role="alert">{error}</p>}
    </Dialog>
  )
}
