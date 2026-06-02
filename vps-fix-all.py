#!/usr/bin/env python3
"""
Patches the VPS container-server.js with:
1. /extract-document endpoint (before health check)
2. Gemini slide generation (replaces OpenAI gpt-image-1)

Run on VPS: python3 vps-fix-all.py
"""

server_path = '/root/video-service/container-server.js'

with open(server_path, 'r') as f:
    code = f.read()

# ========== PATCH 1: Add /extract-document endpoint ==========
extract_endpoint = '''
// Extract and structure document content using OpenAI
app.post("/extract-document", authCheck, async (req, res) => {
  try {
    const { fileBase64, fileName, purpose, mimeType } = req.body
    if (!fileBase64) return res.status(400).json({ error: "No file data provided" })

    const OpenAI = require("openai")
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // Upload file to OpenAI
    const buffer = Buffer.from(fileBase64, "base64")
    const file = new File([buffer], fileName || "document.pdf", { type: mimeType || "application/pdf" })
    const uploaded = await openai.files.create({ file, purpose: "assistants" })

    // Extract + structure in one call
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_file", file_id: uploaded.id },
            {
              type: "input_text",
              text: (purpose ? "Purpose: " + purpose + "\\n\\n" : "") + 'Extract and structure ALL content from this document into JSON. Return ONLY valid JSON:\\n{\\n  "title": "Main title or document name",\\n  "subtitle": "Subtitle or tagline if any",\\n  "sections": [{ "title": "Section name", "content": "Full section content" }],\\n  "keyMetrics": [{ "value": "stat value", "label": "stat label" }],\\n  "contactInfo": { "phone": "phone or null", "email": "email or null", "website": "website or null" },\\n  "companyName": "Company name or null"\\n}\\nInclude ALL content. Never invent contact info.'
            }
          ]
        }
      ],
      text: { format: { type: "json_object" } }
    })

    // Clean up
    await openai.files.delete(uploaded.id).catch(() => {})

    const text = response.output_text || ""
    const cleaned = text.replace(/^```(?:json)?\\s*\\n?/i, "").replace(/\\n?```\\s*$/i, "")
    const structured = JSON.parse(cleaned)
    console.log("[extract-document] Extracted:", structured.title || "untitled", "- sections:", structured.sections?.length || 0)
    res.json(structured)
  } catch (err) {
    console.error("[extract-document] Error:", err.message)
    res.status(500).json({ error: err.message || "Extraction failed" })
  }
})

'''

health_marker = "app.get('/health'"

if 'extract-document' in code:
    print('SKIP: /extract-document already exists')
else:
    idx = code.find(health_marker)
    if idx == -1:
        print('ERROR: Could not find health check marker')
        exit(1)
    code = code[:idx] + extract_endpoint + code[idx:]
    print(f'PATCH 1: Added /extract-document endpoint at position {idx}')

# ========== PATCH 2: Replace OpenAI slides with Gemini ==========
old_slide_start = '    // Generate slides in parallel batches of 2 for speed'
old_slide_end = "Audio + slides both done`)"

start_idx = code.find(old_slide_start)
end_idx = code.find(old_slide_end)

if start_idx == -1 or end_idx == -1:
    print('ERROR: Could not find slide generation block')
    exit(1)

end_idx += len(old_slide_end)

