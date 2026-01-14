/**
 * ContextPurifier - 上下文净化器
 *
 * 实现 VCPSuper 风格的上下文清理：
 * 1. 格式对齐 (空格、换行、引号、括号)
 * 2. Token 溢出控制
 * 3. 重复内容清理
 * 4. 敏感信息过滤
 *
 * @version 1.0.0
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('ContextPurifier')

/**
 * 净化配置
 */
export interface PurifierConfig {
  /** 最大 Token 数 (估算) */
  maxTokens?: number
  /** 最大字符数 */
  maxChars?: number
  /** 是否清理重复内容 */
  removeDuplicates?: boolean
  /** 重复检测阈值 (0-1) */
  duplicateThreshold?: number
  /** 是否格式化空白 */
  normalizeWhitespace?: boolean
  /** 是否统一引号 */
  normalizeQuotes?: boolean
  /** 是否移除多余换行 */
  collapseNewlines?: boolean
  /** 最大连续换行数 */
  maxConsecutiveNewlines?: number
  /** 是否过滤敏感信息 */
  filterSensitive?: boolean
  /** 敏感词列表 */
  sensitivePatterns?: RegExp[]
  /** 是否保留代码块格式 */
  preserveCodeBlocks?: boolean
  /** 截断策略 */
  truncateStrategy?: 'head' | 'tail' | 'middle' | 'smart'
}

/**
 * 净化结果
 */
export interface PurifyResult {
  content: string
  originalLength: number
  purifiedLength: number
  estimatedTokens: number
  modifications: PurifyModification[]
  truncated: boolean
  duplicatesRemoved: number
}

/**
 * 修改记录
 */
export interface PurifyModification {
  type: 'whitespace' | 'newline' | 'quote' | 'duplicate' | 'sensitive' | 'truncate'
  description: string
  position?: number
  count?: number
}

/**
 * 上下文净化器
 */
export class ContextPurifier {
  private config: Required<PurifierConfig>

  constructor(config: PurifierConfig = {}) {
    this.config = {
      maxTokens: config.maxTokens ?? 8000,
      maxChars: config.maxChars ?? 32000,
      removeDuplicates: config.removeDuplicates ?? true,
      duplicateThreshold: config.duplicateThreshold ?? 0.9,
      normalizeWhitespace: config.normalizeWhitespace ?? true,
      normalizeQuotes: config.normalizeQuotes ?? true,
      collapseNewlines: config.collapseNewlines ?? true,
      maxConsecutiveNewlines: config.maxConsecutiveNewlines ?? 2,
      filterSensitive: config.filterSensitive ?? false,
      sensitivePatterns: config.sensitivePatterns ?? [],
      preserveCodeBlocks: config.preserveCodeBlocks ?? true,
      truncateStrategy: config.truncateStrategy ?? 'smart'
    }
  }

