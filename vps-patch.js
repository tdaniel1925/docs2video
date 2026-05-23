const fs = require('fs')
let s = fs.readFileSync('server.js', 'utf8')
if (s.includes('style-preview')) {
  console.log('Already patched')
  process.exit(0)
}
const route = [
  '',
  '// Style preview route',
  "app.post('/style-preview', authCheck, async (req, res) => {",
  '  try {',
  '    const { referenceImageBase64, userId } = req.body',
  "    if (!referenceImageBase64) return res.status(400).json({ error: 'No reference image' })",
  "    console.log('[style-preview] Starting...')",
  "    const OpenAI = require('openai')",
  '    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })',
  "    const a = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,' + referenceImageBase64 } }, { type: 'text', text: 'Describe this visual style for recreating it: colors, typography, layout, textures, mood. 2-4 sentences.' }] }], max_tokens: 300 })",
  "    const style = (a.choices[0] && a.choices[0].message && a.choices[0].message.content) || 'Professional design'",
  "    console.log('[style-preview] Style:', style.slice(0, 80))",
  '    const [c, d] = await Promise.all([',
  "      openai.images.generate({ model: 'gpt-image-2', prompt: 'Create a COVER slide in this style: ' + style + '. Title: Quarterly Business Review, subtitle: Q2 2025. 1920x1080 landscape. Fill canvas. No logos.', size: '1536x1024', quality: 'high', n: 1 }),",
  "      openai.images.generate({ model: 'gpt-image-2', prompt: 'Create a CONTENT slide in this style: ' + style + '. KEY METRICS: Revenue 2.4M, Clients 1240, Retention 94 percent. 1920x1080 landscape. Fill canvas. No logos.', size: '1536x1024', quality: 'high', n: 1 })",
  '    ])',
  "    const cover = c.data[0].b64_json ? 'data:image/png;base64,' + c.data[0].b64_json : null",
  "    const content = d.data[0].b64_json ? 'data:image/png;base64,' + d.data[0].b64_json : null",
  '    let refUrl = null',
  '    if (userId) {',
  '      try {',
  "        const rid = require('crypto').randomUUID()",
  "        const sp = userId + '/style-refs/' + rid + '.png'",
  '        const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)',
  "        await sb.storage.from('logos').upload(sp, Buffer.from(referenceImageBase64, 'base64'), { contentType: 'image/png', upsert: true })",
  "        refUrl = sb.storage.from('logos').getPublicUrl(sp).data.publicUrl",
  "      } catch(e) { console.error('[style-preview] Save failed:', e.message) }",
  '    }',
  "    console.log('[style-preview] Done')",
  '    res.json({ previews: [cover, content].filter(Boolean), referenceUrl: refUrl, styleDescription: style })',
  '  } catch (err) {',
  "    console.error('[style-preview] Error:', err)",
  "    res.status(500).json({ error: err.message || 'Failed' })",
  '  }',
  '})',
  '',
].join('\n')
s = s.replace('app.listen(', route + '\napp.listen(')
fs.writeFileSync('server.js', s)
console.log('Patched OK. Lines:', s.split('\n').length)
