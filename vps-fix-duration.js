var f=require("fs")
var c=f.readFileSync("/app/server.js","utf8")
c=c.replace(
"const cd=rd>0?rd+1.0:10;",
"const cd=Math.ceil(f.statSync(audioPath).size/16000)+1;"
)
f.writeFileSync("/app/server.js",c)
console.log("done")