  /**
   * 净化上下文
   */
  purify(content: string): PurifyResult {
    const originalLength = content.length
    const modifications: PurifyModification[] = []
    let purified = content
    let duplicatesRemoved = 0

    logger.debug('Starting context purification', { originalLength })

    // 1. 提取并保护代码块
    const codeBlocks: Map<string, string> = new Map()
    if (this.config.preserveCodeBlocks) {
      purified = this.extractCodeBlocks(purified, codeBlocks)
    }

    // 2. 格式化空白
    if (this.config.normalizeWhitespace) {
      const before = purified.length
      purified = this.normalizeWhitespace(purified)
      if (purified.length !== before) {
        modifications.push({
          type: 'whitespace',
          description: 'Normalized whitespace',
          count: before - purified.length
        })
      }
    }

    // 3. 统一引号
    if (this.config.normalizeQuotes) {
      const { text, count } = this.normalizeQuotes(purified)
      if (count > 0) {
        purified = text
        modifications.push({
          type: 'quote',
          description: 'Normalized quotes',
          count
        })
      }
    }

    // 4. 折叠换行
    if (this.config.collapseNewlines) {
      const before = purified.length
      purified = this.collapseNewlines(purified)
      if (purified.length !== before) {
        modifications.push({
          type: 'newline',
          description: `Collapsed excessive newlines (max ${this.config.maxConsecutiveNewlines})`,
          count: before - purified.length
        })
      }
    }

    // 5. 移除重复内容
    if (this.config.removeDuplicates) {
      const { text, removed } = this.removeDuplicates(purified)
      if (removed > 0) {
        purified = text
        duplicatesRemoved = removed
        modifications.push({
          type: 'duplicate',
          description: 'Removed duplicate content',
          count: removed
        })
      }
    }

    // 6. 过滤敏感信息
    if (this.config.filterSensitive && this.config.sensitivePatterns.length > 0) {
      const { text, count } = this.filterSensitive(purified)
      if (count > 0) {
        purified = text
        modifications.push({
          type: 'sensitive',
          description: 'Filtered sensitive content',
          count
        })
      }
    }

    // 7. 恢复代码块
    if (this.config.preserveCodeBlocks) {
      purified = this.restoreCodeBlocks(purified, codeBlocks)
    }

    // 8. Token/长度截断
    let truncated = false
    const estimatedTokens = this.estimateTokens(purified)

    if (estimatedTokens > this.config.maxTokens || purified.length > this.config.maxChars) {
      const targetLength = Math.min(
        this.config.maxChars,
        Math.floor(this.config.maxTokens * 4) // 粗略估算: 1 token ≈ 4 chars
      )

      purified = this.truncate(purified, targetLength)
      truncated = true
      modifications.push({
        type: 'truncate',
        description: `Truncated using ${this.config.truncateStrategy} strategy`,
        count: originalLength - purified.length
      })
    }

    const result: PurifyResult = {
      content: purified,
      originalLength,
      purifiedLength: purified.length,
      estimatedTokens: this.estimateTokens(purified),
      modifications,
      truncated,
      duplicatesRemoved
    }

    logger.info('Context purification complete', {
      originalLength,
      purifiedLength: result.purifiedLength,
      modificationsCount: modifications.length,
      truncated
    })

    return result
  }

