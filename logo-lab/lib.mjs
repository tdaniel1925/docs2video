// Shared plumbing for the logo research harness.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { dirname } from 'path'

export const RUNS = 'logo-lab/runs'
export const RESULTS = 'logo-lab/results.json'

export const save = (p, buf) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, buf) }
export const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback)
export const writeJson = (p, v) => save(p, JSON.stringify(v, null, 2))

/**
 * Every generated image, keyed by its own id.
 *
 * One flat store rather than a folder tree, because the questions asked of it
 * cut across runs — "every image from the studios steer", "every image a human
 * rated 5" — and a tree would force a walk for each one.
 */
export const loadResults = () => readJson(RESULTS, { images: [] })
export const saveResults = (r) => writeJson(RESULTS, r)

export function upsert(results, image) {
  const i = results.images.findIndex((x) => x.id === image.id)
  if (i >= 0) results.images[i] = { ...results.images[i], ...image }
  else results.images.push(image)
  return results
}

/** A short stable id from the things that define an image. */
export const imageId = (parts) =>
  parts.filter(Boolean).join('_').replace(/[^a-z0-9_-]/gi, '-').toLowerCase()

// ── the engines ─────────────────────────────────────────────────────────────

/**
 * Gemini's image model. Fast and cheap, which is what makes an experiment with
 * a few hundred images affordable at all — at GPT Image's ~95s each, a single
 * ablation run would take most of a day.
 */
export async function gemini(prompt, key = process.env.GEMINI_API_KEY) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    },
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
  const part = (data.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData || p.inline_data)
  const b64 = part?.inlineData?.data ?? part?.inline_data?.data
  if (!b64) throw new Error('no image returned')
  return Buffer.from(b64, 'base64')
}

export async function gptImage(prompt, key = process.env.OPENAI_API_KEY) {
  const { default: OpenAI } = await import('openai')
  const ai = new OpenAI({ apiKey: key })
  const res = await ai.images.generate({
    model: 'gpt-image-2', prompt, size: '1024x1024', quality: 'high', n: 1,
  })
  return Buffer.from(res.data[0].b64_json, 'base64')
}

export const ENGINES = { gemini, gptImage }

/** Run tasks with a concurrency cap, so a 160-image batch doesn't stampede. */
export async function pool(items, limit, fn) {
  const out = []
  const queue = [...items.entries()]
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const next = queue.shift()
      if (!next) return
      const [i, item] = next
      try { out[i] = await fn(item, i) } catch (e) { out[i] = { error: e.message } }
    }
  }))
  return out
}
