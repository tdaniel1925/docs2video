'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { brandSkin } from '../../../../_lib/template-palette'
import type { VideoTemplateId } from '../../../../_lib/video-templates'

/*
 * A TEMPLATE'S PAGE IN THE BRAND'S COLORS, LIVE (owner, 2026-10-18:
 * "templates need to be able to change to brand colors").
 *
 * The pages are the engine's own — fitted by it from the made-up sample words
 * (public/templates/previews.json, brought over by
 * scripts/import-template-previews.mjs) — and they are recolored here by the
 * engine's own rules (app/_lib/template-palette.ts, a copy of its palette.ts),
 * so the card shows what the film will be drawn in. Drawn at the film's
 * 1920×1080 and scaled to the card.
 */

type Previews = Record<VideoTemplateId, { name: string; fonts: string; css: string; skin: string; pages: { layout: string; html: string }[] }>

let loading: Promise<Previews> | null = null
const loadPreviews = () => (loading ??= fetch('/templates/previews.json').then((r) => { if (!r.ok) throw new Error('previews'); return r.json() as Promise<Previews> }).catch((e) => { loading = null; throw e }))

/** The stylesheets and fonts for every template, in the brand's colors — one <style> for the whole picker. */
export function TemplateLiveStyles({ palette }: { palette: string[] }) {
  const [p, setP] = useState<Previews | null>(null)
  useEffect(() => { let alive = true; loadPreviews().then((x) => { if (alive) setP(x) }, () => {}); return () => { alive = false } }, [])
  const key = palette.join(',')
  const css = useMemo(() => {
    if (!p) return ''
    return Object.entries(p).map(([id, t]) => `${t.css}\n${brandSkin(id as VideoTemplateId, t.skin, palette).css}`).join('\n')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the palette's colors, not its array
  }, [p, key])
  if (!p) return null
  const fonts = [...new Set(Object.values(p).flatMap((t) => t.fonts.split('&')))].join('&')
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- the templates' own fonts, only while their previews show */}
      <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${fonts}&display=swap`} />
      <style data-template-live-css>{css}</style>
    </>
  )
}

/** One page of a template (0 cover · 1 number · 2 cards · 3 closing), drawn and scaled to its box. */
export function TemplateLive({ id, page = 0, className }: { id: VideoTemplateId; page?: number; className?: string }) {
  const [p, setP] = useState<Previews | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  useEffect(() => { let alive = true; loadPreviews().then((x) => { if (alive) setP(x) }, () => {}); return () => { alive = false } }, [])
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setScale(el.clientWidth / 1920)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // The page in the brand's colors: its section carries the class "bc".
  const html = p?.[id]?.pages[page]?.html.replace(/class="slide tp ([^"]*)"/, 'class="slide tp $1 bc"') ?? ''
  return (
    <div ref={box} className={`cf-tpl-live${className ? ` ${className}` : ''}`} aria-hidden="true" data-template-live={id}>
      {html && scale ? <div className="cf-tpl-live-page" style={{ transform: `scale(${scale})` }} dangerouslySetInnerHTML={{ __html: html }} /> : null}
    </div>
  )
}
