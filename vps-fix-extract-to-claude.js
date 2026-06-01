/**
 * VPS PATCH: Replace /extract-document from OpenAI gpt-4o-mini to Claude Sonnet.
 *
 * Deploy steps:
 *   1. scp vps-fix-extract-to-claude.js root@5.161.215.156:/tmp/
 *   2. ssh root@5.161.215.156
 *   3. cd /app && npm install @anthropic-ai/sdk
 *   4. node /tmp/vps-fix-extract-to-claude.js
 *   5. docker restart docs2video-service
 *
 * Also requires ANTHROPIC_API_KEY in the docker-compose environment.
 */
const fs = require('fs')
const serverPath = '/app/server.js'
let c = fs.readFileSync(serverPath, 'utf8')

// Find the extract-document handler
const marker = '// Extract and structure document content using OpenAI'
const startIdx = c.indexOf(marker)
if (startIdx === -1) {
  // Try alternate marker in case already partially patched
  const alt = 'app.post("/extract-document"'
  const altIdx = c.indexOf(alt)
  if (altIdx === -1) { console.log('ERROR: /extract-document handler not found'); process.exit(1) }
}

// Find the closing of the handler (the }) that matches the app.post)
const handlerStart = c.indexOf('app.post("/extract-document"', startIdx > -1 ? startIdx : 0)
if (handlerStart === -1) { console.log('ERROR: app.post not found'); process.exit(1) }

// Find matching close: look for the next app. route or end pattern after this handler
let depth = 0
let handlerEnd = -1
let foundOpen = false
for (let i = handlerStart; i < c.length; i++) {
  if (c[i] === '{') { depth++; foundOpen = true }
  if (c[i] === '}') { depth-- }
  if (foundOpen && depth === 0) {
    // Skip the closing paren of app.post(...)
    let j = i + 1
    while (j < c.length && /\s/.test(c[j])) j++
    if (c[j] === ')') {
      handlerEnd = j + 1
      break
    }
  }
}
if (handlerEnd === -1) { console.log('ERROR: could not find handler end'); process.exit(1) }

// Also remove any comment line before
const actualStart = startIdx > -1 ? startIdx : handlerStart

const newHandler = `// Extract and structure document content using Claude Sonnet
app.post("/extract-document", async (req, res) => {
  try {
    const { fileBase64, fileName, purpose, mimeType } = req.body
    if (!fileBase64) return res.status(400).json({ error: "No file data provided" })

    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const promptText = (purpose ? "Purpose: " + purpose + "\\n\\n" : "") +
      'Extract and structure ALL content from this document into JSON. Return ONLY valid JSON (no markdown, no code fences):\\n' +
      '{\\n' +
      '  "title": "Main title or document name",\\n' +
      '  "subtitle": "Subtitle or tagline, or null",\\n' +
      '  "source": "Source or origin, or null",\\n' +
      '  "companyName": "Company name or null",\\n' +
      '  "contactInfo": {\\n' +
      '    "phone": "Phone ONLY if it clearly belongs to the entity the content is ABOUT, otherwise null",\\n' +
      '    "email": "Email ONLY if it clearly belongs to the entity, otherwise null",\\n' +
      '    "website": "Website URL or null"\\n' +
      '  },\\n' +
      '  "keyMetrics": [{ "value": "stat value", "label": "stat label", "qualifier": "context or null" }],\\n' +
      '  "sections": [{ "title": "Section name", "content": "Full section content" }],\\n' +
      '  "bulletPoints": ["Key takeaway or finding"],\\n' +
      '  "additionalNotes": ["Caveats, disclaimers, or supplementary info"]\\n' +
      '}\\n' +
      'CONTACT OWNERSHIP: For ALL fields (phone, email, website), extract ONLY contacts belonging to the entity the content is ABOUT. If ownership is ambiguous, return null.\\n' +
      'Include ALL content. Never invent contact info.'

    const docMime = mimeType || "application/pdf"
    const isPdf = docMime.includes("pdf")

    const contentParts = []
    if (isPdf) {
      contentParts.push({ type: "document", source: { type: "base64", media_type: docMime, data: fileBase64 } })
    } else {
      // For non-PDF (DOCX, PPTX, etc.) — send as text since Claude can't read these natively
      const textContent = Buffer.from(fileBase64, "base64").toString("utf8").slice(0, 50000)
      contentParts.push({ type: "text", text: "Document content:\\n" + textContent })
    }
    contentParts.push({ type: "text", text: promptText })

    const response = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: contentParts }],
    })

    const text = (response.content[0] && response.content[0].type === "text" ? response.content[0].text : "").trim()
    const cleaned = text.replace(/^\`\`\`(?:json)?\\s*\\n?/i, "").replace(/\\n?\`\`\`\\s*$/i, "")
    const structured = JSON.parse(cleaned)
    console.log("[extract-document] Extracted (Claude Sonnet):", structured.title || "untitled", "- sections:", (structured.sections || []).length)
    res.json(structured)
  } catch (err) {
    console.error("[extract-document] Error:", err.message)
    res.status(500).json({ error: err.message || "Extraction failed" })
  }
})`

c = c.substring(0, actualStart) + newHandler + c.substring(handlerEnd)

fs.writeFileSync(serverPath, c)
console.log('SUCCESS: VPS /extract-document updated to Claude Sonnet!')
console.log('')
console.log('Next steps:')
console.log('  1. Ensure ANTHROPIC_API_KEY is in docker-compose.yml environment')
console.log('  2. Run: docker restart docs2video-service')
