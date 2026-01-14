/**
 * IntegratedMemoryService - 统一记忆服务 (渲染进程)
 *
 * 提供渲染进程与 IntegratedMemoryCoordinator 交互的服务层
 * 用于集成到 KnowledgeService、AssistantService 等
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('IntegratedMemoryService')

// ==================== 类型定义 ====================

export interface MemorySearchOptions {
  backends?: Array<'knowledge' | 'diary' | 'memory' | 'lightmemo' | 'deepmemo' | 'meshmemo'>
  topK?: number
  threshold?: number
  applyLearning?: boolean
  recordQuery?: boolean
  userId?: string
  agentId?: string
  knowledgeBaseId?: string
}

export interface MemorySearchResult {
  id: string
  content: string
  score: number
  backend: string
  matchedTags?: string[]
  metadata?: Record<string, unknown>
  learning?: {
    appliedWeight: number
    rawScore: number
    matchedLearningTags: string[]
    userSelectionCount: number
  }
}

export interface MemoryReference {
  id: number
  content: string
  sourceUrl?: string
  type: 'memory' | 'diary' | 'knowledge' | 'lightmemo' | 'deepmemo' | 'meshmemo'
  backend: string
  metadata?: Record<string, unknown>
  score?: number
}

// ==================== 服务实现 ====================

class IntegratedMemoryService {
  private static instance: IntegratedMemoryService

  static getInstance(): IntegratedMemoryService {
    if (!IntegratedMemoryService.instance) {
      IntegratedMemoryService.instance = new IntegratedMemoryService()
    }
    return IntegratedMemoryService.instance
  }

  /**
   * 智能搜索 - 用于会话上下文增强
   * 自动应用学习权重，返回最相关的记忆内容
   */
  async searchForContext(
    query: string,
    options?: MemorySearchOptions
  ): Promise<{
    results: MemorySearchResult[]
    references: MemoryReference[]
  }> {
    try {
      const result = await window.api.integratedMemory.intelligentSearch({
        query,
        options: {
          ...options,
          applyLearning: options?.applyLearning ?? true,
          recordQuery: options?.recordQuery ?? true
        }
      })

      if (!result.success || !result.results) {
        logger.warn('Integrated memory search failed', { error: result.error })
        return { results: [], references: [] }
      }

      // 转换为引用格式
      const references: MemoryReference[] = result.results.map((r, index) => ({
        id: index + 1,
        content: r.content,
        sourceUrl: this.getSourceUrl(r),
        type: this.getTypeFromBackend(r.backend),
        backend: r.backend,
        metadata: r.metadata,
        score: r.score
      }))

      logger.debug('Integrated memory search completed', {
        query: query.slice(0, 50),
        resultCount: result.results.length
      })

      return {
        results: result.results as MemorySearchResult[],
        references
      }
    } catch (error) {
      logger.error('Integrated memory search error', error as Error)
      return { results: [], references: [] }
    }
  }

  /**
   * 为助手搜索相关记忆
   * 结合助手的知识库配置
   */
  async searchForAssistant(
    query: string,
    assistantId: string,
    knowledgeBaseIds?: string[],
    options?: Omit<MemorySearchOptions, 'agentId' | 'knowledgeBaseId'>
  ): Promise<MemoryReference[]> {
    try {
      const searchOptions: MemorySearchOptions = {
        ...options,
        agentId: assistantId,
        // 如果有知识库配置，添加 knowledge 到后端列表
        backends: knowledgeBaseIds?.length
          ? [...(options?.backends || ['diary', 'memory', 'lightmemo', 'deepmemo']), 'knowledge']
          : options?.backends || ['diary', 'memory', 'lightmemo', 'deepmemo']
      }

      const { references } = await this.searchForContext(query, searchOptions)
      return references
    } catch (error) {
      logger.error('Search for assistant failed', error as Error)
      return []
    }
  }

  /**
   * 为群聊搜索相关记忆
   * 结合多个 Agent 的上下文
   */
  async searchForGroupChat(
    query: string,
    sessionId: string,
    _agentIds: string[], // 预留用于多 Agent 场景的过滤
    options?: Omit<MemorySearchOptions, 'agentId'>
  ): Promise<MemoryReference[]> {
    try {
      // 群聊场景：搜索所有后端，不限定特定 agent
      const searchOptions: MemorySearchOptions = {
        ...options,
        backends: options?.backends || ['diary', 'memory', 'lightmemo', 'deepmemo', 'meshmemo'],
        userId: sessionId
      }

      const { references } = await this.searchForContext(query, searchOptions)
      return references
    } catch (error) {
      logger.error('Search for group chat failed', error as Error)
      return []
    }
  }

  /**
   * 记录用户选择反馈
   * 用于优化搜索结果排序
   */
  async recordSelection(searchId: string, selectedResultId: string, query: string): Promise<void> {
    try {
      await window.api.integratedMemory.recordPositiveFeedback({
        searchId,
        selectedResultId,
        query
      })
      logger.debug('Selection feedback recorded', { searchId, selectedResultId })
    } catch (error) {
      logger.warn('Failed to record selection feedback', error as Error)
    }
  }

  /**
   * 记录用户忽略反馈
   */
  async recordIgnore(searchId: string, ignoredResultId: string, query: string): Promise<void> {
    try {
      await window.api.integratedMemory.recordNegativeFeedback({
        searchId,
        ignoredResultId,
        query
      })
      logger.debug('Ignore feedback recorded', { searchId, ignoredResultId })
    } catch (error) {
      logger.warn('Failed to record ignore feedback', error as Error)
    }
  }

  /**
   * 创建记忆
   * Agent 或用户主动保存内容到记忆系统
   */
  async createMemory(params: {
    content: string
    title?: string
    backend?: 'diary' | 'memory' | 'notes'
    tags?: string[]
    autoTag?: boolean
    modelId?: string
    providerId?: string
    metadata?: Record<string, unknown>
  }): Promise<{
    success: boolean
    entry?: {
      id: string
      content: string
      title?: string
      tags: string[]
      backend: string
    }
    error?: string
  }> {
    try {
      const result = await window.api.integratedMemory.create(params)
      if (result.success) {
        logger.info('Memory created', { backend: params.backend, tags: result.entry?.tags })
      }
      return {
        success: result.success,
        entry: result.entry as
          | {
              id: string
              content: string
              title?: string
              tags: string[]
              backend: string
            }
          | undefined,
        error: result.error
      }
    } catch (error) {
      logger.error('Create memory failed', error as Error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * 获取搜索建议
   * 用于搜索框自动补全
   */
  async getSuggestions(partialQuery: string, limit: number = 5): Promise<string[]> {
    try {
      const result = await window.api.integratedMemory.getSuggestions({ partialQuery, limit })
      return result.suggestions || []
    } catch {
      return []
    }
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    totalMemories: number
    learningProgress: {
      queryCount: number
      feedbackCount: number
    }
    topTags: string[]
  } | null> {
    try {
      const result = await window.api.integratedMemory.getStats()
      if (result.success && result.stats) {
        return {
          totalMemories: result.stats.memoryStats.totalDocuments,
          learningProgress: {
            queryCount: result.stats.learningStats.totalQueries,
            feedbackCount: result.stats.learningStats.totalFeedback
          },
          topTags: result.stats.tagPoolStats.topTags
        }
      }
      return null
    } catch {
      return null
    }
  }

  // ==================== 辅助方法 ====================

  private getSourceUrl(result: MemorySearchResult): string {
    if (result.metadata?.sourceUrl) {
      return String(result.metadata.sourceUrl)
    }
    if (result.metadata?.filePath) {
      return String(result.metadata.filePath)
    }
    return `memory://${result.backend}/${result.id}`
  }

  private getTypeFromBackend(backend: string): MemoryReference['type'] {
    switch (backend) {
      case 'diary':
        return 'diary'
      case 'memory':
        return 'memory'
      case 'knowledge':
        return 'knowledge'
      case 'lightmemo':
        return 'lightmemo'
      case 'deepmemo':
        return 'deepmemo'
      case 'meshmemo':
        return 'meshmemo'
      default:
        return 'memory'
    }
  }
}

// ==================== 导出 ====================

export const integratedMemoryService = IntegratedMemoryService.getInstance()

/**
 * 便捷函数：为会话增强搜索记忆
 */
export async function searchIntegratedMemory(query: string, options?: MemorySearchOptions): Promise<MemoryReference[]> {
  const { references } = await integratedMemoryService.searchForContext(query, options)
  return references
}

/**
 * 便捷函数：创建记忆
 */
export async function createIntegratedMemory(
  content: string,
  options?: {
    title?: string
    backend?: 'diary' | 'memory' | 'notes'
    tags?: string[]
    autoTag?: boolean
  }
): Promise<boolean> {
  const result = await integratedMemoryService.createMemory({
    content,
    ...options
  })
  return result.success
}

export default integratedMemoryService
