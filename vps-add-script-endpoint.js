// Adds /generate-script endpoint to VPS server.js
// This runs Claude Sonnet for script generation with no timeout constraints.
// Run inside container: node /app/vps-add-script-endpoint.js
const fs = require('fs')
const serverPath = '/app/server.js'
let c = fs.readFileSync(serverPath, 'utf8')

if (c.includes('/generate-script')) {
  console.log('/generate-script already exists, removing old version')
  const idx = c.indexOf('// VPS Script Generation Endpoint')
  if (idx > -1) c = c.substring(0, idx).trimEnd() + '\n'
}

const endpoint = [
  '',
  '// VPS Script Generation Endpoint — no timeout constraints',
  'app.post("/generate-script", authCheck, async (req, res) => {',
  '  try {',
  '    const { policyData, brandName, brandTone, colors, detailed, voiceId, contactInfo, purpose, uploadMode, industry, detailLevel, narrationStyle, classification } = req.body;',
  '    if (!policyData) return res.status(400).json({ error: "No policy data provided" });',
  '',
  '    const Anthropic = (await import("@anthropic-ai/sdk")).default;',
  '    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });',
  '',
  '    // Strategic analysis pass',
  '    console.log("[generate-script] Starting strategic analysis...");',
  '    var analysisPrompt = "You are a senior communications strategist. Analyze this data and provide a strategic brief for creating a video.\\n\\nPurpose: " + (purpose || "informative overview") + "\\n\\nData:\\n" + JSON.stringify(policyData).slice(0, 30000);',
  '    var analysisRes = await claude.messages.create({ model: "claude-sonnet-4-6", max_tokens: 4096, messages: [{ role: "user", content: analysisPrompt }] });',
  '    var deepAnalysis = (analysisRes.content[0] && analysisRes.content[0].type === "text" ? analysisRes.content[0].text : "").trim();',
  '    console.log("[generate-script] Strategic analysis: " + deepAnalysis.length + " chars");',
  '',
  '    // Determine scene count based on detail level',
  '    var lengthInstruction = "";',
  '    if (detailLevel === "quick") lengthInstruction = "VIDEO LENGTH: HIGHLIGHTS — 3-4 scenes, under 60 seconds.";',
  '    else if (detailLevel === "detailed") lengthInstruction = "VIDEO LENGTH: DETAILED — Cover every data point thoroughly. 10-15 scenes.";',
  '    else lengthInstruction = "VIDEO LENGTH: STANDARD — Cover all major points. 6-12 scenes.";',
  '',
  '    // Build script generation prompt',
  '    var isInsurance = policyData.policyType && policyData.deathBenefit > 0;',
  '    var dataBlock = JSON.stringify(policyData).slice(0, 40000);',
  '    var scriptPrompt = "You are a professional scriptwriter creating an explainer video narration.\\n\\n";',
  '    scriptPrompt += "SOURCE DATA:\\n" + dataBlock + "\\n\\n";',
  '    if (deepAnalysis) scriptPrompt += "STRATEGIC BRIEF:\\n" + deepAnalysis + "\\n\\n";',
  '    if (brandName) scriptPrompt += "Brand: " + brandName + "\\n";',
  '    if (purpose) scriptPrompt += "Purpose: " + purpose + "\\n";',
  '    scriptPrompt += lengthInstruction + "\\n\\n";',
  '    scriptPrompt += "HARD CONSTRAINTS:\\n";',
  '    scriptPrompt += "- ONLY use facts from the SOURCE DATA. Never invent numbers, contacts, or claims.\\n";',
  '    scriptPrompt += "- Every scene must have: scene (number), beat, title, narration, slideData, slidePrompt, duration.\\n";',
  '    scriptPrompt += "- No logos, no brand marks in slidePrompt.\\n";',
  '    if (isInsurance) {',
  '      scriptPrompt += "- NEVER mention the carrier name \\"" + (policyData.carrier || "") + "\\". Use \\"the carrier\\" instead.\\n";',
  '      scriptPrompt += "- Policy type (\\"" + (policyData.policyType || "") + "\\") IS allowed.\\n";',
  '    }',
  '    scriptPrompt += "- Contact info ONLY in the final scene, only if it exists in source data.\\n";',
  '    if (contactInfo) {',
  '      var parts = [];',
  '      if (contactInfo.phone) parts.push("Phone: " + contactInfo.phone);',
  '      if (contactInfo.email) parts.push("Email: " + contactInfo.email);',
  '      if (contactInfo.website) parts.push("Website: " + contactInfo.website);',
  '      if (parts.length) scriptPrompt += "\\nCONTACT INFO (final scene only):\\n" + parts.join("\\n") + "\\n";',
  '    }',
  '    scriptPrompt += "\\nBANNED PHRASES: \\"it\'s important to note\\", \\"as you can see\\", \\"let\'s take a look at\\", \\"the data shows\\", \\"moving on to\\", \\"in conclusion\\".\\n";',
  '    scriptPrompt += "\\nReturn ONLY valid JSON array (no markdown):\\n[{ \\"scene\\": 1, \\"beat\\": \\"hook\\", \\"title\\": \\"...\\", \\"slideData\\": { \\"headline\\": \\"...\\", \\"stats\\": [], \\"bullets\\": [] }, \\"narration\\": \\"...\\", \\"slidePrompt\\": \\"...\\", \\"duration\\": 15 }]";',
  '',
  '    console.log("[generate-script] Generating script with Sonnet...");',
  '    var scriptRes = await claude.messages.create({ model: "claude-sonnet-4-6", max_tokens: 8192, messages: [{ role: "user", content: scriptPrompt }] });',
  '    var scriptText = (scriptRes.content[0] && scriptRes.content[0].type === "text" ? scriptRes.content[0].text : "").trim();',
  '    var fStart = scriptText.indexOf("[");',
  '    var fEnd = scriptText.lastIndexOf("]");',
  '    if (fStart >= 0 && fEnd > fStart) scriptText = scriptText.substring(fStart, fEnd + 1);',
  '    var scenes = JSON.parse(scriptText);',
  '    if (!Array.isArray(scenes) || scenes.length === 0) throw new Error("No scenes generated");',
  '    console.log("[generate-script] Generated " + scenes.length + " scenes");',
  '    res.json({ scenes: scenes });',
  '  } catch (err) {',
  '    console.error("[generate-script] Error:", err.message);',
  '    res.status(500).json({ error: err.message || "Script generation failed" });',
  '  }',
  '});',
  '',
].join('\n')

c = c.trimEnd() + '\n' + endpoint
fs.writeFileSync(serverPath, c)
console.log('SUCCESS: /generate-script endpoint added!')
