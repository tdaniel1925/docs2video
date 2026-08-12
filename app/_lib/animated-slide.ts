import { GoogleGenAI } from '@google/genai'
import puppeteer from 'puppeteer'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFile, mkdir, rm, readFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { execFile } from 'child_process'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

function getFfmpegPath(): string {
  const ext = process.platform === 'win32' ? '.exe' : ''
  return join(process.cwd(), 'node_modules', 'ffmpeg-static', `ffmpeg${ext}`)
}

function runFfmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(getFfmpegPath(), args, { maxBuffer: 50 * 1024 * 1024, timeout: 60000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`FFmpeg: ${err.message}\n${stderr}`))
      resolve(stdout + stderr)
    })
  })
}

interface SlideData {
  title: string
  subtitle?: string
  metrics: { label: string; value: string; highlight?: boolean }[]
  brandName?: string
  brandBar?: { name: string; phone?: string; website?: string }
}

// Step 1: Generate a styled background from Gemini (no text, no data)
async function generateBackground(
  stylePrompt: string,
  colors: { primary: string; secondary: string; accent: string; background: string; text: string }
): Promise<Buffer> {
  const prompt = `Create a BACKGROUND-ONLY presentation slide. NO text, NO numbers, NO words, NO labels, NO charts.

DESIGN STYLE: ${stylePrompt}

BRAND COLORS: Primary: ${colors.primary}, Secondary: ${colors.secondary}, Accent: ${colors.accent}, Background: ${colors.background}

IMPORTANT:
- Create ONLY the decorative background — textures, patterns, shapes, gradients, artistic elements
- Leave the center area relatively clean/open for text to be overlaid later
- DO NOT include ANY text, numbers, words, labels, or data
- DO NOT include any human faces
- Fill the entire 1920x1080 canvas
- This is JUST the background artwork/texture`

  const response = await genai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: prompt,
    config: {
      responseFormat: {
        image: { aspectRatio: '16:9', imageSize: '4K' },
      },
    } as any,
  })

  const parts = response.candidates?.[0]?.content?.parts ?? []
  for (const part of parts) {
    if (part.inlineData) {
      return Buffer.from(part.inlineData.data!, 'base64')
    }
  }
  throw new Error('No background image generated')
}

