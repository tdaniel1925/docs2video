// VPS fix: Use images.generate for ALL slides, then composite logo with Sharp
// This avoids the "Invalid image file" errors from images.edit
const fs = require('fs')
let code = fs.readFileSync('/tmp/server.js', 'utf8')

// Replace the entire generateOneSlide function
const oldFunc = `    async function generateOneSlide(idx) {
      const prompt = slidePrompts[idx]
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          if (logoBase64) {
            const response = await openai.images.edit({
              model: 'gpt-image-2',
              prompt: \`Use the provided brand logo image in this slide. Keep the logo in its ORIGINAL colors.\\n\\n\${prompt}\`,
              image: new File([Buffer.from(logoBase64, 'base64')], 'logo.png', { type: 'image/png' }),
              size: '1920x1088',
              quality: 'high',
              n: 1,
            })
            const imageData = response.data?.[0]
            if (imageData?.b64_json) return Buffer.from(imageData.b64_json, 'base64')
          } else {
            const response = await openai.images.generate({
              model: 'gpt-image-2',
              prompt,
              size: '1920x1088',
              quality: 'high',
              n: 1,
            })
            const imageData = response.data?.[0]
            if (imageData?.b64_json) return Buffer.from(imageData.b64_json, 'base64')
          }
          throw new Error('No image in response')
        } catch (retryErr) {
          console.error(\`[\${videoId}] Slide \${idx + 1} attempt \${attempt}/3 failed:\`, retryErr.message?.slice(0, 150))`

const newFunc = `    async function generateOneSlide(idx) {
      const prompt = slidePrompts[idx]
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          // Always use images.generate (not images.edit) — more reliable
          const response = await openai.images.generate({
            model: 'gpt-image-2',
            prompt,
            size: '1920x1088',
            quality: 'high',
            n: 1,
          })
          const imageData = response.data?.[0]
          if (!imageData?.b64_json) throw new Error('No image in response')
          let slideBuf = Buffer.from(imageData.b64_json, 'base64')

          // Composite logo with Sharp if available (bottom-right corner)
          if (logoBase64) {
            try {
              const sharp = require('sharp')
              const logoBuf = Buffer.from(logoBase64, 'base64')
              const logoResized = await sharp(logoBuf)
                .resize(120, 120, { fit: 'inside', withoutEnlargement: true })
                .png()
                .toBuffer()
              slideBuf = await sharp(slideBuf)
                .composite([{ input: logoResized, gravity: 'southeast', top: 40, left: 1760 }])
                .png()
                .toBuffer()
            } catch (logoErr) {
              console.log(\`[\${videoId}] Logo composite failed for slide \${idx + 1}, using slide without logo\`)
            }
          }
          return slideBuf
        } catch (retryErr) {
          console.error(\`[\${videoId}] Slide \${idx + 1} attempt \${attempt}/3 failed:\`, retryErr.message?.slice(0, 150))`

if (code.includes('async function generateOneSlide(idx)')) {
  code = code.replace(oldFunc, newFunc)
  console.log('SUCCESS: Replaced slide generation with Sharp logo compositing')
} else {
  console.log('ERROR: Could not find generateOneSlide function')
}

fs.writeFileSync('/tmp/server.js', code, 'utf8')
