// Restore original OpenAI /extract-document endpoint
const fs = require('fs')
const serverPath = '/app/server.js'
let c = fs.readFileSync(serverPath, 'utf8')

// Remove any existing extract-document endpoint
const idx = c.indexOf('extract-document')
if (idx > -1) {
  const lineStart = c.lastIndexOf('\n', idx)
  c = c.substring(0, lineStart > -1 ? lineStart : idx).trimEnd() + '\n'
  console.log('Removed existing extract-document code')
}

const endpoint = [
  '',
  'app.post("/extract-document", async (req, res) => {',
  '  try {',
  '    const { fileBase64, fileName, purpose, mimeType } = req.body;',
  '    if (!fileBase64) return res.status(400).json({ error: "No file data provided" });',
  '    const OpenAI = (await import("openai")).default;',
  '    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });',
  '    const buffer = Buffer.from(fileBase64, "base64");',
  '    const file = new File([buffer], fileName || "document.pdf", { type: mimeType || "application/pdf" });',
  '    const uploaded = await openai.files.create({ file: file, purpose: "assistants" });',
  '    const response = await openai.responses.create({',
  '      model: "gpt-4o-mini",',
  '      input: [{ role: "user", content: [',
  '        { type: "input_file", file_id: uploaded.id },',
  '        { type: "input_text", text: (purpose ? "Purpose: " + purpose + "\\n\\n" : "") + "Extract and structure ALL content from this document into JSON. Return ONLY valid JSON:\\n{\\n  \\"title\\": \\"Main title\\",\\n  \\"subtitle\\": \\"Subtitle or null\\",\\n  \\"sections\\": [{ \\"title\\": \\"name\\", \\"content\\": \\"content\\" }],\\n  \\"keyMetrics\\": [{ \\"value\\": \\"stat\\", \\"label\\": \\"label\\" }],\\n  \\"contactInfo\\": { \\"phone\\": \\"phone or null\\", \\"email\\": \\"email or null\\", \\"website\\": \\"website or null\\" },\\n  \\"companyName\\": \\"Company name or null\\"\\n}\\nInclude ALL content. Never invent contact info." }',
  '      ]}],',
  '      text: { format: { type: "json_object" } }',
  '    });',
  '    await openai.files.delete(uploaded.id).catch(function(){});',
  '    var rawText = response.output_text || "";',
  '    var fStart = rawText.indexOf("{");',
  '    var fEnd = rawText.lastIndexOf("}");',
  '    if (fStart >= 0 && fEnd > fStart) rawText = rawText.substring(fStart, fEnd + 1);',
  '    var structured = JSON.parse(rawText);',
  '    console.log("[extract-document] Extracted:", structured.title || "untitled", "sections:", (structured.sections||[]).length);',
  '    res.json(structured);',
  '  } catch (err) {',
  '    console.error("[extract-document] Error:", err.message);',
  '    res.status(500).json({ error: err.message || "Extraction failed" });',
  '  }',
  '});',
  '',
].join('\n')

c = c.trimEnd() + '\n' + endpoint
fs.writeFileSync(serverPath, c)
console.log('SUCCESS: OpenAI /extract-document restored!')
