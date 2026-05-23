// Fix the podcast code in /tmp/server.js on the VPS host
const fs = require('fs')
const path = '/tmp/server.js'
let code = fs.readFileSync(path, 'utf8')

// Find the old broken podcast block and the solo TTS block, replace both
// The current state has the old podcast code (with workDir bug) + solo fallback

const oldBlock = `        // Podcast mode: generate multi-voice dialogue
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
            }`

// Check if the old block exists
if (code.includes('Podcast mode: generate multi-voice dialogue')) {
  console.log('Found old broken podcast block, removing it...')

  // Remove everything from "// Podcast mode:" to the matching else block
  // Strategy: find the podcast if block and its else, replace with clean version

  // Find start
  const startMarker = '        // Podcast mode: generate multi-voice dialogue'
  const startIdx = code.indexOf(startMarker)

  // Find the solo TTS that comes after (either in else block or standalone)
  // Look for the next "model: 'tts-1-hd'" after the podcast block
  const afterStart = code.indexOf("model: 'tts-1-hd'", startIdx)

  // Find the block that contains the solo TTS - go back to find its try {
  const soloTryIdx = code.lastIndexOf('try {', afterStart)

  // Find the end of the solo catch block
  const soloCatchStart = code.indexOf('} catch (e) {', afterStart)
  const soloCatchEnd = code.indexOf('}', code.indexOf("buffers.push(Buffer.alloc(0))", soloCatchStart)) + 1

  // Now find the closing brace of the outer if/else
  let searchFrom = soloCatchEnd
  let depth = 0
  let outerEnd = searchFrom
  // Skip whitespace and find closing braces
  for (let i = searchFrom; i < code.length; i++) {
    if (code[i] === '}') {
      outerEnd = i + 1
      break
    }
    if (code[i] !== ' ' && code[i] !== '\n' && code[i] !== '\r') break
  }

  console.log(`Removing from index ${startIdx} to ~${outerEnd + 50}`)
}

// Simpler approach: just do a string replace on the known patterns
// Remove the entire podcast+solo block and replace with clean version

// First, let's see what we're dealing with
const lines = code.split('\n')
let podcastStart = -1
let blockEnd = -1

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Podcast mode: generate multi-voice dialogue')) {
    podcastStart = i
  }
  // Find the audiosDone++ after the TTS blocks
  if (podcastStart > 0 && i > podcastStart && lines[i].includes('audiosDone++') && !lines[i].includes('//')) {
    blockEnd = i
    break
  }
}

if (podcastStart > 0 && blockEnd > 0) {
  console.log(`Found podcast block: lines ${podcastStart + 1} to ${blockEnd + 1}`)

  const newBlock = `        // Podcast mode: multi-voice dialogue using gpt-4o-mini-tts
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
            // Concatenate clips
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
            console.error(\`[\${videoId}] TTS failed for clip \${i + 1}:\`, e.message)
            buffers.push(Buffer.alloc(0))
          }
        }`

  // Replace lines podcastStart through blockEnd-1 (keep audiosDone++)
  const before = lines.slice(0, podcastStart)
  const after = lines.slice(blockEnd)
  const result = [...before, newBlock, ...after]
  code = result.join('\n')

  console.log('Replaced with clean podcast + solo block')
} else {
  console.log('ERROR: Could not find podcast block boundaries')
  console.log('podcastStart:', podcastStart, 'blockEnd:', blockEnd)
}

fs.writeFileSync(path, code, 'utf8')
console.log('Done! Now: docker cp /tmp/server.js docs2video-service:/app/server.js && docker restart docs2video-service')
