/**
 * VCPSuperPurifier - VCPSuper 完整净化器
 *
 * 功能:
 * 1. 多轮对话压缩 - 减少 token 使用
 * 2. 冗余信息清理 - 去除重复内容
 * 3. 格式标准化 - 统一消息格式
 * 4. 智能摘要 - 长对话自动摘要
 *
 * VCPToolBox 对标: VCPSuper 净化器
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('VCP:SuperPurifier')

// ==================== 类型定义 ====================

/**
 * 消息类型
 */
export interface PurifierMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  timestamp?: number
  metadata?: Record<string, unknown>
}

/**
 * 净化配置
 */
export interface PurifierConfig {
  /** 启用对话压缩 */
  enableCompression: boolean
  /** 压缩阈值 (超过多少轮开始压缩) */
  compressionThreshold: number
  /** 保留最近多少轮 */
  keepRecentRounds: number
  /** 启用去重 */
  enableDeduplication: boolean
  /** 相似度阈值 (0-1, 超过则视为重复) */
  similarityThreshold: number
  /** 启用格式标准化 */
  enableNormalization: boolean
  /** 启用智能摘要 */
  enableSummarization: boolean
  /** 摘要最大长度 */
  summaryMaxLength: number
  /** 最大 token 预算 */
  maxTokenBudget?: number
}

/**
 * 净化结果
 */
export interface PurifierResult {
  /** 净化后的消息 */
  messages: PurifierMessage[]
  /** 原始消息数 */
  originalCount: number
  /** 净化后消息数 */
  purifiedCount: number
  /** 移除的重复消息数 */
  duplicatesRemoved: number
  /** 是否进行了压缩 */
  compressed: boolean
  /** 压缩摘要 (如果有) */
  summary?: string
  /** 估计节省的 token 数 */
  estimatedTokensSaved: number
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: PurifierConfig = {
  enableCompression: true,
  compressionThreshold: 10,
  keepRecentRounds: 5,
  enableDeduplication: true,
  similarityThreshold: 0.85,
  enableNormalization: true,
  enableSummarization: true,
  summaryMaxLength: 500,
  maxTokenBudget: undefined
}

// ==================== VCPSuperPurifier 实现 ====================

export class VCPSuperPurifier {
  private config: PurifierConfig

  constructor(config: Partial<PurifierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    logger.info('VCPSuperPurifier initialized', { config: this.config })
  }

  /**
   * 主净化入口
   */
  async purify(messages: PurifierMessage[], configOverride?: Partial<PurifierConfig>): Promise<PurifierResult> {
    const config = configOverride ? { ...this.config, ...configOverride } : this.config

    if (messages.length === 0) {
      return {
        messages: [],
        originalCount: 0,
        purifiedCount: 0,
        duplicatesRemoved: 0,
        compressed: false,
        estimatedTokensSaved: 0
      }
    }

    const originalCount = messages.length
    let result = [...messages]
    let duplicatesRemoved = 0
    let compressed = false
    let summary: string | undefined

    // 1. 格式标准化
    if (config.enableNormalization) {
      result = this.normalizeFormat(result)
    }

    // 2. 去除重复内容
    if (config.enableDeduplication) {
      const beforeDedup = result.length
      result = this.deduplicateMessages(result, config)
      duplicatesRemoved = beforeDedup - result.length
    }

    // 3. 压缩长对话
    if (config.enableCompression && result.length > config.compressionThreshold) {
      const compressionResult = await this.compressConversation(result, config)
      result = compressionResult.messages
      summary = compressionResult.summary
      compressed = true
    }

    // 4. Token 预算检查
    if (config.maxTokenBudget) {
      result = this.enforceTokenBudget(result, config.maxTokenBudget)
    }

    const estimatedTokensSaved = this.estimateTokens(messages) - this.estimateTokens(result)

    logger.info('Purification completed', {
      originalCount,
      purifiedCount: result.length,
      duplicatesRemoved,
      compressed,
      estimatedTokensSaved
    })

    return {
      messages: result,
      originalCount,
      purifiedCount: result.length,
      duplicatesRemoved,
      compressed,
      summary,
      estimatedTokensSaved
    }
  }

