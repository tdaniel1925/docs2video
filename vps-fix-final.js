const fs = require('fs')
let code = fs.readFileSync('/tmp/server.js', 'utf8')
const marker = "model: 'tts-1-hd', voice: voiceId || 'nova',"
const idx = code.indexOf(marker)
if (idx === -1) { console.log('ERROR: cannot find marker'); process.exit(1) }
const tryIdx = code.lastIndexOf('try {', idx)
const allocIdx = code.indexOf('buffers.push(Buffer.alloc(0))', idx)
const catchEnd = code.indexOf('}', allocIdx + 30)
const endIdx = catchEnd + 1
const before = code.slice(0, tryIdx)
const after = code.slice(endIdx)
const insert = `if (narrationStyle === 'podcast' && scene.dialogue && scene.dialogue.length > 0) {
          try {
            const dClips = []
            for (const line of scene.dialogue) {
              const resp = await openai.audio.speech.create({
                model: 'gpt-4o-mini-tts', voice: line.voice || 'coral',
                input: line.text.slice(0, 2000),
                instructions: line.instructions || 'Speak naturally.',
                response_format: 'mp3', speed: 1.0,
              })
              dClips.push(Buffer.from(await resp.arrayBuffer()))
            }
            const dDir = join(tmpdir(), \`dlg-\${randomUUID()}\`)
            await mkdir(dDir, { recursive: true })
            const fList = []
            for (let d = 0; d < dClips.length; d++) {
              const cp = join(dDir, \`l\${d}.mp3\`)
              await writeFile(cp, dClips[d])
              fList.push(\`file '\${cp}'\`)
            }
            await writeFile(join(dDir, 'list.txt'), fList.join('\\n'))
            const op = join(dDir, 'out.mp3')
            await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', join(dDir, 'list.txt'), '-c', 'copy', '-y', op])
            buffers.push(await readFile(op))
            await rm(dDir, { recursive: true, force: true }).catch(() => {})
          } catch (e) {
            console.error(\`[\${videoId}] Podcast TTS failed \${i + 1}:\`, e.message)
            try {
              const resp = await openai.audio.speech.create({
                model: 'tts-1-hd', voice: voiceId || 'nova',
                input: scene.narration.slice(0, 4096), response_format: 'mp3', speed: 0.95,
              })
              buffers.push(Buffer.from(await resp.arrayBuffer()))
            } catch (e2) { buffers.push(Buffer.alloc(0)) }
          }
        } else {
          try {
            const resp = await openai.audio.speech.create({
              model: 'tts-1-hd', voice: voiceId || 'nova',
              input: scene.narration.slice(0, 4096), response_format: 'mp3', speed: 0.95,
            })
            buffers.push(Buffer.from(await resp.arrayBuffer()))
          } catch (e) {
            console.error(\`[\${videoId}] TTS failed clip \${i + 1}:\`, e.message)
            buffers.push(Buffer.alloc(0))
          }
        }`
code = before + insert + after
fs.writeFileSync('/tmp/server.js', code, 'utf8')
console.log('SUCCESS: podcast TTS injected')
