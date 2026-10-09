'use client'
import { normalizeUrl, tidyUrlInput } from '../../../../_lib/normalize-url'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Button, Note } from '../../../../_components/kit'
import { createClient } from '../../../../_lib/supabase/client'
import { createProjectBrand } from '../../../../_actions/brands'
import { pickBrandColors, quickBrandPrefill } from '../../../../_lib/brand-quick'
import s from './AddBrandPiece.module.css'

/*
 * "ADD YOUR BRAND" — inside the project, on step 3 (Make it yours).
 *
 * Since the light start there's no brand page to get through before the first
 * project. This small piece asks for what matters on the video: a name, a
 * logo, two colours — and can fill itself in from the person's website.
 *
 * Reuses, doesn't copy:
 *  - the logo goes through /api/brands/logo (the Brands page's own logo
 *    processing: transparent light/dark versions for the video);
 *  - the website read is /api/brand-from-url (no AI, just the page);
 *  - the brand is saved by createProjectBrand, which builds the row with the
 *    same code as the Brands page. The first brand becomes the default.
 *
 * Logos: real ones only — uploaded, or the one on their own website. Never
 * drawn. No logo → the name shows as text.
 */

export type SavedBrand = {
  id: string
  name: string
  logo_url: string | null
  primary_color: string | null
  secondary_color: string | null
  accent_color: string | null
}

type Logo = { url: string; light: string | null; dark: string | null; chip: boolean }

/** A "data:image/png;base64,…" picture as a file-like blob. (fetch() can't
 *  open data: addresses here — the site's security rules only allow https.) */
function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body = ''] = dataUrl.split(',')
  const type = head.match(/^data:([^;,]+)/)?.[1] || 'image/png'
  if (!/;base64/i.test(head)) return new Blob([decodeURIComponent(body)], { type })
  const bin = atob(body)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