  /**
   * 同步版净化 (用于快速净化，不使用压缩功能)
   */
  purifySync(
    messages: PurifierMessage[],
    options?: {
      deduplication?: { enabled: boolean }
      normalization?: { enabled: boolean }
      compression?: { enabled: boolean }
    }
  ): PurifierResult {
    if (messages.length === 0) {
      return {
        messages: [],
        originalCount: 0,
        purifiedCount: 0,
        duplicatesRemoved: 0,
        compressed: false,
        estimatedTokensSaved: 0
      }
    }

    const originalCount = messages.length
    let result = [...messages]
    let duplicatesRemoved = 0

    // 1. 格式标准化
    if (options?.normalization?.enabled !== false && this.config.enableNormalization) {
      result = this.normalizeFormat(result)
    }

    // 2. 去除重复内容
    if (options?.deduplication?.enabled !== false && this.config.enableDeduplication) {
      const beforeDedup = result.length
      result = this.deduplicateMessages(result, this.config)
      duplicatesRemoved = beforeDedup - result.length
    }

    const estimatedTokensSaved = this.estimateTokens(messages) - this.estimateTokens(result)

    return {
      messages: result,
      originalCount,
      purifiedCount: result.length,
      duplicatesRemoved,
      compressed: false,
      estimatedTokensSaved
    }
  }

  /**
   * 格式标准化
   * 包含 VCPToolBox VCPSuper 净化器的完整中文符号归一化功能
   */
  private normalizeFormat(messages: PurifierMessage[]): PurifierMessage[] {
    return messages.map((msg) => {
      let content = msg.content

      // 1. 移除多余空白
      content = content.replace(/\n{3,}/g, '\n\n')
      content = content.replace(/[ \t]+/g, ' ')
      content = content.trim()

      // 2. 标准化引号 (中英文引号统一)
      content = content.replace(/[""「」『』]/g, '"')
      content = content.replace(/['']/g, "'")

      // 3. 移除零宽字符
      content = content.replace(/[\u200B-\u200D\uFEFF]/g, '')

      // 4. 标准化换行符
      content = content.replace(/\r\n/g, '\n')
      content = content.replace(/\r/g, '\n')

      // 5. 中文符号归一化 (VCPSuper 增强)
      content = this.normalizeChineseSymbols(content)

      // 6. 连续重复字符压缩
      content = this.compressRepeatedChars(content)

      return {
        ...msg,
        content
      }
    })
  }

  /**
   * 中文符号归一化
   * 将中文全角标点转换为半角，统一标点使用
   */
  private normalizeChineseSymbols(content: string): string {
    // 全角转半角映射表
    const fullToHalfMap: Record<string, string> = {
      '，': ', ',    // 中文逗号 → 英文逗号+空格
      '。': '. ',    // 中文句号 → 英文句号+空格
      '！': '! ',    // 中文感叹号 → 英文感叹号+空格
      '？': '? ',    // 中文问号 → 英文问号+空格
      '；': '; ',    // 中文分号 → 英文分号+空格
      '：': ': ',    // 中文冒号 → 英文冒号+空格
      '（': '(',     // 中文左括号
      '）': ')',     // 中文右括号
      '【': '[',     // 中文方括号
      '】': ']',
      '《': '<',     // 中文书名号
      '》': '>',
      '——': '-',     // 中文破折号
      '…': '...',    // 中文省略号
      '～': '~',     // 中文波浪号
      '　': ' '      // 全角空格
    }

    // 应用映射
    for (const [full, half] of Object.entries(fullToHalfMap)) {
      content = content.split(full).join(half)
    }

    // 清理标点后多余的空格
    content = content.replace(/\s+([,.!?;:])/g, '$1')  // 标点前的空格
    content = content.replace(/([,.!?;:])\s+/g, '$1 ') // 标点后保留一个空格

    return content
  }

