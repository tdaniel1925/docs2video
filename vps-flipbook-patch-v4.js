/**
 * VPS Flipbook Patch v4 — Fix thumbnail upload + add debug logging
 *
 * DEPLOY:
 *   scp "C:\dev\1 - PrismGraphs\vps-flipbook-patch-v4.js" root@5.161.215.156:/root/
 *   docker cp /root/vps-flipbook-patch-v4.js docs2video-service:/app/patch-v4.js
 *   docker exec docs2video-service node /app/patch-v4.js
 *   docker restart docs2video-service
 *   docker logs docs2video-service --tail 5
 */

const fs = require('fs')
const serverPath = '/app/server.js'
let code = fs.readFileSync(serverPath, 'utf8')
let changes = 0

// ============================================================
// PATCH 1: Fix thumbnail upload — missing Array.isArray guard
// The thumbnail is slideBuffers[0] which is an array in flipbook mode
// ============================================================
const oldThumbUpload = `await supabase.storage.from('videos').upload(thumbPath, slideBuffers[0], { contentType: 'image/png', upsert: true })`
if (code.includes(oldThumbUpload)) {
  code = code.replace(oldThumbUpload, `await supabase.storage.from('videos').upload(thumbPath, Array.isArray(slideBuffers[0]) ? slideBuffers[0][0] : slideBuffers[0], { contentType: 'image/png', upsert: true })`)
  changes++
  console.log('1. Fixed thumbnail upload — Array.isArray guard added')
} else {
  console.log('1. SKIP: thumbnail upload pattern not found')
}

// ============================================================
// PATCH 2: Add debug logging to flipbook detection
// So we can see in logs whether flipbook mode triggers
// ============================================================
const oldPipelineLog = 'FULL PIPELINE:'
if (code.includes(oldPipelineLog)) {
  // Add logging after the pipeline starts to show flipbook status
  const oldLogLine = `console.log(\`[\${videoId}] FULL PIPELINE: \${scenes.length} scenes, voice=\${voiceId}, \${slidePrompts.length} prompts\`)`
  if (code.includes(oldLogLine)) {
    code = code.replace(oldLogLine, `console.log(\`[\${videoId}] FULL PIPELINE: \${scenes.length} scenes, voice=\${voiceId}, \${slidePrompts.length} prompts\`)
    console.log(\`[\${videoId}] Flipbook check: slidePrompts[0] isArray=\${Array.isArray(slidePrompts[0])}, length=\${Array.isArray(slidePrompts[0]) ? slidePrompts[0].length : 'N/A'}\`)`)
    changes++
    console.log('2. Added flipbook debug logging')
  } else {
    console.log('2. SKIP: pipeline log line not found exactly')
  }
} else {
  console.log('2. SKIP: FULL PIPELINE log not found')
}

// ============================================================
// PATCH 3: Fix brandName/brandColors extraction from request
// The v3 patch couldn't find the exact destructuring pattern.
// Let's add them separately after the destructuring.
// ============================================================
const generateHandler = `const { videoId, voiceId, scenes, slidePrompts, logoUrl, musicPrompt, industry, narrationStyle`
if (code.includes(generateHandler)) {
  // Find the closing of the destructuring
  const startIdx = code.indexOf(generateHandler)
  // Find the next line that has "= req.body" or "} = req.body"
  const afterDestructure = code.indexOf('\n', code.indexOf('req.body', startIdx))
  if (afterDestructure > -1) {
    // Insert brandName/brandColors extraction right after
    const insertPoint = code.indexOf('\n', afterDestructure)
    if (insertPoint > -1) {
      code = code.slice(0, insertPoint) + `\n    const brandName = req.body.brandName || null\n    const brandColors = req.body.brandColors || { primary: '#1B365D', secondary: '#4A90D9', text: '#FFFFFF' }` + code.slice(insertPoint)
      changes++
      console.log('3. Added brandName/brandColors extraction from request body')
    }
  }
} else {
  console.log('3. SKIP: generate handler destructuring not found')
}

// ============================================================
// PATCH 4: Increase Supabase upload size limit
// Videos over 50MB fail. Use chunked upload or increase limit.
// Add CRF compression to reduce file size.
// ============================================================
// Find the final concat/output ffmpeg command and add CRF
const oldFinalConcat = `'-c', 'copy', '-movflags', '+faststart'`
if (code.includes(oldFinalConcat)) {
  // Keep copy mode for concat (re-encoding would be too slow)
  // Instead, let's add compression to individual clips
  console.log('4. NOTE: Video size issue needs CRF on individual clips, not concat')
} else {
  console.log('4. SKIP: final concat pattern not found')
}

// ============================================================
// PATCH 5: Add CRF compression to flipbook clips to reduce size
// ============================================================
const oldFlipbookPreset = `'-c:v', 'libx264', '-preset', 'ultrafast', '-g', '50'`
if (code.includes(oldFlipbookPreset)) {
  // Replace ultrafast with fast + CRF 26 (good quality, much smaller files)
  while (code.includes(oldFlipbookPreset)) {
    code = code.replace(oldFlipbookPreset, `'-c:v', 'libx264', '-preset', 'fast', '-crf', '26', '-g', '50'`)
  }
  changes++
  console.log('5. Added CRF 26 compression to flipbook clips (smaller output)')
} else {
  console.log('5. SKIP: flipbook preset pattern not found')
}

// Save
fs.writeFileSync(serverPath, code)
console.log('\nDone! ' + changes + ' changes applied.')
console.log('Run: docker restart docs2video-service')