export default function AddBrandPiece({
  videoId,
  draft,
  onSaved,
  onClose,
}: {
  videoId: string
  draft: Record<string, unknown> | null
  onSaved: (brand: SavedBrand) => void
  onClose: () => void
}) {
  const start = quickBrandPrefill(draft, null)
  const [name, setName] = useState(start.name)
  const [website, setWebsite] = useState(start.website)
  const [primary, setPrimary] = useState(start.primary)
  const [secondary, setSecondary] = useState(start.secondary)
  const [logo, setLogo] = useState<Logo | null>(null)
  const [busy, setBusy] = useState<null | 'website' | 'logo' | 'save'>(null)
  const [message, setMessage] = useState<{ tone: 'info' | 'warn' | 'stop'; text: string } | null>(null)
  const colorsTouched = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // The person's company or name, if the project didn't already give one.
  useEffect(() => {
    if (start.name) return
    let alive = true
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: p } = await supabase.from('profiles').select('company_name, full_name').eq('id', data.user.id).maybeSingle()
      const fill = quickBrandPrefill(draft, p as { company_name?: string | null; full_name?: string | null } | null).name
      if (alive && fill) setName((n) => n || fill)
    }).catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Send a real logo image through the Brands page's logo processing. */
  async function takeLogoFile(file: File) {
    setMessage(null)
    if (file.size > 8 * 1024 * 1024) { setMessage({ tone: 'stop', text: 'That logo is too large. Please use one under 8MB.' }); return false }
    setBusy('logo')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/brands/logo', { method: 'POST', body: fd })
      const raw = await res.text()
      let data: Record<string, unknown> = {}
      try { data = raw ? JSON.parse(raw) : {} } catch { data = { error: raw.slice(0, 140) } }
      if (!res.ok) {
        // 422 = it couldn't cleanly cut the logo out; the brand still works
        // without it (the name shows as text).
        setMessage({ tone: res.status === 422 ? 'warn' : 'stop', text: String(data.error || 'We couldn’t use that logo. Try a different image.') })
        return false
      }
      const url = String(data.logo_url)
      setLogo({ url, light: (data.logo_light_url as string) ?? null, dark: (data.logo_dark_url as string) ?? null, chip: !!data.logo_chip })
      // Colours from the logo, unless they were already chosen.
      if (!colorsTouched.current) {
        fetch('/api/extract-logo-colors', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: url }),
        }).then((r) => (r.ok ? r.json() : null)).then((c) => {
          if (!c || colorsTouched.current) return
          const picked = pickBrandColors([c.primary, c.secondary])
          if (picked.primary) setPrimary(picked.primary)
          if (picked.secondary) setSecondary(picked.secondary)
        }).catch(() => {})
      }
      return true
    } catch {
      setMessage({ tone: 'stop', text: 'Connection lost. Please try again.' })
      return false
    } finally {
      setBusy(null)
    }
  }

  /** Read the person's own website for their colours and logo. */
  async function fillFromWebsite() {
    if (!website.trim()) { setMessage({ tone: 'info', text: 'Type your website first, like yourcompany.com.' }); return }
    setBusy('website')
    setMessage(null)
    try {
      const res = await fetch('/api/brand-from-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: normalizeUrl(website) ?? website.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setMessage({ tone: 'stop', text: data.error || 'We couldn’t read that website.' }); return }
      const picked = pickBrandColors(data.colors)
      if (picked.primary) { setPrimary(picked.primary); colorsTouched.current = true }
      if (picked.secondary) setSecondary(picked.secondary)
      let gotLogo = false
      if (typeof data.logoDataUrl === 'string' && data.logoDataUrl.startsWith('data:image/')) {
        // The logo on their own site is a real logo — processed like an upload.
        const blob = dataUrlToBlob(data.logoDataUrl)
        const ext = blob.type.split('/')[1]?.replace('svg+xml', 'svg') || 'png'
        setBusy(null)
        gotLogo = await takeLogoFile(new File([blob], `website-logo.${ext}`, { type: blob.type }))
      }
      if (!picked.primary && !gotLogo) {
        setMessage({ tone: 'info', text: 'We couldn’t find colours or a logo there. Pick them below.' })
      } else if (!gotLogo) {
        setMessage({ tone: 'info', text: 'Colours filled in. We didn’t find a logo — upload one, or your name shows as text.' })
      } else {
        setMessage({ tone: 'info', text: 'Filled in from your website. Check it looks right.' })
      }
    } catch {
      setMessage({ tone: 'stop', text: 'Connection lost. Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  async function save() {
    if (!name.trim()) { setMessage({ tone: 'stop', text: 'Type your name or your company’s name.' }); return }
    setBusy('save')
    setMessage(null)
    try {
      const fd = new FormData()
      fd.set('name', name.trim())
      fd.set('profile_type', 'company')
      fd.set('primary_color', primary)
      fd.set('secondary_color', secondary)
      if (logo) {
        fd.set('logo_url', logo.url)
        fd.set('logo_file_url', logo.url)
        if (logo.light) fd.set('logo_light_url', logo.light)
        if (logo.dark) fd.set('logo_dark_url', logo.dark)
        fd.set('logo_chip', String(logo.chip))
      }
      // The closing card's contact line reads the website from here.
      if (website.trim()) fd.set('brand_guide_data', JSON.stringify({ website: website.trim() }))
      const made = await createProjectBrand(fd)
      if ('error' in made) { setMessage({ tone: 'stop', text: made.error }); return }

      // This project uses it from now on.
      const patch = await fetch('/api/videos/draft', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, updates: { brandId: made.id } }),
      })
      if (!patch.ok) { setMessage({ tone: 'stop', text: 'Your brand is saved, but we couldn’t add it to this project. Press Change to pick it.' }) }
      onSaved({ id: made.id, name: name.trim(), logo_url: logo?.url ?? null, primary_color: primary, secondary_color: secondary, accent_color: null })
    } catch {
      setMessage({ tone: 'stop', text: 'Connection lost. Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className={s.piece} aria-labelledby="add-brand-title">
      <div className={s.head}>
        <h2 id="add-brand-title" className={s.title}>Add your brand</h2>
        <span className={s.hint}>optional — it goes on this and every new project</span>
      </div>

      <label className={s.field}>
        <span className={s.label}>Your name or company</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rivera Insurance" maxLength={120} />
      </label>

      <div className={s.field}>
        <label className={s.label} htmlFor="add-brand-site">Your website</label>
        <div className={s.row}>
          <input id="add-brand-site" className="input" value={website} onChange={(e) => setWebsite(e.target.value)} onBlur={() => setWebsite((v) => tidyUrlInput(v))} autoComplete="url" placeholder="yourcompany.com" inputMode="url" />
          <Button variant="secondary" size="sm" onClick={fillFromWebsite} disabled={!!busy}>
            {busy === 'website' ? 'Reading…' : 'Fill in from it'}
          </Button>
        </div>
      </div>

      <div className={s.field}>
        <span className={s.label}>Your logo</span>
        <div className={s.row}>
          {logo ? <img className={s.logo} src={logo.url} alt="Your logo" /> : <span className={s.noLogo}>{name.trim() || 'Your name'}</span>}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="kit-sr"
            aria-label="Upload your logo"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void takeLogoFile(f); e.target.value = '' }}
          />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={!!busy}>
            {busy === 'logo' ? 'Getting it ready…' : logo ? 'Use a different logo' : 'Upload your logo'}
          </Button>
          {logo ? <Button variant="quiet" size="sm" onClick={() => setLogo(null)} disabled={!!busy}>Remove</Button> : null}
        </div>
        <p className={s.small}>Only your real logo — we never draw one. No logo? Your name shows as text, like above.</p>
      </div>

      <div className={s.field}>
        <span className={s.label}>Your colours</span>
        <div className={s.row}>
          <label className={s.swatch}>
            <input type="color" value={primary} onChange={(e) => { colorsTouched.current = true; setPrimary(e.target.value.toUpperCase()) }} aria-label="Main colour" />
            <span>Main</span>
          </label>
          <label className={s.swatch}>
            <input type="color" value={secondary} onChange={(e) => { colorsTouched.current = true; setSecondary(e.target.value.toUpperCase()) }} aria-label="Second colour" />
            <span>Second</span>
          </label>
        </div>
      </div>

      {message ? <Note tone={message.tone}>{message.text}</Note> : null}

      <div className={s.actions}>
        <Button onClick={save} disabled={!!busy || !name.trim()} disabledReason={!name.trim() ? 'Type your name or company first.' : undefined}>
          {busy === 'save' ? 'Saving…' : 'Save my brand'}
        </Button>
        <Button variant="quiet" onClick={onClose} disabled={busy === 'save'}>Not now</Button>
        <Link className={s.more} href={`/create/brand?id=${encodeURIComponent(videoId)}`}>More brand options (photo, contact details)</Link>
      </div>
    </section>
  )
}