// Step 2: Create animated HTML slide
function buildAnimatedHtml(
  bgBase64: string,
  data: SlideData,
  colors: { primary: string; accent: string; text: string },
  durationSec: number
): string {
  const metricCards = data.metrics.map((m, i) => `
    <div class="metric" style="animation-delay: ${0.8 + i * 0.3}s; ${m.highlight ? `border: 2px solid ${colors.accent};` : ''}">
      <div class="metric-label">${m.label}</div>
      <div class="metric-value ${m.highlight ? 'highlight' : ''}" ${m.value.match(/^\$[\d,]+$/) ? `data-count="${m.value.replace(/[$,]/g, '')}"` : ''}>
        ${m.value}
      </div>
    </div>
  `).join('')

  const barItems: string[] = []
  if (data.brandBar?.name) barItems.push(data.brandBar.name)
  if (data.brandBar?.phone) barItems.push(data.brandBar.phone)
  if (data.brandBar?.website) barItems.push(data.brandBar.website)

  return `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1920px; height: 1080px; overflow: hidden;
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    background: url('data:image/png;base64,${bgBase64}') center/cover no-repeat;
    color: ${colors.text};
  }

  .overlay {
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    justify-content: safe center; align-items: center;
    padding: 80px 120px;
    background: rgba(0,0,0,0.25);
  }

  .title {
    font-size: 72px; font-weight: 800; letter-spacing: -0.03em;
    text-align: center; margin-bottom: 12px;
    opacity: 0; transform: translateY(30px);
    animation: slideUp 0.8s ease forwards;
    text-shadow: 0 4px 20px rgba(0,0,0,0.4);
  }

  .subtitle {
    font-size: 28px; font-weight: 500; opacity: 0;
    animation: fadeIn 0.6s ease 0.4s forwards;
    text-shadow: 0 2px 10px rgba(0,0,0,0.4);
    margin-bottom: 60px;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(${Math.min(data.metrics.length, 2)}, 1fr);
    gap: 24px; width: 100%; max-width: 900px;
  }

  .metric {
    background: rgba(255,255,255,0.12);
    backdrop-filter: blur(20px);
    border-radius: 16px; padding: 32px 36px;
    border: 1px solid rgba(255,255,255,0.15);
    opacity: 0; transform: translateY(20px) scale(0.95);
    animation: cardIn 0.6s ease forwards;
  }

  .metric-label {
    font-size: 16px; text-transform: uppercase;
    letter-spacing: 0.12em; opacity: 0.6;
    margin-bottom: 8px; font-weight: 600;
  }

  .metric-value {
    font-size: 48px; font-weight: 800;
    letter-spacing: -0.02em;
  }

  .metric-value.highlight {
    color: ${colors.accent};
  }

  .brand-bar {
    position: absolute; bottom: 0; left: 0; right: 0;
    height: 56px; background: ${colors.primary};
    display: flex; align-items: center; justify-content: center;
    gap: 32px; font-size: 18px; font-weight: 600;
    color: rgba(255,255,255,0.9); letter-spacing: 0.02em;
    opacity: 0;
    animation: fadeIn 0.5s ease ${0.8 + data.metrics.length * 0.3 + 0.3}s forwards;
  }

  .brand-bar span { opacity: 0.5; }

  /* Count-up animation for numbers */
  .counting { font-variant-numeric: tabular-nums; }

  @keyframes slideUp {
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    to { opacity: 1; }
  }
  @keyframes cardIn {
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
</style>
</head>
<body>
  <div class="overlay">
    <div class="title">${data.title}</div>
    ${data.subtitle ? `<div class="subtitle">${data.subtitle}</div>` : '<div class="subtitle" style="margin-bottom:60px"></div>'}
    <div class="metrics-grid">
      ${metricCards}
    </div>
  </div>
  ${barItems.length > 0 ? `
  <div class="brand-bar">
    ${barItems.join(' <span>|</span> ')}
  </div>` : ''}

  <script>
    /**
     * MAKE IT FIT. Measured, not estimated.
     *
     * Every size on this slide was a fixed number — 72px headline, 28px
     * subtitle, 48px figures — chosen for text of a length nobody controls. The
     * words are written by a model from somebody's document, so a headline can
     * be four words or fourteen. When it is fourteen it wraps onto three lines,
     * shoves the panels down, and the frame is `overflow: hidden`, so the
     * bottom of the slide is simply cut off. That is the overlapping and
     * spilling.
     *
     * This runs in a real browser before a single frame is captured, so it does
     * not guess: it asks the page whether the content fits and shrinks the type
     * a step at a time until it does. Real measurement handles a long German
     * word, a customer's twelve-word title and a dollar figure with eight
     * digits, none of which a rule of thumb would survive.
     */
    (function fitToFrame() {
      var overlay = document.querySelector('.overlay');
      var bar = document.querySelector('.brand-bar');
      if (!overlay) return;

      // THE BRAND BAR SITS ON TOP OF EVERYTHING. It is positioned absolutely at
      // the bottom, so the layout above knows nothing about it and the last row
      // of panels was free to slide underneath. Reserve its height plus a gap.
      if (bar) {
        var pad = bar.offsetHeight + 32;
        overlay.style.paddingBottom = pad + 'px';
      }

      // A single unbroken string longer than the frame — a URL, a long email —
      // cannot be shrunk into fitting at any sane size. Let it break.
      overlay.style.overflowWrap = 'anywhere';

      var scaled = [
        { el: overlay.querySelector('.title'), start: 72, floor: 34 },
        { el: overlay.querySelector('.subtitle'), start: 28, floor: 17 },
      ];
      overlay.querySelectorAll('.metric-value').forEach(function (el) {
        scaled.push({ el: el, start: 48, floor: 24 });
      });
      overlay.querySelectorAll('.metric-label').forEach(function (el) {
        scaled.push({ el: el, start: 16, floor: 11 });
      });
      scaled = scaled.filter(function (s) { return s.el; });

      /**
       * DOES NOT FIT — asked three ways, because one of them is not enough.
       *
       * My first version asked only whether the box scrolls. That misses the
       * two failures that actually look worst: content pushed off the TOP of a
       * centred column, and the last row of panels sliding UNDER the brand bar,
       * which floats above everything and so never registers as overflow.
       *
       * The shrink loop stopped early on a real slide because of it — three
       * steps, then "fits", then a clipped frame. Measured, caught, widened.
       */
      var doesNotFit = function () {
        if (overlay.scrollHeight > overlay.clientHeight + 1) return true;
        if (overlay.scrollWidth > overlay.clientWidth + 1) return true;
        var kids = Array.prototype.slice.call(overlay.children);
        for (var k = 0; k < kids.length; k++) {
          var r = kids[k].getBoundingClientRect();
          if (r.top < -1 || r.bottom > window.innerHeight + 1) return true;
          if (r.left < -1 || r.right > window.innerWidth + 1) return true;
        }
        if (bar) {
          var barTop = bar.getBoundingClientRect().top;
          for (var j = 0; j < kids.length; j++) {
            if (kids[j].getBoundingClientRect().bottom > barTop + 1) return true;
          }
        }
        return false;
      };

      // 4% a step, 40 steps at most — that reaches the floor from any starting
      // size, and the bound means a layout that can never fit stops rather than
      // hanging the render.
      for (var step = 0; step < 40 && doesNotFit(); step++) {
        var moved = false;
        for (var i = 0; i < scaled.length; i++) {
          var s = scaled[i];
          var now = parseFloat(getComputedStyle(s.el).fontSize);
          var next = Math.max(s.floor, now * 0.96);
          if (next < now - 0.01) { s.el.style.fontSize = next + 'px'; moved = true; }
        }
        // Everything is already as small as it is allowed to get. Shrinking
        // further would trade a clipped slide for an unreadable one, which is
        // not a trade — leave it and say so.
        if (!moved) break;
      }

      if (doesNotFit()) {
        console.warn('[slide] content still does not fit at the smallest readable size — the text is too long for one slide');
      }
    })();
  </script>

  <script>
    // Count-up animation for dollar values
    document.querySelectorAll('[data-count]').forEach(el => {
      const target = parseInt(el.getAttribute('data-count'));
      const prefix = el.textContent.trim().startsWith('$') ? '$' : '';
      const duration = 1500;
      const delay = parseFloat(el.closest('.metric').style.animationDelay) * 1000 + 600;

      el.textContent = prefix + '0';
      el.classList.add('counting');

      setTimeout(() => {
        const start = performance.now();
        function tick(now) {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = Math.round(target * eased);
          el.textContent = prefix + current.toLocaleString();
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }, delay);
    });
  </script>
</body>
</html>`
}

