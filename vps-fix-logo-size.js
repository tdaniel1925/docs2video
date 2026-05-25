var f=require("fs")
var c=f.readFileSync("/app/server.js","utf8")
var changes=0

// 1. Fix logo resize — standardize to 200x120 for all slides
// Find all .resize() calls on logo and normalize
var old1=".resize(560, 320, { fit: 'inside', withoutEnlargement: true })"
if(c.includes(old1)){
  c=c.replace(new RegExp(old1.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'),
    ".resize(200, 120, { fit: 'inside', withoutEnlargement: true })")
  changes++
  console.log("1. Fixed 560x320 -> 200x120")
}

var old2=".resize(140, 80, { fit: 'inside', withoutEnlargement: true })"
if(c.includes(old2)){
  c=c.replace(new RegExp(old2.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'),
    ".resize(200, 120, { fit: 'inside', withoutEnlargement: true })")
  changes++
  console.log("2. Fixed 140x80 -> 200x120")
}

var old3=".resize(120, 120, { fit: 'inside', withoutEnlargement: true })"
if(c.includes(old3)){
  c=c.replace(new RegExp(old3.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'),
    ".resize(200, 120, { fit: 'inside', withoutEnlargement: true })")
  changes++
  console.log("3. Fixed 120x120 -> 200x120")
}

// Also check for the pattern without withoutEnlargement
var old4=".resize(560, 320, { fit: 'inside' })"
if(c.includes(old4)){
  c=c.replace(new RegExp(old4.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'),
    ".resize(200, 120, { fit: 'inside', withoutEnlargement: true })")
  changes++
  console.log("4. Fixed 560x320 (no enlarge) -> 200x120")
}

// 2. Logo composite — no pill needed, slides now have light top-right corner
// (GPT-image-2 prompt updated to include light area for logo)

// 3. Fix logo position — use consistent 20px padding from top-right
var posPatterns=[
  {old:"top: 40, left: 1920 - lw - 40", new:"top: 20, left: 1920 - lw - 20"},
  {old:"top: 15, left: 1920 - lw - 15", new:"top: 20, left: 1920 - lw - 20"},
]
for(var p of posPatterns){
  if(c.includes(p.old)){
    c=c.replace(new RegExp(p.old.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'), p.new)
    changes++
    console.log("6. Standardized logo position to top:20 right:20")
  }
}

f.writeFileSync("/app/server.js",c)
console.log("Done! "+changes+" changes applied")