  /**
   * 连续重复字符压缩
   * 将连续重复的字符压缩为合理数量
   */
  private compressRepeatedChars(content: string): string {
    // 压缩连续的标点符号 (如 !!! → !)
    content = content.replace(/([!?！？]){2,}/g, '$1')

    // 压缩连续的句号/省略号 (保留最多3个)
    content = content.replace(/\.{4,}/g, '...')
    content = content.replace(/。{2,}/g, '。')

    // 压缩连续的波浪号
    content = content.replace(/[~～]{2,}/g, '~')

    // 压缩连续的破折号
    content = content.replace(/[-—]{3,}/g, '--')

    // 压缩连续的空格 (保留一个)
    content = content.replace(/ {2,}/g, ' ')

    return content
  }

  /**
   * 去除重复消息
   */
  private deduplicateMessages(messages: PurifierMessage[], config: PurifierConfig): PurifierMessage[] {
    const result: PurifierMessage[] = []
    const seenContents = new Map<string, number>() // content hash -> index

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      const contentHash = this.hashContent(msg.content)

      // 检查是否有相似内容
      let isDuplicate = false

      if (seenContents.has(contentHash)) {
        isDuplicate = true
      } else {
        // 检查相似度
        for (const [_hash, idx] of seenContents) {
          const existingContent = result[idx]?.content
          if (existingContent && this.calculateSimilarity(msg.content, existingContent) >= config.similarityThreshold) {
            isDuplicate = true
            break
          }
        }
      }

      if (!isDuplicate) {
        seenContents.set(contentHash, result.length)
        result.push(msg)
      } else {
        logger.debug('Duplicate message removed', {
          index: i,
          contentPreview: msg.content.slice(0, 50)
        })
      }
    }

    return result
  }

  /**
   * 压缩长对话
   */
  private async compressConversation(
    messages: PurifierMessage[],
    config: PurifierConfig
  ): Promise<{ messages: PurifierMessage[]; summary?: string }> {
    const keepRecent = config.keepRecentRounds * 2 // user + assistant

    // 分离系统消息、早期消息和近期消息
    const systemMessages = messages.filter((m) => m.role === 'system')
    const nonSystemMessages = messages.filter((m) => m.role !== 'system')

    if (nonSystemMessages.length <= keepRecent) {
      return { messages }
    }

    // 保留最近的消息
    const recentMessages = nonSystemMessages.slice(-keepRecent)
    const earlyMessages = nonSystemMessages.slice(0, -keepRecent)

    // 生成早期对话摘要
    const summary = await this.summarizeMessages(earlyMessages, config)

    // 构建压缩后的消息列表
    const compressedMessages: PurifierMessage[] = [
      ...systemMessages,
      {
        role: 'system',
        content: `[对话历史摘要]\n${summary}`
      },
      ...recentMessages
    ]

    return {
      messages: compressedMessages,
      summary
    }
  }

  /**
   * 生成消息摘要
   */
  private async summarizeMessages(messages: PurifierMessage[], config: PurifierConfig): Promise<string> {
    if (!config.enableSummarization || messages.length === 0) {
      return this.generateBasicSummary(messages, config)
    }

    // 基础摘要实现 (不依赖 AI)
    // 实际部署可以集成 LLM 进行智能摘要
    return this.generateBasicSummary(messages, config)
  }

