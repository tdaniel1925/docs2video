/**
 * VPS endpoint: /style-preview
 * Add this route to your VPS Express server.
 *
 * Receives a reference image, analyzes its style with GPT-4o-mini,
 * generates 2 preview slides with gpt-image-2, returns base64 images.
 */

const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Add to your Express app:
// app.post('/style-preview', handleStylePreview)

async function handleStylePreview(req, res) {
  try {
    const { referenceImageBase64, userId } = req.body;

    if (!referenceImageBase64) {
      return res.status(400).json({ error: 'No reference image provided' });
    }

    console.log(`[style-preview] Starting for user ${userId}`);

    // Step 1: Analyze the reference image style
    console.log('[style-preview] Analyzing reference image...');
    const analysisRes = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${referenceImageBase64}` } },
          { type: 'text', text: "Describe this image's visual style in detail for recreating it: colors (specific hex codes), typography style, layout approach, textures, decorative elements, mood, spacing. Be very specific. 2-4 sentences." },
        ],
      }],
      max_tokens: 300,
    });
    const styleDescription = analysisRes.choices[0]?.message?.content ?? 'Professional modern design';
    console.log('[style-preview] Style:', styleDescription.slice(0, 100) + '...');

    // Step 2: Generate both slides in parallel
    console.log('[style-preview] Generating 2 preview slides...');
    const [coverRes, contentRes] = await Promise.all([
      openai.images.generate({
        model: 'gpt-image-2',
        prompt: `Create a presentation COVER slide in this EXACT visual style: ${styleDescription}

Content: Title "Quarterly Business Review", subtitle "Q2 2025 Performance Summary", small text "Prepared by Anderson Financial Group".

1920x1080 landscape. Fill entire canvas edge to edge. No logos.`,
        size: '1536x1024',
        quality: 'high',
        n: 1,
      }),
      openai.images.generate({
        model: 'gpt-image-2',
        prompt: `Create a presentation CONTENT slide in this EXACT visual style: ${styleDescription}

Content: Title "KEY METRICS". Three data card sections: Revenue $2.4M (+18%), New Clients 1,240, Retention Rate 94%. Below: Growth Drivers heading with 3 bullet points.

1920x1080 landscape. Fill entire canvas edge to edge. No logos.`,
        size: '1536x1024',
        quality: 'high',
        n: 1,
      }),
    ]);

    const coverImage = coverRes.data?.[0]?.b64_json
      ? `data:image/png;base64,${coverRes.data[0].b64_json}`
      : null;
    const contentImage = contentRes.data?.[0]?.b64_json
      ? `data:image/png;base64,${contentRes.data[0].b64_json}`
      : null;

    // Step 3: Save reference image to Supabase Storage
    let referenceUrl = null;
    if (userId) {
      try {
        const refId = require('crypto').randomUUID();
        const storagePath = `${userId}/style-refs/${refId}.png`;
        await supabase.storage
          .from('logos')
          .upload(storagePath, Buffer.from(referenceImageBase64, 'base64'), {
            contentType: 'image/png',
            upsert: true,
          });
        const { data: urlData } = supabase.storage.from('logos').getPublicUrl(storagePath);
        referenceUrl = urlData.publicUrl;
      } catch (e) {
        console.error('[style-preview] Failed to save reference:', e.message);
      }
    }

    console.log(`[style-preview] Done. Cover: ${coverImage ? 'yes' : 'no'}, Content: ${contentImage ? 'yes' : 'no'}`);

    res.json({
      previews: [coverImage, contentImage].filter(Boolean),
      referenceUrl,
      styleDescription,
    });
  } catch (err) {
    console.error('[style-preview] Error:', err);
    res.status(500).json({ error: err.message || 'Preview generation failed' });
  }
}

module.exports = { handleStylePreview };
