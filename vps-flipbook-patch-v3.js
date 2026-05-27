/**
 * VPS Flipbook Patch v3 — Fix thumbnails, audio sync, bar, logo
 *
 * DEPLOY:
 *   scp "C:\dev\1 - PrismGraphs\vps-flipbook-patch-v3.js" root@5.161.215.156:/root/
 *   docker cp /root/vps-flipbook-patch-v3.js docs2video-service:/app/patch-v3.js
 *   docker exec docs2video-service node /app/patch-v3.js
 *   docker restart docs2video-service
 *   docker logs docs2video-service --tail 5
 */

const fs = require('fs')
const serverPath = '/app/server.js'
let code = fs.readFileSync(serverPath, 'utf8')
let changes = 0

// ============================================================
// PATCH 1: Fix Supabase slide upload for flipbook arrays
// The upload loop passes slideBuffers[i] raw — when flipbook
// mode is active, that's an array not a Buffer.
// ============================================================
const oldUpload = `await supabase.storage.from('videos').upload(sp, slideBuffers[i],`
if (code.includes(oldUpload)) {
  code = code.replace(oldUpload, `await supabase.storage.from('videos').upload(sp, Array.isArray(slideBuffers[i]) ? slideBuffers[i][0] : slideBuffers[i],`)
  changes++
  console.log('1. Fixed Supabase upload for flipbook arrays (thumbnails)')
} else {
  console.log('1. SKIP: Supabase upload pattern not found')
}

// ============================================================
// PATCH 2: Fix audio duration calculation in flipbook clips
// Old: Math.ceil(audioBuffers[i].length / 24000) — wrong for MP3
// New: Use ffprobe to get actual duration
// ============================================================
const oldAudioDur = `const hasAudio = audioBuffers[i] && audioBuffers[i].length > 100
        const audioDur = hasAudio ? Math.ceil(audioBuffers[i].length / 24000) + 1 : 5`
if (code.includes(oldAudioDur)) {
  code = code.replace(oldAudioDur, `const hasAudio = audioBuffers[i] && audioBuffers[i].length > 100
        let audioDur = 5
        if (hasAudio) {
          try {
            audioDur = await new Promise((resolve) => {
              execFile('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', audioPath], { timeout: 10000 }, (err, stdout) => {
                resolve(err ? 8 : Math.ceil(parseFloat(stdout.trim()) || 8))
              })
            })
          } catch { audioDur = 8 }
        }`)
  changes++
  console.log('2. Fixed audio duration — now uses ffprobe')
} else {
  console.log('2. SKIP: audio duration pattern not found')
}

// ============================================================
// PATCH 3: Change image generation size from 1920x1088 to 1920x1080
// The flipbook frames should be 1920x1080 (standard HD)
// ============================================================
const oldSize1088 = `size: '1920x1088'`
if (code.includes(oldSize1088)) {
  // Replace all instances
  while (code.includes(oldSize1088)) {
    code = code.replace(oldSize1088, `size: '1536x1024'`)
  }
  changes++
  console.log('3. Changed image size to 1536x1024 (standard aspect)')
} else {
  console.log('3. SKIP: 1920x1088 not found (may already be fixed)')
}

// ============================================================
// PATCH 4: Fix the flipbook clip vf filter to output 1920x980
// Leave 100px at bottom for branded bar
// The scale filter needs to output 1920x980 then pad to 1920x1080
// ============================================================
const oldFlipVf = `'-filter_complex', '[0:v]' + vf + ',minterpolate=fps=12:mi_mode=blend[v]'`
if (code.includes(oldFlipVf)) {
  // Replace both instances (with audio and without)
  while (code.includes(oldFlipVf)) {
    code = code.replace(oldFlipVf, `'-filter_complex', '[0:v]scale=1920:980:force_original_aspect_ratio=decrease,pad=1920:980:(ow-iw)/2:(oh-ih)/2,minterpolate=fps=24:mi_mode=blend[v]'`)
  }
  changes++
  console.log('4. Fixed flipbook filter: 1920x980 output + fps=24 for smoother blending')
} else {
  console.log('4. SKIP: flipbook vf filter not found')
}

