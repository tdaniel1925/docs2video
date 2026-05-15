/**
 * Generate 20 new template preview images using Gemini image generation.
 * Run: node scripts/generate-style-previews.js
 */
require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const path = require('path')
const { GoogleGenAI } = require('@google/genai')

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const MODEL = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview'

const CONTENT = 'Document Overview — Key Metrics: Revenue $2.5M, Growth 32%, Team Size 48. Show 4-5 data sections with icons.'
const SUFFIX = 'MUST be EXACTLY 1920x1080 16:9 landscape. Fill entire canvas. DO NOT create any company logos or brand marks.'

const styles = [
  { id: 'stock-certificate', prompt: 'Ornate stock certificate design. Cream/ivory parchment background, elaborate engraved border patterns in dark green and gold, classical serif typography, embossed seal effects, fine line engravings of allegorical figures in corners, guilloché patterns, old-world financial document aesthetic. Feels prestigious, official, valuable.' },
  { id: 'vintage-bond', prompt: 'Aged government bond document style. Yellowed antique paper texture, intricate copper-plate engraving illustrations, classical Roman typography, wax seal marks, decorative rosette patterns, aged ink effects. Feels historical, authoritative, collectible.' },
  { id: 'art-deco', prompt: 'Art Deco poster design from 1920s. Black background with bold geometric gold patterns, symmetrical sunburst motifs, tall elegant typefaces, chrome and gold metallic accents, Gatsby-era luxury. Sharp angles, chevrons, and fan shapes. Feels glamorous, sophisticated, timeless.' },
  { id: 'marble-gold', prompt: 'White Carrara marble texture background with thin gold vein lines running through. Elegant gold leaf accents, premium serif typography, generous whitespace, subtle embossed effects. Luxury real estate brochure aesthetic. Feels opulent, refined, high-end.' },
  { id: 'nightclub-flyer', prompt: 'Nightclub event flyer design. Pure black background with electric neon pink, cyan, and purple glow effects. Bold condensed sans-serif typography, lens flare effects, smoke/fog atmosphere, DJ booth silhouette elements. High energy, high contrast. Feels exciting, vibrant, party-ready.' },
  { id: 'concert-poster', prompt: 'Rock concert poster design. Dark grungy textured background with distressed effects, bold blocky typography in red and white, torn paper edges, halftone dot patterns, vintage microphone and guitar silhouettes. Punk/indie rock aesthetic. Feels raw, energetic, underground.' },
  { id: 'movie-poster', prompt: 'Cinematic movie poster design. Deep blue-black background with dramatic orange/teal color grading, large cinematic title treatment, film grain texture, dramatic spotlight lighting from below, silhouetted figures, aspect ratio bars. Hollywood blockbuster feel. Feels epic, dramatic, premium.' },
  { id: 'festival', prompt: 'Music festival poster design. Psychedelic flowing gradients in sunset colors (pink, orange, purple, gold), wavy organic typography, fluid blob shapes, retro 70s psychedelic patterns, peace symbols, flower motifs. Feels free-spirited, colorful, dreamy.' },
  { id: 'medical-journal', prompt: 'Medical journal article layout. Clean white background, clinical teal/green accent color, anatomical line drawings, precise data tables, clean sans-serif body text with serif headings, subtle grid lines, pill capsule and DNA helix decorative elements. Feels scientific, trustworthy, precise.' },
  { id: 'legal-brief', prompt: 'Legal document style. Off-white/cream paper background, dark navy text, thin formal borders, section numbering (I, II, III), serif fonts throughout (like Times New Roman but elegant), paragraph indentation, footnote markers, scales of justice watermark at 5% opacity. Feels authoritative, formal, institutional.' },
  { id: 'scientific-paper', prompt: 'Scientific research poster design. White background with navy/dark blue headers, multi-column layout, embedded scatter plots and bar charts in muted colors, citation numbers, Greek letter symbols (α, β, Σ), molecular structure diagrams as decorative elements. Academic conference poster aesthetic. Feels rigorous, scholarly, data-driven.' },
  { id: 'collage-scrapbook', prompt: 'Mixed media scrapbook collage style. Kraft paper background, torn paper edges revealing layers underneath, washi tape strips in pastel colors, polaroid-style photo frames, hand-written annotations, sticker effects, pushpin graphics, string connecting elements. Feels creative, personal, handmade.' },
  { id: 'comic-book', prompt: 'Comic book page design. Bold black outlines, halftone Ben-Day dots pattern, speech bubble shapes for data callouts, action lines radiating from key numbers, POW/BAM style burst shapes for highlights, primary colors (red, blue, yellow) on white. Panel grid layout. Feels fun, dynamic, pop-art.' },
  { id: 'chalkboard-v2', prompt: 'Classroom chalkboard design. Dark green/black chalkboard texture background, chalk-style hand-drawn text in white and colored chalk (yellow, pink, blue), chalk dust effects, sketchy arrows and underlines, eraser smudge marks, wooden frame border at edges. Feels educational, nostalgic, approachable.' },
  { id: 'glassmorphism', prompt: 'Glassmorphism UI design. Vibrant gradient background (purple to blue to pink), frosted glass cards with 40% transparency and blur backdrop, thin white 1px borders on cards, subtle shadow beneath each card, rounded corners, modern SF Pro style typography in white. Feels futuristic, clean, Apple-inspired.' },
  { id: 'neubrutalism', prompt: 'Neubrutalist web design. Off-white background, thick 3-4px black borders on every element, harsh drop shadows offset to bottom-right, raw primary colors (bright yellow, electric blue, hot pink), deliberately clunky typography mixing serif and sans-serif, no rounded corners — all sharp edges. Feels bold, raw, anti-corporate.' },
  { id: 'gradient-mesh', prompt: 'Flowing gradient mesh design inspired by Apple marketing. Deep black background with flowing colorful gradient blobs — vibrant purple, blue, teal, green transitioning smoothly. Clean white sans-serif typography floating over the gradients. Minimal layout, maximum visual impact. Feels premium, modern, Silicon Valley.' },
  { id: 'terminal', prompt: 'Hacker terminal / CLI aesthetic. Pure black background (#000000), monospace green text (#00FF00) like a Linux terminal, command prompt characters ($ > _), matrix-style falling characters faintly in background, scan line effects, slight CRT monitor curvature, terminal window chrome at top. Feels technical, hacker, cybersecurity.' },
  { id: 'newspaper', prompt: 'Vintage newspaper front page design. Cream/newsprint texture background, multi-column layout with thin vertical rules between columns, large bold serif headline (like The New York Times), smaller serif body text, dateline, article bylines, halftone photo placeholder areas, classic newspaper masthead style. Feels journalistic, classic, informative.' },
  { id: 'travel-magazine', prompt: 'Luxury travel magazine spread design. Large background photography of an exotic beach/mountain landscape (slightly blurred), white text overlays with elegant thin sans-serif typography, magazine-style pull quotes, thin gold accent lines, page number in corner, glossy premium feel. Feels aspirational, wanderlust, premium editorial.' },
]

const outDir = path.join(__dirname, '..', 'public', 'style-previews')

async function generateOne(style) {
  const fullPrompt = `${style.prompt}\n\nContent for the slide: "${CONTENT}"\n\n${SUFFIX}`

  const response = await genai.models.generateContent({
    model: MODEL,
    contents: fullPrompt,
    config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '4K' } } },
  })

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData) {
      const outPath = path.join(outDir, `${style.id}.png`)
      fs.writeFileSync(outPath, Buffer.from(part.inlineData.data, 'base64'))
      return outPath
    }
  }
  throw new Error('No image data in response')
}

async function main() {
  console.log(`Generating ${styles.length} style previews using model: ${MODEL}`)
  console.log(`Output dir: ${outDir}\n`)

  let success = 0
  let failed = 0

  for (let i = 0; i < styles.length; i++) {
    const style = styles[i]
    console.log(`[${i + 1}/${styles.length}] Generating "${style.id}"...`)
    try {
      const outPath = await generateOne(style)
      const stat = fs.statSync(outPath)
      console.log(`  ✓ Saved (${(stat.size / 1024).toFixed(0)} KB)`)
      success++
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`)
      failed++
    }
  }

  console.log(`\nDone! ${success} succeeded, ${failed} failed.`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
