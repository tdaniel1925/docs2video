// VPS fix: Replace images.edit with images.generate + Sharp logo composite
const fs = require('fs')
let code = fs.readFileSync('/tmp/server.js', 'utf8')

// Replace the entire if(logoBase64) / else block with just images.generate + Sharp
const oldBlock = `          if (logoBase64) {
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
          throw new Error('No image in response')`

const newBlock = `          // Generate slide (no logo in prompt — Sharp composites it after)
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

          // Composite actual logo on top with Sharp
          if (logoBase64) {
            try {
              const sharp = require('sharp')
              const logoBuf = Buffer.from(logoBase64, 'base64')
              const logoResized = await sharp(logoBuf)
                .resize(140, 80, { fit: 'inside', withoutEnlargement: true })
                .png()
                .toBuffer()
              const logoMeta = await sharp(logoResized).metadata()
              const lw = logoMeta.width || 140
              slideBuf = await sharp(slideBuf)
                .composite([{ input: logoResized, top: 40, left: 1920 - lw - 40 }])
                .png()
                .toBuffer()
            } catch (e) { /* logo composite failed, use slide without */ }
          }
          return slideBuf`

if (code.includes('images.edit')) {
  code = code.replace(oldBlock, newBlock)
  console.log('SUCCESS: Replaced images.edit with images.generate + Sharp composite')
} else {
  console.log('ERROR: images.edit block not found — may already be replaced')
}

fs.writeFileSync('/tmp/server.js', code, 'utf8')