gemini_slides = '''    // --- TEMPLATE REFERENCE: Download once, use for all slides ---
    let templateRefBase64 = null
    const templateRefUrl = req.body.templateRefUrl || null
    if (templateRefUrl) {
      try {
        console.log(`[${videoId}] Downloading template reference from ${templateRefUrl}`)
        const tRes = await fetch(templateRefUrl, { signal: AbortSignal.timeout(10000) })
        if (tRes.ok) {
          templateRefBase64 = Buffer.from(await tRes.arrayBuffer()).toString('base64')
          console.log(`[${videoId}] Template reference loaded (${Math.round(templateRefBase64.length / 1024)}KB)`)
        }
      } catch (e) { console.log(`[${videoId}] Template ref download failed:`, e.message) }
    }

    // --- GEMINI SLIDE GENERATION (replaces OpenAI gpt-image-1) ---
    const { GoogleGenAI: GenAISlides } = require('@google/genai')
    const geminiSlides = new GenAISlides({ apiKey: GEMINI_API_KEY })

    // Generate slides in parallel batches
    const slideBuffers = new Array(slidePrompts.length).fill(null)

    async function generateOneSlide(idx) {
      const prompt = slidePrompts[idx]
      const parts = []
      if (templateRefBase64) {
        parts.push({ text: 'REFERENCE DESIGN (match this EXACTLY): This image shows the visual style to follow. Replicate the same layout structure, geometric shapes, diagonal color blocks, icon circles, decorative elements, footer bar, and overall mood. Only change the DATA content and use the brand colors specified.' })
        parts.push({ inlineData: { mimeType: 'image/png', data: templateRefBase64 } })
      }
      parts.push({ text: prompt })
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await geminiSlides.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: [{ role: 'user', parts }],
            config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '4K' } } },
          })
          const rParts = response.candidates?.[0]?.content?.parts ?? []
          for (const rp of rParts) {
            if (rp.inlineData) {
              let slideBuf = Buffer.from(rp.inlineData.data, 'base64')
              const sharp = require('sharp')
              slideBuf = await sharp(slideBuf).resize(1920, 1080, { fit: 'cover' }).png().toBuffer()
              if (logoBase64) {
                try {
                  const logoBuf = Buffer.from(logoBase64, 'base64')
                  const logoResized = await sharp(logoBuf).resize(200, 70, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
                  slideBuf = await sharp(slideBuf).composite([{ input: logoResized, top: 40, left: 40 }]).png().toBuffer()
                } catch (e) { console.log(`[${videoId}] Logo composite failed:`, e.message) }
              } else if (brandName) {
                try {
                  const safeName = brandName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  const textSvg = Buffer.from('<svg width="400" height="60" xmlns="http://www.w3.org/2000/svg"><text x="0" y="42" font-size="32" font-weight="800" font-family="sans-serif" fill="' + (brandColors.primary || '#1B365D') + '">' + safeName + '</text></svg>')
                  const textBuf = await sharp(textSvg).png().toBuffer()
                  slideBuf = await sharp(slideBuf).composite([{ input: textBuf, top: 40, left: 40 }]).png().toBuffer()
                } catch (e) { console.log(`[${videoId}] Brand name composite failed:`, e.message) }
              }
              return slideBuf
            }
          }
          throw new Error('No image in Gemini response')
        } catch (retryErr) {
          console.error(`[${videoId}] Slide ${idx + 1} attempt ${attempt}/3 failed:`, retryErr.message?.slice(0, 150))
          if (attempt < 3) await new Promise(r => setTimeout(r, 3000 * attempt))
        }
      }
      return await generateFallbackSlide(scenes[idx]?.title || `Slide ${idx + 1}`, idx + 1, slidePrompts.length)
    }

    const BATCH_SIZE = 2
    for (let i = 0; i < slidePrompts.length; i += BATCH_SIZE) {
      const batch = []
      for (let j = i; j < Math.min(i + BATCH_SIZE, slidePrompts.length); j++) {
        batch.push(generateOneSlide(j).then(buf => { slideBuffers[j] = buf }))
      }
      await Promise.all(batch)
      const done = Math.min(i + BATCH_SIZE, slidePrompts.length)
      console.log(`[${videoId}] Slides ${done}/${slidePrompts.length} done`)
      const slidePct = 22 + Math.round((done / slidePrompts.length) * 43)
      await updateStatus('generating_slides', `Designing slide ${done} of ${slidePrompts.length}... (audio ${audiosDone}/${scenes.length})`, slidePct)
    }
    console.log(`[${videoId}] Slides complete: ${slideBuffers.length}`)

    // Wait for audio to finish (it ran in parallel with slides)
    await updateStatus('generating_slides', `Slides done, waiting for audio...`, 66)
    const audioBuffers = await audioPromise
    console.log(`[${videoId}] Audio + slides both done`)'''

code = code[:start_idx] + gemini_slides + code[end_idx:]
print(f'PATCH 2: Replaced slide generation ({end_idx - start_idx} chars -> {len(gemini_slides)} chars)')

# Write patched file
with open(server_path, 'w') as f:
    f.write(code)

print(f'\nSUCCESS: Patched file written to {server_path}')
print('Now run:')
print('  docker cp /root/video-service/container-server.js docs2video-service:/app/server.js')
print('  docker restart docs2video-service')
print('  docker logs docs2video-service --tail 5')
