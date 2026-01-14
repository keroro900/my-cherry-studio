/**
 * 统一知识库服务
 *
 * 整合多个数据源（知识库、日记、笔记等）的搜索能力，
 * 提供统一的搜索接口和结果融合
 *
 * 功能：
 * - 多源并行搜索
 * - RRF 结果融合
 * - TagMemo 标签增强
 * - 智能检索规划
 */

import { loggerService } from '@logger'
import type { KnowledgeBaseParams, KnowledgeSearchResult } from '@types'

import { weightedRRFFuse, type WeightedSource } from '../../memory/utils/RRFUtils'
import { getNoteService, type NoteService } from '../../services/notes'
import { getTagMemoService, type TagMemoService } from '../tagmemo'
import type { RetrievalPlanner } from './RetrievalPlanner'
import { getRetrievalPlanner } from './RetrievalPlanner'
import type {
  BackendStats,
  DataSourceType,
  DiarySearchOptions,
  KnowledgeBackend,
  RRFFusionConfig,
  RRFFusionInput,
  UnifiedKnowledgeConfig,
  UnifiedResultMetadata,
  UnifiedSearchOptions,
  UnifiedSearchResult
} from './types'

const logger = loggerService.withContext('UnifiedKnowledgeService')

// ==================== 后端适配器 ====================

/**
 * 日记/笔记后端适配器
 * 使用 NoteService 替代废弃的 DailyNoteService
 */
class DiaryBackendAdapter implements KnowledgeBackend {
  readonly name: DataSourceType = 'diary'
  private noteService: NoteService

  constructor() {
    this.noteService = getNoteService()
  }

  async search(query: string, topK: number, options?: DiarySearchOptions): Promise<UnifiedSearchResult[]> {
    const results: UnifiedSearchResult[] = []

    try {
      // 使用 NoteService 获取所有笔记
      let allNotes = await this.noteService.listAll()

      // 应用过滤器
      if (options?.publicOnly) {
        allNotes = allNotes.filter((n) => n.frontmatter.isPublic)
      }

      if (options?.tags && options.tags.length > 0) {
        const tagSet = new Set(options.tags.map((t) => t.toLowerCase()))
        allNotes = allNotes.filter((n) => {
          const noteTags = n.frontmatter.tags || []
          return noteTags.some((t) => tagSet.has(t.toLowerCase()))
        })
      }

      if (options?.dateRange) {
        const start = new Date(options.dateRange.start).getTime()
        const end = new Date(options.dateRange.end).getTime()
        allNotes = allNotes.filter((n) => {
          const noteDate = n.frontmatter.date ? new Date(n.frontmatter.date).getTime() : n.createdAt.getTime()
          return noteDate >= start && noteDate <= end
        })
      }

      if (options?.characterName) {
        allNotes = allNotes.filter((n) => n.frontmatter.characterName === options.characterName)
      }

      // 简单文本匹配评分
      const queryLower = query.toLowerCase()
      const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 1)

      const scoredNotes = allNotes.map((note) => {
        const contentLower = note.content.toLowerCase()
        const titleLower = note.title.toLowerCase()
        const tagsLower = (note.frontmatter.tags || []).join(' ').toLowerCase()

        // 计算匹配分数
        let score = 0
        let matchCount = 0

        for (const word of queryWords) {
          if (contentLower.includes(word)) {
            matchCount++
            score += 0.3
          }
          if (titleLower.includes(word)) {
            matchCount++
            score += 0.5
          }
          if (tagsLower.includes(word)) {
            matchCount++
            score += 0.4
          }
        }

        // 归一化分数
        if (queryWords.length > 0) {
          score = matchCount / (queryWords.length * 3) // 最高 3 分
        }

        return { note, score }
      })

      // 按分数排序并取 topK
      const topNotes = scoredNotes
        .filter((e) => e.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)

      // 转换为统一结果格式
      for (const { note, score } of topNotes) {
        results.push({
          pageContent: note.content,
          uniqueId: note.id,
          score,
          source: 'diary',
          metadata: {
            title: note.title,
            date: note.frontmatter.date || note.createdAt.toISOString().split('T')[0],
            tags: note.frontmatter.tags || [],
            diaryName: note.frontmatter.characterName,
            characterName: note.frontmatter.characterName,
            isPublic: note.frontmatter.isPublic || false,
            uniqueId: note.id,
            filePath: note.filePath
          } as UnifiedResultMetadata
        })
      }
    } catch (error) {
      logger.error('DiaryBackendAdapter search failed', error as Error)
    }

