// The outside-world half of "Something I like" (look-reference.ts holds the
// rules). Server only: sharp, pdf-lib, Gemini, the render service, storage,
// the rate-limit counter.

import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
import { GoogleGenAI } from '@google/genai'
import { createAdminClient } from './supabase/admin'
import { hitRateLimitStrict } from './rate-limit'
import { isSafePublicUrl, safeFetch, fetchPage, extractFonts } from './brand-scraper'
import { videoServiceUrl } from './video-service'
import { REFERENCE_READS_PER_DAY, VISION_PROMPT, type ReadDeps } from './look-reference'

const BUCKET = 'videos'
const VISION_MODEL = 'gemini-2.5-flash'
// Gemini 2.5 Flash list prices (per million tokens), for the cost log.
const PRICE_IN = 0.3, PRICE_OUT = 2.5

/** RGB pixels of a picture, at most 120×120 (enough for colour; fast). */
export async function picturePixels(picture: Buffer): Promise<Uint8Array> {
  const { data, info } = await sharp(picture, { limitInputPixels: 80_000_000, failOn: 'error' })
    .rotate().flatten({ background: '#ffffff' }).resize(120, 120, { fit: 'inside' }).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true })
  if (info.channels !== 3) throw new Error(`unexpected ${info.channels} channels`)
  return new Uint8Array(data.buffer, data.byteOffset, data.length)
}

export async function pictureThumb(picture: Buffer): Promise<Buffer> {
  return sharp(picture, { limitInputPixels: 80_000_000 }).rotate().flatten({ background: '#ffffff' })
    .resize(768, 768, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer()
}

/** A PDF's first page as a picture: pdf-lib keeps page 1, the render service draws it (pdftoppm). */
export async function pdfFirstPage(pdf: Buffer): Promise<Buffer> {
  const src = await PDFDocument.load(pdf, { ignoreEncryption: true })
  if (src.getPageCount() < 1) throw new Error('empty PDF')
  const one = await PDFDocument.create()
  const [page] = await one.copyPages(src, [0])
  one.addPage(page)
  const { width, height } = page.getSize()
  const bytes = Buffer.from(await one.save())
  const secret = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')
  const res = await fetch(`${videoServiceUrl()}/convert`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-secret': secret },
    body: JSON.stringify({ fileBase64: bytes.toString('base64'), fileName: 'reference.pdf' }),
    signal: AbortSignal.timeout(45000),
  })
  if (!res.ok) throw new Error(`convert ${res.status}`)
  const j = await res.json().catch(() => null) as { slides?: string[] } | null
  const b64 = j?.slides?.[0]
  if (!b64) throw new Error('no page picture')
  const img = Buffer.from(b64, 'base64')
  // /convert pads every page to 1920×1080 with white; cut the padding off so it isn't read as a colour.
  const scale = Math.min(1920 / Math.max(1, width), 1080 / Math.max(1, height))
  const w = Math.max(1, Math.min(1920, Math.round(width * scale))), h = Math.max(1, Math.min(1080, Math.round(height * scale)))
  return sharp(img).extract({ left: Math.floor((1920 - w) / 2), top: Math.floor((1080 - h) / 2), width: w, height: h }).png().toBuffer()
}

/** A website's screenshot through microlink (as the commercial maker does). Only for public addresses. */
export async function websiteScreenshot(url: string): Promise<Buffer | null> {
  if (!(await isSafePublicUrl(url))) return null
  const api = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&viewport.width=1280&viewport.height=800&waitUntil=networkidle2`
  const r = await fetch(api, { signal: AbortSignal.timeout(35000) })
  if (!r.ok) return null
  const j = await r.json().catch(() => null) as { data?: { screenshot?: { url?: string } } } | null
  const shot = j?.data?.screenshot?.url
  if (!shot) return null
  const img = await safeFetch(shot, { timeoutMs: 25000 })
  if (!img || !img.ok) return null
  const buf = Buffer.from(await img.arrayBuffer())
  if (buf.length < 3000) return null
  const meta = await sharp(buf).metadata()
  return meta.width && meta.width >= 400 ? buf : null
}

let _genai: GoogleGenAI | null = null
const genai = () => (_genai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' }))

/** Gemini 2.5 Flash names the mood + closest free font, JSON only. */
export async function visionRead(jpeg: Buffer): Promise<{ json: unknown; costUsd: number }> {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set')
  const res = await genai().models.generateContent({
    model: VISION_MODEL,
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: jpeg.toString('base64') } }, { text: VISION_PROMPT }] }],
    config: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 }, abortSignal: AbortSignal.timeout(20000) },
  })
  const text = (res.text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const u = res.usageMetadata
  const costUsd = ((u?.promptTokenCount ?? 0) * PRICE_IN + (u?.candidatesTokenCount ?? 0) * PRICE_OUT) / 1e6
  return { json: JSON.parse(text), costUsd }
}

/** Everything readReference needs, for one signed-in account. */
export function referenceDeps(userId: string): ReadDeps {
  const admin = createAdminClient()
  const path = (key: string) => `${userId}/look-refs/${key}.json`
  const day = new Date().toISOString().slice(0, 10)
  return {
    cacheGet: async (key) => {
      const { data, error } = await admin.storage.from(BUCKET).download(path(key))
      if (error || !data) return null
      return JSON.parse(await data.text())
    },
    cachePut: async (key, value) => {
      const { error } = await admin.storage.from(BUCKET).upload(path(key), Buffer.from(JSON.stringify(value)), { contentType: 'application/json', upsert: true })
      if (error) throw new Error(error.message)
    },
    countRead: () => hitRateLimitStrict(`look-ref:${userId}:${day}`, REFERENCE_READS_PER_DAY, 86400),
    pixels: picturePixels,
    thumb: pictureThumb,
    vision: visionRead,
    pdfFirstPage,
    screenshot: websiteScreenshot,
    isPublic: isSafePublicUrl,
    siteFonts: async (url) => { const html = await fetchPage(url); return html ? extractFonts(html) : [] },
    log: (line) => console.log(`[look-ref] ${line}`),
  }
}
