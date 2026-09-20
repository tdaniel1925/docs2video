const fs = require('fs')
const f = 'src/DirectedVideo.tsx'
let s = fs.readFileSync(f, 'utf8')
if (!s.includes('setAssetBase')) {
  s = s.replace(/import \{([^}]*)\} from 'remotion'/, (m, names) => {
    const list = names.split(',').map((x) => x.trim()).filter((x) => x && x !== 'staticFile')
    return `import { ${list.join(', ')} } from 'remotion'\nimport { staticFile, setAssetBase } from './lib/asset'`
  })
  s = s.replace("export type DirectedProps = { plan: DirPlan;", "export type DirectedProps = { assetBase?: string; plan: DirPlan;")
  const m = s.match(/export const DirectedVideo: React\.FC<[^>]*> = \((\w+)\) => \{/)
  if (!m) { console.log('MISS DirectedVideo component signature'); process.exit(1) }
  s = s.replace(m[0], `${m[0]}\n  setAssetBase(${m[1]}?.assetBase)`)
  fs.writeFileSync(f, s)
}
console.log('DirectedVideo patched:', s.includes('setAssetBase(') && s.includes("from './lib/asset'"))
