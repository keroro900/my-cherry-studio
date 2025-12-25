export type ExtractedJson =
  | { ok: true; value: unknown; source: 'code_fence' | 'bracket_match' }
  | { ok: false; error: string }

/**
 * JSON Schema 验证结果
 */
export type JsonValidationResult =
  | { valid: true; value: unknown }
  | { valid: false; error: string; missingKeys?: string[] }

function getFirstCodeFenceBlock(text: string): string | null {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return match?.[1]?.trim() || null
}

function findFirstJsonStart(text: string): { index: number; open: '{' | '[' } | null {
  const trimmed = text.trim()
  const obj = trimmed.indexOf('{')
  const arr = trimmed.indexOf('[')

  if (obj === -1 && arr === -1) return null
  if (obj === -1) return { index: arr, open: '[' }
  if (arr === -1) return { index: obj, open: '{' }
  return obj < arr ? { index: obj, open: '{' } : { index: arr, open: '[' }
}

function matchBrackets(text: string, startIndex: number, open: '{' | '['): string | null {
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let quote: '"' | "'" | null = null
  let escaped = false

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (quote && ch === quote) {
        inString = false
        quote = null
      }
      continue
    }

    if (ch === '"' || ch === "'") {
      inString = true
      quote = ch
      continue
    }

    if (ch === open) {
      depth++
      continue
    }

    if (ch === close) {
      depth--
      if (depth === 0) {
        return text.slice(startIndex, i + 1)
      }
    }
  }

  return null
}

export function extractJsonFromText(text: string): ExtractedJson {
  const fenced = getFirstCodeFenceBlock(text)
  if (fenced) {
    try {
      return { ok: true, value: JSON.parse(fenced), source: 'code_fence' }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  const start = findFirstJsonStart(text)
  if (!start) return { ok: false, error: 'No JSON start token found' }

  const slice = matchBrackets(text.trim(), start.index, start.open)
  if (!slice) return { ok: false, error: 'Unclosed JSON brackets' }

  try {
    return { ok: true, value: JSON.parse(slice), source: 'bracket_match' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 验证 JSON 对象是否包含必需的键
 *
 * @param json 要验证的 JSON 对象
 * @param requiredKeys 必需的键名列表
 * @returns 验证结果
 *
 * @example
 * const result = validateJsonSchema({ name: 'test' }, ['name', 'id'])
 * // { valid: false, error: '缺少必需字段: id', missingKeys: ['id'] }
 */
export function validateJsonSchema(json: unknown, requiredKeys: string[]): JsonValidationResult {
  if (json === null || json === undefined) {
    return { valid: false, error: 'JSON 值为空' }
  }

  if (typeof json !== 'object' || Array.isArray(json)) {
    return { valid: false, error: 'JSON 必须是对象类型' }
  }

  const obj = json as Record<string, unknown>
  const missingKeys: string[] = []

  for (const key of requiredKeys) {
    if (!(key in obj) || obj[key] === undefined) {
      missingKeys.push(key)
    }
  }

  if (missingKeys.length > 0) {
    return {
      valid: false,
      error: `缺少必需字段: ${missingKeys.join(', ')}`,
      missingKeys
    }
  }

  return { valid: true, value: json }
}

/**
 * 从文本中提取并验证 JSON
 *
 * @param text 包含 JSON 的文本
 * @param requiredKeys 可选的必需键名列表
 * @returns 提取和验证结果
 *
 * @example
 * const result = extractAndValidateJson('```json\n{"name": "test"}\n```', ['name', 'id'])
 * // { ok: false, error: '缺少必需字段: id' }
 */
export function extractAndValidateJson(text: string, requiredKeys?: string[]): ExtractedJson {
  const extracted = extractJsonFromText(text)

  if (!extracted.ok) {
    return extracted
  }

  if (requiredKeys && requiredKeys.length > 0) {
    const validation = validateJsonSchema(extracted.value, requiredKeys)
    if (!validation.valid) {
      return { ok: false, error: validation.error }
    }
  }

  return extracted
}

/**
 * 尝试修复常见的 JSON 格式错误
 *
 * @param text 可能格式错误的 JSON 文本
 * @returns 修复后的文本
 */
export function tryFixJson(text: string): string {
  let fixed = text.trim()

  // 移除尾部逗号 (常见错误)
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1')

  // 修复单引号（非标准但常见）
  // 注意：这可能会破坏包含撇号的字符串值，所以只在解析失败时尝试
  // fixed = fixed.replace(/'/g, '"')

  return fixed
}

/**
 * 安全地从文本中提取 JSON，自动尝试修复格式错误
 *
 * @param text 包含 JSON 的文本
 * @returns 提取结果
 */
export function safeExtractJson(text: string): ExtractedJson {
  // 首先尝试正常提取
  const result = extractJsonFromText(text)
  if (result.ok) {
    return result
  }

  // 尝试修复后再提取
  const fixed = tryFixJson(text)
  if (fixed !== text) {
    const fixedResult = extractJsonFromText(fixed)
    if (fixedResult.ok) {
      return fixedResult
    }
  }

  return result
}
