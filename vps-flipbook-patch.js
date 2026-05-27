/**
 * VPS Flipbook Patch — Transforms the /generate endpoint to support
 * illustrated flipbook-style videos with 3 frames per scene.
 *
 * DEPLOY:
 *   curl -o /root/vps-flipbook-patch.js "URL_TO_THIS_FILE"
 *   docker cp /root/vps-flipbook-patch.js docs2video-service:/app/vps-flipbook-patch.js
 *   docker exec docs2video-service node /app/vps-flipbook-patch.js
 *   docker restart docs2video-service
 */

const fs = require('fs')
const path = '/app/server.js'
let code = fs.readFileSync(path, 'utf8')
let changes = 0

// ============================================================
// CHANGE 1: Update /generate to accept slidePrompts as array-of-arrays
// Currently: slidePrompts = ['prompt1', 'prompt2', ...]
// New: slidePrompts = [['frame1a','frame1b','frame1c'], ['frame2a','frame2b','frame2c'], ...]
// Also supports legacy single-string format for backward compatibility
// ============================================================

// Find the generateOneSlide function and add flipbook support
const oldGenSlideStart = 'async function generateOneSlide(idx) {'
const oldGenSlidePrompt = 'const prompt = slidePrompts[idx]'

if (code.includes(oldGenSlideStart)) {
  // Add a new function before generateOneSlide for flipbook frame generation
  const flipbookFunction = `
    // Flipbook: detect if slidePrompts[idx] is an array (3 frames) or string (1 slide)
    function isFlipbookMode(idx) {
      return Array.isArray(slidePrompts[idx])
    }

    async function generateFlipbookFrames(idx) {
      const frames = slidePrompts[idx] // Array of 3 prompt strings
      const frameBuffers = []
      for (let f = 0; f < frames.length; f++) {
        const framePrompt = frames[f]
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const response = await openai.images.generate({
              model: 'gpt-image-2',
              prompt: framePrompt,
              size: '1920x1088',
              quality: 'high',
              n: 1,
            })
            const imageData = response.data?.[0]
            if (!imageData?.b64_json) throw new Error('No image in response')
            frameBuffers.push(Buffer.from(imageData.b64_json, 'base64'))
            break
          } catch (e) {
            console.error('[' + videoId + '] Frame ' + (f+1) + '/' + frames.length + ' scene ' + (idx+1) + ' attempt ' + attempt + ' failed:', e.message?.slice(0, 100))
            if (attempt === 2) {
              // Use previous frame as fallback, or generate a simple fallback
              if (frameBuffers.length > 0) {
                frameBuffers.push(frameBuffers[frameBuffers.length - 1])
              } else {
                frameBuffers.push(await generateFallbackSlide(scenes[idx]?.title || 'Slide ' + (idx + 1), idx + 1, slidePrompts.length))
              }
            } else {
              await new Promise(r => setTimeout(r, 2000))
            }
          }
        }
      }
      console.log('[' + videoId + '] Flipbook scene ' + (idx+1) + ': ' + frameBuffers.length + ' frames generated')
      return frameBuffers
    }

    ${oldGenSlideStart}`

  code = code.replace(oldGenSlideStart, flipbookFunction)
  changes++
  console.log('1. Added generateFlipbookFrames function')
}

// ============================================================
// CHANGE 2: Update the slide generation loop to handle both modes
// ============================================================

// Find the batch loop that calls generateOneSlide
const oldBatchLoop = `batch.push(generateOneSlide(j).then(buf => { slideBuffers[j] = buf }))`

if (code.includes(oldBatchLoop)) {
  const newBatchLoop = `batch.push((async () => {
          if (isFlipbookMode(j)) {
            slideBuffers[j] = await generateFlipbookFrames(j) // Array of 3 Buffers
          } else {
            slideBuffers[j] = await generateOneSlide(j) // Single Buffer (legacy)
          }
        })())`
  code = code.replace(oldBatchLoop, newBatchLoop)
  changes++
  console.log('2. Updated batch loop for flipbook support')
}

// ============================================================
// CHANGE 3: Update clip assembly to handle flipbook frames
// Replace the single-image clip creation with multi-frame flipbook
// ============================================================

// Find the clip creation section — the for loop that creates clips
// We need to find the pattern where it writes slide_i.png and creates clips
const oldClipSection = `if (audioBuffers[i] && audioBuffers[i].length > 100) {`

