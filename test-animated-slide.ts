// Run with: npx tsx test-animated-slide.ts
import { generateAnimatedSlide } from './app/_lib/animated-slide'
import { writeFile } from 'fs/promises'

async function main() {
  console.log('Testing animated slide generation...\n')

  const result = await generateAnimatedSlide(
    // Style: blue-steps
    'Clean modern blue-steps infographic style. Blue gradient background, white cards, clear data hierarchy, step-by-step visual flow. Professional and trustworthy.',
    // Slide data
    {
      title: 'Your Policy at a Glance',
      subtitle: 'American General — Indexed Universal Life',
      metrics: [
        { label: 'Death Benefit', value: '$500,000', highlight: true },
        { label: 'Annual Premium', value: '$4,200' },
        { label: 'Cash Value (Year 10)', value: '$68,500', highlight: true },
        { label: 'Payment Mode', value: 'Annual' },
      ],
      brandName: 'Henderson Financial',
      brandBar: {
        name: 'Henderson Financial Group',
        phone: '(555) 234-5678',
        website: 'hendersonfinancial.com',
      },
    },
    // Colors
    {
      primary: '#1B365D',
      secondary: '#4A90D9',
      accent: '#C7E8A8',
      background: '#0a1628',
      text: '#FFFFFF',
    },
    // Audio duration (seconds)
    8
  )

  await writeFile('public/test-animated-slide.mp4', result)
  console.log('\nSaved to public/test-animated-slide.mp4')
  console.log('View at: http://localhost:3002/test-animated-slide.mp4')
}

main().catch(console.error)
