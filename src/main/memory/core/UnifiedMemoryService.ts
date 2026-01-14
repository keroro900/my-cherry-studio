/**
 * 统一记忆服务 - 增强记忆系统的核心入口
 *
 * 提供统一的记忆操作接口，整合：
 * - 向量数据库存储 (LibSQL)
 * - 知识图谱存储
 * - WaveRAG 检索
 * - TagMemo 标签增强
 * - 时间感知搜索
 * - 对话信息提取
 * - Native 中文分词增强 (jieba)
 *
 * @module memory/core/UnifiedMemoryService
 */

import { loggerService } from '@logger'
import crypto from 'crypto'

import { SQLiteStore } from '../storage/SQLiteStore'
import { VectorIndexService } from '../storage/VectorIndexService'
import type {
  AddMemoryInput,
  AddMemoryResult,
  ConversationMessage,
  DeepSearchOptions,
  ExtractionResult,
  GroupedMemories,
  MemoryEntry,
  MemoryEventType,
  MemoryMetadata,
  MemoryServiceConfig,
  RetrievalOptions,
  RetrievalResult,
  ScoredMemoryEntry,
  TopicCluster
} from '../types'
import { SEMANTIC_GROUPS } from '../types'

// Native jieba 分词集成
import {
  isChineseSearchEngineAvailable,
  jiebaCut
} from '../../knowledge/vector/VexusAdapter'

const logger = loggerService.withContext('UnifiedMemoryService')

// ==================== 内部类型 ====================

interface MemoryStoreAdapter {
  add(entry: MemoryEntry): Promise<void>
  get(id: string): Promise<MemoryEntry | null>
  update(id: string, updates: Partial<MemoryEntry>): Promise<void>
  delete(id: string): Promise<void>
  search(query: string, options: RetrievalOptions): Promise<ScoredMemoryEntry[]>
  list(options: { userId?: string; limit?: number; offset?: number }): Promise<MemoryEntry[]>
}

interface EmbeddingAdapter {
  embed(text: string): Promise<number[]>
  embedBatch(texts: string[]): Promise<number[][]>
}

interface ExtractorAdapter {
  extract(messages: ConversationMessage[]): Promise<ExtractionResult>
}

// ==================== 事件发射器 ====================

type EventListener = (event: { type: MemoryEventType; data: Record<string, unknown> }) => void

class MemoryEventEmitter {
  private listeners: Map<MemoryEventType, Set<EventListener>> = new Map()

  on(type: MemoryEventType, listener: EventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(listener)
  }

  off(type: MemoryEventType, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener)
  }

  emit(type: MemoryEventType, data: Record<string, unknown>): void {
    this.listeners.get(type)?.forEach((listener) => {
      try {
        listener({ type, data })
      } catch (error) {
        logger.error('Event listener error', { type, error })
      }
    })
  }
}

// ==================== 统一记忆服务 ====================

/**
 * 统一记忆服务
 *
 * 所有记忆操作的统一入口
 */
export class UnifiedMemoryService {
  private static instance: UnifiedMemoryService | null = null

  private config: MemoryServiceConfig
  private store: MemoryStoreAdapter | null = null
  private sqliteStore: SQLiteStore | null = null
  private vectorIndex: VectorIndexService | null = null
  private embedder: EmbeddingAdapter | null = null
  private extractor: ExtractorAdapter | null = null
  private events: MemoryEventEmitter
  private cache: Map<string, { entry: ScoredMemoryEntry[]; expiry: number }> = new Map()
  private isInitialized = false

  private constructor() {
    this.config = {
      enabled: true,
      retrieval: {
        defaultTopK: 10,
        defaultThreshold: 0.5,
        defaultMode: 'hybrid',
        enableTagMemo: true
      },
      deduplicationThreshold: 0.85,
      cache: {
        enabled: true,
        ttlSeconds: 300,
        maxSize: 1000
      }
    }
    this.events = new MemoryEventEmitter()
  }

  /**
   * 获取单例实例
   */
  static getInstance(): UnifiedMemoryService {
    if (!UnifiedMemoryService.instance) {
      UnifiedMemoryService.instance = new UnifiedMemoryService()
    }
    return UnifiedMemoryService.instance
  }

  /**
   * 初始化服务
   */
  async initialize(config?: Partial<MemoryServiceConfig>): Promise<void> {
    if (this.isInitialized) {
      logger.debug('UnifiedMemoryService already initialized')
      return
    }

    if (config) {
      this.config = { ...this.config, ...config }
    }

    logger.info('Initializing UnifiedMemoryService', {
      enabled: this.config.enabled,
      autoExtraction: this.config.autoExtraction?.enabled
    })

    // 初始化存储适配器
    await this.initializeStore()

    // 初始化嵌入适配器
    if (this.config.embedding) {
      await this.initializeEmbedder()
    }

    // 初始化提取器
    if (this.config.autoExtraction?.enabled) {
      await this.initializeExtractor()
    }

    this.isInitialized = true
    logger.info('UnifiedMemoryService initialized successfully')
  }