// Also fix legacy single-slide vf to output 1920x980
const oldLegacyVf = `const vf = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2'`
if (code.includes(oldLegacyVf)) {
  code = code.replace(oldLegacyVf, `const vf = 'scale=1920:980:force_original_aspect_ratio=decrease,pad=1920:980:(ow-iw)/2:(oh-ih)/2'`)
  changes++
  console.log('4b. Fixed legacy vf to 1920x980')
} else {
  console.log('4b. SKIP: legacy vf pattern not found')
}

// ============================================================
// PATCH 5: Add branded bottom bar compositing after each clip
// After creating each clip, composite a 100px bar at the bottom
// with company name, website, phone from the scenes data
// ============================================================
// Find where clipFiles.push(clipPath) happens and add bar compositing before it
const oldClipPush = `clipFiles.push(clipPath)

      // Get accurate duration`
if (code.includes(oldClipPush)) {
  code = code.replace(oldClipPush, `// Composite 100px branded bar at bottom of clip
      const barColor = brandColors?.primary || '#1B365D'
      const barTextColor = brandColors?.text || '#FFFFFF'
      const contactParts = []
      if (scenes[i]?.contactInfo?.company || brandName) contactParts.push(scenes[i]?.contactInfo?.company || brandName)
      if (scenes[i]?.contactInfo?.website) contactParts.push(scenes[i]?.contactInfo?.website)
      if (scenes[i]?.contactInfo?.phone) contactParts.push(scenes[i]?.contactInfo?.phone)
      if (scenes[i]?.contactInfo?.email) contactParts.push(scenes[i]?.contactInfo?.email)
      const barText = contactParts.length > 0 ? contactParts.join('  ·  ') : ''

      if (barText) {
        const barClipPath = join(workDir, 'bar_clip_' + i + '.mp4')
        try {
          // Pad video to 1920x1080 with colored bar at bottom, add text
          const barFilter = \`[0:v]pad=1920:1080:0:0:color=\${barColor.replace('#', '0x')},drawtext=text='\${barText.replace(/'/g, "\\\\'")}':fontsize=22:fontcolor=\${barTextColor.replace('#', '0x')}:x=(w-text_w)/2:y=990:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf[v]\`
          const barArgs = ['-i', clipPath, '-filter_complex', barFilter, '-map', '[v]']
          // Preserve audio if present
          const hasClipAudio = audioBuffers[i] && audioBuffers[i].length > 100
          if (hasClipAudio) barArgs.push('-map', '0:a', '-c:a', 'copy')
          else barArgs.push('-an')
          barArgs.push('-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-y', barClipPath)
          await runFfmpeg(barArgs)
          // Replace original clip with bar version
          await require('fs').promises.rename(barClipPath, clipPath)
          console.log('[' + videoId + '] Bar composited on clip ' + (i+1) + ': ' + barText)
        } catch (barErr) {
          console.error('[' + videoId + '] Bar composite failed for clip ' + (i+1) + ':', barErr.message?.slice(0, 100))
          // Continue with original clip (no bar)
        }
      }

      clipFiles.push(clipPath)

      // Get accurate duration`)
  changes++
  console.log('5. Added branded bar compositing after each clip')
} else {
  console.log('5. SKIP: clipFiles.push pattern not found')
}

// ============================================================
// PATCH 6: Pass brandName and brandColors to the clip assembly scope
// Make sure the /generate handler extracts these from the request
// ============================================================
const oldReqExtract = `const { videoId, voiceId, scenes, slidePrompts, logoUrl, musicPrompt, industry, narrationStyle`
if (code.includes(oldReqExtract)) {
  if (!code.includes('brandName, brandColors')) {
    code = code.replace(oldReqExtract, `const { videoId, voiceId, scenes, slidePrompts, logoUrl, musicPrompt, industry, narrationStyle, brandName, brandColors`)
    changes++
    console.log('6. Added brandName, brandColors to request destructuring')
  } else {
    console.log('6. SKIP: brandName/brandColors already in request')
  }
} else {
  console.log('6. SKIP: request destructuring pattern not found')
}

// Save
fs.writeFileSync(serverPath, code)
console.log('\nDone! ' + changes + ' changes applied.')
console.log('Run: docker restart docs2video-service')
