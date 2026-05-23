import { describe, it, expect } from 'vitest'
import { detectIndustry } from '../app/_lib/industries'

describe('detectIndustry (regex fallback)', () => {
  it('detects insurance documents', () => {
    const result = detectIndustry(
      'Life Insurance Policy Illustration',
      'This policy provides a death benefit of $500,000 with an annual premium of $3,200. The cash value grows tax-deferred.'
    )
    expect(result).toBe('insurance')
  })

  it('detects financial services documents', () => {
    const result = detectIndustry(
      'Q4 Portfolio Review',
      'Your portfolio allocation includes 60% equity, 30% bonds, and 10% alternative investments. Total return was 12.5%.'
    )
    expect(result).toBe('financial')
  })

  it('detects real estate documents', () => {
    const result = detectIndustry(
      '123 Main St Property Listing',
      'This beautiful 3 bedroom, 2 bathroom home features 2,400 square feet. MLS #12345. HOA dues are $250/month.'
    )
    expect(result).toBe('real_estate')
  })

  it('detects technology documents', () => {
    const result = detectIndustry(
      'Cloud Platform Overview',
      'Our SaaS platform provides API integration, cloud deployment, and AI-powered automation with enterprise scalability.'
    )
    expect(result).toBe('technology')
  })

  it('returns general for ambiguous content', () => {
    const result = detectIndustry(
      'Meeting Notes',
      'We discussed the upcoming event and decided on next steps.'
    )
    expect(result).toBe('general')
  })

  it('gives extra weight to title matches', () => {
    // "policy" in the title should push toward insurance
    const result = detectIndustry(
      'Policy Coverage Summary',
      'This document describes the coverage and premium details for the policyholder.'
    )
    expect(result).toBe('insurance')
  })
})
