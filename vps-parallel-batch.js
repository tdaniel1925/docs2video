var f=require("fs")
var c=f.readFileSync("/app/server.js","utf8")
var changes=0

// 1. Increase slide batch size from 7 to 10
var old1="const BATCH_SIZE = 7"
if(c.includes(old1)){
  c=c.replace(old1,"const BATCH_SIZE = 10")
  changes++
  console.log("1. Slide batch: 7 -> 10")
}

// 2. Parallelize audio generation
// Find the sequential audio loop and replace with parallel
var oldAudioLoop=`      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i]
        if (!scene.narration?.trim()) {
          buffers.push(Buffer.alloc(0))
          audiosDone++
          continue
        }`

var newAudioLoop=`      // Parallel audio generation (batch of 10)
      const audioPromises = scenes.map(async (scene, i) => {
        if (!scene.narration?.trim()) {
          audiosDone++
          return Buffer.alloc(0)
        }`

if(c.includes(oldAudioLoop)){
  c=c.replace(oldAudioLoop, newAudioLoop)
  changes++
  console.log("2. Replaced sequential audio loop with parallel map")
}

// 3. Fix the end of the audio loop — change push to return + await all
// Find the closing of the audio for loop and replace
var oldAudioEnd=`        audiosDone++
        console.log(\`[\${videoId}] Audio \${audiosDone}/\${scenes.length}\`)
      }
      console.log(\`[\${videoId}] Audio complete: \${buffers.length} clips\`)
      return buffers`

var newAudioEnd=`        audiosDone++
        console.log(\`[\${videoId}] Audio \${audiosDone}/\${scenes.length}\`)
        return audioBuf
      })
      const results = await Promise.all(audioPromises)
      buffers.push(...results)
      console.log(\`[\${videoId}] Audio complete: \${buffers.length} clips (parallel)\`)
      return buffers`

if(c.includes(oldAudioEnd)){
  c=c.replace(oldAudioEnd, newAudioEnd)
  changes++
  console.log("3. Audio results collected via Promise.all")
}else{
  // Try simpler match — the audio loop might have different formatting
  // Find "audiosDone++" near end of loop and the "return buffers"
  console.log("3. WARN: Could not find exact audio loop end pattern")
  console.log("   Audio parallelization may need manual review")
}

// 4. Fix audio variable names — in parallel, each promise returns the buffer
// The individual TTS calls use buffers.push() which won't work in parallel
// We need to change buffers.push(audioBuf) to return audioBuf
var pushCount = 0
// Replace all "buffers.push(" inside the audio generation with "return ("
// But only within the audio promise section
// This is tricky — let's just check if the parallel pattern is in place
if(c.includes("const audioPromises = scenes.map")){
  // Replace buffers.push(Buffer.alloc(0)) with return Buffer.alloc(0) inside the map
  // But only the ones inside the audioPromises map, not elsewhere
  // Since we already changed the loop start, the push calls inside should become returns
  // Let's do targeted replacements
  var section = c.indexOf("const audioPromises = scenes.map")
  var sectionEnd = c.indexOf("const results = await Promise.all(audioPromises)")
  if(section > -1 && sectionEnd > -1){
    var audioSection = c.slice(section, sectionEnd)
    var fixedSection = audioSection.replace(/buffers\.push\(/g, "return (")
    // Remove trailing ) that was part of push
    // Actually buffers.push(X) becomes return (X) which is fine
    c = c.slice(0, section) + fixedSection + c.slice(sectionEnd)
    pushCount = (audioSection.match(/buffers\.push\(/g)||[]).length
    if(pushCount > 0){
      changes++
      console.log("4. Replaced " + pushCount + " buffers.push() with return() in audio section")
    }
  }
}

f.writeFileSync("/app/server.js", c)
console.log("Done! " + changes + " changes applied")
