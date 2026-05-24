var f=require("fs")
var c=f.readFileSync("/app/server.js","utf8")
var changes=0

// Fix: force a keyframe at the start of every clip
// Without this, -c copy concat causes slides to appear late
// because the player waits for the next keyframe at clip boundaries

// Add -g 1 (keyframe every frame for first frame) to all clip encoding
// Actually, better: use -force_key_frames 0 to force keyframe at t=0
// Simplest: set keyframe interval to 1 second with -g 25 (at 25fps)
// This ensures a keyframe within the first frame of each clip

// Replace all '-tune', 'stillimage' with '-tune', 'stillimage', '-g', '1'
// -g 1 = GOP size of 1 = every frame is a keyframe for stillimage content
// Since the image never changes, this costs almost nothing in file size
var count=0
c=c.replace(/'-tune', 'stillimage'/g, function(m){
  count++
  return "'-tune', 'stillimage', '-g', '1'"
})
if(count>0){
  changes++
  console.log("1. Added -g 1 (keyframe every frame) to "+count+" ffmpeg calls")
}

// Also fix the duration estimate while we're here
var old1="require('fs').statSync(audioPath).size/16000"
if(c.includes(old1)){
  c=c.replace(new RegExp(old1.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'),"require('fs').statSync(audioPath).size/24000")
  changes++
  console.log("2. Fixed duration estimate /16000 -> /24000")
}

// Add -preset ultrafast if not already there
if(!c.includes("'-preset', 'ultrafast'")){
  c=c.replace(/'-g', '1'/g, "'-g', '1', '-preset', 'ultrafast'")
  changes++
  console.log("3. Added -preset ultrafast")
}

f.writeFileSync("/app/server.js",c)
console.log("Done! "+changes+" fixes applied")
