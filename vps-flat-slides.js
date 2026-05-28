/**
 * VPS Patch: Flat slides pipeline
 *
 * The Next.js app now sends:
 *   slidePrompts: string[]      — flat array, one prompt per slide
 *   slideNarrations: string[]   — flat array, one narration per slide (matches slidePrompts 1:1)
 *
 * This patch changes the VPS to:
 * 1. Use slideNarrations (if present) for per-slide TTS instead of scenes[i].narration
 * 2. Remove the flipbook frame-assembly code — every slide is a simple still image
 * 3. Add xfade crossfade between clips in the final concat
 *
 * DEPLOY:
 *   scp this file to VPS, docker cp, docker exec node, docker restart
 */
const fs = require('fs')
const serverPath = '/app/server.js'
let c = fs.readFileSync(serverPath, 'utf8')
let changes = 0

// ============================================================
// PATCH 1: Extract slideNarrations from request body
// ============================================================
const pipelineLog = 'FULL PIPELINE:'
const pipelineIdx = c.indexOf(pipelineLog)
if (pipelineIdx > -1) {
  const lineEnd = c.indexOf('\n', pipelineIdx)
  // Check if slideNarrations is already extracted
  if (!c.includes('slideNarrations')) {
    c = c.slice(0, lineEnd) + '\n    const slideNarrations = req.body.slideNarrations || null' + c.slice(lineEnd)
    changes++
    console.log('1. Added slideNarrations extraction from request body')
  } else {
    console.log('1. SKIP: slideNarrations already exists')
  }
} else {
  console.log('1. SKIP: FULL PIPELINE log not found')
}

// ============================================================
// PATCH 2: Update TTS generation to use per-slide narrations
// Find where audioBuffers are generated and use slideNarrations
// ============================================================
// The TTS loop generates audio from scenes[i].narration or scenes[i].dialogue
// We need to change it to use slideNarrations[i] when available
const oldTtsLoop = 'for (let i = 0; i < slidePrompts.length; i++) {'
const ttsIdx = c.indexOf(oldTtsLoop)
if (ttsIdx > -1) {
  // Find the narration text extraction within this loop
  // Look for where it gets the narration text
  const loopBlock = c.substring(ttsIdx, ttsIdx + 2000)

  // Check if it uses scenes[i] for narration
  if (loopBlock.includes('scenes[i]')) {
    // Find the narration assignment
    const narrPatterns = [
      'const narration = scenes[i]?.narration',
      'scenes[i].narration',
      'const text = scenes[i]'
    ]

    let foundNarr = false
    for (const pattern of narrPatterns) {
      const narrIdx = c.indexOf(pattern, ttsIdx)
      if (narrIdx > -1 && narrIdx < ttsIdx + 2000) {
        // Map scene index from slide index
        // slideNarrations is flat (1 per slide), scenes is by scene
        // We need to use slideNarrations[i] directly when available
        const lineStart = c.lastIndexOf('\n', narrIdx)
        const insertText = '\n      // Use per-slide narration if available (flat 1:1 mapping)\n      const slideNarration = slideNarrations ? slideNarrations[i] : null\n'
        c = c.slice(0, lineStart) + insertText + c.slice(lineStart)

        // Now replace the narration reference to prefer slideNarration
        // Find the next occurrence of the pattern after our insertion
        const newNarrIdx = c.indexOf(pattern, lineStart + insertText.length)
        if (newNarrIdx > -1) {
          const lineEnd = c.indexOf('\n', newNarrIdx)
          const oldLine = c.substring(newNarrIdx, lineEnd)
          // Replace scenes[i].narration with (slideNarration || scenes[Math.floor(...)].narration)
          c = c.substring(0, newNarrIdx) +
            oldLine.replace(/scenes\[i\](?:\?)?\.narration/g, '(slideNarration || scenes[Math.min(i, scenes.length-1)]?.narration || "")') +
            c.substring(lineEnd)
        }

        foundNarr = true
        changes++
        console.log('2. Updated TTS to use per-slide narrations when available')
        break
      }
    }

    if (!foundNarr) {
      // Fallback: try to find the TTS call and inject before it
      console.log('2. Could not find exact narration pattern, trying alternative...')
      // Look for the TTS function call
      const ttsCall = c.indexOf('openai.audio.speech.create', ttsIdx)
      if (ttsCall > -1 && ttsCall < ttsIdx + 3000) {
        console.log('2. Found TTS call at ' + ttsCall + ' — manual intervention needed')
      }
    }
  } else {
    console.log('2. SKIP: loop does not reference scenes[i]')
  }
} else {
  console.log('2. SKIP: TTS loop not found')
}

