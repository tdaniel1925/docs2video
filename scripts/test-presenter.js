/**
 * Test script: Generate a News Anchor style talking head video
 * Run: node scripts/test-presenter.js
 */
require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const OpenAI = require('openai')
const { GoogleGenAI } = require('@google/genai')

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const KIE_KEY = process.env.KIE_API_KEY

async function main() {
  // Step 1: Generate TTS audio
  console.log('Step 1: Generating narration audio...')
  const speech = await openai.audio.speech.create({
    model: 'tts-1-hd',
    voice: 'nova',
    input: 'Hello, and thank you for your time today. I have prepared a comprehensive overview of your universal life insurance policy. This presentation will walk you through your coverage, premiums, and how your cash value grows over time.',
    response_format: 'mp3',
    speed: 0.95,
  })
  const audioBuffer = Buffer.from(await speech.arrayBuffer())
  fs.writeFileSync('public/demo-presenter-audio.mp3', audioBuffer)
  console.log('  Audio saved (' + (audioBuffer.length / 1024).toFixed(0) + 'KB)')

  // Step 2: Generate a professional portrait
  console.log('Step 2: Generating presenter portrait...')
  const imgResponse = await genai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: 'Professional corporate headshot of a confident male insurance agent, age 40s, wearing dark navy suit and tie. Clean solid gray background, studio lighting, warm genuine smile, looking directly at camera. Shoulders and head visible. Photorealistic, high quality.',
    config: { responseFormat: { image: { aspectRatio: '1:1' } } },
  })
  let portraitBase64 = null
  for (const part of imgResponse.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData) {
      fs.writeFileSync('public/demo-presenter-face.png', Buffer.from(part.inlineData.data, 'base64'))
      portraitBase64 = part.inlineData.data
      console.log('  Portrait saved')
      break
    }
  }
  if (!portraitBase64) { console.error('No portrait generated'); return }

  // Step 3: Upload assets to Supabase for public URLs
  console.log('Step 3: Uploading assets for public URLs...')
  const { createClient } = require('@supabase/supabase-js')
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const portraitBuf = Buffer.from(portraitBase64, 'base64')
  await supabase.storage.from('videos').upload('demos/presenter-face.png', portraitBuf, { contentType: 'image/png', upsert: true })
  await supabase.storage.from('videos').upload('demos/presenter-audio.mp3', audioBuffer, { contentType: 'audio/mpeg', upsert: true })

  const { data: faceUrl } = supabase.storage.from('videos').getPublicUrl('demos/presenter-face.png')
  const { data: audioUrl } = supabase.storage.from('videos').getPublicUrl('demos/presenter-audio.mp3')
  console.log('  Face URL:', faceUrl.publicUrl)
  console.log('  Audio URL:', audioUrl.publicUrl)

  // Step 4: Call InfiniteTalk to create talking head video
  console.log('Step 4: Calling InfiniteTalk API...')

  const talkRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIE_KEY}`,
    },
    body: JSON.stringify({
      model: 'infinitalk/from-audio',
      input: {
        image_url: faceUrl.publicUrl,
        audio_url: audioUrl.publicUrl,
        prompt: 'Professional male insurance agent speaking to camera, natural head movements, warm expression, corporate office background',
        resolution: '720p',
      },
    }),
  })

  console.log('  Status:', talkRes.status)
  const talkData = await talkRes.json()
  console.log('  Response:', JSON.stringify(talkData).slice(0, 300))

  const taskId = talkData.data?.taskId ?? talkData.data?.task_id ?? talkData.task_id ?? talkData.taskId
  if (!taskId) {
    console.error('No task_id returned. Full response:', JSON.stringify(talkData))
    return
  }
  console.log('  Task ID:', taskId)

  // Step 5: Poll for completion
  console.log('Step 5: Waiting for video generation...')
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 10000))

    const statusRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { 'Authorization': `Bearer ${KIE_KEY}` },
    })
    if (!statusRes.ok) { console.log(`  Poll ${i + 1}: ${statusRes.status}`); continue }
    const statusData = await statusRes.json()
    if (i === 0) console.log('  Full response:', JSON.stringify(statusData).slice(0, 500))

    const state = statusData.data?.state ?? statusData.data?.status ?? statusData.status
    console.log(`  Poll ${i + 1}: ${state}`)

    if (state === 'completed' || state === 'success') {
      // Try to find the video URL in various response formats
      const videoUrl = statusData.data?.video_url
        ?? statusData.data?.output?.video_url
        ?? statusData.data?.result?.video_url
        ?? statusData.data?.result

      console.log('  Video URL:', videoUrl)

      if (videoUrl && typeof videoUrl === 'string' && videoUrl.startsWith('http')) {
        const vidRes = await fetch(videoUrl)
        const vidBuf = Buffer.from(await vidRes.arrayBuffer())
        fs.writeFileSync('public/demo-presenter-video.mp4', vidBuf)
        console.log(`  Video saved! (${(vidBuf.length / 1024 / 1024).toFixed(1)}MB)`)
      } else {
        console.log('  Full completed response:', JSON.stringify(statusData).slice(0, 1000))
      }
      break
    }

    if (state === 'failed' || state === 'fail') {
      console.error('  Generation failed:', JSON.stringify(statusData).slice(0, 500))
      break
    }
  }

  console.log('\nDone! Check public/ folder for outputs.')
}

main().catch(e => console.error('Fatal error:', e.message))
