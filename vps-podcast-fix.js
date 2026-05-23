// VPS fix: Add podcast multi-voice support properly
const fs = require('fs')
const path = '/app/server.js'

let code = fs.readFileSync(path, 'utf8')

// 1. Add narrationStyle to destructured params if not already there
if (!code.includes('narrationStyle')) {
  code = code.replace(
    "const { videoId, voiceId, scenes, userId, slidePrompts, logoUrl, musicPrompt, industry } = req.body",
    "const { videoId, voiceId, scenes, userId, slidePrompts, logoUrl, musicPrompt, industry, narrationStyle } = req.body"
  )
  console.log('1. Added narrationStyle to params')
} else {
  console.log('1. narrationStyle already in params')
}

// 2. Remove the podcastWorkDir line if it exists (from failed patch)
code = code.replace(/.*podcastWorkDir.*\n/g, '')
console.log('2. Cleaned up failed patch remnants')

// 3. Find and replace the audio generation loop
// Match the existing solo TTS code inside the audioPromise
const oldTTS = `        try {
          const resp = await openai.audio.speech.create({
            model: 'tts-1-hd', voice: voiceId || 'nova',
            input: scene.narration.slice(0, 4096), response_format: 'mp3', speed: 0.95,
          })
          buffers.push(Buffer.from(await resp.arrayBuffer()))
        } catch (e) {
          console.error(\`[\${videoId}] TTS failed for clip \${i + 1}:\`, e.message)
          buffers.push(Buffer.alloc(0))
        }`

const newTTS = `        // Podcast mode: multi-voice dialogue
        if (narrationStyle === 'podcast' && scene.dialogue && scene.dialogue.length > 0) {
          try {
            const dialogueClips = []
            for (const line of scene.dialogue) {
              const resp = await openai.audio.speech.create({
                model: 'gpt-4o-mini-tts',
                voice: line.voice || 'coral',
                input: line.text.slice(0, 2000),
                instructions: line.instructions || 'Speak naturally.',
                response_format: 'mp3',
                speed: 1.0,
              })
              dialogueClips.push(Buffer.from(await resp.arrayBuffer()))
            }
            // Concatenate clips with ffmpeg
            const dDir = join(tmpdir(), \`dlg-\${randomUUID()}\`)
            await mkdir(dDir, { recursive: true })
            const cList = []
            for (let d = 0; d < dialogueClips.length; d++) {
              const cp = join(dDir, \`l\${d}.mp3\`)
              await writeFile(cp, dialogueClips[d])
              cList.push(\`file '\${cp}'\`)
            }
            const lp = join(dDir, 'list.txt')
            await writeFile(lp, cList.join('\\n'))
            const op = join(dDir, 'out.mp3')
            await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', lp, '-c', 'copy', '-y', op])
            buffers.push(await readFile(op))
            await rm(dDir, { recursive: true, force: true }).catch(() => {})
            console.log(\`[\${videoId}] Podcast audio \${i + 1}: \${scene.dialogue.length} lines\`)
          } catch (e) {
            console.error(\`[\${videoId}] Podcast TTS failed scene \${i + 1}:\`, e.message)
            // Fallback to solo
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
          // Solo narrator (default)
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
        }`

if (code.includes("model: 'tts-1-hd', voice: voiceId || 'nova'")) {
  code = code.replace(oldTTS, newTTS)
  console.log('3. Replaced TTS block with podcast support')
} else {
  console.log('WARNING: Could not find TTS block')
}

fs.writeFileSync(path, code, 'utf8')
console.log('Done! Restart: docker restart docs2video-service')
