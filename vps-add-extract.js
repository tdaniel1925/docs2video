const fs = require('fs')
let code = fs.readFileSync('/tmp/server.js', 'utf8')

// Add the extract-document endpoint before the health check
const healthCheck = `app.get('/health'`
const extractEndpoint = `
// Extract and structure document content using OpenAI
app.post("/extract-document", async (req, res) => {
  try {
    const { fileBase64, fileName, purpose, mimeType } = req.body
    if (!fileBase64) return res.status(400).json({ error: "No file data provided" })

    const OpenAI = (await import("openai")).default
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
    const cleaned = text.replace(/^\`\`\`(?:json)?\\s*\\n?/i, "").replace(/\\n?\`\`\`\\s*$/i, "")
    const structured = JSON.parse(cleaned)
    console.log("[extract-document] Extracted:", structured.title || "untitled", "- sections:", structured.sections?.length || 0)
    res.json(structured)
  } catch (err) {
    console.error("[extract-document] Error:", err.message)
    res.status(500).json({ error: err.message || "Extraction failed" })
  }
})

app.get('/health'`

if (code.includes('app.post("/extract-document"')) {
  console.log('SKIP: /extract-document endpoint already exists')
} else if (code.includes(healthCheck)) {
  code = code.replace(healthCheck, extractEndpoint)
  fs.writeFileSync('/tmp/server.js', code, 'utf8')
  console.log('SUCCESS: Added /extract-document endpoint')
} else {
  console.log('ERROR: Could not find health check to insert before')
}
