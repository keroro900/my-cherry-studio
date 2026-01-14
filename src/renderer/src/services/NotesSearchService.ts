import { loggerService } from '@logger'
import type { NotesTreeNode } from '@renderer/types/note'

const logger = loggerService.withContext('NotesSearchService')

// ==================== Native Search Types ====================

/**
 * Native search result from IPC
 */
export interface NativeSearchResult {
  id: string
  filePath: string
  title: string
  content: string
  tags?: string[]
  searchScore: number
  updatedAt: string
}

/**
 * Native search response
 */
interface NativeSearchResponse {
  success: boolean
  results?: NativeSearchResult[]
  error?: string
}

/**
 * Native search stats
 */
export interface NativeSearchStats {
  available: boolean
  initialized: boolean
  documentCount?: number
}

// ==================== Native Search Functions ====================

/**
 * Check if Native search is available
 */
export async function isNativeSearchAvailable(): Promise<boolean> {
  try {
    const stats = await window.api.dailyNoteWrite.getSearchStats()
    return stats?.stats?.available === true
  } catch {
    return false
  }
}

/**
 * Initialize Native search index
 */
export async function initNativeSearchIndex(): Promise<{
  success: boolean
  indexed?: number
  error?: string
}> {
  try {
    return await window.api.dailyNoteWrite.initSearchIndex()
  } catch (error) {
    logger.error('Failed to initialize native search index', error as Error)
    return { success: false, error: String(error) }
  }
}

/**
 * Get Native search statistics
 */
export async function getNativeSearchStats(): Promise<NativeSearchStats> {
  try {
    const response = await window.api.dailyNoteWrite.getSearchStats()
    return response?.stats || { available: false, initialized: false }
  } catch {
    return { available: false, initialized: false }
  }
}

/**
 * Search using Native ChineseSearchEngine
 * Uses jieba tokenization + tantivy BM25 for better Chinese text search
 *
 * @param query - Search query
 * @param options - Search options
 * @returns Native search results
 */
export async function searchNative(
  query: string,
  options: {
    limit?: number
    minScore?: number
  } = {}
): Promise<NativeSearchResult[]> {
  const { limit = 20, minScore = 0.1 } = options

  try {
    const response: NativeSearchResponse = await window.api.dailyNoteWrite.fullTextSearch({
      query,
      limit,
      minScore
    })

    if (response?.success && response.results) {
      logger.debug('Native search completed', { query, results: response.results.length })
      return response.results
    }

    logger.warn('Native search returned no results', { query, response })
    return []
  } catch (error) {
    logger.error('Native search failed', { query, error: String(error) })
    return []
  }
}

/**
 * Hybrid search: try Native first, fallback to regex
 *
 * @param nodes - Notes tree nodes (for fallback)
 * @param keyword - Search keyword
 * @param options - Search options
 * @param signal - Abort signal
 * @returns Combined search results
 */
