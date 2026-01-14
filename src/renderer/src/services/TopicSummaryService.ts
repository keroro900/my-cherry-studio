/**
 * TopicSummaryService - 话题自动总结服务
 *
 * 基于 VCP 群聊模式设计，实现：
 * 1. 当消息数量达到阈值时自动生成话题标题
 * 2. 仅在话题名称为默认值时触发
 * 3. 使用 AI 生成简洁的标题（不超过 15 个字）
 */

import { loggerService } from '@logger'
import AiProvider from '@renderer/aiCore'
import type { Assistant, Provider } from '@renderer/types'

import type { GroupMessage } from './GroupChatService'

const logger = loggerService.withContext('TopicSummaryService')

/**
 * 话题总结配置
 */
export interface TopicSummaryConfig {
  /** 触发总结的最小消息数 */
  minMessages: number
  /** 默认话题名称列表（只有这些名称才会触发总结） */
  defaultTopics: string[]
  /** 最大标题长度 */
  maxTitleLength: number
  /** 用于总结的最近消息数 */
  contextMessageCount: number
}

/**
 * 话题总结结果
 */
export interface TopicSummaryResult {
  success: boolean
  title?: string
  error?: string
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: TopicSummaryConfig = {
  minMessages: 4,
  defaultTopics: ['主要群聊', '新话题', 'New Topic', '群聊', 'Group Chat'],
  maxTitleLength: 15,
  contextMessageCount: 10
}

/**
 * TopicSummaryService - 话题总结服务
 */
export class TopicSummaryService {
  private config: TopicSummaryConfig
  private summarizedSessions: Set<string> = new Set()

  constructor(config: Partial<TopicSummaryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 检查是否需要生成话题总结
   */
  shouldSummarize(sessionId: string, messages: GroupMessage[], currentTopicName: string): boolean {
    // 已经总结过的不再总结
    if (this.summarizedSessions.has(sessionId)) {
      return false
    }

    // 消息数量不足
    if (messages.length < this.config.minMessages) {
      return false
    }

    // 话题名称不是默认值
    if (!this.config.defaultTopics.includes(currentTopicName)) {
      return false
    }

    return true
  }

  /**
   * 生成话题总结
   */
  async summarize(
    sessionId: string,
    messages: GroupMessage[],
    currentTopicName: string,
    provider: Provider,
    assistant: Assistant
  ): Promise<TopicSummaryResult> {
    // 检查是否需要总结
    if (!this.shouldSummarize(sessionId, messages, currentTopicName)) {
      return { success: false, error: '不需要总结' }
    }

    logger.info('Generating topic summary', {
      sessionId,
      messageCount: messages.length,
      currentTopicName
    })

    // 构建上下文
    const recentMessages = messages.slice(-this.config.contextMessageCount)
    const context = recentMessages
      .filter((m) => m.type === 'chat')
      .map((m) => `${m.agentName}: ${m.content}`)
      .join('\n')

    if (!context.trim()) {
      return { success: false, error: '没有有效的对话内容' }
    }

    // 构建总结提示
    const prompt = `请根据以下对话内容，生成一个简洁的话题标题。要求：
1. 标题不超过 ${this.config.maxTitleLength} 个字
2. 概括对话的核心主题
3. 只输出标题文字，不要加引号或其他标点

对话内容：
${context}

话题标题：`

    try {
      const aiProvider = new AiProvider(provider)
      const result = await aiProvider.completions({
        assistant: {
          ...assistant,
          prompt: '你是一个专业的话题总结助手，擅长从对话中提取核心主题。'
        },
        messages: prompt,
        streamOutput: false,
        callType: 'chat',
        topicId: `summary_${sessionId}`
      })

      const rawTitle = result.getText?.() || ''
      const cleanedTitle = this.cleanTitle(rawTitle)

      if (cleanedTitle) {
        // 标记为已总结
        this.summarizedSessions.add(sessionId)
        logger.info('Topic summary generated', { sessionId, title: cleanedTitle })
        return { success: true, title: cleanedTitle }
      }

      return { success: false, error: '生成的标题为空' }
    } catch (error) {
      logger.error('Topic summary failed', error as Error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 清理生成的标题
   */
  private cleanTitle(rawTitle: string): string {
    return (
      rawTitle
        .trim()
        // 移除首尾引号
        .replace(/^["'《「『]|["'》」』]$/g, '')
        // 移除多余空格
        .replace(/\s+/g, ' ')
        // 移除换行符
        .replace(/[\r\n]/g, '')
        // 截断到最大长度
        .substring(0, this.config.maxTitleLength)
    )
  }

  /**
   * 重置会话的总结状态
   */
  resetSession(sessionId: string): void {
    this.summarizedSessions.delete(sessionId)
  }

  /**
   * 清除所有总结状态
   */
  clearAll(): void {
    this.summarizedSessions.clear()
  }
}

// 单例
let _instance: TopicSummaryService | null = null

export function getTopicSummaryService(): TopicSummaryService {
  if (!_instance) {
    _instance = new TopicSummaryService()
  }
  return _instance
}

export default TopicSummaryService
