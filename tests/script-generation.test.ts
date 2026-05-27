import { describe, it, expect } from 'vitest'
import { generateScript } from '../app/_lib/script-generator'
import type { VideoScene } from '../app/_lib/types'
import * as fs from 'fs/promises'
import * as path from 'path'
import { config } from 'dotenv'

// Load env vars for API keys
config({ path: path.resolve(__dirname, '../.env.local') })

const FIXTURES = [
  'insurance-illustration',
  'financial-portfolio',
  'real-estate-listing',
  'marketing-onepager',
  'scraped-website',
  'short-text-input',
]

// Default params for generateScript calls
const DEFAULT_COLORS = {
  primary: '#1a3668',
  secondary: '#2a5090',
  accent: '#cc0000',
  background: '#f0f4f8',
  text: '#1a1a2e',
}

// Map fixture names to the specific params generateScript needs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCallParams(fixtureName: string, source: Record<string, any>) {
  const base = {
    brandName: source.agentInfo?.agency || source.title?.split('—')[0]?.trim() || 'Test Brand',
    colors: DEFAULT_COLORS,
    detailed: false,
    assetCount: 0,
    voiceId: 'nova',
    brandTone: undefined as string | undefined,
    contactInfo: undefined as { phone?: string; email?: string; calendly?: string } | undefined,
    purpose: undefined as string | undefined,
    uploadMode: undefined as string | undefined,
    industry: source.industry || undefined as string | undefined,
    detailLevel: 'standard' as 'quick' | 'standard' | 'detailed',
    narrationStyle: 'solo' as 'solo' | 'podcast',
  }

  // Insurance fixture has contactInfo nested
  if (source.contactInfo) {
    base.contactInfo = {
      phone: source.contactInfo.phone,
      email: source.contactInfo.email,
    }
  }
  // Scraped website fixture
  if (fixtureName === 'scraped-website') {
    base.contactInfo = { phone: '1-888-274-2739', email: 'agents@apexaffinitygroup.com' }
  }
  // Short text — use quick mode
  if (fixtureName === 'short-text-input') {
    base.detailLevel = 'quick'
  }

  return base
}

describe('Script Generation — Golden Tests', () => {
  for (const fixtureName of FIXTURES) {
    it(`generates expected script for ${fixtureName}`, async () => {
      const sourcePath = path.resolve(__dirname, `fixtures/sources/${fixtureName}.json`)
      const source = JSON.parse(await fs.readFile(sourcePath, 'utf-8'))
      const goldenPath = path.resolve(__dirname, `fixtures/golden/${fixtureName}.json`)
      const params = getCallParams(fixtureName, source)

      const result = await generateScript(
        source,
        params.brandName,
        params.colors,
        params.detailed,
        params.assetCount,
        params.voiceId,
        params.brandTone,
        params.contactInfo,
        params.purpose,
        params.uploadMode,
        params.industry,
        params.detailLevel,
        params.narrationStyle,
      )

      // Verify result is a non-empty array of scenes
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)

      // Every scene must have required fields
      for (const scene of result) {
        expect(scene).toHaveProperty('narration')
        expect(scene).toHaveProperty('beat')
        expect(scene).toHaveProperty('slidePrompt')
        expect(typeof scene.narration).toBe('string')
        expect(scene.narration.length).toBeGreaterThan(5)
      }

      // UPDATE_GOLDEN mode: write golden and skip comparison
      if (process.env.UPDATE_GOLDEN === 'true') {
        await fs.writeFile(goldenPath, JSON.stringify(result, null, 2))
        console.log(`Wrote golden output for ${fixtureName} (${result.length} scenes)`)
        return
      }

      // Normal mode: compare against existing golden
      let goldenRaw: string
      try {
        goldenRaw = await fs.readFile(goldenPath, 'utf-8')
      } catch (err: unknown) {
        if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new Error(
            `No golden file for ${fixtureName}. Run with UPDATE_GOLDEN=true to create.`
          )
        }
        throw err
      }

      const golden = JSON.parse(goldenRaw)
      const comparison = structuralComparison(result, golden, fixtureName)
      if (!comparison.pass) {
        console.error(`Structural mismatch for ${fixtureName}:`, comparison.reason)
      }
      expect(comparison.pass).toBe(true)
    })
  }
})

interface ComparisonResult {
  pass: boolean
  reason?: string
}

/**
 * Compare structure, not exact text (LLM output varies).
 * Verifies: scene count in expected range, all required beats present,
 * required fields per scene, narration length within bounds.
 */
function structuralComparison(actual: VideoScene[], golden: VideoScene[], fixtureName: string): ComparisonResult {
  // Scene count within ±3 of golden
  if (Math.abs(actual.length - golden.length) > 3) {
    return {
      pass: false,
      reason: `Scene count mismatch: got ${actual.length}, golden has ${golden.length} (tolerance ±3)`,
    }
  }

  // Same core beats present (allow ±2 evidence scenes)
  const actualBeats = actual.map((s: VideoScene) => s.beat)
  const goldenBeats = golden.map((s: VideoScene) => s.beat)

  // Check required beats are present
  const requiredBeats: VideoScene['beat'][] = ['hook', 'action']
  for (const beat of requiredBeats) {
    if (!actualBeats.includes(beat)) {
      return { pass: false, reason: `Missing required beat: ${beat}` }
    }
  }

  // For insurance fixtures, check disclaimer beats
  if (fixtureName === 'insurance-illustration') {
    // Disclaimers may appear — check at least one structural beat is shared
    const goldenCoreBeatSet = new Set(goldenBeats.filter((b: string) => b !== 'evidence'))
    const actualCoreBeatSet = new Set(actualBeats.filter((b: string) => b !== 'evidence'))
    const shared = [...goldenCoreBeatSet].filter((b) => actualCoreBeatSet.has(b))
    if (shared.length < 3) {
      return {
        pass: false,
        reason: `Too few shared core beats: ${shared.join(', ')} (need ≥3)`,
      }
    }
  }

  // Every scene has required fields
  for (let i = 0; i < actual.length; i++) {
    const scene = actual[i]
    if (!scene.narration || typeof scene.narration !== 'string') {
      return { pass: false, reason: `Scene ${i + 1} missing narration` }
    }
    if (!scene.beat) {
      return { pass: false, reason: `Scene ${i + 1} missing beat tag` }
    }
    if (scene.narration.length < 10) {
      return { pass: false, reason: `Scene ${i + 1} narration too short (${scene.narration.length} chars)` }
    }
  }

  return { pass: true }
}
