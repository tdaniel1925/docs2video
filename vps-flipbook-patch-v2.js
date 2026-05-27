/**
 * VPS Flipbook Patch v2 — Clean surgical patch
 *
 * DEPLOY:
 *   scp "C:\dev\1 - PrismGraphs\vps-flipbook-patch-v2.js" root@5.161.215.156:/root/
 *   docker cp /root/vps-flipbook-patch-v2.js docs2video-service:/app/patch-v2.js
 *   docker exec docs2video-service node /app/patch-v2.js
 *   docker restart docs2video-service
 *   docker logs docs2video-service --tail 5
 */

const fs = require('fs')
const serverPath = '/app/server.js'
let code = fs.readFileSync(serverPath, 'utf8')
let changes = 0

// ============================================================
// PATCH 1: Add flipbook helper functions BEFORE generateOneSlide
// ============================================================
const marker1 = 'async function generateOneSlide(idx) {'
if (code.includes(marker1)) {
  const helpers = `// --- FLIPBOOK SUPPORT ---
    function isFlipbookMode(idx) {
      return Array.isArray(slidePrompts[idx])
    }

    async function generateFlipbookFrames(idx) {
      const frames = slidePrompts[idx]
      const fbufs = []
      for (let f = 0; f < frames.length; f++) {
        for (let att = 1; att <= 2; att++) {
          try {
            const resp = await openai.images.generate({ model: 'gpt-image-2', prompt: frames[f], size: '1920x1088', quality: 'high', n: 1 })
            const img = resp.data?.[0]
            if (!img?.b64_json) throw new Error('No image')
            fbufs.push(Buffer.from(img.b64_json, 'base64'))
            break
          } catch (e) {
            console.error('[' + videoId + '] Flipbook frame ' + (f+1) + ' scene ' + (idx+1) + ' attempt ' + att + ': ' + (e.message||'').slice(0,80))
            if (att === 2) fbufs.push(fbufs.length > 0 ? fbufs[fbufs.length-1] : await generateFallbackSlide(scenes[idx]?.title || 'Slide', idx+1, slidePrompts.length))
            else await new Promise(r => setTimeout(r, 2000))
          }
        }
      }
      console.log('[' + videoId + '] Flipbook scene ' + (idx+1) + ': ' + fbufs.length + ' frames')
      return fbufs
    }
    // --- END FLIPBOOK SUPPORT ---

    async function generateOneSlide(idx) {`

  code = code.replace(marker1, helpers)
  changes++
  console.log('1. Added flipbook helper functions')
} else {
  console.log('1. SKIP: generateOneSlide not found')
}

// ============================================================
// PATCH 2: Update batch loop to use flipbook when available
// ============================================================
const marker2 = `batch.push(generateOneSlide(j).then(buf => { slideBuffers[j] = buf }))`
if (code.includes(marker2)) {
  code = code.replace(marker2, `batch.push((isFlipbookMode(j) ? generateFlipbookFrames(j) : generateOneSlide(j)).then(buf => { slideBuffers[j] = buf }))`)
  changes++
  console.log('2. Updated batch loop for flipbook')
} else {
  console.log('2. SKIP: batch loop pattern not found')
}

// ============================================================
// PATCH 3: Update slide file writing to handle arrays
// ============================================================
const marker3 = "await writeFile(join(workDir, `slide_${i}.png`), slideBuffers[i])"
if (code.includes(marker3)) {
  code = code.replace(marker3, `{
        const sb = slideBuffers[i]
        await writeFile(join(workDir, \`slide_\${i}.png\`), Array.isArray(sb) ? sb[0] : sb)
      }`)
  changes++
  console.log('3. Updated slide writing for arrays')
} else {
  console.log('3. SKIP: slide write pattern not found')
}

// ============================================================
// PATCH 4: Replace clip creation to handle flipbook frames
// This is the critical change — we replace the if/else block
// that creates each clip from a single slide
// ============================================================
const oldClipBlock = `if (audioBuffers[i] && audioBuffers[i].length > 100) {
        // Add 0.3s delay before audio starts to prevent clipping
        await runFfmpeg(['-loop', '1', '-i', slidePath, '-i', audioPath, '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', vf, '-af', 'adelay=300|300', '-y', clipPath])
      } else {
        await runFfmpeg(['-loop', '1', '-i', slidePath, '-t', '5', '-c:v', 'libx264', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-vf', vf, '-an', '-y', clipPath])
      }`

if (code.includes(oldClipBlock)) {
  const newClipBlock = `if (Array.isArray(slideBuffers[i]) && slideBuffers[i].length > 1) {
        // FLIPBOOK: multiple frames per scene
        const frames = slideBuffers[i]
        const fdir = join(workDir, 'frames_' + i)
        await mkdir(fdir, { recursive: true })
        for (let f = 0; f < frames.length; f++) {
          await writeFile(join(fdir, 'f' + f + '.png'), frames[f])
        }
        const hasAudio = audioBuffers[i] && audioBuffers[i].length > 100
        const audioDur = hasAudio ? Math.ceil(audioBuffers[i].length / 24000) + 1 : 5
        const frameDur = (audioDur / frames.length).toFixed(2)
        // Build concat file for frames
        const fcLines = []
        for (let f = 0; f < frames.length; f++) {
          fcLines.push("file '" + join(fdir, 'f' + f + '.png').replace(/\\\\/g, '/') + "'")
          fcLines.push('duration ' + frameDur)
        }
        fcLines.push("file '" + join(fdir, 'f' + (frames.length-1) + '.png').replace(/\\\\/g, '/') + "'")
        await writeFile(join(fdir, 'fc.txt'), fcLines.join('\\n'))
        console.log('[' + videoId + '] Flipbook clip ' + (i+1) + ': ' + frames.length + ' frames, ' + audioDur + 's')
        if (hasAudio) {
          await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', join(fdir, 'fc.txt'), '-i', audioPath, '-filter_complex', '[0:v]' + vf + ',minterpolate=fps=12:mi_mode=blend[v]', '-map', '[v]', '-map', '1:a', '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '50', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-af', 'adelay=300|300', '-shortest', '-t', String(audioDur), '-y', clipPath])
        } else {
          await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', join(fdir, 'fc.txt'), '-filter_complex', '[0:v]' + vf + ',minterpolate=fps=12:mi_mode=blend[v]', '-map', '[v]', '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '50', '-pix_fmt', 'yuv420p', '-t', '5', '-an', '-y', clipPath])
        }
      } else if (audioBuffers[i] && audioBuffers[i].length > 100) {
        // LEGACY: single slide + audio
        await runFfmpeg(['-loop', '1', '-i', slidePath, '-i', audioPath, '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', vf, '-af', 'adelay=300|300', '-y', clipPath])
      } else {
        // LEGACY: single slide, no audio
        await runFfmpeg(['-loop', '1', '-i', slidePath, '-t', '5', '-c:v', 'libx264', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-vf', vf, '-an', '-y', clipPath])
      }`

  code = code.replace(oldClipBlock, newClipBlock)
  changes++
  console.log('4. Replaced clip creation with flipbook support')
} else {
  console.log('4. SKIP: clip block pattern not found (may have been previously patched)')
}

// Save
fs.writeFileSync(serverPath, code)
console.log('\nDone! ' + changes + ' changes applied.')
console.log('Run: docker restart docs2video-service')
