'use client'

import { useEffect, useRef, useState } from 'react'
import ScriptEditor from '../../../../_components/ScriptEditor'
import type { Video } from '../../../../_lib/types'

export type OlderEditorState = {
  scenes: { scene: number; title: string; narration: string; slidePrompt: string }[]
  slides: (string | null)[]
}

/** The scenes and slide pictures as the video has them now. */
export function olderEditorStateOf(video: Video): OlderEditorState {
  return {
    scenes: Array.isArray(video.script) ? video.script.map((s: any, i: number) => ({
      scene: i + 1,
      title: s.title ?? `Scene ${i + 1}`,
      narration: s.narration ?? '',
      slidePrompt: s.slidePrompt ?? '',
    })) : [],
    slides: (video.slide_urls ?? []).map((url: string) => url),
  }
}

/**
 * The older scene editor — what the "Edit Video" button opened. Kept, and
 * reached only from the "Ask for a change" bar: for looks that save slide
 * pictures but no Fix-a-Scene plan it is the only way to change the video in
 * place. Change the words, order or scenes, then "Save & Regenerate" rebuilds
 * the video from the slide pictures with the new voice (/api/re-render —
 * free). Moved out of the result page unchanged apart from:
 *   * it can open on a given scene (This scene) or with an earlier version
 *     loaded (Undo);
 *   * a save is reported to the change list with the version before it.
 */
export default function OlderEditor({ video, initial, focusScene, onClose, onSaved, onError }: {
  video: Video
  /** Start from this instead of the video as it is (Undo). */
  initial?: OlderEditorState | null
  focusScene?: number
  onClose: () => void
  onSaved: (before: OlderEditorState, next: Partial<Video>) => void
  onError: (message: string) => void
}) {
  const before = useRef<OlderEditorState>(olderEditorStateOf(video))
  const [scenes, setScenes] = useState(initial?.scenes ?? before.current.scenes)
  const [slides, setSlides] = useState<(string | null)[]>(initial?.slides ?? before.current.slides)
  const [changedAudio, setChangedAudio] = useState<Set<number>>(
    // Undo puts back old words — the voice is made again for each scene whose
    // words differ from the video as it is now.
    () => new Set(initial
      ? initial.scenes.flatMap((s, i) => (s.narration !== before.current.scenes[i]?.narration ? [i] : []))
      : []),
  )
  const [rendering, setRendering] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    box.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (focusScene != null && focusScene >= 0) {
      setTimeout(() => {
        const areas = box.current?.querySelectorAll('textarea')
        const el = areas?.[focusScene] as HTMLTextAreaElement | undefined
        el?.focus()
      }, 400)
    }
  }, [focusScene])

  async function save() {
    setRendering(true)
    try {
      const res = await fetch('/api/re-render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.id,
          updatedScenes: scenes.map((s) => ({ ...s, duration: 0 })),
          updatedSlideUrls: slides.filter(Boolean) as string[],
          changedAudioIndexes: Array.from(changedAudio),
          voiceId: video.voice_id ?? 'nova',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSaved(before.current, {
        video_url: data.videoUrl,
        slide_urls: data.slideUrls,
        duration: data.duration,
        script: scenes.map((s) => ({ ...s, beat: 'context' as const, duration: 0 })) as unknown as Video['script'],
      })
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Re-render failed')
    } finally {
      setRendering(false)
    }
  }

  return (
    <div ref={box} className="res-card res-older" aria-label="Scene editor" role="region">
      <div className="res-older-head">
        <div>
          <h2 className="res-h2">Scene editor</h2>
          <p className="res-hint">Change the words, order or scenes. Save rebuilds the video from its slide pictures with the new voice — free.</p>
        </div>
        <div className="res-older-actions">
          <button type="button" className="kit-btn kit-btn--quiet kit-btn--sm" onClick={onClose} disabled={rendering}>Cancel</button>
          <button type="button" className="kit-btn kit-btn--primary kit-btn--sm" onClick={save} disabled={rendering}>
            {rendering ? 'Rebuilding… this takes a few minutes' : 'Save & Regenerate'}
          </button>
        </div>
      </div>
      <div className="res-older-body">
        <ScriptEditor
          scenes={scenes}
          slides={slides}
          onScenesChange={setScenes}
          onSlidesChange={setSlides}
          onRegenerateAudio={async (sceneIndex) => {
            setChangedAudio((prev) => new Set(prev).add(sceneIndex))
          }}
          onDeleteScene={(sceneIndex) => {
            if (scenes.length <= 2) return
            setScenes((prev) => prev.filter((_, i) => i !== sceneIndex))
            setSlides((prev) => prev.filter((_, i) => i !== sceneIndex))
          }}
          onEditSlide={async (sceneIndex, instruction) => {
            const currentSlide = slides[sceneIndex]
            if (!currentSlide) return
            const res = await fetch('/api/edit-slide', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ currentSlideBase64: currentSlide, editInstruction: instruction }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            const next = [...slides]
            next[sceneIndex] = data.image
            setSlides(next)
          }}
          onRedoSlide={async () => {
            // Regeneration removed — content is now reviewed at script stage
          }}
        />
      </div>
    </div>
  )
}
