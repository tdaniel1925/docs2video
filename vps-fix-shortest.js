var f=require("fs")
var c=f.readFileSync("/app/server.js","utf8")
var changes=0

// Fix /generate route: replace -t duration guess with -shortest + apad
var old1="const _dur=Math.ceil(require('fs').statSync(audioPath).size/24000)+1;console.log('['+videoId+'] Clip '+(i+1)+': '+_dur+'s');await runFfmpeg(['-loop', '1', '-i', slidePath, '-i', audioPath, '-c:v', 'libx264', '-tune', 'stillimage', '-g', '25', '-preset', 'ultrafast', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', vf, '-t', String(_dur), '-y', clipPath])"
var new1="await runFfmpeg(['-loop', '1', '-i', slidePath, '-i', audioPath, '-c:v', 'libx264', '-tune', 'stillimage', '-g', '25', '-preset', 'ultrafast', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', vf, '-af', 'apad=pad_dur=0.5', '-shortest', '-y', clipPath])"
if(c.includes(old1)){
  c=c.replace(old1,new1)
  changes++
  console.log("1. Fixed /generate: -shortest + apad=0.5s")
}else{
  console.log("1. WARN: /generate old string not found")
}

// Fix /assemble route too
var old2a="const rd=0;\n        const cd=Math.ceil(require('fs').statSync(audioPath).size/24000)+1;\n        console.log(`[${videoId}] Slide ${i+1}: audio=${rd.toFixed(1)}s clip=${cd.toFixed(1)}s`);\n        await runFfmpeg(["
var old2="await runFfmpeg([\n          '-loop', '1',\n          '-i', slidePath,\n          '-i', audioPath,\n          '-c:v', 'libx264',\n          '-tune', 'stillimage',\n          '-g', '25',\n          '-preset', 'ultrafast',\n          '-c:a', 'aac',\n          '-b:a', '192k',\n          '-pix_fmt', 'yuv420p',\n          '-vf', vf,\n          '-t', String(cd),\n          '-y',\n          clipPath,\n        ])"
// Try simpler match for /assemble
if(c.includes("-t', String(cd)")){
  c=c.replace("-t', String(cd)", "-af', 'apad=pad_dur=0.5', '-shortest")
  changes++
  console.log("2. Fixed /assemble: -shortest + apad=0.5s")
}

// Remove leftover rd/cd variable lines if present
c=c.replace(/\s*const rd=0;\n/g,"\n")
c=c.replace(/\s*const cd=Math\.ceil\(require\('fs'\)\.statSync\(audioPath\)\.size\/24000\)\+1;\n/g,"\n")
c=c.replace(/\s*console\.log\(`\[\$\{videoId\}\] Slide \$\{i\+1\}.*?\);\n/g,"\n")
changes++
console.log("3. Cleaned up unused rd/cd variables")

f.writeFileSync("/app/server.js",c)
console.log("Done! "+changes+" fixes")