    return results
  }

  async isAvailable(): Promise<boolean> {
    return true
  }

  async getStats(): Promise<BackendStats> {
    try {
      const allNotes = await this.noteService.listAll()
      return {
        documentCount: allNotes.length,
        healthy: true,
        lastUpdated: new Date()
      }
    } catch {
      return {
        documentCount: 0,
        healthy: false,
        lastUpdated: new Date()
      }
    }
  }
}

/**
 * 知识库后端适配器（通过 IPC 调用 KnowledgeService）
 */
class KnowledgeBackendAdapter implements KnowledgeBackend {
  readonly name: DataSourceType = 'knowledge'
  private searchFn?: (query: string, base: KnowledgeBaseParams) => Promise<KnowledgeSearchResult[]>
  private knowledgeBaseId?: string

  constructor(options?: {
    searchFn?: (query: string, base: KnowledgeBaseParams) => Promise<KnowledgeSearchResult[]>
    knowledgeBaseId?: string
  }) {
    this.searchFn = options?.searchFn
    this.knowledgeBaseId = options?.knowledgeBaseId
  }

  async search(query: string, topK: number, _options?: Record<string, unknown>): Promise<UnifiedSearchResult[]> {
    if (!this.searchFn) {
      logger.warn('Knowledge backend search function not set')
      return []
    }

    try {
      // 构建搜索参数
      const base: KnowledgeBaseParams = {
        id: this.knowledgeBaseId || 'default'
      } as KnowledgeBaseParams

      const rawResults = await this.searchFn(query, base)

      // 转换为统一格式
      return rawResults.slice(0, topK).map((r) => ({
        ...r,
        source: 'knowledge' as DataSourceType,
        metadata: {
          uniqueId: (r as any).uniqueId ?? (r as any).metadata?.uniqueId,
          path: (r as any).metadata?.source,
          title: (r as any).metadata?.title
        } as UnifiedResultMetadata
      }))
    } catch (error) {
      logger.error('Knowledge backend search failed', error as Error)
      return []
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.searchFn
  }

  async getStats(): Promise<BackendStats> {
    return {
      documentCount: 0,
      healthy: !!this.searchFn
    }
  }

  setSearchFunction(fn: (query: string, base: KnowledgeBaseParams) => Promise<KnowledgeSearchResult[]>): void {
    this.searchFn = fn
  }

  setKnowledgeBaseId(id: string): void {
    this.knowledgeBaseId = id
  }
}

// ==================== UnifiedKnowledgeService ====================

export class UnifiedKnowledgeService {
  private backends: Map<DataSourceType, KnowledgeBackend> = new Map()
  private tagMemo: TagMemoService
  private rrfConfig: Required<RRFFusionConfig>
  private planner: RetrievalPlanner
  private config: UnifiedKnowledgeConfig

  constructor(config: UnifiedKnowledgeConfig = {}) {
    this.config = config
    this.tagMemo = getTagMemoService({
      enabled: config.tagMemo?.enabled ?? true
    })
    // 初始化 RRF 配置 (使用函数式 API 替代类)
    this.rrfConfig = {
      k: config.rrf?.k ?? 60,
      sourceWeights: config.rrf?.sourceWeights ?? {},
      deduplicate: config.rrf?.deduplicate ?? true,
      deduplicateField: config.rrf?.deduplicateField ?? 'content'
    }
    this.planner = getRetrievalPlanner()

    // 注册默认后端
    this.registerDefaultBackends()

    logger.info('UnifiedKnowledgeService initialized')
  }

  /**
   * 注册默认后端
   */
  private registerDefaultBackends(): void {
    // 日记后端
    this.backends.set('diary', new DiaryBackendAdapter())

    // 知识库后端（需要后续设置搜索函数）
    this.backends.set('knowledge', new KnowledgeBackendAdapter())

    logger.debug('Registered default backends', {
      backends: Array.from(this.backends.keys())
    })
  }

  /**
   * 注册自定义后端
   */
  registerBackend(backend: KnowledgeBackend): void {
    this.backends.set(backend.name, backend)
    logger.info('Registered backend', { name: backend.name })
  }

