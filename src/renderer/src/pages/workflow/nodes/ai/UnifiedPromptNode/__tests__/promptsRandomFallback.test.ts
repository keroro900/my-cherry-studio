import { describe, expect, it } from 'vitest'

import { buildEcomUserPrompt, buildPatternUserPrompt } from '../prompts'

describe('UnifiedPromptNode random fallback', () => {
  it('pattern: random patternType falls back to seamless', () => {
    const prompt = buildPatternUserPrompt({
      patternType: 'random',
      ageGroup: 'small_kid',
      gender: 'female'
    } as any)
    expect(prompt).toContain('"pattern_type": "seamless"')
  })

  it('ecom: random layout/fill/platform fallbacks applied', () => {
    const prompt = buildEcomUserPrompt({
      layoutMode: 'random',
      fillMode: 'random',
      platformStyle: 'random'
    } as any)
    expect(prompt).toContain('"layout_mode": "flat_lay"')
    expect(prompt).toContain('"fill_mode": "filled"')
    expect(prompt).toContain('"platform_style": "shein"')
  })
})