export async function searchHybrid(
  nodes: NotesTreeNode[],
  keyword: string,
  options: SearchOptions = {},
  signal?: AbortSignal
): Promise<SearchResult[]> {
  const startTime = performance.now()

  // Try Native search first
  const isNativeAvailable = await isNativeSearchAvailable()

  if (isNativeAvailable && !signal?.aborted) {
    try {
      const nativeResults = await searchNative(keyword, { limit: 50 })

      if (nativeResults.length > 0) {
        // Convert native results to SearchResult format
        const results: SearchResult[] = nativeResults.map((nr) => {
          // Find matching node from tree
          const fileNodes = flattenTreeToFiles(nodes)
          const matchingNode = fileNodes.find(
            (n) => n.externalPath.includes(nr.filePath) || n.name === nr.title + '.md'
          )

          // Create a result even if node not found
          const baseNode: NotesTreeNode = matchingNode || {
            id: nr.id,
            name: nr.title,
            type: 'file' as const,
            children: [],
            externalPath: nr.filePath,
            treePath: nr.filePath, // Required by NotesTreeNode
            createdAt: nr.updatedAt,
            updatedAt: nr.updatedAt
          }

          // Extract match context from content
          const matches: SearchMatch[] = []
          const lowerContent = nr.content.toLowerCase()
          const lowerKeyword = keyword.toLowerCase()
          let pos = lowerContent.indexOf(lowerKeyword)
          let matchCount = 0

          while (pos !== -1 && matchCount < 5) {
            const contextStart = Math.max(0, pos - 20)
            const contextEnd = Math.min(nr.content.length, pos + keyword.length + 50)
            matches.push({
              lineNumber: 1,
              lineContent: nr.content.slice(contextStart, contextEnd),
              matchStart: pos - contextStart,
              matchEnd: pos - contextStart + keyword.length,
              context: (contextStart > 0 ? '...' : '') + nr.content.slice(contextStart, contextEnd)
            })
            pos = lowerContent.indexOf(lowerKeyword, pos + 1)
            matchCount++
          }

          return {
            ...baseNode,
            matchType: matches.length > 0 ? ('content' as const) : ('filename' as const),
            matches,
            score: nr.searchScore * 100 // Scale to match existing scoring
          }
        })

        const duration = (performance.now() - startTime).toFixed(2)
        logger.debug(`Hybrid search (native) completed: duration=${duration}ms, results=${results.length}`)

        return results.sort((a, b) => b.score - a.score)
      }
    } catch (error) {
      logger.warn('Native search failed, falling back to regex', { error: String(error) })
    }
  }

  // Fallback to regex search
  return searchAllFiles(nodes, keyword, options, signal)
}

// ==================== Legacy Types ====================

/**
 * Search match result
 */
export interface SearchMatch {
  lineNumber: number
  lineContent: string
  matchStart: number
  matchEnd: number
  context: string
}

/**
 * Search result with match information
 */
export interface SearchResult extends NotesTreeNode {
  matchType: 'filename' | 'content' | 'both'
  matches?: SearchMatch[]
  score: number
}

/**
 * Search options
 */
export interface SearchOptions {
  caseSensitive?: boolean
  useRegex?: boolean
  maxFileSize?: number
  maxMatchesPerFile?: number
  contextLength?: number
}

/**
 * Escape regex special characters
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Calculate relevance score
 * - Filename match has higher priority
 * - More matches increase score
 * - More recent updates increase score
 */
