// Turn a generated logo into a real vector file.
//
//   node scripts/logo-vectorize.mjs
//
// This is THE question for a logo business. A PNG is not a logo — you cannot
// put it on a van, a shirt or a sign. The deliverable is an SVG whose curves
// scale to any size.
//
// It works because of the same constraint that makes the logos look expensive:
// flat, one colour, no gradient, no shadow. That is precisely the input a
// tracer handles cleanly. Ask an image model for a glossy 3D emblem and this
// step is hopeless — which is another reason the house style is non-negotiable.
//
// potrace is pure JavaScript, so it runs in the app on Vercel with no binary
// to install and no third-party service.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs'
import { posterize } from 'potrace'
import sharp from 'sharp'

const IN = '.logo-lab'
const OUT = '.logo-lab/vector'
mkdirSync(OUT, { recursive: true })

/**
 * The logo's own ink, so the vector comes back in the right colour.
 *
 * Takes the DARKEST tenth of the non-paper pixels rather than the most common
 * one. On a hairline mark most "ink" pixels are really half-ink, half-paper —
 * a 1px black line at 1024px averages to grey — so the popular colour is the
 * blur, not the ink. MERIDIAN's near-black type came back as #a8a8a8 that way.
 * The darkest pixels are the only ones that are purely the ink itself.
 */
async function inkColour(png) {
  const { data, info } = await sharp(png).resize(400, 400, { fit: 'inside' })
    .flatten({ background: '#fff' }).raw().toBuffer({ resolveWithObject: true })

  const px = []
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    if (lum > 225) continue // paper
    px.push([lum, r, g, b])
  }
  if (!px.length) return '#111111'

  px.sort((a, b) => a[0] - b[0])
  const take = px.slice(0, Math.max(1, Math.round(px.length * 0.1)))
  const avg = take.reduce((a, p) => [a[0] + p[1], a[1] + p[2], a[2] + p[3]], [0, 0, 0])
  const h = (v) => Math.round(v / take.length).toString(16).padStart(2, '0')
  return `#${h(avg[0])}${h(avg[1])}${h(avg[2])}`
}

const trace = (buf, opts) => new Promise((res, rej) =>
  posterize(buf, opts, (err, svg) => (err ? rej(err) : res(svg))))

const files = readdirSync(IN).filter((f) => f.endsWith('.png'))
console.log(`tracing ${files.length} logo(s)\n`)

for (const f of files) {
  const src = `${IN}/${f}`
  try {
    const colour = await inkColour(src)

    // Upscale before tracing. The tracer follows the pixel edge it is given,
    // so feeding it a bigger, cleaner edge is the difference between smooth
    // curves and a staircase — especially on thin serifs.
    //
    // NO normalise() HERE. It stretches the histogram, which on a pale logo
    // amplifies the near-white background's own speckle into something the
    // tracer treats as artwork. The MERIDIAN mark — hairlines on white — came
    // back as 5.9MB of grey mush because of exactly that.
    const grey = sharp(src)
      .flatten({ background: '#ffffff' })
      .resize(2048, 2048, { fit: 'inside', kernel: 'lanczos3' })
      .greyscale()

    // Pick the cut from the image's OWN levels rather than a fixed number, so
    // a pale mark and a heavy one both separate cleanly from the paper.
    const st = await grey.clone().stats()
    const ch = st.channels[0]
    const cut = Math.round(Math.min(235, Math.max(120, (ch.min + ch.mean) / 2)))

    // Threshold to hard black and white BEFORE tracing. This throws away the
    // anti-aliased fringe, which is where the speckle lives.
    const big = await grey.threshold(cut).png().toBuffer()

    let svg = await trace(big, {
      threshold: 128,
      steps: 1,          // ONE level: these are single-colour marks by design
      color: colour,
      background: 'transparent',
      turdSize: 4,       // drop specks — stray anti-alias crumbs, not artwork
      optTolerance: 0.25,
      alphaMax: 1,
    })

    const name = f.replace(/\.png$/, '')
    writeFileSync(`${OUT}/${name}.svg`, svg)

    // Render the SVG back to a picture so the result can actually be LOOKED
    // at. "It produced an SVG" says nothing about whether the curves survived.
    const check = await sharp(Buffer.from(svg), { density: 300 })
      .resize(900, 900, { fit: 'inside' })
      .flatten({ background: '#ffffff' })
      .png().toBuffer()
    writeFileSync(`${OUT}/${name}-traced.png`, check)

    const paths = (svg.match(/<path/g) || []).length
    console.log(`  ${name}  ink ${colour}  ${Math.round(svg.length / 1024)}kb  ${paths} path(s)`)
  } catch (e) {
    console.log(`  FAIL ${f}: ${String(e.message).slice(0, 90)}`)
  }
}
console.log(`\nSVGs and side-by-side renders in ${OUT}/`)