  /**
   * 设置知识库搜索函数（用于连接 KnowledgeService）
   */
  setKnowledgeSearchFunction(fn: (query: string, base: KnowledgeBaseParams) => Promise<KnowledgeSearchResult[]>): void {
    const backend = this.backends.get('knowledge') as KnowledgeBackendAdapter | undefined
    if (backend) {
      backend.setSearchFunction(fn)
    }
  }

  /**
   * 统一搜索
   */
  async search(query: string, options: UnifiedSearchOptions = {}): Promise<UnifiedSearchResult[]> {
    const startTime = Date.now()

    try {
      // 1. 生成检索计划
      const plan = this.planner.plan(query, options)

      // 2. 并行搜索各数据源
      const searchPromises: Promise<RRFFusionInput>[] = []

      for (const source of plan.sources) {
        const backend = this.backends.get(source)
        if (!backend) {
          logger.warn('Backend not found', { source })
          continue
        }

        const topK = plan.sourceTopK[source] || options.topK || 10

        searchPromises.push(
          backend
            .search(query, topK, {
              characterName: options.characterName,
              tags: options.tags
            })
            .then((results) => ({
              source,
              results
            }))
            .catch((error) => {
              logger.error('Backend search failed', { source, error: String(error) })
              return { source, results: [] }
            })
        )
      }

      const searchResults = await Promise.all(searchPromises)

      // 3. RRF 融合（如果有多个源）
      let fusedResults: UnifiedSearchResult[]

      if (plan.useRRF && searchResults.length > 1) {
        // 转换为 WeightedSource 格式
        const weightedSources: WeightedSource<UnifiedSearchResult>[] = searchResults.map((input) => ({
          name: input.source,
          results: input.results,
          weight: this.rrfConfig.sourceWeights?.[input.source] ?? 1.0
        }))
        // 使用规范的 weightedRRFFuse 函数
        fusedResults = weightedRRFFuse(weightedSources, {
          k: this.rrfConfig.k,
          maxResults: options.topK,
          deduplicate: this.rrfConfig.deduplicate,
          deduplicateBy: this.rrfConfig.deduplicateField === 'uniqueId' ? 'id' : 'content'
        })
      } else {
        // 单源或禁用 RRF，直接合并
        fusedResults = searchResults.flatMap((r) => r.results)
        fusedResults.sort((a, b) => b.score - a.score)
        if (options.topK) {
          fusedResults = fusedResults.slice(0, options.topK)
        }
      }

      // 4. TagMemo 增强
      if (plan.useTagMemo && (options.tagBoost ?? 0.5) > 0) {
        const queryTags = plan.queryAnalysis?.tags || this.tagMemo.extractTagsFromQuery(query)

        if (queryTags.length > 0) {
          fusedResults = await this.tagMemo.applyTagBoost(query, queryTags, fusedResults)
          // 重新排序
          fusedResults.sort((a, b) => b.score - a.score)
        }
      }

      // 5. 应用阈值过滤
      const threshold = options.threshold ?? 0.1
      fusedResults = fusedResults.filter((r) => r.score >= threshold)

      // 6. 限制结果数量
      const topK = options.topK ?? 10
      fusedResults = fusedResults.slice(0, topK)

      const duration = Date.now() - startTime
      logger.info('Unified search completed', {
        query: query.slice(0, 50),
        sources: plan.sources,
        resultCount: fusedResults.length,
        duration
      })

      return fusedResults
    } catch (error) {
      logger.error('Unified search failed', error as Error)
      throw error
    }
  }

  /**
   * 仅搜索日记
   */
  async searchDiary(query: string, options?: DiarySearchOptions & { topK?: number }): Promise<UnifiedSearchResult[]> {
    const backend = this.backends.get('diary')
    if (!backend) {
      return []
    }

    const results = await backend.search(query, options?.topK ?? 10, options as Record<string, unknown>)

    // 应用 TagMemo
    if (options?.tags && options.tags.length > 0) {
      return await this.tagMemo.applyTagBoost(query, options.tags, results)
    }

    return results
  }

  /**
   * 仅搜索知识库
   */
  async searchKnowledge(
    query: string,
    knowledgeBaseId?: string,
    options?: { topK?: number }
  ): Promise<UnifiedSearchResult[]> {
    const backend = this.backends.get('knowledge') as KnowledgeBackendAdapter | undefined
    if (!backend) {
      return []
    }

    if (knowledgeBaseId) {
      backend.setKnowledgeBaseId(knowledgeBaseId)
    }

    return await backend.search(query, options?.topK ?? 10)
  }