  /**
   * 初始化存储适配器
   */
  private async initializeStore(): Promise<void> {
    // 初始化 SQLite 存储
    this.sqliteStore = new SQLiteStore({
      userId: this.config.defaultUserId || 'default-user'
    })
    await this.sqliteStore.initialize()

    // 初始化向量索引
    this.vectorIndex = new VectorIndexService({
      dimensions: 1536,
      algorithm: 'cosine'
    })

    // 创建存储适配器，桥接 SQLiteStore 到内部接口
    this.store = {
      add: async (entry: MemoryEntry) => {
        await this.sqliteStore!.add({
          content: entry.content,
          type: entry.type,
          source: entry.metadata.source,
          importance: entry.metadata.importance,
          confidence: entry.metadata.confidence,
          tags: entry.metadata.tags,
          customMetadata: entry.metadata.custom
        })

        // 如果有嵌入向量，添加到向量索引
        if (entry.embedding && this.vectorIndex) {
          this.vectorIndex.add(entry.id, entry.embedding, entry)
        }
      },
      get: async (id: string) => {
        return this.sqliteStore!.getById(id)
      },
      update: async (id: string, updates: Partial<MemoryEntry>) => {
        await this.sqliteStore!.update(id, {
          content: updates.content,
          type: updates.type,
          importance: updates.metadata?.importance,
          confidence: updates.metadata?.confidence,
          tags: updates.metadata?.tags
        })

        // 更新向量索引
        if (updates.embedding && this.vectorIndex) {
          const entry = await this.sqliteStore!.getById(id)
          if (entry) {
            this.vectorIndex.update(id, updates.embedding, entry)
          }
        }
      },
      delete: async (id: string) => {
        await this.sqliteStore!.delete(id)
        this.vectorIndex?.remove(id)
      },
      search: async (query: string, options: RetrievalOptions) => {
        return this.sqliteStore!.search(query, options)
      },
      list: async (options) => {
        return this.sqliteStore!.list(options)
      }
    }

    logger.info('Store initialized with SQLite backend')
  }

  /**
   * 初始化嵌入适配器
   */
  private async initializeEmbedder(): Promise<void> {
    // 集成 UnifiedEmbeddingService
    const { getEmbeddingService } = await import('../../knowledge/embedding/UnifiedEmbeddingService')
    const embeddingService = getEmbeddingService()

    this.embedder = {
      embed: async (text: string) => {
        logger.debug('Embedder.embed', { textLength: text.length })
        try {
          const result = await embeddingService.embedText(text)
          return result.embedding
        } catch (error) {
          logger.warn('Embedding failed, returning empty vector', { error })
          return []
        }
      },
      embedBatch: async (texts: string[]) => {
        logger.debug('Embedder.embedBatch', { count: texts.length })
        try {
          const results = await embeddingService.embedTexts(texts)
          return results.map((r) => r.embedding)
        } catch (error) {
          logger.warn('Batch embedding failed, returning empty vectors', { error })
          return texts.map(() => [])
        }
      }
    }

    logger.info('Embedder initialized with UnifiedEmbeddingService')
  }

