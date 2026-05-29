import { NextResponse } from 'next/server'
import { generateSlide } from '../../_lib/gemini'
import { synthesizeSpeech } from '../../_lib/tts'
import { createAdminClient } from '../../_lib/supabase/admin'
import { execFile } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFile, mkdir, rm, readFile } from 'fs/promises'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 300

// Ken Burns effect types
const KB_EFFECTS = {
  // Slow zoom into center
  'zoom-in': {
    zoom: "min(zoom+0.0004,1.12)",
    x: "iw/2-(iw/zoom/2)",
    y: "ih/2-(ih/zoom/2)",
  },
  // Slow zoom out from center
  'zoom-out': {
    zoom: "if(eq(on,1),1.12,max(zoom-0.0004,1.0))",
    x: "iw/2-(iw/zoom/2)",
    y: "ih/2-(ih/zoom/2)",
  },
  // Pan left to right
  'pan-right': {
    zoom: "1.08",
    x: "if(eq(on,1),0,min(x+1,iw-iw/zoom))",
    y: "ih/4-(ih/zoom/4)",
  },
  // Pan right to left
  'pan-left': {
    zoom: "1.08",
    x: "if(eq(on,1),iw-iw/zoom,max(x-1,0))",
    y: "ih/4-(ih/zoom/4)",
  },
  // Zoom into top-left quadrant (e.g., focus on a title)
  'zoom-top-left': {
    zoom: "min(zoom+0.0004,1.15)",
    x: "iw/4-(iw/zoom/4)",
    y: "ih/4-(ih/zoom/4)",
  },
  // Zoom into bottom-right (e.g., focus on CTA)
  'zoom-bottom-right': {
    zoom: "min(zoom+0.0004,1.15)",
    x: "3*iw/4-(iw/zoom/2)",
    y: "3*ih/4-(ih/zoom/2)",
  },
}

type KBEffect = keyof typeof KB_EFFECTS

function getFfmpegPath(): string {
  const ext = process.platform === 'win32' ? '.exe' : ''
  return join(process.cwd(), 'node_modules', 'ffmpeg-static', `ffmpeg${ext}`)
}

function runFfmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(getFfmpegPath(), args, { maxBuffer: 100 * 1024 * 1024, timeout: 120000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`FFmpeg: ${err.message}\n${stderr}`))
      else resolve(stdout + stderr)
    })
  })
}

