/**
 * ContextSanitizerService - 上下文净化服务
 *
 * 参考 VCPChat contextSanitizer.js 实现
 * 将 AI 回复中的 HTML 转换为 Markdown 以减少 token 用量
 */

import { loggerService } from '@logger'
import TurndownService from 'turndown'

const logger = loggerService.withContext('ContextSanitizerService')

/**
 * 消息接口（用于净化）
 * 只要求 content 字段，其他字段保持原样
 */
interface SanitizableMessage {
  content: string
}

/**
 * LRU 缓存实现
 */
class LRUCache<K, V> {
  private capacity: number
  private cache: Map<K, V>

  constructor(capacity: number) {
    this.capacity = capacity
    this.cache = new Map()
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined
    }
    // 移动到末尾（最近使用）
    const value = this.cache.get(key)!
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.capacity) {
      // 删除最旧的条目（第一个）
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(key, value)
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}

/**
 * 上下文净化服务
 */
class ContextSanitizerService {
  private static instance: ContextSanitizerService | null = null
  private turndownService: TurndownService
  private cache: LRUCache<string, string>
  private readonly CACHE_CAPACITY = 100

  private constructor() {
    // 初始化 Turndown 服务
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '_'
    })

    // 配置 Turndown 规则
    this.configureTurndown()

    // 初始化 LRU 缓存
    this.cache = new LRUCache(this.CACHE_CAPACITY)

    logger.info('ContextSanitizerService initialized')
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): ContextSanitizerService {
    if (!ContextSanitizerService.instance) {
      ContextSanitizerService.instance = new ContextSanitizerService()
    }
    return ContextSanitizerService.instance
  }

  /**
   * 配置 Turndown 规则
   */
  private configureTurndown(): void {
    // 保留代码块
    this.turndownService.addRule('codeBlock', {
      filter: ['pre'],
      replacement: (content, node) => {
        const element = node as HTMLElement
        const codeElement = element.querySelector('code')
        const language = codeElement?.className?.match(/language-(\w+)/)?.[1] || ''
        const code = codeElement?.textContent || content
        return `\n\`\`\`${language}\n${code}\n\`\`\`\n`
      }
    })

    // 处理表格（简化为列表）
    this.turndownService.addRule('table', {
      filter: ['table'],
      replacement: (_content, node) => {
        const element = node as HTMLElement
        const rows = element.querySelectorAll('tr')
        const lines: string[] = []
        rows.forEach((row) => {
          const cells = row.querySelectorAll('td, th')
          const cellTexts = Array.from(cells).map((cell) => cell.textContent?.trim() || '')
          if (cellTexts.some((t) => t)) {
            lines.push('- ' + cellTexts.join(' | '))
          }
        })
        return '\n' + lines.join('\n') + '\n'
      }
    })

    // 移除脚本和样式
    this.turndownService.addRule('removeScripts', {
      filter: ['script', 'style', 'noscript'],
      replacement: () => ''
    })

    // 简化图片（只保留 alt 文本）
    this.turndownService.addRule('simplifyImages', {
      filter: ['img'],
      replacement: (_content, node) => {
        const element = node as HTMLImageElement
        const alt = element.alt || '图片'
        return `[${alt}]`
      }
    })
  }

  /**
   * 净化单条消息内容
   * 将 HTML 转换为 Markdown
   */
  sanitizeContent(content: string): string {
    if (!content || typeof content !== 'string') {
      return content
    }

    // 检查缓存
    const cacheKey = this.generateCacheKey(content)
    const cached = this.cache.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    try {
      // 检查是否包含 HTML 标签
      if (!this.containsHtml(content)) {
        // 不包含 HTML，直接返回
        this.cache.set(cacheKey, content)
        return content
      }

      // 使用 Turndown 转换
      const sanitized = this.turndownService.turndown(content)

      // 清理多余空行
      const cleaned = sanitized.replace(/\n{3,}/g, '\n\n').trim()

      // 缓存结果
      this.cache.set(cacheKey, cleaned)

      logger.debug('Content sanitized', {
        originalLength: content.length,
        sanitizedLength: cleaned.length,
        reduction: `${Math.round((1 - cleaned.length / content.length) * 100)}%`
      })

      return cleaned
    } catch (error) {
      logger.error('Failed to sanitize content', error as Error)
      return content
    }
  }

  /**
   * 净化消息数组
   * @param messages 消息数组
   * @param startDepth 起始深度（从第几条消息开始净化，默认 2）
   */
  sanitizeMessages<T extends SanitizableMessage>(messages: T[], startDepth: number = 2): T[] {
    if (!messages || messages.length === 0) {
      return messages
    }

    return messages.map((msg, index) => {
      // 跳过前 startDepth 条消息
      if (index < startDepth) {
        return msg
      }

      return {
        ...msg,
        content: this.sanitizeContent(msg.content)
      }
    })
  }

  /**
   * 检查内容是否包含 HTML 标签
   */
  private containsHtml(content: string): boolean {
    // 简单检查常见 HTML 标签
    const htmlPattern = /<\/?(?:div|p|span|a|img|table|tr|td|th|ul|ol|li|h[1-6]|pre|code|br|hr|em|strong|b|i)[^>]*>/i
    return htmlPattern.test(content)
  }

  /**
   * 生成缓存键
   * 使用内容的简单哈希
   */
  private generateCacheKey(content: string): string {
    // 简单的字符串哈希
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // 转换为32位整数
    }
    return `ctx_${hash}_${content.length}`
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear()
    logger.info('Context sanitizer cache cleared')
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; capacity: number } {
    return {
      size: this.cache.size,
      capacity: this.CACHE_CAPACITY
    }
  }
}

// 导出服务实例
export const contextSanitizerService = ContextSanitizerService.getInstance()

// 导出工厂函数
export function getContextSanitizerService(): ContextSanitizerService {
  return ContextSanitizerService.getInstance()
}