// ============================================================
// PATCH 3: Simplify clip assembly — no more flipbook, just still images
// Since each slide now has its own audio, use the simple -loop 1 approach
// for ALL slides (same as the old legacy path)
// ============================================================
const flipbookCheck = 'if (Array.isArray(slideBuffers[i]) && slideBuffers[i].length > 1) {'
if (c.includes(flipbookCheck)) {
  // The flipbook path is no longer needed — slidePrompts is now flat
  // slideBuffers[i] will always be a single Buffer, never an array
  // But we keep the Array.isArray guard just in case for backward compat
  // Just make it fall through to legacy path by setting the condition to false
  c = c.replace(flipbookCheck, 'if (false && Array.isArray(slideBuffers[i]) && slideBuffers[i].length > 1) {')
  changes++
  console.log('3. Disabled flipbook clip assembly — all slides use simple still-image path')
} else {
  console.log('3. SKIP: flipbook check not found')
}

// ============================================================
// PATCH 4: Add xfade crossfade to the final concat step
// Instead of simple concat with -c copy, re-encode with xfade transitions
// ============================================================
const oldConcat = "await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', concatFile, '-c', 'copy', '-movflags', '+faststart', '-y', outputPath])"
if (c.includes(oldConcat)) {
  const newConcat = `// Build xfade crossfade between clips
    const fadeDur = 0.4
    if (clipFiles.length <= 1) {
      // Single clip — just copy
      await runFfmpeg(['-i', clipFiles[0], '-c', 'copy', '-movflags', '+faststart', '-y', outputPath])
    } else if (clipFiles.length <= 20) {
      // Multiple clips — xfade crossfade between them
      const xfArgs = []
      for (const cf of clipFiles) { xfArgs.push('-i', cf) }

      // Build xfade filter chain
      const filterParts = []
      let prevLabel = '0:v'
      for (let x = 1; x < clipFiles.length; x++) {
        const offset = durations.slice(0, x).reduce((s, d) => s + d, 0) - fadeDur * x
        const outLabel = x === clipFiles.length - 1 ? 'vout' : 'xf' + x
        filterParts.push('[' + prevLabel + '][' + x + ':v]xfade=transition=fade:duration=' + fadeDur + ':offset=' + Math.max(0, offset).toFixed(2) + '[' + outLabel + ']')
        prevLabel = outLabel
      }

      // Concat all audio streams
      let audioConcat = ''
      for (let x = 0; x < clipFiles.length; x++) {
        audioConcat += '[' + x + ':a]'
      }
      audioConcat += 'concat=n=' + clipFiles.length + ':v=0:a=1[aout]'
      filterParts.push(audioConcat)

      xfArgs.push('-filter_complex', filterParts.join(';'))
      xfArgs.push('-map', '[vout]', '-map', '[aout]')
      xfArgs.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p')
      xfArgs.push('-c:a', 'aac', '-b:a', '192k')
      xfArgs.push('-movflags', '+faststart', '-y', outputPath)

      try {
        await runFfmpeg(xfArgs)
      } catch (xfErr) {
        console.error('[' + videoId + '] xfade failed, falling back to simple concat:', xfErr.message?.slice(0, 100))
        // Fallback to simple concat
        await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', concatFile, '-c', 'copy', '-movflags', '+faststart', '-y', outputPath])
      }
    } else {
      // Too many clips for xfade — simple concat
      await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', concatFile, '-c', 'copy', '-movflags', '+faststart', '-y', outputPath])
    }`

  c = c.replace(oldConcat, newConcat)
  changes++
  console.log('4. Added xfade crossfade (0.4s) to final clip concat')
} else {
  console.log('4. SKIP: concat command not found — may have been previously patched')
  // Try the alternate concat pattern
  const altConcat = c.indexOf("'-f', 'concat', '-safe', '0'")
  if (altConcat > -1) {
    console.log('4. NOTE: Found alternate concat pattern at position ' + altConcat + ' — check manually')
  }
}

// Save
fs.writeFileSync(serverPath, c)
console.log('\nDone! ' + changes + ' changes applied.')
console.log('Run: docker restart docs2video-service')
