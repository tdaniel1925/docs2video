var f=require("fs")
var c=f.readFileSync("/app/server.js","utf8")

// Add 0.5s audio delay on ALL clips to prevent audio cutoff at start
// The -af filter needs both adelay and apad combined
var old="'-af', 'apad=pad_dur=0.5', '-shortest'"
var rep="'-af', 'adelay=500|500,apad=pad_dur=0.5', '-shortest'"
if(c.includes(old)){
  c=c.replace(old, rep)
  f.writeFileSync("/app/server.js",c)
  console.log("Fixed: added 0.5s audio delay on all clips")
}else{
  console.log("ERROR: pattern not found")
}
