import { describe, it, expect } from 'vitest'
import { fitSourceData } from '../app/_lib/source-data-fitter'

describe('fitSourceData', () => {
  const smallDoc = {
    title: 'Test Document',
    subtitle: 'A subtitle',
    source: 'test.pdf',
    keyMetrics: [{ label: 'Revenue', value: '$1M' }],
    sections: [
      { title: 'Overview', content: 'This is the overview.' },
      { title: 'Details', content: 'These are details.' },
    ],
    bulletPoints: ['Point 1', 'Point 2'],
    additionalNotes: ['Note 1'],
  }

  it('passes through a small document unchanged', () => {
    const result = fitSourceData(smallDoc, 30000)
    expect(result.wasTruncated).toBe(false)
    expect(result.droppedSections).toEqual([])
    expect(result.fitted).toEqual(smallDoc)
  })

  it('drops additionalNotes first when over limit', () => {
    const result = fitSourceData(smallDoc, 200)
    expect(result.wasTruncated).toBe(true)
    expect(result.droppedSections).toContain('additionalNotes')
    expect(result.fitted.additionalNotes).toEqual([])
  })

  it('preserves title and keyMetrics when trimming', () => {
    const hugeDoc = {
      title: 'Important Title',
      keyMetrics: [{ label: 'Revenue', value: '$1M' }],
      sections: Array.from({ length: 20 }, (_, i) => ({
        title: `Section ${i + 1}`,
        content: 'A'.repeat(2000),
      })),
      bulletPoints: Array.from({ length: 50 }, (_, i) => `Bullet ${i + 1}`),
      additionalNotes: Array.from({ length: 20 }, (_, i) => `Note ${i + 1}`),
    }

    const result = fitSourceData(hugeDoc, 5000)
    expect(result.wasTruncated).toBe(true)
    expect(result.fitted.title).toBe('Important Title')
    expect(result.fitted.keyMetrics.length).toBeGreaterThan(0)
    expect(JSON.stringify(result.fitted).length).toBeLessThanOrEqual(5000)
  })

  it('drops sections from the end, keeping the first ones', () => {
    const doc = {
      title: 'Test',
      sections: Array.from({ length: 10 }, (_, i) => ({
        title: `Section ${i + 1}`,
        content: 'X'.repeat(500),
      })),
      bulletPoints: [],
      additionalNotes: [],
    }

    const result = fitSourceData(doc, 2000)
    expect(result.wasTruncated).toBe(true)
    // First section should always survive
    expect(result.fitted.sections[0].title).toBe('Section 1')
    // Later sections should have been dropped
    expect(result.droppedSections.some((s: string) => s.includes('Section 10'))).toBe(true)
  })

  it('returns droppedSections list with descriptive names', () => {
    const doc = {
      title: 'Test',
      sections: [
        { title: 'Intro', content: 'X'.repeat(500) },
        { title: 'Body', content: 'X'.repeat(500) },
        { title: 'Appendix A', content: 'X'.repeat(500) },
        { title: 'Appendix B', content: 'X'.repeat(500) },
      ],
      bulletPoints: ['a', 'b', 'c'],
      additionalNotes: ['note'],
    }

    const result = fitSourceData(doc, 500)
    expect(result.wasTruncated).toBe(true)
    expect(result.droppedSections.length).toBeGreaterThan(0)
    // Every entry should be a non-empty string
    result.droppedSections.forEach((s: string) => {
      expect(typeof s).toBe('string')
      expect(s.length).toBeGreaterThan(0)
    })
  })
})
