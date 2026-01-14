/**
 * WorldBook 引擎
 *
 * 实现世界书的关键词匹配和消息注入
 * 支持:
 * - 主关键词 + 二级关键词匹配
 * - 常驻条目
 * - 递归扫描
 * - 深度注入
 * - Token 预算控制
 */

import { loggerService } from '@logger'

import type {
  WorldBook,
  WorldBookEntry,
  WorldBookEngineConfig,
  WorldBookInjectionResult,
  WorldBookMatchOptions,
  WorldBookMatchResult,
  WorldBookPosition
} from './types'

const logger = loggerService.withContext('WorldBookEngine')

/**
 * 消息结构 (用于注入)
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: WorldBookEngineConfig = {
  defaultScanDepth: 10,
  defaultTokenBudget: 2000,
  tokenCounter: (text: string) => Math.ceil(text.length / 4) // 简单估算
}

/**
 * WorldBook 引擎类
 */
export class WorldBookEngine {
  private config: WorldBookEngineConfig
  private books: Map<string, WorldBook> = new Map()
  private keywordIndex: Map<string, Set<{ bookId: string; entryId: number }>> = new Map()

  constructor(config?: Partial<WorldBookEngineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // ============================================================================
  // 世界书管理
  // ============================================================================

  /**
   * 加载世界书
   */
  loadBook(bookId: string, book: WorldBook): void {
    logger.info('Loading WorldBook', { bookId, entryCount: book.entries.length })

    this.books.set(bookId, book)
    this.indexBook(bookId, book)
  }

  /**
   * 卸载世界书
   */
  unloadBook(bookId: string): void {
    logger.info('Unloading WorldBook', { bookId })

    this.books.delete(bookId)
    this.removeBookFromIndex(bookId)
  }

  /**
   * 获取世界书
   */
  getBook(bookId: string): WorldBook | undefined {
    return this.books.get(bookId)
  }

  /**
   * 列出所有世界书
   */
  listBooks(): string[] {
    return Array.from(this.books.keys())
  }

  // ============================================================================
  // 关键词匹配
  // ============================================================================

  /**
   * 在文本中匹配世界书条目
   */
  matchText(text: string, bookId?: string, options?: WorldBookMatchOptions): WorldBookMatchResult[] {
    const results: WorldBookMatchResult[] = []
    const booksToSearch = bookId ? [bookId] : Array.from(this.books.keys())

    for (const id of booksToSearch) {
      const book = this.books.get(id)
      if (!book) continue

      const bookResults = this.matchInBook(text, book, options)
      results.push(...bookResults)
    }

    // 按优先级排序
    results.sort((a, b) => b.entry.priority - a.entry.priority)

    return results
  }

  /**
   * 在单个世界书中匹配
   */
  private matchInBook(text: string, book: WorldBook, _options?: WorldBookMatchOptions): WorldBookMatchResult[] {
    const results: WorldBookMatchResult[] = []
    const textLower = text.toLowerCase()

    for (const entry of book.entries) {
      // 跳过禁用的条目
      if (!entry.enabled) continue

      // 常驻条目直接添加
      if (entry.constant) {
        results.push({
          entry,
          matchedKeys: [],
          score: 1.0,
          isConstant: true
        })
        continue
      }

      // 匹配主关键词
      const matchedKeys = this.matchKeywords(entry.case_sensitive ? text : textLower, entry.keys, entry.case_sensitive)

      if (matchedKeys.length === 0) continue

      // 如果是选择性触发，还需要匹配二级关键词
      if (entry.selective && entry.secondary_keys.length > 0) {
        const secondaryMatches = this.matchKeywords(
          entry.case_sensitive ? text : textLower,
          entry.secondary_keys,
          entry.case_sensitive
        )

        if (secondaryMatches.length === 0) continue

        matchedKeys.push(...secondaryMatches)
      }

      // 计算匹配分数
      const score = this.calculateMatchScore(matchedKeys, entry)

      results.push({
        entry,
        matchedKeys,
        score,
        isConstant: false
      })
    }

    return results
  }

  /**
   * 匹配关键词列表
   */
  private matchKeywords(text: string, keywords: string[], caseSensitive: boolean): string[] {
    const matched: string[] = []
    const searchText = caseSensitive ? text : text.toLowerCase()

    for (const keyword of keywords) {
      const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase()

      // 支持正则表达式 (以 / 开头和结尾)
      if (keyword.startsWith('/') && keyword.endsWith('/')) {
        try {
          const regex = new RegExp(keyword.slice(1, -1), caseSensitive ? '' : 'i')
          if (regex.test(text)) {
            matched.push(keyword)
          }
        } catch {
          // 无效正则，跳过
        }
      } else {
        // 普通关键词匹配
        if (searchText.includes(searchKeyword)) {
          matched.push(keyword)
        }
      }
    }

    return matched
  }

  /**
   * 计算匹配分数
   */
  private calculateMatchScore(matchedKeys: string[], entry: WorldBookEntry): number {
    // 基础分数 = 匹配关键词数 / 总关键词数
    const totalKeys = entry.keys.length + (entry.selective ? entry.secondary_keys.length : 0)
    const baseScore = matchedKeys.length / Math.max(totalKeys, 1)

    // 优先级加成
    const priorityBonus = entry.priority / 100

    return Math.min(baseScore + priorityBonus, 1.0)
  }

  // ============================================================================
  // 消息注入
  // ============================================================================

  /**
   * 将匹配的世界书条目注入到消息列表
   */
  injectEntries(
    messages: ChatMessage[],
    matches: WorldBookMatchResult[],
    options?: WorldBookMatchOptions
  ): WorldBookInjectionResult {
    const tokenBudget = options?.tokenBudget ?? this.config.defaultTokenBudget!
    const tokenCounter = this.config.tokenCounter!

    // 按 insertion_order 排序
    const sortedMatches = [...matches].sort((a, b) => a.entry.insertion_order - b.entry.insertion_order)

    const injectedEntries: WorldBookMatchResult[] = []
    let totalTokens = 0

    // 按位置分组
    const positionGroups = new Map<WorldBookPosition, WorldBookMatchResult[]>()

    for (const match of sortedMatches) {
      const tokens = tokenCounter(match.entry.content)

      // 检查 Token 预算
      if (totalTokens + tokens > tokenBudget) {
        logger.warn('Token budget exceeded, skipping remaining entries', {
          totalTokens,
          budget: tokenBudget,
          skipped: match.entry.id
        })
        continue
      }

      totalTokens += tokens
      injectedEntries.push(match)

      const position = match.entry.position
      if (!positionGroups.has(position)) {
        positionGroups.set(position, [])
      }
      positionGroups.get(position)!.push(match)
    }

    // 执行注入
    this.performInjection(messages, positionGroups)

    return {
      injectedEntries,
      totalTokens,
      budgetExceeded: totalTokens >= tokenBudget
    }
  }

  /**
   * 执行实际的消息注入
   */
  private performInjection(
    messages: ChatMessage[],
    positionGroups: Map<WorldBookPosition, WorldBookMatchResult[]>
  ): ChatMessage[] {
    const result = [...messages]

    // 找到关键位置索引
    const systemIndex = result.findIndex((m) => m.role === 'system')
    const firstUserIndex = result.findIndex((m) => m.role === 'user')

    // 处理各个位置
    for (const [position, matches] of positionGroups) {
      const content = matches.map((m) => m.entry.content).join('\n\n')

      switch (position) {
        case 'before_system':
          if (systemIndex >= 0) {
            result.splice(systemIndex, 0, { role: 'system', content })
          } else {
            result.unshift({ role: 'system', content })
          }
          break

        case 'after_system':
          if (systemIndex >= 0) {
            result.splice(systemIndex + 1, 0, { role: 'system', content })
          } else {
            result.unshift({ role: 'system', content })
          }
          break

        case 'before_char':
          // 在角色定义之前 (通常是 system 消息的开头)
          if (systemIndex >= 0) {
            result[systemIndex].content = content + '\n\n' + result[systemIndex].content
          }
          break

        case 'after_char':
          // 在角色定义之后 (通常是 system 消息的末尾)
          if (systemIndex >= 0) {
            result[systemIndex].content = result[systemIndex].content + '\n\n' + content
          }
          break

        case 'before_example':
          // 在示例对话之前 (通常在 system 之后，user 之前)
          if (firstUserIndex >= 0) {
            result.splice(firstUserIndex, 0, { role: 'system', content })
          }
          break

        case 'after_example':
          // 在示例对话之后
          if (firstUserIndex >= 0) {
            result.splice(firstUserIndex, 0, { role: 'system', content })
          }
          break

        case 'depth':
          // 按深度注入 - 处理每个条目的 depth 值
          for (const match of matches) {
            const depth = match.entry.depth ?? 0
            const insertIndex = Math.max(0, result.length - depth)
            result.splice(insertIndex, 0, { role: 'system', content: match.entry.content })
          }
          break
      }
    }

    return result
  }

  // ============================================================================
  // 递归扫描
  // ============================================================================

  /**
   * 递归扫描 - 扫描已注入内容以触发更多条目
   */
  recursiveScan(
    messages: ChatMessage[],
    bookId: string,
    maxDepth: number = 3,
    options?: WorldBookMatchOptions
  ): WorldBookInjectionResult {
    const book = this.books.get(bookId)
    if (!book || !book.recursive_scanning) {
      return { injectedEntries: [], totalTokens: 0, budgetExceeded: false }
    }

    let currentMessages = [...messages]
    const allInjected: WorldBookMatchResult[] = []
    const injectedIds = new Set<number>()
    let totalTokens = 0
    let budgetExceeded = false

    for (let depth = 0; depth < maxDepth; depth++) {
      // 构建扫描文本
      const scanText = this.buildScanText(currentMessages, options?.scanDepth)

      // 匹配
      const matches = this.matchText(scanText, bookId, options)

      // 过滤已注入的条目
      const newMatches = matches.filter((m) => !injectedIds.has(m.entry.id))

      if (newMatches.length === 0) break

      // 注入
      const result = this.injectEntries(currentMessages, newMatches, options)

      allInjected.push(...result.injectedEntries)
      totalTokens += result.totalTokens
      budgetExceeded = result.budgetExceeded

      // 记录已注入的条目
      for (const match of result.injectedEntries) {
        injectedIds.add(match.entry.id)
      }

      if (budgetExceeded) break
    }

    return { injectedEntries: allInjected, totalTokens, budgetExceeded }
  }

  /**
   * 构建扫描文本
   */
  private buildScanText(messages: ChatMessage[], scanDepth?: number): string {
    const depth = scanDepth ?? this.config.defaultScanDepth!
    const relevantMessages = messages.slice(-depth)

    return relevantMessages.map((m) => m.content).join('\n')
  }

  // ============================================================================
  // 索引管理
  // ============================================================================

  /**
   * 索引世界书
   */
  private indexBook(bookId: string, book: WorldBook): void {
    for (const entry of book.entries) {
      if (!entry.enabled) continue

      for (const keyword of entry.keys) {
        const normalizedKey = keyword.toLowerCase()
        if (!this.keywordIndex.has(normalizedKey)) {
          this.keywordIndex.set(normalizedKey, new Set())
        }
        this.keywordIndex.get(normalizedKey)!.add({ bookId, entryId: entry.id })
      }
    }
  }

  /**
   * 从索引中移除世界书
   */
  private removeBookFromIndex(bookId: string): void {
    for (const [keyword, entries] of this.keywordIndex) {
      for (const entry of entries) {
        if (entry.bookId === bookId) {
          entries.delete(entry)
        }
      }
      if (entries.size === 0) {
        this.keywordIndex.delete(keyword)
      }
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 设置 Token 计算器
   */
  setTokenCounter(counter: (text: string) => number): void {
    this.config.tokenCounter = counter
  }

  /**
   * 获取统计信息
   */
  getStats(): { bookCount: number; entryCount: number; keywordCount: number } {
    let entryCount = 0
    for (const book of this.books.values()) {
      entryCount += book.entries.length
    }

    return {
      bookCount: this.books.size,
      entryCount,
      keywordCount: this.keywordIndex.size
    }
  }

  /**
   * 清空所有数据
   */
  clear(): void {
    this.books.clear()
    this.keywordIndex.clear()
    logger.info('WorldBookEngine cleared')
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

let engineInstance: WorldBookEngine | null = null

/**
 * 获取 WorldBookEngine 单例
 */
export function getWorldBookEngine(config?: Partial<WorldBookEngineConfig>): WorldBookEngine {
  if (!engineInstance) {
    engineInstance = new WorldBookEngine(config)
  }
  return engineInstance
}

/**
 * 重置 WorldBookEngine 单例
 */
export function resetWorldBookEngine(): void {
  if (engineInstance) {
    engineInstance.clear()
    engineInstance = null
  }
}
