// VPS patch: Upload music separately instead of mixing into MP4
// Usage: Copy this file to VPS, then run inside Docker:
//   docker cp vps-music-patch.js docs2video-service:/app/patch.js
//   docker exec docs2video-service node /app/patch.js
//   docker restart docs2video-service

const fs = require('fs')
const path = '/app/server.js'

let code = fs.readFileSync(path, 'utf8')

// 1. Add musicPublicUrl variable before "let musicSaved = false"
code = code.replace(
  'let musicSaved = false',
  'let musicPublicUrl = null\n        let musicSaved = false'
)

// 2. Replace the FFmpeg music mixing block with separate upload
const oldMixBlock = `            // Mix music under narration
            await updateStatus('assembling', 'Mixing background music...', 91)
            const fadeOutStart = Math.max(0, totalDurationEst - 3)
            const mixedPath = join(workDir, 'output_with_music.mp4')
            await runFfmpeg([
              '-i', outputPath,
              '-stream_loop', '-1',
              '-i', musicPath,
              '-filter_complex',
              \`[1:a]volume=0.07,afade=t=in:st=0:d=2,afade=t=out:st=\${fadeOutStart}:d=3[music];[0:a][music]amix=inputs=2:duration=first[out]\`,
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
            musicSaved = true
            console.log(\`[\${videoId}] Music mixed successfully\`)`

const newUploadBlock = `            // Upload music separately for frontend volume control
            await updateStatus('assembling', 'Uploading background music...', 91)
            const musicStoragePath = \`\${userId}/\${videoId}_music.mp3\`
            const musicBuffer = await readFile(musicPath)
            await supabase.storage.from('videos').upload(musicStoragePath, musicBuffer, { contentType: 'audio/mpeg', upsert: true })
            const { data: musicUrlData } = supabase.storage.from('videos').getPublicUrl(musicStoragePath)
            musicPublicUrl = musicUrlData.publicUrl
            musicSaved = true
            console.log(\`[\${videoId}] Music uploaded separately: \${musicPublicUrl}\`)`

if (code.includes('Mix music under narration')) {
  code = code.replace(oldMixBlock, newUploadBlock)
  console.log('Replaced music mixing block with separate upload')
} else {
  console.log('WARNING: Could not find music mixing block - may already be patched')
}

// 3. Add music_url to the DB completion update
code = code.replace(
  'slide_urls: slideUrls,\n        status:',
  'slide_urls: slideUrls,\n        music_url: musicPublicUrl,\n        status:'
)
console.log('Added music_url to DB update')

fs.writeFileSync(path, code, 'utf8')
console.log('Patch applied successfully! Restart the container: docker restart docs2video-service')
