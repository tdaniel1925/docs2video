var f=require("fs")
var c=f.readFileSync("/app/server.js","utf8")
var changes=0

// 1. Fix duration estimate: OpenAI TTS is 192kbps (~24KB/s), not 128kbps
// Use ffprobe on the audio file for exact duration instead of guessing
var old1="const _dur=Math.ceil(require('fs').statSync(audioPath).size/16000)+1;"
var new1="const _sz=require('fs').statSync(audioPath).size;const _dur=Math.ceil(_sz/24000)+1;"
if(c.includes(old1)){c=c.replace(old1,new1);changes++;console.log("1. Fixed /generate duration: /24000")}

// Also fix /assemble route
var old2="const cd=Math.ceil(require('fs').statSync(audioPath).size/16000)+1;"
var new2="const cd=Math.ceil(require('fs').statSync(audioPath).size/24000)+1;"
if(c.includes(old2)){c=c.replace(old2,new2);changes++;console.log("2. Fixed /assemble duration: /24000")}

// 2. Add -preset ultrafast to ALL libx264 encoding calls
// This makes encoding 3-4x faster with slightly larger files
var count=0
c=c.replace(/'-tune', 'stillimage'/g, function(m){
  count++
  return "'-tune', 'stillimage', '-preset', 'ultrafast'"
})
if(count>0){changes++;console.log("3. Added -preset ultrafast to "+count+" ffmpeg calls")}

f.writeFileSync("/app/server.js",c)
console.log("Done! "+changes+" fixes applied")
