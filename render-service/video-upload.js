// =============================================================================
// SAVE A FINISHED VIDEO — one step for every render path.
//
// Supabase stops any single upload at the PROJECT limit (50 MB), whatever the
// bucket says. A 3.5-minute Drawn-slides video came out at 58.6 MB, rendered
// for 16 minutes, then failed at the very last step: "The object exceeded the
// maximum allowed size" (2026-10-17). Several render paths also ignored the
// upload error entirely, so a video could be marked complete with no file.
//
// uploadVideo(): if the file is over the limit, re-encode it to fit (bitrate
// worked out from its length — slides with slow motion look fine at the
// result), then upload and THROW on any error.
// =============================================================================

const { execFile } = require('child_process')
const { writeFile, readFile, mkdir, rm } = require('fs/promises')
const { join } = require('path')
const { tmpdir } = require('os')
const { randomUUID } = require('crypto')

const STORAGE_MAX_BYTES = 49 * 1024 * 1024   // just under Supabase's 50 MB project cap
const TARGET_BYTES = 45 * 1024 * 1024        // aim lower: x264 lands a little over target
const AUDIO_KBPS = 128

const exec = (cmd, args, timeout) => new Promise((resolve, reject) =>
  execFile(cmd, args, { timeout, maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) =>
    err ? reject(new Error(`${cmd} failed: ${err.message} ${String(stderr || '').slice(-300)}`)) : resolve(String(stdout || ''))))

/** Video bitrate (kbps) that makes `seconds` of video land near `targetBytes` with the audio. */
function fitBitrateKbps(seconds, targetBytes = TARGET_BYTES, audioKbps = AUDIO_KBPS) {
  if (!(seconds > 0)) return 0
  return Math.max(250, Math.floor((targetBytes * 8) / seconds / 1000 - audioKbps))
}

async function fitVideoForUpload(buf, tag = 'video') {
  if (buf.length <= STORAGE_MAX_BYTES) return buf
  const dir = join(tmpdir(), `d2v-fit-${randomUUID()}`)
  await mkdir(dir, { recursive: true })
  try {
    const inp = join(dir, 'in.mp4'), out = join(dir, 'out.mp4')
    await writeFile(inp, buf)
    const secs = parseFloat((await exec('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', inp], 15000)).trim())
    const kbps = fitBitrateKbps(secs)
    if (!kbps) throw new Error('could not read the video length to shrink it')
    console.log(`[${tag}] ${(buf.length / 1048576).toFixed(1)} MB is over the ${STORAGE_MAX_BYTES / 1048576} MB limit — re-encoding ${secs.toFixed(0)}s at ${kbps} kbps`)
    for (const scale of [1, 0.8]) {
      const v = Math.floor(kbps * scale)
      await exec('ffmpeg', ['-y', '-i', inp,
        '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', `${v}k`, '-maxrate', `${v}k`, '-bufsize', `${v * 2}k`, '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', `${AUDIO_KBPS}k`, '-movflags', '+faststart', out], 900000)
      const fitted = await readFile(out)
      console.log(`[${tag}] re-encoded to ${(fitted.length / 1048576).toFixed(1)} MB`)
      if (fitted.length <= STORAGE_MAX_BYTES) return fitted
    }
    throw new Error('the video is too large to save even after shrinking it')
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Upload a finished MP4 (shrunk to fit if needed). Throws on failure — never
 * let a render report success without its file. Returns the bytes uploaded.
 */
async function uploadVideo(sb, bucket, path, buf, tag = 'video') {
  const fitted = await fitVideoForUpload(buf, tag)
  const { error } = await sb.storage.from(bucket).upload(path, fitted, { contentType: 'video/mp4', upsert: true })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return fitted
}

module.exports = { uploadVideo, fitVideoForUpload, fitBitrateKbps, STORAGE_MAX_BYTES }
