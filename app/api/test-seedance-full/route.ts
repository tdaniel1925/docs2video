import { NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'
import { generateSlide } from '../../_lib/gemini'
import { synthesizeSpeech } from '../../_lib/tts'
import { assembleVideo } from '../../_lib/video'
import { createAdminClient } from '../../_lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 600 // 10 min — this is a long test

fal.config({ credentials: process.env.FAL_KEY! })

const SCENES = [
  {
    title: 'Title Card',
    narration: 'Welcome. Today we are walking you through an Index Universal Life insurance policy. This video will explain exactly how your coverage works, what it costs, and how your cash value grows over time.',
    slidePrompt: 'Professional title slide for a life insurance policy overview. Show "Index Universal Life" as the main title, "Policy Overview" as subtitle, "Prepared for Mr. Client" at the bottom. Use deep navy and gold color scheme with elegant typography. Clean, premium, corporate feel.',
    animate: true,
    animationPrompt: 'Cinematic reveal animation of @Image1. The title text fades in with an elegant sweep from left to right. Subtle golden particle effects drift across the dark background. A soft camera push-in creates depth. Premium, corporate video intro feel. Sync to @Audio1.',
  },
  {
    title: 'Death Benefit',
    narration: 'Your policy provides a death benefit of one hundred seventy-six thousand, two hundred and four dollars. This is the guaranteed amount your family would receive, providing crucial financial protection when they need it most.',
    slidePrompt: 'Data slide showing death benefit prominently. Large number "$176,204" in the center. Label "Death Benefit" above. Subtitle "Total Family Protection" below. Use deep navy background with gold accent line. Clean, large typography. Professional financial presentation style.',
    animate: false,
  },
  {
    title: 'Premium & Payment',
    narration: 'Your annual premium is ten thousand dollars, paid once per year. This premium powers both your life insurance protection and builds cash value over time, creating a financial asset that grows year after year.',
    slidePrompt: 'Data slide showing premium details. "$10,000" as the large number. "Annual Premium" label. Show payment mode "Annual" and a simple visual comparing premium paid vs protection received. Navy and gold theme. Clean corporate style.',
    animate: false,
  },
  {
    title: 'Cash Value Growth',
    narration: 'Here is where it gets exciting. Your cash value grows significantly over time. By year five, you will have over forty-eight thousand dollars. By year fifteen, over two hundred sixteen thousand. And by year thirty, your cash value could reach nearly seven hundred thousand dollars.',
    slidePrompt: 'Chart slide showing cash value growth. Bar chart with these values: Year 1: $8,413 | Year 5: $48,323 | Year 10: $116,371 | Year 15: $216,429 | Year 20: $355,829 | Year 25: $496,114 | Year 30: $693,029. Make bars grow from left to right with gold gradient fill on navy background. Large clear labels.',
    animate: true,
    animationPrompt: 'Smoothly animate the bar chart in @Image1. Each bar should grow upward one after another from left to right with a satisfying motion. Numbers appear above each bar as it reaches full height. The growth feels impressive and upward-trending. Keep exact layout and colors from the image. Sync timing to @Audio1.',
  },
  {
    title: 'Closing CTA',
    narration: 'Thank you for taking the time to review this policy overview. If you have any questions or would like to discuss the details further, please do not hesitate to reach out. We are here to help you make the best decision for your family.',
    slidePrompt: 'Closing slide with call to action. "Ready to discuss?" as heading. "Contact your advisor" as subheading. Show a checkmark list of 3 key benefits: "Death Benefit: $176,204", "Growing Cash Value", "Flexible Premium Options". Navy and gold theme. Professional, warm, inviting. "Powered by Docs2Video" in small footer text.',
    animate: true,
    animationPrompt: 'Elegant closing animation of @Image1. The heading fades in first, then each benefit line appears one by one with a subtle slide-in from the right. A soft golden glow pulses behind the contact section. The "Powered by" footer gently fades in last. Warm, professional, inviting feel. Sync to @Audio1.',
  },
]

async function animateWithSeedance(slideImageUrl: string, audioUrl: string | null, prompt: string, duration: string): Promise<Buffer> {
  const input: any = {
    prompt,
    image_urls: [slideImageUrl],
    resolution: '1080p',
    duration,
    generate_audio: false, // we have our own TTS
  }

  if (audioUrl) {
    input.audio_urls = [audioUrl]
  }

  console.log(`[seedance] Submitting reference-to-video (${duration}s, 1080p)...`)
  const startTime = Date.now()

  const result = await fal.subscribe('bytedance/seedance-2.0/reference-to-video', {
    input,
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === 'IN_PROGRESS') {
        const elapsed = Math.round((Date.now() - startTime) / 1000)
        console.log(`[seedance] ${elapsed}s — ${update.logs?.slice(-1)[0]?.message ?? 'processing...'}`)
      }
    },
  })

  const videoUrl = result.data?.video?.url
  if (!videoUrl) throw new Error('Seedance returned no video URL')

  console.log(`[seedance] Done in ${Math.round((Date.now() - startTime) / 1000)}s`)

  // Download the video
  const res = await fetch(videoUrl)
  return Buffer.from(await res.arrayBuffer())
}

