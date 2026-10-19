'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
 *
 * EACH PAGE IS SEALED IN ITS OWN SHADOW ROOT, with only its template's styles
 * (owner test, 2026-10-19). Put in the main page, all eight templates' 114 KB
 * of styles made every change to the Look step restyle the whole document —
 * switching to My brand froze the tab for 3.5 s — and the app's own heading
 * rule reached into the previews and broke their titles. Sealed, neither can
 * happen. The fonts' @font-face rules stay in the document (TemplateLiveStyles),
 * where shadow roots can use them.
 */

type Previews = Record<VideoTemplateId, { name: string; fonts: string; css: string; skin: string; pages: { layout: string; html: string }[] }>

let loading: Promise<Previews> | null = null
const loadPreviews = () => (loading ??= fetch('/templates/previews.json').then((r) => { if (!r.ok) throw new Error('previews'); return r.json() as Promise<Previews> }).catch((e) => { loading = null; throw e }))

/** One template's styles in one palette, worked out once and shared by every card and scene. */
const skins = new Map<string, string>()
function cssFor(p: Previews, id: VideoTemplateId, palette: string[]): string {
  const key = `${id}|${palette.join(',')}`
  let css = skins.get(key)
  if (css === undefined) {
    const t = p[id]
    css = t ? `${t.css}\n${brandSkin(id, t.skin, palette).css}` : ''
    skins.set(key, css)
  }
  return css
}

/** The templates' fonts, once in the document (shadow roots use the document's @font-face). */
export function TemplateLiveStyles({ palette }: { palette: string[] }) {
  void palette
  const [p, setP] = useState<Previews | null>(null)
  useEffect(() => { let alive = true; loadPreviews().then((x) => { if (alive) setP(x) }, () => {}); return () => { alive = false } }, [])
  if (!p) return null
  const fonts = [...new Set(Object.values(p).flatMap((t) => t.fonts.split('&')))].join('&')
  // eslint-disable-next-line @next/next/no-page-custom-font -- the templates' own fonts, only while their previews show
  return <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${fonts}&display=swap`} />
}

/** One page of a template (0 cover · 1 number · 2 cards · 3 closing), drawn and scaled to its box. */
export function TemplateLive({ id, page = 0, className, palette = [] }: { id: VideoTemplateId; page?: number; className?: string; palette?: string[] }) {
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
  const key = palette.join(',')
  // Draw it into the box's own shadow root: its styles in, the app's out.
  useEffect(() => {
    const el = box.current
    if (!el || !p || !html) return
    const root = el.shadowRoot ?? el.attachShadow({ mode: 'open' })
    root.innerHTML = `<style>:host{display:block}.pg{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0;pointer-events:none}\n${cssFor(p, id, palette)}</style><div class="pg">${html}</div>`
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the palette's colors, not its array
  }, [p, id, html, key])
  useEffect(() => {
    const pg = box.current?.shadowRoot?.querySelector<HTMLElement>('.pg')
    if (pg) pg.style.transform = `scale(${scale})`
  }, [scale, p, html, key])
  return <div ref={box} className={`cf-tpl-live${className ? ` ${className}` : ''}`} aria-hidden="true" data-template-live={id} />
}