  /**
   * 提取代码块
   */
  private extractCodeBlocks(text: string, blocks: Map<string, string>): string {
    const codeBlockRegex = /```[\s\S]*?```|`[^`]+`/g
    let index = 0

    return text.replace(codeBlockRegex, (match) => {
      const placeholder = `__CODE_BLOCK_${index++}__`
      blocks.set(placeholder, match)
      return placeholder
    })
  }

  /**
   * 恢复代码块
   */
  private restoreCodeBlocks(text: string, blocks: Map<string, string>): string {
    let result = text
    for (const [placeholder, code] of blocks) {
      result = result.replace(placeholder, code)
    }
    return result
  }

  /**
   * 格式化空白
   */
  private normalizeWhitespace(text: string): string {
    // 将多个空格替换为单个空格 (但保留换行)
    return text
      .split('\n')
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .join('\n')
  }

  /**
   * 统一引号
   */
  private normalizeQuotes(text: string): { text: string; count: number } {
    let count = 0

    // 中文引号 → 英文引号
    const normalized = text
      .replace(/[""]/g, () => {
        count++
        return '"'
      })
      .replace(/['']/g, () => {
        count++
        return "'"
      })
      // 全角标点 → 半角
      .replace(/，/g, () => {
        count++
        return ', '
      })
      .replace(/。/g, () => {
        count++
        return '. '
      })
      .replace(/：/g, () => {
        count++
        return ': '
      })
      .replace(/；/g, () => {
        count++
        return '; '
      })

    return { text: normalized, count }
  }

  /**
   * 折叠多余换行
   */
  private collapseNewlines(text: string): string {
    const max = this.config.maxConsecutiveNewlines
    const pattern = new RegExp(`\\n{${max + 1},}`, 'g')
    return text.replace(pattern, '\n'.repeat(max))
  }

  /**
   * 移除重复内容
   */
  private removeDuplicates(text: string): { text: string; removed: number } {
    // 按段落分割
    const paragraphs = text.split(/\n\n+/)
    const seen = new Map<string, number>()
    const unique: string[] = []
    let removed = 0

    for (const para of paragraphs) {
      const normalized = para.trim().toLowerCase()
      if (normalized.length < 20) {
        // 短段落直接保留
        unique.push(para)
        continue
      }

      const hash = this.simpleHash(normalized)

      if (seen.has(hash)) {
        // 检查相似度
        const existingIndex = seen.get(hash)!
        const existing = unique[existingIndex]
        const similarity = this.calculateSimilarity(normalized, existing.toLowerCase())

        if (similarity >= this.config.duplicateThreshold) {
          removed++
          continue // 跳过重复
        }
      }

      seen.set(hash, unique.length)
      unique.push(para)
    }

    return {
      text: unique.join('\n\n'),
      removed
    }
  }

  /**
   * 过滤敏感信息
   */
  private filterSensitive(text: string): { text: string; count: number } {
    let result = text
    let count = 0

    for (const pattern of this.config.sensitivePatterns) {
      const matches = result.match(pattern)
      if (matches) {
        count += matches.length
        result = result.replace(pattern, '[FILTERED]')
      }
    }

    return { text: result, count }
  }

  /**
   * 截断文本
   */
  private truncate(text: string, targetLength: number): string {
    if (text.length <= targetLength) return text

    switch (this.config.truncateStrategy) {
      case 'head':
        return text.slice(0, targetLength) + '...'

      case 'tail':
        return '...' + text.slice(-targetLength)

      case 'middle':
        const half = Math.floor(targetLength / 2)
        return text.slice(0, half) + '\n...[truncated]...\n' + text.slice(-half)

      case 'smart':
      default:
        return this.smartTruncate(text, targetLength)
    }
  }

  /**
   * 智能截断 - 保留开头和最近的内容
   */
  private smartTruncate(text: string, targetLength: number): string {
    // 保留 30% 开头 + 70% 结尾
    const headRatio = 0.3
    const headLength = Math.floor(targetLength * headRatio)
    const tailLength = targetLength - headLength - 30 // 30 for separator

    const head = text.slice(0, headLength)
    const tail = text.slice(-tailLength)

    // 尝试在句子边界截断
    const headEnd = head.lastIndexOf('。') + 1 || head.lastIndexOf('. ') + 2 || head.length
    const tailStart = tail.indexOf('。') + 1 || tail.indexOf('. ') + 2 || 0

    return head.slice(0, headEnd) + '\n\n... [内容已省略] ...\n\n' + tail.slice(tailStart)
  }

  /**
   * 估算 Token 数
   */
  private estimateTokens(text: string): number {
    // 粗略估算:
    // - 英文: ~4 chars/token
    // - 中文: ~1.5 chars/token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const otherChars = text.length - chineseChars

    return Math.ceil(chineseChars / 1.5 + otherChars / 4)
  }

  /**
   * 简单哈希
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return hash.toString(36)
  }

  /**
   * 计算相似度 (Jaccard)
   */
  private calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.split(/\s+/))
    const wordsB = new Set(b.split(/\s+/))

    const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)))
    const union = new Set([...wordsA, ...wordsB])

    return intersection.size / union.size
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PurifierConfig>): void {
    Object.assign(this.config, config)
  }

  /**
   * 获取当前配置
   */
  getConfig(): Required<PurifierConfig> {
    return { ...this.config }
  }
}

// 单例
let _instance: ContextPurifier | null = null

export function getContextPurifier(): ContextPurifier {
  if (!_instance) {
    _instance = new ContextPurifier()
  }
  return _instance
}

export function createContextPurifier(config?: PurifierConfig): ContextPurifier {
  return new ContextPurifier(config)
}
