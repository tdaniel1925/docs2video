import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { synthesizeSpeech } from '../../_lib/tts'
import { createAdminClient } from '../../_lib/supabase/admin'
import { execFile } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFile, mkdir, rm, readFile } from 'fs/promises'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 600

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

function getFfmpegPath(): string {
  const ext = process.platform === 'win32' ? '.exe' : ''
  return join(process.cwd(), 'node_modules', 'ffmpeg-static', `ffmpeg${ext}`)
}

function runFfmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(getFfmpegPath(), args, { maxBuffer: 100 * 1024 * 1024, timeout: 180000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`FFmpeg: ${err.message}\n${stderr}`))
      else resolve(stdout + stderr)
    })
  })
}

// The style description that gets prepended to EVERY frame for consistency
const STYLE_PREFIX = `Professional infographic illustration style. Warm, rich color palette with deep navy (#0A1628) background. Gold (#C5A55A) accents and highlights. Flat illustration style with subtle gradients and soft shadows. Clean sans-serif typography for data. Friendly, approachable characters with simple features. 1920x1080 landscape format. Fill entire canvas edge to edge. DO NOT generate any logos or brand marks.`

// Two test scenes with illustrated flipbook frames
const SCENES = [
  {
    title: 'Death Benefit — Protection Story',
    narration: "Your policy provides a death benefit of one hundred seventy-six thousand, two hundred and four dollars. Think of this as a financial safety net — no matter what happens, your family is protected.",
    frames: [
      {
        time: 0,
        prompt: `${STYLE_PREFIX} Scene: A dark stormy sky with heavy rain clouds. Lightning in the distance. An empty field with tall grass swaying in the wind. Moody, dramatic. No text, no people yet. Just the approaching storm.`,
      },
      {
        time: 1.5,
        prompt: `${STYLE_PREFIX} Scene: Same stormy sky. A family of four (mom, dad, boy, girl) standing in the field looking worried at the approaching storm. They're small figures, the storm is large and intimidating. Soft warm glow around the family contrasting with the dark sky. No text.`,
      },
      {
        time: 3,
        prompt: `${STYLE_PREFIX} Scene: A massive golden shield materializes above the family, deflecting the rain. The shield is elegant with ornate edges. The family looks up in wonder and relief. Rain bounces off the shield. The area under the shield is dry and warmly lit. No text yet.`,
      },
      {
        time: 5,
        prompt: `${STYLE_PREFIX} Scene: Close-up of the golden shield. Engraved on the shield in elegant serif font: "$176,204". Below in smaller text: "DEATH BENEFIT". The family is safe and smiling underneath. Rain still falling outside the shield but they're dry and warm. Golden light radiates from the shield.`,
      },
      {
        time: 7,
        prompt: `${STYLE_PREFIX} Scene: The storm has passed. Beautiful sunrise breaking through clouds. The golden shield has transformed into a beautiful golden archway. The family walks through it into a sunlit meadow. A clean data card in the bottom-right shows: "Death Benefit: $176,204 | Total Family Protection". Hopeful, warm, safe feeling.`,
      },
      {
        time: 9,
        prompt: `${STYLE_PREFIX} Scene: Wide shot of the sunlit meadow. The family is playing together happily. In the sky, the golden shimmer of the shield is faintly visible like a constellation, still watching over them. Elegant text at bottom: "Your family. Always protected." Data card shows: "$176,204 Death Benefit". Beautiful, emotional, reassuring.`,
      },
    ],
  },
  {
    title: 'Cash Value Growth — Garden Story',
    narration: "Your cash value grows year after year. Starting small, but with patience, it becomes something remarkable. By year ten, over one hundred sixteen thousand dollars. By year thirty, nearly seven hundred thousand.",
    frames: [
      {
        time: 0,
        prompt: `${STYLE_PREFIX} Scene: A person kneeling in a garden, planting a small golden seed in rich dark soil. A watering can nearby. A small sign in the soil reads "$10,000/year". Early morning light. Simple, hopeful beginning. Clean garden setting.`,
      },
      {
        time: 2,
        prompt: `${STYLE_PREFIX} Scene: Same garden, time has passed. A green sprout has emerged from the soil. Small leaves unfurling. A small label reads "Year 5: $48,323". The person watches with a gentle smile. Warm golden sunlight. A small butterfly nearby.`,
      },
      {
        time: 4,
        prompt: `${STYLE_PREFIX} Scene: The sprout is now a healthy young tree with spreading branches. Birds are starting to nest. Flowers bloom around the base. A wooden sign reads "Year 10: $116,371". The person leans against the tree contentedly. Beautiful afternoon light through the leaves.`,
      },
      {
        time: 6,
        prompt: `${STYLE_PREFIX} Scene: The tree is now tall and strong with a full canopy. Golden fruit hangs from the branches. A tire swing for kids. Label reads "Year 20: $355,829". The person's family has joined — kids playing around the tree. Warm, idyllic setting.`,
      },
      {
        time: 8,
        prompt: `${STYLE_PREFIX} Scene: Magnificent ancient oak tree with massive trunk and spreading golden canopy that fills most of the frame. The family is having a picnic underneath. Golden light streams through leaves. Carved into the trunk: "$693,029". A sign at the base reads "Year 30". Abundant, prosperous, beautiful.`,
      },
      {
        time: 10,
        prompt: `${STYLE_PREFIX} Scene: Zoom out to reveal the oak tree is in a beautiful estate garden with a lovely house in the background. The whole scene radiates prosperity and security. Elegant data overlay in corner shows a growth chart: Year 5 ($48K) → Year 10 ($116K) → Year 20 ($356K) → Year 30 ($693K). Title at bottom: "Your money grows while you live your life."`,
      },
    ],
  },
]

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const sceneIndex = body.scene ?? 0 // 0 = protection story, 1 = garden story, 2 = both

  const startTime = Date.now()
  const log: string[] = []
  function addLog(msg: string) {
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    console.log(`[${elapsed}s] ${msg}`)
    log.push(`[${elapsed}s] ${msg}`)
  }

  try {
    const workDir = join(tmpdir(), `flipbook-test-${randomUUID()}`)
    await mkdir(workDir, { recursive: true })

    const scenesToProcess = sceneIndex === 2 ? SCENES : [SCENES[sceneIndex]]

    // Step 1: Generate TTS
    addLog('Generating TTS narration...')
    const audioBuffers = await Promise.all(
      scenesToProcess.map(s => synthesizeSpeech(s.narration, 'onyx'))
    )
    addLog(`Audio done — ${audioBuffers.length} clips`)

    // Step 2: Generate all frames with Gemini
    const allSceneClips: string[] = []

    for (let si = 0; si < scenesToProcess.length; si++) {
      const scene = scenesToProcess[si]
      addLog(`Scene ${si + 1}: "${scene.title}" — generating ${scene.frames.length} frames...`)

      const frameBuffers: Buffer[] = []

      for (let fi = 0; fi < scene.frames.length; fi++) {
        const frame = scene.frames[fi]
        addLog(`  Frame ${fi + 1}/${scene.frames.length}...`)

        try {
          const response = await genai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: frame.prompt,
            config: {
              responseFormat: {
                image: { aspectRatio: '16:9', imageSize: '4K' },
              },
            } as any,
          })

          const parts = response.candidates?.[0]?.content?.parts ?? []
          let found = false
          for (const part of parts) {
            if (part.inlineData) {
              frameBuffers.push(Buffer.from(part.inlineData.data!, 'base64'))
              found = true
              break
            }
          }
          if (!found) {
            addLog(`  Frame ${fi + 1} — no image returned, using previous frame`)
            if (frameBuffers.length > 0) frameBuffers.push(frameBuffers[frameBuffers.length - 1])
          }
        } catch (err) {
          addLog(`  Frame ${fi + 1} FAILED: ${err instanceof Error ? err.message : 'unknown'}`)
          if (frameBuffers.length > 0) frameBuffers.push(frameBuffers[frameBuffers.length - 1])
        }
      }

      addLog(`  All ${frameBuffers.length} frames generated`)

      // Step 3: Write frames and audio, assemble with FFmpeg
      const audioPath = join(workDir, `audio_${si}.mp3`)
      await writeFile(audioPath, audioBuffers[si])

      // Calculate how long each frame should display
      const audioDuration = Math.round(audioBuffers[si].length / 16000) + 1
      const frameDuration = audioDuration / frameBuffers.length

      // Write each frame as an image
      const frameDir = join(workDir, `frames_${si}`)
      await mkdir(frameDir, { recursive: true })

      // Create concat file with each frame shown for its calculated duration
      const concatLines: string[] = []
      for (let fi = 0; fi < frameBuffers.length; fi++) {
        const framePath = join(frameDir, `frame_${fi.toString().padStart(3, '0')}.png`)
        await writeFile(framePath, frameBuffers[fi])
        concatLines.push(`file '${framePath.replace(/\\/g, '/')}'`)
        concatLines.push(`duration ${frameDuration.toFixed(2)}`)
      }
      // FFmpeg requires last file repeated
      const lastFrame = join(frameDir, `frame_${(frameBuffers.length - 1).toString().padStart(3, '0')}.png`)
      concatLines.push(`file '${lastFrame.replace(/\\/g, '/')}'`)

      const concatFile = join(workDir, `concat_${si}.txt`)
      await writeFile(concatFile, concatLines.join('\n'))

      // Assemble: frames + crossfade + audio
      const clipPath = join(workDir, `scene_${si}.mp4`)

      // Use concat demuxer for frame sequence, overlay audio
      // Add crossfade between frames using blend filter
      await runFfmpeg([
        '-f', 'concat', '-safe', '0',
        '-i', concatFile,
        '-i', audioPath,
        '-filter_complex',
        // Scale to 1080p and add slight fade between frames
        `[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,minterpolate=fps=15:mi_mode=blend[v]`,
        '-map', '[v]',
        '-map', '1:a',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
        '-c:a', 'aac', '-b:a', '192k',
        '-pix_fmt', 'yuv420p',
        '-t', String(audioDuration),
        '-y',
        clipPath,
      ])

      allSceneClips.push(clipPath)
      addLog(`  Scene ${si + 1} clip assembled`)
    }

    // Step 4: Concatenate all scene clips if multiple
    let finalPath: string
    if (allSceneClips.length === 1) {
      finalPath = allSceneClips[0]
    } else {
      finalPath = join(workDir, 'final_flipbook.mp4')
      const concatFile = join(workDir, 'final_concat.txt')
      await writeFile(concatFile, allSceneClips.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n'))
      await runFfmpeg([
        '-f', 'concat', '-safe', '0',
        '-i', concatFile,
        '-c', 'copy',
        '-movflags', '+faststart',
        '-y', finalPath,
      ])
    }

    addLog('Uploading final video...')
    const finalBuffer = await readFile(finalPath)
    const admin = createAdminClient()
    const storagePath = `test-flipbook/flipbook_${Date.now()}.mp4`
    await admin.storage.from('videos').upload(storagePath, finalBuffer, { contentType: 'video/mp4', upsert: true })
    const { data: urlData } = admin.storage.from('videos').getPublicUrl(storagePath)

    await rm(workDir, { recursive: true, force: true }).catch(() => {})

    const totalTime = Math.round((Date.now() - startTime) / 1000)
    const totalFrames = scenesToProcess.reduce((sum, s) => sum + s.frames.length, 0)
    const cost = (totalFrames * 0.03 + 0.10).toFixed(2)

    addLog(`DONE! ${totalFrames} frames, ${totalTime}s, ~$${cost}`)

    return NextResponse.json({
      videoUrl: urlData.publicUrl,
      totalTime,
      totalFrames,
      cost: `$${cost}`,
      scenes: scenesToProcess.map(s => s.title),
      log,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed'
    log.push(`ERROR: ${msg}`)
    return NextResponse.json({ error: msg, log }, { status: 500 })
  }
}