export async function POST() {
  const startTime = Date.now()
  const log: string[] = []

  function addLog(msg: string) {
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    const line = `[${elapsed}s] ${msg}`
    console.log(line)
    log.push(line)
  }

  try {
    addLog('Starting full Seedance video test...')

    // Step 1: Generate all TTS audio in parallel
    addLog('Generating TTS audio for all 5 scenes...')
    const audioBuffers = await Promise.all(
      SCENES.map(scene => synthesizeSpeech(scene.narration, 'onyx'))
    )
    addLog(`Audio done — ${audioBuffers.length} clips`)

    // Step 2: Upload audio to Supabase so we have URLs for Seedance
    addLog('Uploading audio clips to storage...')
    const admin = createAdminClient()
    const audioUrls: string[] = []
    for (let i = 0; i < audioBuffers.length; i++) {
      const path = `test-seedance/audio_${i}_${Date.now()}.mp3`
      await admin.storage.from('videos').upload(path, audioBuffers[i], { contentType: 'audio/mpeg', upsert: true })
      const { data } = admin.storage.from('videos').getPublicUrl(path)
      audioUrls.push(data.publicUrl)
    }
    addLog('Audio uploaded')

    // Step 3: Generate slide images
    addLog('Generating slide images with Gemini...')
    const slideBuffers: Buffer[] = []
    for (let i = 0; i < SCENES.length; i++) {
      addLog(`Generating slide ${i + 1}/${SCENES.length}: ${SCENES[i].title}`)
      const buf = await generateSlide(
        { title: 'IUL Policy Overview', subtitle: 'Prepared for Mr. Client', source: 'American General', keyMetrics: [], sections: [], bulletPoints: [], additionalNotes: [] },
        i, 'luxury' as any, null, null,
        { primary: '#1B365D', secondary: '#C5A55A', accent: '#FFB347', background: '#0a1628', text: '#FFFFFF' },
        SCENES[i].slidePrompt, false
      )
      slideBuffers.push(buf)
    }
    addLog(`Slides done — ${slideBuffers.length} images`)

    // Step 4: Upload slide images to get URLs for Seedance
    addLog('Uploading slides to storage...')
    const slideUrls: string[] = []
    for (let i = 0; i < slideBuffers.length; i++) {
      const path = `test-seedance/slide_${i}_${Date.now()}.png`
      await admin.storage.from('videos').upload(path, slideBuffers[i], { contentType: 'image/png', upsert: true })
      const { data } = admin.storage.from('videos').getPublicUrl(path)
      slideUrls.push(data.publicUrl)
    }
    addLog('Slides uploaded')

    // Step 5: For animated scenes, send to Seedance; for static, keep as-is
    addLog('Processing scenes (animated + static)...')
    const finalClipBuffers: Buffer[] = []

    for (let i = 0; i < SCENES.length; i++) {
      const scene = SCENES[i]

      if (scene.animate && scene.animationPrompt) {
        // Seedance animated clip
        const audioDuration = Math.round(audioBuffers[i].length / 16000) + 1
        const clipDuration = String(Math.min(Math.max(audioDuration, 4), 15))
        addLog(`Scene ${i + 1} "${scene.title}" → Seedance animation (${clipDuration}s)...`)

        try {
          const animatedClip = await animateWithSeedance(
            slideUrls[i],
            null,  // Don't pass audio to Seedance — we overlay TTS in FFmpeg
            scene.animationPrompt,
            clipDuration
          )
          finalClipBuffers.push(animatedClip)
          addLog(`Scene ${i + 1} animated successfully`)
        } catch (err) {
          addLog(`Scene ${i + 1} Seedance FAILED: ${err instanceof Error ? err.message : 'unknown'} — falling back to static`)
          // Fallback: use static slide
          finalClipBuffers.push(slideBuffers[i])
        }
      } else {
        // Static slide — will be assembled with audio by FFmpeg
        addLog(`Scene ${i + 1} "${scene.title}" → static slide`)
        finalClipBuffers.push(slideBuffers[i])
      }
    }

    // Step 6: Assemble final video with FFmpeg
    // For Seedance clips (MP4), we need to handle differently than static slides (PNG)
    // The simplest approach: use assembleVideo which handles both
    addLog('Assembling final video with FFmpeg...')

    // For scenes that were animated by Seedance, we have MP4 buffers (with audio baked in)
    // For static scenes, we have PNG buffers + separate audio
    // Let's write them all as clips and concatenate

    const { execFile } = await import('child_process')
    const { tmpdir } = await import('os')
    const { join } = await import('path')
    const { writeFile, mkdir, rm, readFile } = await import('fs/promises')
    const { randomUUID } = await import('crypto')

    const workDir = join(tmpdir(), `seedance-test-${randomUUID()}`)
    await mkdir(workDir, { recursive: true })

    const clipPaths: string[] = []

    // Get FFmpeg path
    const ext = process.platform === 'win32' ? '.exe' : ''
    const ffmpegPath = join(process.cwd(), 'node_modules', 'ffmpeg-static', `ffmpeg${ext}`)

    function runFfmpeg(args: string[]): Promise<void> {
      return new Promise((resolve, reject) => {
        execFile(ffmpegPath, args, { maxBuffer: 100 * 1024 * 1024, timeout: 120000 }, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    }

    for (let i = 0; i < SCENES.length; i++) {
      const scene = SCENES[i]
      const clipPath = join(workDir, `clip_${i}.mp4`)

      if (scene.animate) {
        // Seedance clip is MP4 — strip its audio and overlay our TTS audio
        const seedancePath = join(workDir, `seedance_${i}.mp4`)
        const audioPath = join(workDir, `audio_${i}.mp3`)
        await writeFile(seedancePath, finalClipBuffers[i])
        await writeFile(audioPath, audioBuffers[i])

        // Re-encode: take VIDEO from Seedance, AUDIO from our TTS
        const reEncodedPath = join(workDir, `clip_${i}_re.mp4`)
        await runFfmpeg([
          '-i', seedancePath,         // input 0: Seedance video
          '-i', audioPath,            // input 1: our TTS audio
          '-map', '0:v',              // use video from input 0
          '-map', '1:a',              // use audio from input 1
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
          '-c:a', 'aac', '-b:a', '192k',
          '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
          '-r', '30', '-pix_fmt', 'yuv420p',
          '-shortest',                // end when shorter track ends
          '-y', reEncodedPath,
        ])
        clipPaths.push(reEncodedPath)
      } else {
        // Static slide + audio
        const slidePath = join(workDir, `slide_${i}.png`)
        const audioPath = join(workDir, `audio_${i}.mp3`)
        await writeFile(slidePath, slideBuffers[i])
        await writeFile(audioPath, audioBuffers[i])

        const audioDuration = Math.round(audioBuffers[i].length / 16000) + 2

        await runFfmpeg([
          '-loop', '1',
          '-i', slidePath,
          '-i', audioPath,
          '-c:v', 'libx264', '-tune', 'stillimage',
          '-c:a', 'aac', '-b:a', '192k',
          '-pix_fmt', 'yuv420p',
          '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
          '-t', String(audioDuration),
          '-r', '30',
          '-y', clipPath,
        ])
        clipPaths.push(clipPath)
      }
      addLog(`Clip ${i + 1} ready`)
    }

    // Concatenate all clips
    const concatFile = join(workDir, 'concat.txt')
    const concatContent = clipPaths.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n')
    await writeFile(concatFile, concatContent)

    const outputPath = join(workDir, 'final_output.mp4')
    await runFfmpeg([
      '-f', 'concat', '-safe', '0',
      '-i', concatFile,
      '-c', 'copy',
      '-movflags', '+faststart',
      '-y', outputPath,
    ])

    addLog('Final video assembled!')

    // Upload to Supabase
    const finalBuffer = await readFile(outputPath)
    const finalPath = `test-seedance/full_test_${Date.now()}.mp4`
    await admin.storage.from('videos').upload(finalPath, finalBuffer, { contentType: 'video/mp4', upsert: true })
    const { data: finalUrl } = admin.storage.from('videos').getPublicUrl(finalPath)

    // Cleanup
    await rm(workDir, { recursive: true, force: true }).catch(() => {})

    const totalTime = Math.round((Date.now() - startTime) / 1000)
    addLog(`DONE! Total time: ${totalTime}s`)
    addLog(`Video URL: ${finalUrl.publicUrl}`)

    return NextResponse.json({
      videoUrl: finalUrl.publicUrl,
      totalTime,
      log,
      scenes: SCENES.map((s, i) => ({
        title: s.title,
        animated: s.animate,
      })),
    })
  } catch (err) {
    addLog(`FATAL ERROR: ${err instanceof Error ? err.message : 'unknown'}`)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Test failed', log }, { status: 500 })
  }
}