  /**
   * 获取 TagMemo 服务
   */
  getTagMemoService(): TagMemoService {
    return this.tagMemo
  }

  /**
   * 初始化 TagMemo（从搜索结果构建共现矩阵）
   */
  async initializeTagMemo(results: KnowledgeSearchResult[]): Promise<void> {
    await this.tagMemo.initializeFromSearchResults(results)
  }

  /**
   * 获取后端统计信息
   */
  async getBackendStats(): Promise<Record<DataSourceType, BackendStats>> {
    const stats: Partial<Record<DataSourceType, BackendStats>> = {}

    for (const [name, backend] of this.backends) {
      try {
        stats[name] = await backend.getStats()
      } catch (error) {
        logger.error('Failed to get backend stats', { backend: name, error: String(error) })
        stats[name] = { documentCount: 0, healthy: false }
      }
    }

    return stats as Record<DataSourceType, BackendStats>
  }

  /**
   * 检查后端可用性
   */
  async checkBackendAvailability(): Promise<Record<DataSourceType, boolean>> {
    const availability: Partial<Record<DataSourceType, boolean>> = {}

    for (const [name, backend] of this.backends) {
      try {
        availability[name] = await backend.isAvailable()
      } catch {
        availability[name] = false
      }
    }

    return availability as Record<DataSourceType, boolean>
  }

  /**
   * 获取启用的后端列表
   */
  getEnabledBackends(): DataSourceType[] {
    return Array.from(this.backends.keys())
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<UnifiedKnowledgeConfig>): void {
    if (config.rrf) {
      this.updateRRFConfig(config.rrf)
    }
    this.config = { ...this.config, ...config }
  }

  /**
   * 更新 RRF 配置
   */
  updateRRFConfig(config: Partial<RRFFusionConfig>): void {
    if (config.k !== undefined) this.rrfConfig.k = config.k
    if (config.sourceWeights) {
      this.rrfConfig.sourceWeights = { ...this.rrfConfig.sourceWeights, ...config.sourceWeights }
    }
    if (config.deduplicate !== undefined) this.rrfConfig.deduplicate = config.deduplicate
    if (config.deduplicateField) this.rrfConfig.deduplicateField = config.deduplicateField
  }

  /**
   * 获取可用的后端列表（用于 IPC）
   */
  async getAvailableBackends(): Promise<DataSourceType[]> {
    const availability = await this.checkBackendAvailability()
    return Object.entries(availability)
      .filter(([_, available]) => available)
      .map(([name]) => name as DataSourceType)
  }

  /**
   * 获取所有后端统计（用于 IPC）
   */
  async getAllStats(): Promise<Record<DataSourceType, BackendStats>> {
    return this.getBackendStats()
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    logger.info('Initializing UnifiedKnowledgeService...')

    // 检查后端可用性
    const availability = await this.checkBackendAvailability()
    logger.info('Backend availability', availability)

    // 从笔记收集文档标签信息 (使用 NoteService 替代废弃的 DailyNoteService)
    const noteService = getNoteService()
    const docs: Array<{ id: string; tags: string[] }> = []

    try {
      const allNotes = await noteService.listAll()
      for (const note of allNotes) {
        if (note.frontmatter.tags && note.frontmatter.tags.length > 0) {
          docs.push({
            id: note.id,
            tags: note.frontmatter.tags
          })
        }
      }
    } catch (error) {
      logger.warn('Failed to collect note tags for TagMemo initialization', error as Error)
    }

    // 初始化 TagMemo
    if (docs.length > 0) {
      await this.tagMemo.initialize(docs)
    }

    logger.info('UnifiedKnowledgeService initialized', { docCount: docs.length })
  }
}

// ==================== 单例和工厂函数 ====================

let serviceInstance: UnifiedKnowledgeService | null = null

export function getUnifiedKnowledgeService(): UnifiedKnowledgeService {
  if (!serviceInstance) {
    serviceInstance = new UnifiedKnowledgeService()
  }
  return serviceInstance
}

export function createUnifiedKnowledgeService(config?: UnifiedKnowledgeConfig): UnifiedKnowledgeService {
  return new UnifiedKnowledgeService(config)
}

/**
 * 重置单例（用于测试）
 */
export function resetUnifiedKnowledgeService(): void {
  serviceInstance = null
}
