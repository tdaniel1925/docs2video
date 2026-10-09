'use client'

import { useState } from 'react'
import { Clapperboard, Download, FileText, Film, Presentation, ScrollText, type LucideIcon } from 'lucide-react'
import type { Video } from '../../../../_lib/types'
import Menu from './Menu'
import { downloadsFor, scriptText, type DownloadItem } from './downloads'
import { isHtmlDeck } from './output'

type Notice = (n: { type: 'error' | 'success'; message: string }) => void

/** Save a file the browser already has. */
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

function safeName(title: string | null | undefined, fallback: string) {
  return (title || fallback).replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || fallback
}

/**
 * ONE "Download" menu instead of a row of buttons. It lists only what this
 * project really has (see downloads.ts), each with a line saying what it is;
 * the one download that costs credits shows its price.
 */
/** One picture per kind of file (lucide, 16px), beside its words. */
const FILE_ICON: Record<DownloadItem['key'], LucideIcon> = {
  mp4: Film,
  'video-file': Film,
  'export-video': Clapperboard,
  pdf: FileText,
  pptx: Presentation,
  script: ScrollText,
}

export default function DownloadsMenu({ video, onNotice }: { video: Video; onNotice: Notice }) {
  const items = downloadsFor(video)
  const [busy, setBusy] = useState<string | null>(null)
  const [exportState, setExportState] = useState<'idle' | 'started'>('idle')
  if (items.length === 0) return null
  const deck = isHtmlDeck(video)
  const name = safeName(video.title, deck ? 'Presentation' : 'video')

  async function run(item: DownloadItem) {
    if (busy) return
    setBusy(item.key)
    try {
      if (item.key === 'mp4') {
        const res = await fetch(video.video_url!)
        if (!res.ok) throw new Error('The video file could not be fetched.')
        saveBlob(await res.blob(), `${name}.mp4`)
      } else if (item.key === 'video-file') {
        window.open((video as Video & { export_video_url?: string }).export_video_url!, '_blank')
      } else if (item.key === 'script') {
        const text = scriptText(video.script)
        if (!text) throw new Error('This one has no script to save.')
        saveBlob(new Blob([text], { type: 'text/plain' }), `${name}.txt`)
      } else if (item.key === 'pdf' || item.key === 'pptx') {
        const res = deck
          ? await fetch('/api/presentation-export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId: video.id, kind: item.key }) })
          : await fetch(item.key === 'pdf' ? '/api/download-pdf' : '/api/download-pptx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId: video.id, title: video.title ?? 'Video Slides' }) })
        if (!res.ok) {
          const d = await res.json().catch(() => ({} as { error?: string }))
          throw new Error(d.error || `The ${item.label} could not be made — try again.`)
        }
        saveBlob(await res.blob(), `${name}.${item.key}`)
      } else if (item.key === 'export-video') {
        const res = await fetch('/api/presentation-export-video', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: video.id }),
        })
        const d = await res.json().catch(() => ({} as { url?: string; error?: string }))
        if (d.url) { window.open(d.url, '_blank'); return }
        if (!res.ok) throw new Error(d.error || 'The export did not start.')
        setExportState('started')
        onNotice({ type: 'success', message: 'Exporting your video. It takes about as long as the presentation plus a minute — refresh this page then to download it.' })
      }
    } catch (e) {
      onNotice({ type: 'error', message: e instanceof Error ? e.message : 'That download did not work — try again.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Menu label={<><Download size={16} />{busy ? 'Preparing…' : 'Download'}</>} testId="downloads-menu">
      {(close) => items.map((item) => {
        const Icon = FILE_ICON[item.key]
        return (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          className="kit-menu-item res-menu-item"
          disabled={!!busy || (item.key === 'export-video' && exportState === 'started')}
          onClick={() => { close(); run(item) }}
        >
          <Icon size={16} className="res-menu-icon" />
          <span className="res-menu-text">
            <span className="res-menu-label">{item.label}</span>
            {item.hint && <span className="res-menu-hint">{item.key === 'export-video' && exportState === 'started' ? 'Exporting — refresh in a few minutes' : item.hint}</span>}
          </span>
          {item.credits != null && <span className="kit-chip kit-chip--money">{item.credits.toLocaleString('en-US')} credits</span>}
        </button>
        )
      })}
    </Menu>
  )
}