if (code.includes(oldClipSection)) {
  // Replace the entire clip creation logic
  const newClipSection = `// Check if this scene has flipbook frames (array) or single slide (buffer)
      const isFlipbook = Array.isArray(slideBuffers[i])

      if (isFlipbook && slideBuffers[i].length > 1) {
        // FLIPBOOK MODE: 3 frames → crossfade → one clip
        const frames = slideBuffers[i]
        const frameDir = join(workDir, 'frames_' + i)
        await mkdir(frameDir, { recursive: true })

        // Write each frame
        for (let f = 0; f < frames.length; f++) {
          await writeFile(join(frameDir, 'frame_' + f + '.png'), frames[f])
        }

        if (audioBuffers[i] && audioBuffers[i].length > 100) {
          // Calculate duration per frame from audio length
          const audioSize = audioBuffers[i].length
          const audioDur = Math.ceil(audioSize / 24000) + 1
          const frameDur = (audioDur / frames.length).toFixed(2)

          // Create concat file for frames
          const frameConcatLines = []
          for (let f = 0; f < frames.length; f++) {
            frameConcatLines.push("file '" + join(frameDir, 'frame_' + f + '.png').replace(/\\\\/g, '/') + "'")
            frameConcatLines.push('duration ' + frameDur)
          }
          // FFmpeg requires last file repeated
          frameConcatLines.push("file '" + join(frameDir, 'frame_' + (frames.length - 1) + '.png').replace(/\\\\/g, '/') + "'")
          await writeFile(join(frameDir, 'concat.txt'), frameConcatLines.join('\\n'))

          // Assemble flipbook clip: frames with smooth blend + audio
          const _dur = Math.ceil(audioSize / 24000) + 1
          console.log('[' + videoId + '] Flipbook clip ' + (i+1) + ': ' + frames.length + ' frames, ' + _dur + 's')
          await runFfmpeg([
            '-f', 'concat', '-safe', '0', '-i', join(frameDir, 'concat.txt'),
            '-i', audioPath,
            '-filter_complex', '[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,minterpolate=fps=12:mi_mode=blend[v]',
            '-map', '[v]', '-map', '1:a',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '50',
            '-c:a', 'aac', '-b:a', '192k',
            '-pix_fmt', 'yuv420p',
            '-af', 'adelay=300|300,apad=pad_dur=0.5',
            '-shortest',
            '-t', String(_dur),
            '-y', clipPath
          ])
        } else {
          // No audio — show frames for 5 seconds total
          const frameDur = (5 / frames.length).toFixed(2)
          const frameConcatLines = []
          for (let f = 0; f < frames.length; f++) {
            frameConcatLines.push("file '" + join(frameDir, 'frame_' + f + '.png').replace(/\\\\/g, '/') + "'")
            frameConcatLines.push('duration ' + frameDur)
          }
          frameConcatLines.push("file '" + join(frameDir, 'frame_' + (frames.length - 1) + '.png').replace(/\\\\/g, '/') + "'")
          await writeFile(join(frameDir, 'concat.txt'), frameConcatLines.join('\\n'))

          await runFfmpeg([
            '-f', 'concat', '-safe', '0', '-i', join(frameDir, 'concat.txt'),
            '-filter_complex', '[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,minterpolate=fps=12:mi_mode=blend[v]',
            '-map', '[v]',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '50',
            '-pix_fmt', 'yuv420p', '-t', '5', '-an',
            '-y', clipPath
          ])
        }
      } else {
        // LEGACY MODE: single slide image
        // Unwrap if it's a single-element array
        if (Array.isArray(slideBuffers[i])) {
          await writeFile(slidePath, slideBuffers[i][0])
        }

        if (audioBuffers[i] && audioBuffers[i].length > 100) {`

  code = code.replace(oldClipSection, newClipSection)
  changes++
  console.log('3. Added flipbook clip assembly with minterpolate blending')
}

// ============================================================
// CHANGE 4: Update logo compositing for flipbook mode
// - First scene, frame 0: logo (top-left, smaller)
// - Middle scenes: 100px bottom bar with company info (done by AI prompt, not Sharp)
// - Last scene, last frame: no bar (CTA in prompt)
// ============================================================

// Find logo compositing section
const oldLogoComposite = `if (logoBase64) {`
const logoCompIdx = code.indexOf(oldLogoComposite, code.indexOf('generateOneSlide'))

if (logoCompIdx > 0) {
  // The logo compositing happens inside generateOneSlide. For flipbook mode,
  // we handle it differently — only on first frame of first scene.
  // The flipbook frames already have "leave bottom 100px empty" in their prompts,
  // so we just need to NOT composite logo on flipbook frames.
  // The generateFlipbookFrames function doesn't call the logo code.
  // So no change needed here — flipbook frames skip logo compositing naturally.
  console.log('4. Logo compositing: flipbook frames skip logo (handled by prompts)')
  changes++
}

// ============================================================
// CHANGE 5: Update the slide writing to handle flipbook arrays
// ============================================================

const oldSlideWrite = `await writeFile(join(workDir, \`slide_\${i}.png\`), slideBuffers[i])`
if (code.includes(oldSlideWrite)) {
  const newSlideWrite = `// Write slide(s) — flipbook mode stores array, legacy stores buffer
      if (Array.isArray(slideBuffers[i])) {
        // Flipbook: write first frame as slide_i.png for thumbnail
        await writeFile(join(workDir, \`slide_\${i}.png\`), slideBuffers[i][0])
      } else {
        await writeFile(join(workDir, \`slide_\${i}.png\`), slideBuffers[i])
      }`
  code = code.replace(oldSlideWrite, newSlideWrite)
  changes++
  console.log('5. Updated slide file writing for flipbook arrays')
}

// Save
fs.writeFileSync(path, code)
console.log(`\nDone! ${changes} changes applied to ${path}`)
console.log('\nRestart the container: docker restart docs2video-service')
