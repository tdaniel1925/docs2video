/**
 * A SAMPLE VIDEO FOR EVERY PRESENTATION LOOK — made by the production pipeline.
 *
 *   npx tsx scripts/look-samples/make-pres-samples.ts
 *
 * Exactly what /api/generate-presentation does for an interactive
 * presentation (buildPresentationHtml + synthesizeSpeech, voice 'nova'), with a
 * made-up story (the Morales family's 2026 coverage review, presented by a
 * made-up agent, Jordan Avery, no logo), then captured the way the production
 * MP4 export captures one (render-service/present-export.js: ?record=1,
 * startShow(durations), narration rebuilt on the same schedule). Nothing is
 * written to any database.
 *
 * Output: public/look-samples/<template-id>.mp4 + .jpg (1280x720, h264 crf 28).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import http from 'node:http'

const ROOT = resolve(__dirname, '../..')
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const WORK = join(ROOT, 'scripts/look-samples/out-pres')
const OUT = join(ROOT, 'public/look-samples')
mkdirSync(WORK, { recursive: true }); mkdirSync(OUT, { recursive: true })

const GAP_MS = 800, TAIL_MS = 1800 // present-export.js

const scenes = [
  { _role: 'cover' as const, title: 'Your 2026 Coverage Review', narration: 'Hi Morales family. Here is your 2026 coverage review, in under a minute.', slideData: { headline: 'Your 2026 Coverage Review' } },
  { title: 'Your premium went down', narration: 'Good news first. Your monthly premium went down, to eighty-four fifty a month.', slideData: { headline: 'Your premium went down', stats: [{ value: '$84.50', label: 'a month' }, { value: '$91.30', label: 'last year' }] } },
  { title: 'What you are covered for', narration: 'You keep five hundred thousand dollars of cover for twenty years, and a critical illness rider is now included.', slideData: { headline: 'What you are covered for', stats: [{ value: '$500,000', label: 'death benefit' }, { value: '20 years', label: 'term' }], bullets: ['Critical illness rider added'] } },
  { title: 'Why it matters', narration: 'If the worst happens, the mortgage is paid off and the children’s education is funded.', slideData: { headline: 'Why it matters', bullets: ['The mortgage is paid off', 'The children’s education is funded', 'Your family stays in its home'] } },
  { _role: 'closing' as const, title: 'What happens next', narration: 'Book a twenty-minute call with me and we will go through it together. Talk soon.', slideData: { headline: 'What happens next', bullets: ['A 20-minute review call', 'Bring any questions'], cta: 'Book your review call' } },
]

async function main() {
  const { buildPresentationHtml, PRESENTATION_TEMPLATES } = await import('../../app/_lib/presentation')
  const { synthesizeSpeech } = await import('../../app/_lib/tts')
  const only = process.argv[2] ? process.argv[2].split(',') : null

  // Narration once (same words for every look), cached so a re-run costs nothing.
  const voClips: string[] = []
  for (let i = 0; i < scenes.length; i++) {
    const f = join(WORK, `vo-${i}.mp3`)
    if (!existsSync(f)) { writeFileSync(f, await synthesizeSpeech(scenes[i].narration, 'nova')); console.log('voice', i) }
    voClips.push(readFileSync(f).toString('base64'))
  }

  const server = http.createServer((req, res) => {
    const f = join(WORK, decodeURIComponent((req.url || '/').split('?')[0]))
    if (!f.startsWith(WORK) || !existsSync(f)) { res.statusCode = 404; res.end(); return }
    res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(readFileSync(f))
  })
  await new Promise<void>((r) => server.listen(3399, r))
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] })

  for (const t of PRESENTATION_TEMPLATES) {
    if (only && !only.includes(t.id)) continue
    const html = buildPresentationHtml({
      title: 'Your 2026 Coverage Review',
      scenes,
      templateId: t.id,
      recipientName: 'the Morales family',
      presenter: { name: 'Jordan Avery', contactLine: 'jordan@example.com' },
      // An insurance review is regulated: production adds this line to every slide.
      disclaimer: 'Prepared by your agent for education only. Figures shown are illustrated and not guarantees. Refer to your full illustration for complete terms, values and conditions.',
      voClips,
      shareActions: true,
      hasSourceDoc: true,
      hasDeckDownload: true,
    })
    writeFileSync(join(WORK, `${t.id}.html`), html)
    const url = `http://localhost:3399/${t.id}.html?record=1`

    // ── present-export.js, step 1: durations from the page, then record ──
    const probeCtx = await browser.newContext(); const probe = await probeCtx.newPage()
    await probe.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
    const durs0: number[] = await probe.evaluate(async () => {
      /* VO is a top-level const in the page's script (not on window): read it by name, as present-export.js does. */
      const clips: string[] = (0, eval)('typeof VO !== "undefined" ? VO : []')
      const out: number[] = []
      for (const b64 of clips) {
        if (!b64) { out.push(2500); continue }
        out.push(await new Promise<number>((res) => { const a = new Audio('data:audio/mpeg;base64,' + b64); a.onloadedmetadata = () => res(Math.round(a.duration * 1000)); a.onerror = () => res(2500) }))
      }
      return out
    })
    await probeCtx.close()
    if (!durs0.length) throw new Error(`${t.id}: no narration in the page`)
    const durs = durs0.map((d, i, arr) => d + (i === arr.length - 1 ? TAIL_MS : GAP_MS))
    const totalMs = durs.reduce((a, b) => a + b, 0)
    const cap = join(WORK, `cap-${t.id}`); rmSync(cap, { recursive: true, force: true }); mkdirSync(cap)
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: cap, size: { width: 1920, height: 1080 } } })
    const page = await ctx.newPage()
    const tPage = Date.now()
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
    await page.evaluate(() => (document.fonts ? document.fonts.ready.then(() => true) : true)).catch(() => {})
    await page.waitForTimeout(900)
    const leadMs = Date.now() - tPage
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.evaluate((d) => (window as any).startShow(d), durs)
    await page.waitForTimeout(totalMs + 800)
    await page.close(); await ctx.close()
    const webm = join(cap, readdirSync(cap).find((f) => f.endsWith('.webm'))!)

    // ── step 2: narration on the identical schedule ──
    const inputs = ['-f', 'lavfi', '-t', (leadMs / 1000).toFixed(3), '-i', 'anullsrc=r=44100:cl=stereo']
    const labels = ['[0:a]']; const filters: string[] = []
    voClips.forEach((_, i) => {
      inputs.push('-i', join(WORK, `vo-${i}.mp3`))
      const idx = inputs.filter((x) => x === '-i').length - 1
      filters.push(`[${idx}:a]aresample=44100,pan=stereo|c0=c0|c1=c0[c${i}]`)
      labels.push(`[c${i}]`)
      if (i < voClips.length - 1) {
        inputs.push('-f', 'lavfi', '-t', (GAP_MS / 1000).toFixed(3), '-i', 'anullsrc=r=44100:cl=stereo')
        labels.push(`[${inputs.filter((x) => x === '-i').length - 1}:a]`)
      }
    })
    const wav = join(WORK, `${t.id}.wav`)
    execFileSync('ffmpeg', ['-y', ...inputs, '-filter_complex', `${filters.join(';')};${labels.join('')}concat=n=${labels.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=9[out]`, '-map', '[out]', wav], { stdio: 'pipe' })

    // ── step 3: the sample file (production muxes at crf 18 1080p; a sample is 720p crf 28) ──
    // The lead-in (page loading before the show starts) is trimmed off the front.
    const mp4 = join(OUT, `${t.id}.mp4`)
    const lead = (leadMs / 1000).toFixed(3)
    execFileSync('ffmpeg', ['-y', '-ss', lead, '-i', webm, '-ss', lead, '-i', wav, '-map', '0:v', '-map', '1:a', '-vf', 'scale=1280:720', '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart', mp4], { stdio: 'pipe' })
    execFileSync('ffmpeg', ['-y', '-ss', '1.5', '-i', mp4, '-frames:v', '1', '-q:v', '4', join(OUT, `${t.id}.jpg`)], { stdio: 'pipe' })
    console.log(`${t.id}: ${(totalMs / 1000).toFixed(1)}s, ${(statSync(mp4).size / 1048576).toFixed(1)} MB`)
  }
  await browser.close(); server.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
