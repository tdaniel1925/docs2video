var f=require("fs")
var c=f.readFileSync("/app/server.js","utf8")
var old="await runFfmpeg(['-loop', '1', '-i', slidePath, '-i', audioPath, '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', vf, '-af', 'adelay=300|300', '-y', clipPath])"
var rep="const _dur=Math.ceil(require('fs').statSync(audioPath).size/16000)+1;console.log('['+videoId+'] Clip '+(i+1)+': '+_dur+'s');await runFfmpeg(['-loop', '1', '-i', slidePath, '-i', audioPath, '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-vf', vf, '-t', String(_dur), '-y', clipPath])"
if(c.includes(old)){
c=c.replace(old,rep)
f.writeFileSync("/app/server.js",c)
console.log("FIXED /generate clip assembly")
}else{
console.log("ERROR: old string not found")
}
