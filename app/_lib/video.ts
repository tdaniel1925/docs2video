import { tmpdir } from 'os'
import { join } from 'path'
import { writeFile, mkdir, rm, readFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { execFile } from 'child_process'

function getFfmpegPath(): string {
  // Try multiple methods to find ffmpeg binary
  // Method 1: require('ffmpeg-static') returns the correct path on all platforms
  try {
    const staticPath = require('ffmpeg-static')
    if (staticPath && typeof staticPath === 'string') {
      console.log(`[ffmpeg] Found via ffmpeg-static: ${staticPath}`)
      return staticPath
    }
  } catch {}

  // Method 2: Check common paths
  const ext = process.platform === 'win32' ? '.exe' : ''
  const candidates = [
    join(process.cwd(), 'node_modules', 'ffmpeg-static', `ffmpeg${ext}`),
    join(process.cwd(), 'node_modules', '.cache', 'ffmpeg-static', `ffmpeg${ext}`),
    `/var/task/node_modules/ffmpeg-static/ffmpeg${ext}`, // Vercel serverless
    `/tmp/ffmpeg${ext}`,
  ]

  for (const p of candidates) {
    try {
      require('fs').accessSync(p, require('fs').constants.X_OK)
      console.log(`[ffmpeg] Found at: ${p}`)
      return p
    } catch {}
  }

  // Fallback
  const fallback = join(process.cwd(), 'node_modules', 'ffmpeg-static', `ffmpeg${ext}`)
  console.log(`[ffmpeg] Using fallback path: ${fallback}`)
  return fallback
}

// Run ffmpeg directly via execFile (handles spaces in paths correctly)
function runFfmpegCmd(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const ffmpegPath = getFfmpegPath()
    console.log(`[ffmpeg] Running: ${args.join(' ')}`)
    execFile(ffmpegPath, args, { maxBuffer: 50 * 1024 * 1024, timeout: 120000 }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[ffmpeg] Error:`, err.message)
        console.error(`[ffmpeg] Stderr:`, stderr)
        return reject(new Error(`FFmpeg failed: ${err.message}\n${stderr}`))
      }
      resolve(stdout + stderr)
    })
  })
}

export async function assembleVideo(
  slideBuffers: Buffer[],
  audioBuffers: Buffer[],
  watermarkText?: string,
  backgroundMusicUrl?: string
): Promise<{ videoBuffer: Buffer; durations: number[] }> {
  const workDir = join(tmpdir(), `docs2video-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })

  try {
    // Write files to disk
    for (let i = 0; i < slideBuffers.length; i++) {
      await writeFile(join(workDir, `slide_${i}.png`), slideBuffers[i])
      if (audioBuffers[i]) {
        await writeFile(join(workDir, `audio_${i}.mp3`), audioBuffers[i])
      }
    }

    // Calculate total audio duration and enforce max limit
    const totalAudioSize = audioBuffers.reduce((sum, b) => sum + b.length, 0)
    const estimatedDurationSec = totalAudioSize / 16000 // ~16KB/sec for 128kbps mp3
    const MAX_VIDEO_DURATION_SEC = 600 // 10 minutes hard cap

    if (estimatedDurationSec > MAX_VIDEO_DURATION_SEC) {
      throw new Error(`Video would be ${Math.round(estimatedDurationSec / 60)} minutes. Maximum is 10 minutes.`)
    }

    // Step 1: Create individual video clips (each slide + its audio)
    const clipFiles: string[] = []
    const durations: number[] = []

    for (let i = 0; i < slideBuffers.length; i++) {
      const clipPath = join(workDir, `clip_${i}.mp4`)
      const slidePath = join(workDir, `slide_${i}.png`)
      const audioPath = join(workDir, `audio_${i}.mp3`)

      const baseVf = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2'
      const vf = watermarkText
        ? `${baseVf},drawtext=text='${watermarkText.replace(/'/g, "\\'")}':fontsize=32:fontcolor=white@0.4:x=w-tw-40:y=h-th-30`
        : baseVf

      if (audioBuffers[i]) {
        // Create clip: slide shown for full duration of audio
        await runFfmpegCmd([
          '-loop', '1',
          '-i', slidePath,
          '-i', audioPath,
          '-c:v', 'libx264',
          '-tune', 'stillimage',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-pix_fmt', 'yuv420p',
          '-vf', vf,
          '-shortest',
          '-y',
          clipPath,
        ])
      } else {
        // No audio — show slide for 5 seconds
        await runFfmpegCmd([
          '-loop', '1',
          '-i', slidePath,
          '-t', '5',
          '-c:v', 'libx264',
          '-tune', 'stillimage',
          '-pix_fmt', 'yuv420p',
          '-vf', vf,
          '-an',
          '-y',
          clipPath,
        ])
      }

      clipFiles.push(clipPath)
      // Estimate duration from audio buffer size (~16KB/sec for 128kbps mp3)
      durations.push(audioBuffers[i] ? Math.round(audioBuffers[i].length / 16000) : 5)
    }

    // Step 2: Concatenate all clips into final video
    const concatFile = join(workDir, 'concat.txt')
    const concatContent = clipFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n')
    await writeFile(concatFile, concatContent)

    const outputPath = join(workDir, 'output.mp4')
    await runFfmpegCmd([
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
      '-c', 'copy',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ])

    // Step 3: Mix background music if provided
    let finalPath = outputPath
    if (backgroundMusicUrl) {
      try {
        console.log(`[ffmpeg] Downloading background music...`)
        const musicRes = await fetch(backgroundMusicUrl, { signal: AbortSignal.timeout(15000) })
        if (musicRes.ok) {
          const musicPath = join(workDir, 'bgmusic.mp3')
          await writeFile(musicPath, Buffer.from(await musicRes.arrayBuffer()))

          const totalDuration = durations.reduce((sum, d) => sum + d, 0)
          const fadeOutStart = Math.max(0, totalDuration - 3) // Fade out last 3 seconds

          const mixedPath = join(workDir, 'output_with_music.mp4')
          await runFfmpegCmd([
            '-i', outputPath,
            '-stream_loop', '-1',
            '-i', musicPath.replace(/\\/g, '/'),
            '-filter_complex',
            `[1:a]volume=0.12,afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutStart}:d=3,aloop=loop=-1:size=2e+09[music];[0:a][music]amix=inputs=2:duration=first[out]`,
            '-map', '0:v',
            '-map', '[out]',
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            '-y',
            mixedPath,
          ])
          finalPath = mixedPath
          console.log(`[ffmpeg] Background music mixed with 2s fade-in and 3s fade-out`)
        }
      } catch (err) {
        console.error(`[ffmpeg] Music mixing failed, using video without music:`, err)
      }
    }

    const videoBuffer = await readFile(finalPath)
    console.log(`[ffmpeg] Video assembled: ${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB`)
    return { videoBuffer, durations }
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}