// Step 3: Capture frames with Puppeteer
async function captureFrames(
  html: string,
  workDir: string,
  durationSec: number,
  fps: number = 30
): Promise<string[]> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080 })

  const htmlPath = join(workDir, 'slide.html')
  await writeFile(htmlPath, html)
  await page.goto(`file://${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' })

  const totalFrames = Math.ceil(durationSec * fps)
  const framePaths: string[] = []

  for (let frame = 0; frame < totalFrames; frame++) {
    // Advance CSS animations by setting the time
    const time = (frame / fps) * 1000
    await page.evaluate((t) => {
      document.getAnimations().forEach(a => {
        a.currentTime = t
      })
    }, time)

    // Small delay to let JS count-up run
    if (frame % 5 === 0) await new Promise(r => setTimeout(r, 10))

    const framePath = join(workDir, `frame_${String(frame).padStart(5, '0')}.png`)
    await page.screenshot({ path: framePath, type: 'png' })
    framePaths.push(framePath)
  }

  await browser.close()
  return framePaths
}

// Main: generate an animated slide clip
export async function generateAnimatedSlide(
  stylePrompt: string,
  data: SlideData,
  colors: { primary: string; secondary: string; accent: string; background: string; text: string },
  audioDurationSec: number
): Promise<Buffer> {
  const workDir = join(tmpdir(), `d2v-animated-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })

  try {
    console.log('[animated] Generating background...')
    const bgBuffer = await generateBackground(stylePrompt, colors)
    const bgBase64 = bgBuffer.toString('base64')

    console.log('[animated] Building HTML...')
    const html = buildAnimatedHtml(bgBase64, data, colors, audioDurationSec)

    console.log('[animated] Capturing frames...')
    const fps = 24
    // Only animate first 4 seconds, then hold last frame for rest of duration
    const animDuration = Math.min(4, audioDurationSec)
    const framePaths = await captureFrames(html, workDir, animDuration, fps)

    // Create video from frames
    const clipPath = join(workDir, 'animated_clip.mp4')
    await runFfmpeg([
      '-framerate', String(fps),
      '-i', join(workDir, 'frame_%05d.png').replace(/\\/g, '/'),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-vf', `fps=${fps}`,
      '-y',
      clipPath,
    ])

    // If audio is longer than animation, freeze on last frame
    if (audioDurationSec > animDuration) {
      const lastFrame = framePaths[framePaths.length - 1]
      const extendedPath = join(workDir, 'extended.mp4')
      await runFfmpeg([
        '-loop', '1',
        '-i', lastFrame.replace(/\\/g, '/'),
        '-t', String(audioDurationSec - animDuration),
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-y',
        extendedPath,
      ])

      // Concat animated + frozen
      const concatFile = join(workDir, 'concat.txt')
      await writeFile(concatFile, `file '${clipPath.replace(/\\/g, '/')}'\nfile '${extendedPath.replace(/\\/g, '/')}'`)
      const finalPath = join(workDir, 'final.mp4')
      await runFfmpeg([
        '-f', 'concat', '-safe', '0',
        '-i', concatFile.replace(/\\/g, '/'),
        '-c', 'copy', '-y',
        finalPath,
      ])
      const buf = await readFile(finalPath)
      console.log(`[animated] Done: ${(buf.length / 1024).toFixed(0)}KB, ${audioDurationSec}s`)
      return buf
    }

    const buf = await readFile(clipPath)
    console.log(`[animated] Done: ${(buf.length / 1024).toFixed(0)}KB, ${animDuration}s`)
    return buf
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}
