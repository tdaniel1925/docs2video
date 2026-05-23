// VPS patch: Add podcast/multi-voice support using gpt-4o-mini-tts
// Usage: docker cp vps-podcast-patch.js docs2video-service:/app/patch.js
//        docker exec docs2video-service node /app/patch.js
//        docker restart docs2video-service

const fs = require('fs')
const path = '/app/server.js'

let code = fs.readFileSync(path, 'utf8')

// 1. Add narrationStyle to destructured params
code = code.replace(
  "const { videoId, voiceId, scenes, userId, slidePrompts, logoUrl, musicPrompt, industry } = req.body",
  "const { videoId, voiceId, scenes, userId, slidePrompts, logoUrl, musicPrompt, industry, narrationStyle } = req.body"
)
console.log('1. Added narrationStyle to params')

// 2. Replace the audio generation block to handle podcast mode
const oldAudioBlock = `    let audiosDone = 0
    const audioPromise = (async () => {
      const buffers = []
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i]
        if (!scene.narration?.trim()) {
          buffers.push(Buffer.alloc(0))
          audiosDone++
          continue
        }
        try {
          const resp = await openai.audio.speech.create({
            model: 'tts-1-hd', voice: voiceId || 'nova',
            input: scene.narration.slice(0, 4096), response_format: 'mp3', speed: 0.95,
          })
          buffers.push(Buffer.from(await resp.arrayBuffer()))
        } catch (e) {
          console.error(\`[\${videoId}] TTS failed for clip \${i + 1}:\`, e.message)
          buffers.push(Buffer.alloc(0))
        }
        audiosDone++
        console.log(\`[\${videoId}] Audio \${audiosDone}/\${scenes.length}\`)
      }
      console.log(\`[\${videoId}] Audio complete: \${buffers.length} clips\`)
      return buffers
    })()`

const newAudioBlock = `    let audiosDone = 0
    const audioPromise = (async () => {
      const buffers = []
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i]
        if (!scene.narration?.trim()) {
          buffers.push(Buffer.alloc(0))
          audiosDone++
          continue
        }

        // Podcast mode: generate multi-voice dialogue
        if (narrationStyle === 'podcast' && scene.dialogue && scene.dialogue.length > 0) {
          try {
            const dialogueClips = []
            for (const line of scene.dialogue) {
              const resp = await openai.audio.speech.create({
                model: 'gpt-4o-mini-tts',
                voice: line.voice || 'coral',
                input: line.text.slice(0, 2000),
                instructions: line.instructions || 'Speak naturally and conversationally.',
                response_format: 'mp3',
                speed: 1.0,
              })
              dialogueClips.push(Buffer.from(await resp.arrayBuffer()))
            }
            // Concatenate dialogue clips into one audio file using ffmpeg
            const dialogueDir = join(workDir || tmpdir(), \`dialogue_\${i}\`)
            await mkdir(dialogueDir, { recursive: true })
            const concatList = []
            for (let d = 0; d < dialogueClips.length; d++) {
              const clipPath = join(dialogueDir, \`line_\${d}.mp3\`)
              await writeFile(clipPath, dialogueClips[d])
              concatList.push(\`file '\${clipPath}'\`)
            }
            const listPath = join(dialogueDir, 'concat.txt')
            await writeFile(listPath, concatList.join('\\n'))
            const outPath = join(dialogueDir, 'combined.mp3')
            await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-y', outPath])
            buffers.push(await readFile(outPath))
            await rm(dialogueDir, { recursive: true, force: true }).catch(() => {})
          } catch (e) {
            console.error(\`[\${videoId}] Podcast TTS failed for scene \${i + 1}:\`, e.message)
            // Fallback to solo narration
            try {
              const resp = await openai.audio.speech.create({
                model: 'tts-1-hd', voice: voiceId || 'nova',
                input: scene.narration.slice(0, 4096), response_format: 'mp3', speed: 0.95,
              })
              buffers.push(Buffer.from(await resp.arrayBuffer()))
            } catch (e2) {
              buffers.push(Buffer.alloc(0))
            }
          }
        } else {
          // Solo narrator mode (default)
          try {
            const resp = await openai.audio.speech.create({
              model: 'tts-1-hd', voice: voiceId || 'nova',
              input: scene.narration.slice(0, 4096), response_format: 'mp3', speed: 0.95,
            })
            buffers.push(Buffer.from(await resp.arrayBuffer()))
          } catch (e) {
            console.error(\`[\${videoId}] TTS failed for clip \${i + 1}:\`, e.message)
            buffers.push(Buffer.alloc(0))
          }
        }
        audiosDone++
        console.log(\`[\${videoId}] Audio \${audiosDone}/\${scenes.length}\`)
      }
      console.log(\`[\${videoId}] Audio complete: \${buffers.length} clips\`)
      return buffers
    })()`

if (code.includes('let audiosDone = 0')) {
  code = code.replace(oldAudioBlock, newAudioBlock)
  console.log('2. Replaced audio generation with podcast support')
} else {
  console.log('WARNING: Could not find audio block to replace')
}

// 3. Need workDir available before audio starts (it's created later in current code)
// The podcast mode needs workDir for temp dialogue files, so we create it earlier
const oldWorkDir = "    // STAGE 3: Assemble with FFmpeg"
const newWorkDir = `    // Create workDir early (needed by podcast dialogue concatenation)
    const workDir = join(tmpdir(), \`d2v-\${randomUUID()}\`)
    await mkdir(workDir, { recursive: true })

    // STAGE 3: Assemble with FFmpeg`

if (code.includes(oldWorkDir)) {
  code = code.replace(oldWorkDir, newWorkDir)
  console.log('3. Moved workDir creation earlier')
}

// Remove the duplicate workDir creation that was in the assembly section
code = code.replace(
  /    const workDir = join\(tmpdir\(\), `d2v-\$\{randomUUID\(\)\}`\)\n    await mkdir\(workDir, \{ recursive: true \}\)\n/g,
  (match, offset) => {
    // Keep the first occurrence (our new one), remove the second
    if (code.indexOf(match) === offset) return match
    return ''
  }
)

fs.writeFileSync(path, code, 'utf8')
console.log('Patch applied! Restart: docker restart docs2video-service')
