/**
 * VCP Parser Utility
 *
 * Optimized single-pass parser for VCP markers in message content.
 * Replaces multiple separate extract functions with one unified parser.
 *
 * Performance improvements:
 * - Single regex scan instead of multiple passes
 * - Pre-compiled regex patterns
 * - Cached results via useMemo-friendly pure functions
 */

export type VCPPartType = 'markdown' | 'vcp-result' | 'vcp-request' | 'vcp-diary' | 'vcp-deep-memory'

export interface VCPPart {
  type: VCPPartType
  content: string
  resultType?: 'result' | 'error'
}

export interface VCPParseResult {
  parts: VCPPart[]
  hasVCPMarkers: boolean
  counts: {
    results: number
    requests: number
    dailyNotes: number
    deepMemory: number
  }
}

// Pre-compiled regex patterns for quick checks (more performant than creating new RegExp each time)
const QUICK_CHECK_STRINGS = [
  '<<<[TOOL_',
  '<<[TOOL_',
  '<<<DailyNoteStart>>>',
  '<<<[DEEP_MEMORY',
  '[[VCP调用结果'
] as const

/**
 * Fast check if content might contain VCP markers.
 * Uses simple string includes for speed.
 */
export function mayContainVCPMarkers(content: string): boolean {
  if (!content || content.length < 10) return false

  for (const marker of QUICK_CHECK_STRINGS) {
    if (content.includes(marker)) {
      return true
    }
  }
  return false
}

// Pre-compiled combined pattern for all VCP markers
// This pattern is created once and reused for all parsing operations
const VCP_COMBINED_PATTERN =
  /<<<?\[(TOOL_RESULT|TOOL_ERROR)\]>>>?([\s\S]*?)<<<?\[\/\1\]>>>?|<<<?\[TOOL_REQUEST\]>>>?([\s\S]*?)<<<?\[END_TOOL_REQUEST\]>>>?|<<<DailyNoteStart>>>([\s\S]*?)<<<DailyNoteEnd>>>|<<<\[DEEP_MEMORY(?:_RETRIEVAL)?\]>>>([\s\S]*?)<<<\[\/DEEP_MEMORY(?:_RETRIEVAL)?\]>>>|\[\[VCP调用结果信息汇总:([\s\S]*?)VCP调用结果结束\]\]/g

/**
 * Parse VCP markers from content in a single pass.
 * Returns structured parts array and metadata.
 *
 * @param content - The message content to parse
 * @returns VCPParseResult with parts array and counts
 */
export function parseVCPContent(content: string): VCPParseResult {
  const emptyResult: VCPParseResult = {
    parts: [{ type: 'markdown', content }],
    hasVCPMarkers: false,
    counts: { results: 0, requests: 0, dailyNotes: 0, deepMemory: 0 }
  }

  if (!content) {
    return { ...emptyResult, parts: [] }
  }

  // Quick check first
  if (!mayContainVCPMarkers(content)) {
    return emptyResult
  }

  const parts: VCPPart[] = []
  const counts = { results: 0, requests: 0, dailyNotes: 0, deepMemory: 0 }

  // Reset lastIndex for global regex
  VCP_COMBINED_PATTERN.lastIndex = 0

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = VCP_COMBINED_PATTERN.exec(content)) !== null) {
    // Add markdown content before this match
    if (match.index > lastIndex) {
      const beforeContent = content.slice(lastIndex, match.index).trim()
      if (beforeContent) {
        parts.push({ type: 'markdown', content: beforeContent })
      }
    }

    // Determine which pattern matched based on capture groups
    if (match[4] !== undefined) {
      // DailyNote match (group 4)
      parts.push({
        type: 'vcp-diary',
        content: match[4].trim()
      })
      counts.dailyNotes++
    } else if (match[5] !== undefined) {
      // Deep Memory match (group 5)
      parts.push({
        type: 'vcp-deep-memory',
        content: match[5].trim()
      })
      counts.deepMemory++
    } else if (match[6] !== undefined) {
      // VCPChat legacy tool result format (group 6)
      parts.push({
        type: 'vcp-result',
        resultType: 'result',
        content: match[6].trim()
      })
      counts.results++
    } else if (match[3] !== undefined) {
      // TOOL_REQUEST match (group 3)
      parts.push({
        type: 'vcp-request',
        content: match[3].trim()
      })
      counts.requests++
    } else if (match[1] !== undefined && match[2] !== undefined) {
      // TOOL_RESULT or TOOL_ERROR match (groups 1 and 2)
      parts.push({
        type: 'vcp-result',
        resultType: match[1] === 'TOOL_RESULT' ? 'result' : 'error',
        content: match[2].trim()
      })
      counts.results++
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining markdown content after last match
  if (lastIndex < content.length) {
    const afterContent = content.slice(lastIndex).trim()
    if (afterContent) {
      parts.push({ type: 'markdown', content: afterContent })
    }
  }

  const hasVCPMarkers = counts.results + counts.requests + counts.dailyNotes + counts.deepMemory > 0

  if (!hasVCPMarkers) {
    return emptyResult
  }

  return {
    parts: parts.length > 0 ? parts : [{ type: 'markdown', content }],
    hasVCPMarkers,
    counts
  }
}

/**
 * Memoization helper for VCP parsing.
 * Creates a cache key from content hash for efficient lookups.
 */
const parseCache = new Map<string, VCPParseResult>()
const MAX_CACHE_SIZE = 100

/**
 * Parse VCP content with caching.
 * Uses a simple LRU-like cache to avoid reparsing the same content.
 *
 * @param content - The message content to parse
 * @returns Cached or freshly parsed VCPParseResult
 */
export function parseVCPContentCached(content: string): VCPParseResult {
  if (!content) {
    return {
      parts: [],
      hasVCPMarkers: false,
      counts: { results: 0, requests: 0, dailyNotes: 0, deepMemory: 0 }
    }
  }

  // Use content length + first/last chars as a quick cache key
  // Full hash would be more accurate but slower
  const cacheKey = `${content.length}:${content.slice(0, 50)}:${content.slice(-50)}`

  const cached = parseCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const result = parseVCPContent(content)

  // Simple cache eviction - clear oldest entries when full
  if (parseCache.size >= MAX_CACHE_SIZE) {
    const firstKey = parseCache.keys().next().value
    if (firstKey) {
      parseCache.delete(firstKey)
    }
  }

  parseCache.set(cacheKey, result)
  return result
}

/**
 * Clear the parse cache.
 * Call this when memory needs to be freed or content changes significantly.
 */
export function clearVCPParseCache(): void {
  parseCache.clear()
}