  /**
   * 生成基础摘要 (不依赖 AI)
   */
  private generateBasicSummary(messages: PurifierMessage[], config: PurifierConfig): string {
    if (messages.length === 0) return '无历史对话'

    const topics = new Set<string>()
    const keyPoints: string[] = []

    for (const msg of messages) {
      // 提取主题词 (简单启发式)
      const words = msg.content.split(/\s+/)
      for (const word of words) {
        if (word.length >= 4 && /^[a-zA-Z\u4e00-\u9fff]+$/.test(word)) {
          topics.add(word)
          if (topics.size >= 10) break
        }
      }

      // 提取关键句 (首句)
      const firstSentence = msg.content.split(/[。！？.!?]/)[0]
      if (firstSentence && firstSentence.length > 10 && firstSentence.length < 100) {
        const roleLabel = msg.role === 'user' ? '用户' : msg.role === 'tool' ? '工具' : '助手'
        keyPoints.push(`${roleLabel}: ${firstSentence.slice(0, 50)}...`)
        if (keyPoints.length >= 5) break
      }
    }

    const summaryParts: string[] = []

    if (topics.size > 0) {
      summaryParts.push(`讨论主题: ${Array.from(topics).slice(0, 5).join(', ')}`)
    }

    if (keyPoints.length > 0) {
      summaryParts.push(`关键内容:\n${keyPoints.join('\n')}`)
    }

    summaryParts.push(`共 ${messages.length} 条消息`)

    const summary = summaryParts.join('\n\n')

    // 限制长度
    if (summary.length > config.summaryMaxLength) {
      return summary.slice(0, config.summaryMaxLength) + '...'
    }

    return summary
  }

  /**
   * 强制 Token 预算
   */
  private enforceTokenBudget(messages: PurifierMessage[], maxTokens: number): PurifierMessage[] {
    let currentTokens = this.estimateTokens(messages)

    if (currentTokens <= maxTokens) {
      return messages
    }

    // 从最早的非系统消息开始移除
    const result = [...messages]

    while (currentTokens > maxTokens && result.length > 1) {
      // 找到第一个非系统消息
      const nonSystemIndex = result.findIndex((m) => m.role !== 'system')
      if (nonSystemIndex === -1) break

      const removed = result.splice(nonSystemIndex, 1)[0]
      currentTokens -= this.estimateTokens([removed])
    }

    logger.info('Token budget enforced', {
      maxTokens,
      finalTokens: currentTokens,
      messagesRemoved: messages.length - result.length
    })

    return result
  }

  // ==================== 工具方法 ====================

  /**
   * 简单哈希函数
   */
  private hashContent(content: string): string {
    let hash = 0
    const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim()

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }

    return hash.toString(36)
  }

  /**
   * 计算文本相似度 (Jaccard 系数)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(
      text1
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2)
    )
    const words2 = new Set(
      text2
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2)
    )

    if (words1.size === 0 || words2.size === 0) {
      return text1.toLowerCase().trim() === text2.toLowerCase().trim() ? 1 : 0
    }

    const intersection = new Set([...words1].filter((x) => words2.has(x)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size
  }

  /**
   * 估算 Token 数量 (简单估计)
   */
  private estimateTokens(messages: PurifierMessage[]): number {
    let totalChars = 0

    for (const msg of messages) {
      totalChars += msg.content.length
    }

    // 粗略估计: 英文约 4 字符/token，中文约 2 字符/token
    // 取中间值 3
    return Math.ceil(totalChars / 3)
  }

  // ==================== 配置管理 ====================

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PurifierConfig>): void {
    this.config = { ...this.config, ...config }
    logger.info('Purifier config updated', { config: this.config })
  }

  /**
   * 获取当前配置
   */
  getConfig(): PurifierConfig {
    return { ...this.config }
  }
}

// ==================== 便捷函数 ====================

let defaultPurifier: VCPSuperPurifier | null = null

export function getVCPSuperPurifier(): VCPSuperPurifier {
  if (!defaultPurifier) {
    defaultPurifier = new VCPSuperPurifier()
  }
  return defaultPurifier
}

/**
 * 快捷净化函数
 */
export async function purifyMessages(
  messages: PurifierMessage[],
  config?: Partial<PurifierConfig>
): Promise<PurifierResult> {
  const purifier = config ? new VCPSuperPurifier(config) : getVCPSuperPurifier()
  return purifier.purify(messages)
}
