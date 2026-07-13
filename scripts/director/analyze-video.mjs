/* Analyze a reference video (YouTube URL) with Gemini's video understanding, so
 * the director can learn a STYLE from an ad you like. Gemini watches the actual
 * video (passed as a fileData URI) and returns a structured breakdown: pacing,
 * editing, motion, color, typography, sound, and structure — plus how CLOSE our
 * TemplateCommercial can get and what it'd take.
 *
 * Run: node scripts/director/analyze-video.mjs "https://www.youtube.com/watch?v=..."
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { GoogleGenAI } from '@google/genai'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const url = process.argv[2]
if (!url) { console.error('usage: analyze-video.mjs "<youtube url>"'); process.exit(1) }

const PROMPT = `You are a motion-design director analyzing this reference ad/video so another team can recreate its STYLE (not its content). Watch it and return a tight, concrete breakdown:

1. VIBE: the overall feeling in 1 sentence (e.g. "gritty athletic hype", "clean premium tech", "playful kinetic").
2. PACING: rough cuts-per-10-seconds, and does energy build?
3. EDITING: cut style (hard cuts, whip-pans, match cuts, morph, speed-ramps), and any signature transition.
4. MOTION: how do elements move (camera push/handheld, parallax, elements flying on/off, text slams, glitch)?
5. COLOR: the grade (desaturated/vibrant/high-contrast/teal-orange/monochrome), and dominant palette.
6. TYPOGRAPHY: font weight/case, how text enters (kinetic/fade/wipe), size, placement.
7. IMAGERY: real footage vs. graphics vs. product shots vs. people. What kind.
8. SOUND: music genre/energy, and use of SFX (whooshes/impacts/risers).
9. STRUCTURE: the beat arc start→finish (e.g. Hook→Problem→Product→Proof→CTA).
10. THE 3-5 THINGS that most define this style — the must-haves to make something feel like this.

Be specific and concrete (a director should be able to execute from this). Plain text, numbered.`

;(async () => {
  console.log(`\n▶ Analyzing (Gemini video understanding): ${url}\n`)
  try {
    const res = await genai.models.generateContent({
      model: process.env.VIDEO_MODEL || 'gemini-flash-latest',
      contents: [{ role: 'user', parts: [
        { fileData: { fileUri: url, mimeType: 'video/*' } },
        { text: PROMPT },
      ] }],
    })
    const text = res.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '(no text)'
    console.log(text)
  } catch (e) {
    console.error('FAILED:', e?.message || e)
    console.error('\n(If this is a "not supported" error, Gemini may not fetch that particular video — try the other URL, or a standard youtube.com/watch link.)')
    process.exit(1)
  }
})()
