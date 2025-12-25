import { describe, expect, it } from 'vitest'

import { extractJsonFromText } from './extractJson'

describe('extractJsonFromText', () => {
  it('extracts JSON object from plain text', () => {
    const result = extractJsonFromText('{"a":1,"b":"x"}')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({ a: 1, b: 'x' })
  })

  it('extracts JSON object from fenced code block', () => {
    const result = extractJsonFromText('```json\n{"a":1}\n```')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({ a: 1 })
  })

  it('extracts first balanced JSON object within text', () => {
    const result = extractJsonFromText('prefix\n{"a":1,"b":{"c":2}}\npost')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({ a: 1, b: { c: 2 } })
  })

  it('handles braces inside JSON strings', () => {
    const text = 'note {"a":"{not a block}","b":"x } y","n":2} end'
    const result = extractJsonFromText(text)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({ a: '{not a block}', b: 'x } y', n: 2 })
  })

  it('returns error when no JSON found', () => {
    const result = extractJsonFromText('no json here')
    expect(result.ok).toBe(false)
  })
})