  /**
   * 初始化提取器适配器
   */
  private async initializeExtractor(): Promise<void> {
    // 集成 LLM 提取服务
    this.extractor = {
      extract: async (messages: ConversationMessage[]) => {
        logger.debug('Extractor.extract', { messageCount: messages.length })

        try {
          // 使用 MCPBridge 调用 LLM 进行信息提取
          const { MCPBridge } = await import('../../mcpServers/shared/MCPBridge')
          const bridge = MCPBridge.getInstance()

          // 构建提取提示词
          const systemPrompt = `你是一个信息提取助手。从对话中提取：
1. 事实 (facts): 明确陈述的信息
2. 偏好 (preferences): 用户的喜好和习惯
3. 实体 (entities): 人名、地名、事物名称
4. 关系 (relations): 实体之间的关系

输出 JSON 格式：
{
  "memories": [{"content": "...", "type": "fact|preference|experience|knowledge", "tags": [...]}],
  "entities": [{"name": "...", "type": "person|place|thing|concept"}],
  "relations": [{"from": "...", "to": "...", "relation": "..."}]
}`

          const conversationText = messages
            .map((m) => `${m.role}: ${m.content}`)
            .join('\n')

          const userPrompt = `请从以下对话中提取信息：\n\n${conversationText}`

          const response = await bridge.generateText({
            systemPrompt,
            userPrompt
          })

          // 解析 JSON 响应
          if (response) {
            try {
              // 尝试从响应中提取 JSON
              const jsonMatch = response.match(/\{[\s\S]*\}/)
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0])
                return {
                  memories: parsed.memories || [],
                  entities: parsed.entities || [],
                  relations: parsed.relations || []
                }
              }
            } catch {
              logger.debug('Failed to parse extraction response as JSON')
            }
          }

          return { memories: [], entities: [], relations: [] }
        } catch (error) {
          logger.warn('LLM extraction failed', { error })
          return { memories: [], entities: [], relations: [] }
        }
      }
    }

    logger.info('Extractor initialized with LLM service')
  }

  // ==================== 添加操作 ====================

  /**
   * 添加单个记忆
   */
  async add(input: AddMemoryInput): Promise<MemoryEntry> {
    this.ensureInitialized()

    const entry = await this.createEntry(input)

    // 检查重复
    if (await this.isDuplicate(entry)) {
      logger.debug('Skipping duplicate memory', { hash: entry.hash })
      throw new Error('Duplicate memory detected')
    }

    // 生成嵌入
    if (this.embedder && !entry.embedding) {
      entry.embedding = await this.embedder.embed(entry.content)
    }

    // 存储
    await this.store!.add(entry)

    // 发送事件
    this.events.emit('memory:added', { entry })

    logger.debug('Memory added', { id: entry.id, type: entry.type })
    return entry
  }

  /**
   * 批量添加记忆
   */
  async addBatch(inputs: AddMemoryInput[]): Promise<AddMemoryResult> {
    this.ensureInitialized()

    const result: AddMemoryResult = {
      added: [],
      skipped: 0,
      failed: []
    }

    for (const input of inputs) {
      try {
        const entry = await this.add(input)
        result.added.push(entry)
      } catch (error) {
        if ((error as Error).message === 'Duplicate memory detected') {
          result.skipped++
        } else {
          result.failed.push({
            input,
            error: (error as Error).message
          })
        }
      }
    }

    logger.info('Batch add completed', {
      added: result.added.length,
      skipped: result.skipped,
      failed: result.failed.length
    })

    return result
  }

  // ==================== 检索操作 ====================

  /**
   * 检索记忆
   */
  async retrieve(options: RetrievalOptions): Promise<RetrievalResult> {
    this.ensureInitialized()

    const startTime = Date.now()
    const mode = options.mode || this.config.retrieval?.defaultMode || 'hybrid'

    // 检查缓存
    const cacheKey = this.getCacheKey(options)
    if (this.config.cache?.enabled) {
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        return {
          entries: cached,
          metadata: {
            totalFound: cached.length,
            timeElapsed: Date.now() - startTime,
            strategy: mode,
            cached: true
          }
        }
      }
    }

    let entries: ScoredMemoryEntry[]

    switch (mode) {
      case 'waverag':
        entries = await this.waveRagSearch(options)
        break
      case 'deepmemo':
        entries = await this.deepMemoSearch(options as DeepSearchOptions)
        break
      case 'timeline':
        entries = await this.timelineSearch(options)
        break
      case 'semantic':
      case 'hybrid':
      case 'exact':
      default:
        entries = await this.store!.search(options.query, options)
    }

    // 应用增强
    if (options.boost) {
      entries = this.applyBoost(entries, options.boost)
    }

    // 应用阈值
    const threshold = options.threshold ?? this.config.retrieval?.defaultThreshold ?? 0.5
    entries = entries.filter((e) => e.score >= threshold)

    // 限制数量
    const topK = options.topK ?? this.config.retrieval?.defaultTopK ?? 10
    entries = entries.slice(0, topK)

    // 更新缓存
    if (this.config.cache?.enabled) {
      this.setCache(cacheKey, entries)
    }

    // 发送事件
    this.events.emit('retrieval:completed', {
      query: options.query,
      mode,
      resultCount: entries.length
    })

    return {
      entries,
      metadata: {
        totalFound: entries.length,
        timeElapsed: Date.now() - startTime,
        strategy: mode,
        cached: false
      }
    }
  }

  /**
   * 获取相关上下文（用于注入对话）
   */
  async getRelevantContext(query: string, limit = 5): Promise<string> {
    const result = await this.retrieve({
      query,
      mode: 'hybrid',
      topK: limit,
      threshold: 0.4
    })

    if (result.entries.length === 0) {
      return ''
    }

    const contextLines = result.entries.map((e, i) => `[${i + 1}] ${e.content}`)

    return `相关记忆：\n${contextLines.join('\n')}`
  }

  // ==================== WaveRAG 检索 ====================

  /**
   * WaveRAG 三阶段检索
   */
  private async waveRagSearch(options: RetrievalOptions): Promise<ScoredMemoryEntry[]> {
    // Phase 1: Lens - 提取查询标签
    const queryTags = this.extractTags(options.query)
    logger.debug('WaveRAG Lens', { tags: queryTags })

    // Phase 2: Expansion - 标签扩展
    const expandedTags = await this.expandTags(queryTags)
    logger.debug('WaveRAG Expansion', { expanded: expandedTags })

    // Phase 3: Focus - 精排
    const results = await this.store!.search(options.query, {
      ...options,
      // 使用扩展后的标签进行检索
      filters: {
        ...options.filters,
        tagsOr: expandedTags
      }
    })

    // 应用 TagMemo 增强
    if (options.enableTagMemo !== false) {
      return this.applyTagMemoBoost(results, expandedTags)
    }

    return results
  }

  /**
   * 提取标签
   * 使用 Native jieba 分词 (如果可用) 以更好地处理中文文本
   */
  private extractTags(text: string): string[] {
    // 尝试使用 Native jieba 分词
    if (isChineseSearchEngineAvailable()) {
      try {
        const tokens = jiebaCut(text.toLowerCase(), true)
        const filtered = tokens.filter((w: string) => w.trim().length > 1)
        return [...new Set(filtered)]
      } catch {
        // Fallback to simple tokenization
      }
    }

    // 简单的标签提取逻辑
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
    return [...new Set(words)]
  }

  /**
   * 标签扩展
   */
  private async expandTags(tags: string[]): Promise<string[]> {
    // 集成 TagMemoService 进行标签扩展
    try {
      const { getTagMemoService } = await import('../../knowledge/tagmemo')
      const tagMemoService = getTagMemoService()

      const matrix = tagMemoService.getCooccurrenceMatrix()
      const expanded = new Set<string>(tags)

      // 使用共现矩阵扩展标签
      const relations = matrix.expandTags(tags, 2, 0.7)
      for (const rel of relations) {
        if (rel.weight > 0.3) {
          expanded.add(rel.tag2)
        }
      }

      logger.debug('Tags expanded', {
        original: tags.length,
        expanded: expanded.size
      })

      return Array.from(expanded)
    } catch (error) {
      logger.warn('Tag expansion failed, returning original tags', { error })
      return tags
    }
  }

  /**
   * 应用 TagMemo 增强
   */
  private applyTagMemoBoost(entries: ScoredMemoryEntry[], tags: string[]): ScoredMemoryEntry[] {
    // 集成 TagMemoService 进行标签增强
    try {
      // 同步加载 TagMemoService（避免 async 问题）
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getTagMemoService } = require('../../knowledge/tagmemo')
      const tagMemoService = getTagMemoService()

      const matrix = tagMemoService.getCooccurrenceMatrix()
      const tagSet = new Set(tags.map((t) => t.toLowerCase()))

      return entries.map((entry) => {
        // 提取条目中的标签
        const entryTags = entry.metadata.tags || []
        const matchedTags = entryTags.filter((t) => tagSet.has(t.toLowerCase()))

        if (matchedTags.length === 0) {
          return entry
        }

        // 计算增强分数
        let boostScore = 0
        for (const tag of matchedTags) {
          const tagInfo = matrix.getTagInfo(tag)
          if (tagInfo) {
            // 使用 PMI 风格的权重计算
            const weight = tagInfo.frequency || 1
            const docFreq = tagInfo.documentCount || 1
            // 指数增强 + 对数降噪
            const alpha = 2.0
            const beta = 2.0
            const strength = Math.pow(weight, alpha)
            const penalty = Math.log(docFreq + beta)
            boostScore += penalty > 0 ? strength / penalty : strength
          } else {
            boostScore += 1 // 基础匹配分数
          }
        }

        // 归一化并应用增强
        const normalizedBoost = boostScore / (boostScore + 4)
        const boostFactor = 1 + normalizedBoost * 0.3 // 最多提升 30%

        return {
          ...entry,
          score: Math.min(entry.score * boostFactor, 1.0),
          metadata: {
            ...entry.metadata,
            _tagMemoBoost: {
              matchedTags,
              boostFactor,
              boostScore
            }
          }
        }
      }).sort((a, b) => b.score - a.score)
    } catch (error) {
      logger.warn('TagMemo boost failed, returning original results', { error })
      return entries
    }
  }

  // ==================== DeepMemo 检索 ====================

  /**
   * DeepMemo 深度检索
   */
  private async deepMemoSearch(options: DeepSearchOptions): Promise<ScoredMemoryEntry[]> {
    const firstStageK = options.firstStageK || 50

    // 第一阶段：广度搜索
    const candidates = await this.store!.search(options.query, {
      ...options,
      topK: firstStageK
    })

    if (candidates.length === 0) {
      return []
    }

    // 第二阶段：精排
    const reranked = await this.rerankResults(candidates, options.query)

    // 可选：聚类
    if (options.enableClustering) {
      const clusters = await this.clusterResults(reranked, options.clusterCount || 5)
      // 返回每个聚类的代表
      return clusters.flatMap((c) => c.entries.slice(0, 2))
    }

    return reranked
  }

  /**
   * 结果重排序
   * 使用 BM25 关键词增强 + 可选的 LLM 重排序
   * 集成 Native jieba 分词以提升中文文本处理能力
   */
  private async rerankResults(entries: ScoredMemoryEntry[], query: string): Promise<ScoredMemoryEntry[]> {
    if (entries.length === 0) return entries

    // 第一阶段：BM25 关键词增强
    // 使用 Native jieba 分词 (如果可用)，否则使用简单分词
    const useNativeTokenizer = isChineseSearchEngineAvailable()
    let queryWords: Set<string>

    if (useNativeTokenizer) {
      try {
        const tokens = jiebaCut(query.toLowerCase(), true)
        queryWords = new Set(tokens.filter((w: string) => w.trim().length > 1))
        logger.debug('Using Native jieba tokenizer for BM25', { tokenCount: queryWords.size })
      } catch {
        // Fallback to simple tokenization
        queryWords = new Set(query.toLowerCase().split(/\s+/).filter((w) => w.length > 1))
      }
    } else {
      queryWords = new Set(query.toLowerCase().split(/\s+/).filter((w) => w.length > 1))
    }

    // BM25 参数
    const k1 = 1.5
    const b = 0.75

    // 计算平均文档长度
    const avgDocLen = entries.reduce((sum, e) => sum + e.content.length, 0) / entries.length

    // 计算 IDF (简化版)
    const idfScores = new Map<string, number>()
    for (const word of queryWords) {
      let df = 0
      for (const entry of entries) {
        if (entry.content.toLowerCase().includes(word)) {
          df++
        }
      }
      // IDF = log((N - df + 0.5) / (df + 0.5) + 1)
      const idf = Math.log((entries.length - df + 0.5) / (df + 0.5) + 1)
      idfScores.set(word, idf)
    }

    // 计算 BM25 分数
    const bm25Scored = entries.map((entry) => {
      // 对文档内容也使用 Native 分词 (如果可用)
      let contentWords: string[]
      if (useNativeTokenizer) {
        try {
          contentWords = jiebaCut(entry.content.toLowerCase(), true)
        } catch {
          contentWords = entry.content.toLowerCase().split(/\s+/)
        }
      } else {
        contentWords = entry.content.toLowerCase().split(/\s+/)
      }
      const docLen = contentWords.length

      let bm25Score = 0
      for (const word of queryWords) {
        const tf = contentWords.filter((w) => w.includes(word)).length
        if (tf === 0) continue

        const idf = idfScores.get(word) || 0
        const numerator = tf * (k1 + 1)
        const denominator = tf + k1 * (1 - b + b * (docLen / avgDocLen))
        bm25Score += idf * (numerator / denominator)
      }

      // 混合分数：原始向量分数 60% + BM25 40%
      const hybridScore = entry.score * 0.6 + (bm25Score / 10) * 0.4

      return {
        ...entry,
        score: Math.min(hybridScore, 1.0),
        metadata: {
          ...entry.metadata,
          _bm25Score: bm25Score,
          _originalScore: entry.score,
          _useNativeTokenizer: useNativeTokenizer
        }
      }
    })

    // 按混合分数排序
    const sorted = bm25Scored.sort((a, b) => b.score - a.score)

    // 第二阶段：如果结果数量较多，尝试使用 LLM 重排序（可选）
    // 这里采用保守策略，只对前 N 个结果进行精排
    const topN = Math.min(10, sorted.length)
    if (topN <= 3) {
      return sorted
    }

    try {
      // 尝试使用递归重排序（移植自 VCPToolBox DeepMemo）
      const reranked = await this.recursiveRerank(sorted.slice(0, topN), query, {
        batchSize: 5,
        maxDepth: 3
      })

      // 合并重排序结果和剩余结果
      return [...reranked, ...sorted.slice(topN)]
    } catch (error) {
      logger.debug('LLM rerank failed, using BM25 scores', { error })
      return sorted
    }
  }

  /**
   * 递归重排序算法（移植自 VCPToolBox DeepMemo）
   */
  private async recursiveRerank(
    entries: ScoredMemoryEntry[],
    query: string,
    config: { batchSize: number; maxDepth: number },
    depth = 1
  ): Promise<ScoredMemoryEntry[]> {
    // 达到最大深度或数量足够少时直接返回
    if (depth > config.maxDepth || entries.length <= config.batchSize) {
      return entries
    }

    // 分批处理
    const batches: ScoredMemoryEntry[][] = []
    for (let i = 0; i < entries.length; i += config.batchSize) {
      batches.push(entries.slice(i, i + config.batchSize))
    }

    // 每批选出最佳候选进入下一轮
    const candidates: ScoredMemoryEntry[] = []
    for (const batch of batches) {
      // 使用简单的相关性评分选出批次最佳
      const scored = batch.map((entry) => {
        const relevance = this.calculateRelevance(entry.content, query)
        return { entry, relevance }
      })
      scored.sort((a, b) => b.relevance - a.relevance)
      // 选出每批前 2 个
      candidates.push(...scored.slice(0, 2).map((s) => s.entry))
    }

    // 递归处理候选集
    return this.recursiveRerank(candidates, query, config, depth + 1)
  }

  /**
   * 计算文本相关性（简单实现）
   */
  private calculateRelevance(content: string, query: string): number {
    const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 1)
    const contentLower = content.toLowerCase()

    let matches = 0
    let totalWeight = 0

    for (const word of queryWords) {
      const occurrences = (contentLower.match(new RegExp(word, 'g')) || []).length
      if (occurrences > 0) {
        matches++
        totalWeight += Math.log(occurrences + 1)
      }
    }

    // 覆盖率 + 词频权重
    const coverage = queryWords.length > 0 ? matches / queryWords.length : 0
    return coverage * 0.7 + (totalWeight / 10) * 0.3
  }

  /**
   * 结果聚类
   * 使用简单的 K-Means 风格聚类（基于内容相似度）
   */
  private async clusterResults(entries: ScoredMemoryEntry[], k: number): Promise<TopicCluster[]> {
    if (entries.length === 0) return []
    if (entries.length <= k) {
      // 每个条目独立成簇
      return entries.map((entry) => ({
        id: crypto.randomUUID(),
        topic: entry.type || 'general',
        entries: [entry]
      }))
    }

    // 第一步：基于类型和标签进行初步分组
    const typeGroups = new Map<string, ScoredMemoryEntry[]>()
    const tagGroups = new Map<string, ScoredMemoryEntry[]>()

    for (const entry of entries) {
      // 按类型分组
      const typeKey = entry.type || 'other'
      if (!typeGroups.has(typeKey)) {
        typeGroups.set(typeKey, [])
      }
      typeGroups.get(typeKey)!.push(entry)

      // 按主要标签分组
      const primaryTag = entry.metadata.tags?.[0]?.toLowerCase() || 'untagged'
      if (!tagGroups.has(primaryTag)) {
        tagGroups.set(primaryTag, [])
      }
      tagGroups.get(primaryTag)!.push(entry)
    }

    // 第二步：合并小组，确保最终簇数不超过 k
    const clusters: TopicCluster[] = []

    // 优先使用类型分组
    const sortedTypeGroups = Array.from(typeGroups.entries())
      .sort((a, b) => b[1].length - a[1].length)

    for (const [typeName, typeEntries] of sortedTypeGroups) {
      if (clusters.length >= k) {
        // 将剩余项添加到最后一个簇
        clusters[clusters.length - 1].entries.push(...typeEntries)
      } else {
        clusters.push({
          id: crypto.randomUUID(),
          topic: typeName,
          entries: typeEntries
        })
      }
    }

    // 第三步：如果簇数不足，尝试细分大簇
    if (clusters.length < k) {
      const largestCluster = clusters.reduce((max, c) =>
        c.entries.length > max.entries.length ? c : max
      , clusters[0])

      if (largestCluster && largestCluster.entries.length > 2) {
        // 使用标签进一步细分
        const subClusters = new Map<string, ScoredMemoryEntry[]>()
        for (const entry of largestCluster.entries) {
          const subKey = entry.metadata.tags?.[0] || 'default'
          if (!subClusters.has(subKey)) {
            subClusters.set(subKey, [])
          }
          subClusters.get(subKey)!.push(entry)
        }

        // 替换原簇
        const clusterIdx = clusters.indexOf(largestCluster)
        const subClusterArray = Array.from(subClusters.entries())
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, k - clusters.length + 1)

        clusters.splice(clusterIdx, 1)
        for (const [subTopic, subEntries] of subClusterArray) {
          clusters.push({
            id: crypto.randomUUID(),
            topic: `${largestCluster.topic}/${subTopic}`,
            entries: subEntries
          })
        }
      }
    }

    logger.debug('Clustering completed', {
      inputCount: entries.length,
      clusterCount: clusters.length,
      avgClusterSize: Math.round(entries.length / clusters.length)
    })

    return clusters.slice(0, k)
  }

  // ==================== 时间线检索 ====================

  /**
   * 时间线检索
   */
  private async timelineSearch(options: RetrievalOptions): Promise<ScoredMemoryEntry[]> {
    const results = await this.store!.search(options.query, options)

    // 按时间排序
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  // ==================== 语义组检索 ====================

  /**
   * 按语义组检索
   */
  async searchBySemanticGroup(groupId: string, query?: string): Promise<ScoredMemoryEntry[]> {
    const group = SEMANTIC_GROUPS[groupId]
    if (!group) {
      throw new Error(`Unknown semantic group: ${groupId}`)
    }

    return this.retrieve({
      query: query || group.keywords.join(' '),
      mode: 'hybrid',
      filters: {
        types: group.types,
        tagsOr: group.keywords
      }
    }).then((r) => r.entries)
  }

  /**
   * 自动分组记忆
   */
  async autoGroupMemories(entries: ScoredMemoryEntry[]): Promise<GroupedMemories> {
    const result: GroupedMemories = {
      groups: new Map(),
      ungrouped: []
    }

    for (const entry of entries) {
      let matched = false

      for (const [groupId, group] of Object.entries(SEMANTIC_GROUPS)) {
        // 检查类型匹配
        if (group.types && group.types.includes(entry.type)) {
          if (!result.groups.has(groupId)) {
            result.groups.set(groupId, [])
          }
          result.groups.get(groupId)!.push(entry)
          matched = true
          break
        }

        // 检查关键词匹配
        const contentLower = entry.content.toLowerCase()
        if (group.keywords.some((kw) => contentLower.includes(kw))) {
          if (!result.groups.has(groupId)) {
            result.groups.set(groupId, [])
          }
          result.groups.get(groupId)!.push(entry)
          matched = true
          break
        }
      }

      if (!matched) {
        result.ungrouped.push(entry)
      }
    }

    return result
  }

  // ==================== 对话提取 ====================

  /**
   * 从对话提取记忆
   */
  async extractFromConversation(messages: ConversationMessage[]): Promise<AddMemoryResult> {
    this.ensureInitialized()

    if (!this.extractor) {
      logger.warn('Extractor not initialized, skipping extraction')
      return { added: [], skipped: 0, failed: [] }
    }

    // 提取信息
    const extracted = await this.extractor.extract(messages)

    // 添加提取的记忆
    const result = await this.addBatch(extracted.memories)

    // 处理实体 - 作为 entity 类型的记忆存储
    if (extracted.entities && extracted.entities.length > 0) {
      for (const entity of extracted.entities) {
        try {
          await this.add({
            content: `实体: ${entity.name} (${entity.type})`,
            type: 'entity',
            tags: [entity.type, entity.name.toLowerCase()],
            customMetadata: {
              entityName: entity.name,
              entityType: entity.type
            }
          })
        } catch (error) {
          logger.debug('Failed to store entity', { entity: entity.name, error })
        }
      }
    }

    // 处理关系 - 作为 relation 类型的记忆存储
    if (extracted.relations && extracted.relations.length > 0) {
      for (const relation of extracted.relations) {
        try {
          await this.add({
            content: `关系: ${relation.from} ${relation.type} ${relation.to}`,
            type: 'relation',
            tags: [relation.from.toLowerCase(), relation.to.toLowerCase(), relation.type],
            customMetadata: {
              fromEntity: relation.from,
              toEntity: relation.to,
              relationType: relation.type
            }
          })
        } catch (error) {
          logger.debug('Failed to store relation', { relation, error })
        }
      }
    }

    // 发送事件
    this.events.emit('extraction:completed', {
      messageCount: messages.length,
      memoriesExtracted: result.added.length,
      entitiesExtracted: extracted.entities?.length || 0,
      relationsExtracted: extracted.relations?.length || 0
    })

    return result
  }

  // ==================== 更新和删除 ====================

  /**
   * 更新记忆
   */
  async update(id: string, updates: Partial<MemoryEntry>): Promise<void> {
    this.ensureInitialized()

    const existing = await this.store!.get(id)
    if (!existing) {
      throw new Error(`Memory not found: ${id}`)
    }

    // 如果内容变更，重新生成嵌入
    if (updates.content && updates.content !== existing.content && this.embedder) {
      updates.embedding = await this.embedder.embed(updates.content)
      updates.hash = this.generateHash(updates.content)
    }

    updates.updatedAt = new Date()

    await this.store!.update(id, updates)

    // 清除相关缓存
    this.invalidateCache()

    this.events.emit('memory:updated', { id, updates: Object.keys(updates) })
  }

  /**
   * 删除记忆
   */
  async delete(id: string): Promise<void> {
    this.ensureInitialized()

    await this.store!.delete(id)

    // 清除相关缓存
    this.invalidateCache()

    this.events.emit('memory:deleted', { id })
  }

  // ==================== 事件订阅 ====================

  /**
   * 订阅事件
   */
  on(event: MemoryEventType, listener: (data: Record<string, unknown>) => void): void {
    this.events.on(event, (e) => listener(e.data))
  }

  /**
   * 取消订阅
   */
  off(event: MemoryEventType, listener: (data: Record<string, unknown>) => void): void {
    this.events.off(event, listener as any)
  }

  // ==================== 辅助方法 ====================

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('UnifiedMemoryService not initialized. Call initialize() first.')
    }
    if (!this.store) {
      throw new Error('Memory store not available')
    }
  }

  private async createEntry(input: AddMemoryInput): Promise<MemoryEntry> {
    const now = new Date()
    const hash = this.generateHash(input.content)

    const metadata: MemoryMetadata = {
      source: input.source || 'explicit',
      confidence: input.confidence ?? 1.0,
      tags: input.tags || [],
      userId: input.userId || this.config.defaultUserId,
      agentId: input.agentId,
      sessionId: input.sessionId,
      importance: input.importance ?? 5,
      custom: input.customMetadata
    }

    return {
      id: crypto.randomUUID(),
      content: input.content.trim(),
      type: input.type || 'fact',
      hash,
      metadata,
      createdAt: now,
      updatedAt: now,
      accessCount: 0
    }
  }

  private generateHash(content: string): string {
    return crypto.createHash('sha256').update(content.trim()).digest('hex')
  }

  private async isDuplicate(entry: MemoryEntry): Promise<boolean> {
    // 首先检查哈希 - 精确重复检测
    if (entry.hash && this.sqliteStore) {
      try {
        // 查询是否存在相同哈希的记忆
        const existing = await this.sqliteStore.findByHash(entry.hash)
        if (existing) {
          logger.debug('Duplicate found by hash', { hash: entry.hash.slice(0, 16) })
          return true
        }
      } catch {
        // 如果 findByHash 不可用，继续使用语义检查
        logger.debug('Hash check not available, falling back to semantic check')
      }
    }

    // 然后检查语义相似度 - 近似重复检测
    if (this.embedder && entry.embedding && entry.embedding.length > 0) {
      const similar = await this.retrieve({
        query: entry.content,
        mode: 'semantic',
        topK: 1,
        threshold: this.config.deduplicationThreshold || 0.85
      })
      if (similar.entries.length > 0) {
        logger.debug('Duplicate found by semantic similarity', {
          score: similar.entries[0].score
        })
        return true
      }
    }

    return false
  }

  private applyBoost(entries: ScoredMemoryEntry[], boost: RetrievalOptions['boost']): ScoredMemoryEntry[] {
    if (!boost) return entries

    return entries
      .map((entry) => {
        let score = entry.score

        // 标签增强
        if (boost.tags) {
          const matchingTags = entry.metadata.tags.filter((t) =>
            boost.tags!.some((bt) => t.toLowerCase().includes(bt.toLowerCase()))
          )
          score *= 1 + matchingTags.length * 0.1
        }

        // 类型增强
        if (boost.types && boost.types.includes(entry.type)) {
          score *= 1.2
        }

        // 最近性增强
        if (boost.recency) {
          const daysSinceCreated = (Date.now() - new Date(entry.createdAt).getTime()) / (1000 * 60 * 60 * 24)
          const recencyFactor = Math.exp(-daysSinceCreated / 30) // 30天半衰期
          score *= 1 + recencyFactor * 0.3
        }

        // 频率增强
        if (boost.frequency) {
          const frequencyFactor = Math.log(entry.accessCount + 1) / 10
          score *= 1 + frequencyFactor
        }

        return { ...entry, score }
      })
      .sort((a, b) => b.score - a.score)
  }

  // ==================== 缓存管理 ====================

  private getCacheKey(options: RetrievalOptions): string {
    return crypto.createHash('md5').update(JSON.stringify(options)).digest('hex')
  }

  private getFromCache(key: string): ScoredMemoryEntry[] | null {
    const cached = this.cache.get(key)
    if (cached && cached.expiry > Date.now()) {
      return cached.entry
    }
    this.cache.delete(key)
    return null
  }

  private setCache(key: string, entries: ScoredMemoryEntry[]): void {
    // 清理过期缓存
    if (this.cache.size >= (this.config.cache?.maxSize || 1000)) {
      const now = Date.now()
      for (const [k, v] of this.cache) {
        if (v.expiry < now) {
          this.cache.delete(k)
        }
      }
    }

    const ttl = (this.config.cache?.ttlSeconds || 300) * 1000
    this.cache.set(key, {
      entry: entries,
      expiry: Date.now() + ttl
    })
  }

  private invalidateCache(): void {
    this.cache.clear()
  }

  // ==================== 配置 ====================

  /**
   * 更新配置
   */
  setConfig(config: Partial<MemoryServiceConfig>): void {
    this.config = { ...this.config, ...config }
    logger.debug('Config updated', { config: this.config })
  }

  /**
   * 获取配置
   */
  getConfig(): MemoryServiceConfig {
    return { ...this.config }
  }
}

// 导出单例
export const unifiedMemory = UnifiedMemoryService.getInstance()
