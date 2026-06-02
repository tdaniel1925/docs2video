// Run inside container: node /app/vps-add-extract-endpoint.js
const fs = require('fs')
const serverPath = '/app/server.js'
let c = fs.readFileSync(serverPath, 'utf8')

// Remove any broken previous append
const brokenIdx = c.indexOf('// Extract and structure document content using Claude Sonnet')
if (brokenIdx > -1) {
  c = c.substring(0, brokenIdx).trimEnd() + '\n'
  console.log('Removed broken previous append')
}

if (c.includes('extract-document')) {
  console.log('extract-document endpoint already exists, skipping')
  process.exit(0)
}

// Build the endpoint as an array of lines to avoid template literal escaping issues
const lines = [
  '',
  '// Extract and structure document content using Claude Sonnet',
  'app.post("/extract-document", async (req, res) => {',
  '  try {',
  '    const { fileBase64, fileName, purpose, mimeType } = req.body;',
  '    if (!fileBase64) return res.status(400).json({ error: "No file data provided" });',
  '    const Anthropic = (await import("@anthropic-ai/sdk")).default;',
  '    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });',
  '    var promptLines = [];',
  '    if (purpose) promptLines.push("Purpose: " + purpose);',
  '    promptLines.push("Extract and structure ALL content from this document into JSON.");',
  '    promptLines.push("Return ONLY valid JSON (no markdown code fences).");',
  '    promptLines.push("Schema: title, subtitle, source, companyName, contactInfo (phone/email/website), keyMetrics [{value,label}], sections [{title,content}], bulletPoints [], additionalNotes []");',
  '    promptLines.push("Only include real data found in the content. Never invent contact info.");',
  '    var promptText = promptLines.join(" ");',
  '    var docMime = mimeType || "application/pdf";',
  '    var contentParts = [];',
  '    if (docMime.includes("pdf")) {',
  '      contentParts.push({ type: "document", source: { type: "base64", media_type: docMime, data: fileBase64 } });',
  '    } else {',
  '      contentParts.push({ type: "text", text: "Document content: " + Buffer.from(fileBase64, "base64").toString("utf8").slice(0, 50000) });',
  '    }',
  '    contentParts.push({ type: "text", text: promptText });',
  '    var response = await claude.messages.create({ model: "claude-sonnet-4-6", max_tokens: 4096, messages: [{ role: "user", content: contentParts }] });',
  '    var rawText = (response.content[0] && response.content[0].type === "text" ? response.content[0].text : "").trim();',
  '    var fenceStart = rawText.indexOf("{");',
  '    var fenceEnd = rawText.lastIndexOf("}");',
  '    if (fenceStart >= 0 && fenceEnd > fenceStart) rawText = rawText.substring(fenceStart, fenceEnd + 1);',
  '    var structured;',
  '    try { structured = JSON.parse(rawText); }',
  '    catch (parseErr) {',
  '      console.error("[extract-document] JSON parse failed, attempting repair:", parseErr.message);',
  '      rawText = rawText.replace(/[\\x00-\\x1f]/g, " ").replace(/,\\s*([\\]\\}])/g, "$1");',
  '      try { structured = JSON.parse(rawText); }',
  '      catch (e2) {',
  '        console.error("[extract-document] JSON repair failed:", e2.message);',
  '        return res.status(500).json({ error: "Failed to parse extraction result" });',
  '      }',
  '    }',
  '    console.log("[extract-document] Extracted (Claude Sonnet):", structured.title || "untitled");',
  '    res.json(structured);',
  '  } catch (err) {',
  '    console.error("[extract-document] Error:", err.message);',
  '    res.status(500).json({ error: err.message || "Extraction failed" });',
  '  }',
  '});',
  '',
]

c = c.trimEnd() + '\n' + lines.join('\n')
fs.writeFileSync(serverPath, c)
console.log('SUCCESS: /extract-document endpoint added!')
console.log('Run: docker restart docs2video-service')
