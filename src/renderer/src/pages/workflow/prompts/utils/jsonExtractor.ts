/**
 * JSON 提取工具
 * 从 AI 响应文本中提取 JSON 对象，支持多种格式
 */

/**
 * 检查字符串是否为有效的 JSON
 */
function isValidJson(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

/**
 * 使用平衡括号匹配算法提取第一个完整的 JSON 对象
 * 正确处理字符串内的大括号和转义字符
 */
function extractBalancedJson(text: string): string | null {
  const startIndex = text.indexOf('{')
  if (startIndex === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i]

    // 处理转义字符
    if (escaped) {
      escaped = false
      continue
    }

    // 在字符串内检测转义
    if (char === '\\' && inString) {
      escaped = true
      continue
    }

    // 切换字符串状态
    if (char === '"') {
      inString = !inString
      continue
    }

    // 在字符串内跳过大括号
    if (inString) continue

    // 跟踪大括号深度
    if (char === '{') depth++
    if (char === '}') {
      depth--
      if (depth === 0) {
        const jsonCandidate = text.substring(startIndex, i + 1)
        // 验证提取的 JSON 是否有效
        if (isValidJson(jsonCandidate)) {
          return jsonCandidate
        }
        // 如果无效，继续查找下一个可能的 JSON
        return extractBalancedJson(text.substring(i + 1))
      }
    }
  }

  return null // 未找到匹配的闭合括号
}

/**
 * 从文本中提取 JSON 对象
 *
 * 策略优先级：
 * 1. 查找 fenced code block (```json ... ``` 或 ``` ... ```)
 * 2. 使用平衡括号匹配提取第一个完整的 JSON 对象
 * 3. 尝试非贪婪正则匹配作为最后手段
 *
 * @param text - 包含 JSON 的文本
 * @returns 提取的 JSON 字符串，如果未找到则返回 null
 */
export function extractJsonFromText(text: string): string | null {
  if (!text || typeof text !== 'string') return null

  // 策略 1: 优先查找 fenced code block
  // 支持 ```json 和 ``` 两种格式
  const fencedMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (fencedMatch) {
    const content = fencedMatch[1].trim()
    if (content && isValidJson(content)) {
      return content
    }
  }

  // 策略 2: 平衡括号匹配（主要策略）
  const balancedJson = extractBalancedJson(text)
  if (balancedJson) {
    return balancedJson
  }

  // 策略 3: 非贪婪正则作为最后手段
  // 注意：这只能处理简单的单层 JSON，复杂嵌套可能失败
  const simpleMatch = text.match(/\{[^{}]*\}/)
  if (simpleMatch && isValidJson(simpleMatch[0])) {
    return simpleMatch[0]
  }

  return null
}

/**
 * 从文本中提取并解析 JSON 对象
 *
 * @param text - 包含 JSON 的文本
 * @returns 解析后的对象，如果提取或解析失败则返回 null
 */
export function extractAndParseJson<T = unknown>(text: string): T | null {
  const jsonString = extractJsonFromText(text)
  if (!jsonString) return null

  try {
    return JSON.parse(jsonString) as T
  } catch {
    return null
  }
}