export async function POST() {
  const startTime = Date.now()
  const log: string[] = []
  function addLog(msg: string) {
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    console.log(`[${elapsed}s] ${msg}`)
    log.push(`[${elapsed}s] ${msg}`)
  }

  try {
    const workDir = join(tmpdir(), `kenburns-test-${randomUUID()}`)
    await mkdir(workDir, { recursive: true })

    // 3 test scenes with different Ken Burns effects
    const scenes = [
      {
        narration: "Welcome to your policy overview. Today we'll walk through the key details of your Index Universal Life insurance policy from American General.",
        slidePrompt: "Professional title slide. Large text 'Index Universal Life' centered. Subtitle 'Policy Overview' below. 'Prepared for Mr. Client' at bottom. Deep navy (#0A1628) background with gold (#C5A55A) accent lines. Elegant serif heading. Premium corporate feel. DO NOT create logos.",
        effect: 'zoom-in' as KBEffect,
      },
      {
        narration: "Your policy provides a death benefit of one hundred seventy-six thousand dollars, with an annual premium of just ten thousand dollars paid once per year. This premium powers both your protection and your growing cash value.",
        slidePrompt: "Data slide with two large numbers side by side. Left: '$176,204' with label 'Death Benefit' and subtitle 'Total Protection'. Right: '$10,000' with label 'Annual Premium' and subtitle 'Paid Annually'. Navy background, gold data cards, clean typography. Professional financial presentation. DO NOT create logos.",
        effect: 'pan-right' as KBEffect,
      },
      {
        narration: "Your cash value grows significantly over time. By year ten, over one hundred sixteen thousand dollars. By year twenty, over three hundred fifty-five thousand. And by year thirty, your cash value could reach nearly seven hundred thousand dollars.",
        slidePrompt: "Bar chart showing cash value growth. Bars for Year 5 ($48K), Year 10 ($116K), Year 15 ($216K), Year 20 ($356K), Year 25 ($496K), Year 30 ($693K). Gold gradient bars on navy background. Clear labels above each bar. Title 'Cash Value Growth' at top. Professional chart style. DO NOT create logos.",
        effect: 'zoom-out' as KBEffect,
      },
    ]

    // Step 1: Generate TTS audio
    addLog('Generating TTS audio...')
    const audioBuffers = await Promise.all(
      scenes.map(s => synthesizeSpeech(s.narration, 'onyx'))
    )
    addLog(`Audio done — ${audioBuffers.length} clips`)

    // Step 2: Generate HIGH-RES slides (4K for Ken Burns headroom)
    addLog('Generating 4K slides with Gemini...')
    const slideBuffers: Buffer[] = []
    for (let i = 0; i < scenes.length; i++) {
      addLog(`Slide ${i + 1}/${scenes.length}...`)
      const buf = await generateSlide(
        { title: 'IUL Policy', subtitle: null, source: 'American General', keyMetrics: [], sections: [], bulletPoints: [], additionalNotes: [] },
        i, 'luxury' as any, null, null,
        { primary: '#0A1628', secondary: '#C5A55A', accent: '#FFB347', background: '#0A1628', text: '#FFFFFF' },
        scenes[i].slidePrompt, false
      )
      slideBuffers.push(buf)
    }
    addLog('Slides done')

    // Step 3: Upscale slides to 4K with Sharp for Ken Burns headroom
    addLog('Upscaling slides to 4K...')
    const sharp = (await import('sharp')).default ?? (await import('sharp'))
    const hiResBuffers: Buffer[] = []
    for (const buf of slideBuffers) {
      const upscaled = await sharp(buf)
        .resize(3840, 2160, { fit: 'fill', kernel: 'lanczos3' })
        .png()
        .toBuffer()
      hiResBuffers.push(upscaled)
    }
    addLog('Upscaling done')

    // Step 4: Apply Ken Burns effects and combine with audio
    addLog('Applying Ken Burns effects...')
    const clipPaths: string[] = []

    for (let i = 0; i < scenes.length; i++) {
      const slidePath = join(workDir, `slide_${i}.png`)
      const audioPath = join(workDir, `audio_${i}.mp3`)
      const clipPath = join(workDir, `clip_${i}.mp4`)

      await writeFile(slidePath, hiResBuffers[i])
      await writeFile(audioPath, audioBuffers[i])

      // Calculate duration from audio (add 1.5s padding)
      const audioDuration = Math.round(audioBuffers[i].length / 16000) + 2
      const totalFrames = audioDuration * 30 // 30fps

      const effect = KB_EFFECTS[scenes[i].effect]

      addLog(`Scene ${i + 1}: ${scenes[i].effect} effect, ${audioDuration}s`)

      // Apply Ken Burns: read from 4K image, output at 1080p, 30fps
      await runFfmpeg([
        '-loop', '1',
        '-i', slidePath,
        '-i', audioPath,
        '-filter_complex',
        `[0:v]zoompan=z='${effect.zoom}':x='${effect.x}':y='${effect.y}':d=${totalFrames}:s=1920x1080:fps=30[v]`,
        '-map', '[v]',
        '-map', '1:a',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '20',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-pix_fmt', 'yuv420p',
        '-t', String(audioDuration),
        '-y',
        clipPath,
      ])

      clipPaths.push(clipPath)
      addLog(`Clip ${i + 1} done`)
    }

    // Step 5: Simple concatenation (reliable)
    addLog('Concatenating clips...')

    const concatFile = join(workDir, 'concat.txt')
    const concatContent = clipPaths.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n')
    await writeFile(concatFile, concatContent)

    const finalPath = join(workDir, 'final_kenburns.mp4')
    await runFfmpeg([
      '-f', 'concat', '-safe', '0',
      '-i', concatFile,
      '-c', 'copy',
      '-movflags', '+faststart',
      '-y',
      finalPath,
    ])

    addLog('Final video assembled!')

    // Upload to Supabase
    const finalBuffer = await readFile(finalPath)
    const admin = createAdminClient()
    const storagePath = `test-kenburns/kenburns_test_${Date.now()}.mp4`
    await admin.storage.from('videos').upload(storagePath, finalBuffer, { contentType: 'video/mp4', upsert: true })
    const { data: urlData } = admin.storage.from('videos').getPublicUrl(storagePath)

    await rm(workDir, { recursive: true, force: true }).catch(() => {})

    const totalTime = Math.round((Date.now() - startTime) / 1000)
    addLog(`DONE! Total time: ${totalTime}s`)

    return NextResponse.json({
      videoUrl: urlData.publicUrl,
      totalTime,
      cost: '$0.40 (slides + TTS only, no AI video)',
      log,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed'
    log.push(`ERROR: ${msg}`)
    return NextResponse.json({ error: msg, log }, { status: 500 })
  }
}