export function calculateRelevanceScore(node: NotesTreeNode, keyword: string, matches: SearchMatch[]): number {
  let score = 0

  // Exact filename match (highest weight)
  if (node.name.toLowerCase() === keyword.toLowerCase()) {
    score += 200
  }
  // Filename contains match (high weight)
  else if (node.name.toLowerCase().includes(keyword.toLowerCase())) {
    score += 100
  }

  // Content match count
  score += Math.min(matches.length * 2, 50)

  // Recent updates boost score
  const daysSinceUpdate = (Date.now() - new Date(node.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  score += Math.max(0, 10 - daysSinceUpdate)

  return score
}

/**
 * Search file content for keyword matches
 */
export async function searchFileContent(
  node: NotesTreeNode,
  keyword: string,
  options: SearchOptions = {}
): Promise<SearchResult | null> {
  const {
    caseSensitive = false,
    useRegex = false,
    maxFileSize = 10 * 1024 * 1024, // 10MB
    maxMatchesPerFile = 50,
    contextLength = 50
  } = options

  try {
    if (node.type !== 'file') {
      return null
    }

    const content = await window.api.file.readExternal(node.externalPath)

    if (!content) {
      return null
    }

    if (content.length > maxFileSize) {
      logger.warn(`File too large to search: ${node.externalPath} (${content.length} bytes)`)
      return null
    }

    const flags = caseSensitive ? 'g' : 'gi'
    const pattern = useRegex ? new RegExp(keyword, flags) : new RegExp(escapeRegex(keyword), flags)

    const lines = content.split('\n')
    const matches: SearchMatch[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      pattern.lastIndex = 0

      let match: RegExpExecArray | null
      while ((match = pattern.exec(line)) !== null) {
        const matchStart = match.index
        const matchEnd = matchStart + match[0].length

        // Keep context short: only 2 chars before match, more after
        const beforeMatch = Math.min(2, matchStart)
        const contextStart = matchStart - beforeMatch
        const contextEnd = Math.min(line.length, matchEnd + contextLength)

        // Add ellipsis if context doesn't start at line beginning
        const prefix = contextStart > 0 ? '...' : ''
        const contextText = prefix + line.substring(contextStart, contextEnd)

        matches.push({
          lineNumber: i + 1,
          lineContent: line,
          matchStart: beforeMatch + prefix.length,
          matchEnd: matchEnd - matchStart + beforeMatch + prefix.length,
          context: contextText
        })

        if (matches.length >= maxMatchesPerFile) {
          break
        }
      }

      if (matches.length >= maxMatchesPerFile) {
        break
      }
    }

    if (matches.length === 0) {
      return null
    }

    const score = calculateRelevanceScore(node, keyword, matches)

    return {
      ...node,
      matchType: 'content',
      matches,
      score
    }
  } catch (error) {
    logger.error(`Failed to search file content for ${node.externalPath}:`, error as Error)
    return null
  }
}

/**
 * Check if filename matches keyword
 */
export function matchFileName(node: NotesTreeNode, keyword: string, caseSensitive = false): boolean {
  const name = caseSensitive ? node.name : node.name.toLowerCase()
  const key = caseSensitive ? keyword : keyword.toLowerCase()
  return name.includes(key)
}

/**
 * Flatten tree to extract file nodes
 */
export function flattenTreeToFiles(nodes: NotesTreeNode[]): NotesTreeNode[] {
  const result: NotesTreeNode[] = []

  function traverse(nodes: NotesTreeNode[]) {
    for (const node of nodes) {
      if (node.type === 'file') {
        result.push(node)
      }
      if (node.children && node.children.length > 0) {
        traverse(node.children)
      }
    }
  }

  traverse(nodes)
  return result
}

/**
 * Search all files concurrently
 */
export async function searchAllFiles(
  nodes: NotesTreeNode[],
  keyword: string,
  options: SearchOptions = {},
  signal?: AbortSignal
): Promise<SearchResult[]> {
  const startTime = performance.now()
  const CONCURRENCY = 5
  const results: SearchResult[] = []

  const fileNodes = flattenTreeToFiles(nodes)

  logger.debug(
    `Starting full-text search: keyword="${keyword}", totalFiles=${fileNodes.length}, options=${JSON.stringify(options)}`
  )

  const queue = [...fileNodes]

  const worker = async () => {
    while (queue.length > 0) {
      if (signal?.aborted) {
        break
      }

      const node = queue.shift()
      if (!node) break

      const nameMatch = matchFileName(node, keyword, options.caseSensitive)
      const contentResult = await searchFileContent(node, keyword, options)

      if (nameMatch && contentResult) {
        results.push({
          ...contentResult,
          matchType: 'both',
          score: contentResult.score + 100
        })
      } else if (nameMatch) {
        results.push({
          ...node,
          matchType: 'filename',
          matches: [],
          score: 100
        })
      } else if (contentResult) {
        results.push(contentResult)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, fileNodes.length) }, () => worker()))

  const sortedResults = results.sort((a, b) => b.score - a.score)

  const endTime = performance.now()
  const duration = (endTime - startTime).toFixed(2)

  logger.debug(
    `Full-text search completed: keyword="${keyword}", duration=${duration}ms, ` +
      `totalFiles=${fileNodes.length}, resultsFound=${sortedResults.length}, ` +
      `filenameMatches=${sortedResults.filter((r) => r.matchType === 'filename').length}, ` +
      `contentMatches=${sortedResults.filter((r) => r.matchType === 'content').length}, ` +
      `bothMatches=${sortedResults.filter((r) => r.matchType === 'both').length}`
  )

  return sortedResults
}
