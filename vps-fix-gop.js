var f=require("fs")
var c=f.readFileSync("/app/server.js","utf8")
c=c.replace(/'-g', '1'/g, "'-g', '25'")
f.writeFileSync("/app/server.js",c)
var count=(c.match(/'-g', '25'/g)||[]).length
console.log("Fixed: changed -g 1 to -g 25 in "+count+" places")
