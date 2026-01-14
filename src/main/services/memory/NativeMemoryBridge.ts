/**
 * NativeMemoryBridge - Rust 原生模块与 MemoryBrain 的桥接层
 *
 * 提供 Rust 原生模块的高性能能力给 MemoryBrain:
 * - TagMemo 标签共现矩阵
 * - HybridSearch RRF 融合
 * - TextChunker 文本分块
 * - Diary CRUD 操作
 * - VexusIndex 向量搜索
 *
 * @module services/memory/NativeMemoryBridge
 */

import { loggerService } from '@logger'

import {
  createHybridSearchEngine,
  createTagCooccurrenceMatrix,
  createTextChunker,
  createUnifiedDatabase,
  createVexusIndex,
  diaryOps,
  healthCheck,
  initializeNativeVCP,
  isNativeModuleAvailable,
  quickRrfFusion,
  tagBoostOps,
  type DiaryDateQuery,
  type DiaryRecord,
  type DiarySearchQuery,
  type DiaryStats,
  type HealthStatus,
  type HybridSearchResult,
  type SearchResultItem,
  type TagAssociation,
  type TagBoostParams,
  type TagBoostResult,
  type TagMatrixStats,
  type TextChunk
} from '../native/NativeVCPBridge'

const logger = loggerService.withContext('NativeMemoryBridge')

// ==================== 类型定义 ====================

export interface NativeMemoryBridgeConfig {
  /** 数据库路径 */
  dbPath?: string
  /** 向量索引维度 */
  vectorDim?: number
  /** 向量索引容量 */
  vectorCapacity?: number
  /** 是否自动初始化 */
  autoInit?: boolean
}

export interface RRFMergeOptions {
  /** BM25 权重 */
  bm25Weight?: number
  /** 向量搜索权重 */
  vectorWeight?: number
  /** TagMemo 增强权重 */
  tagBoostWeight?: number
  /** 返回数量限制 */
  limit?: number
}

export interface TagBoostOptions {
  alphaMin?: number
  alphaMax?: number
  betaBase?: number
}

// ==================== NativeMemoryBridge ====================

export class NativeMemoryBridge {
  private static instance: NativeMemoryBridge | null = null

  private initialized = false
  private config: NativeMemoryBridgeConfig

  // 缓存的原生实例
  private tagMatrix: unknown = null
  private hybridSearch: unknown = null
  private textChunker: unknown = null
  private database: unknown = null
  private vexusIndex: unknown = null

  private constructor() {
    this.config = {
      vectorDim: 1536,
      vectorCapacity: 100000,
      autoInit: true
    }
    logger.info('NativeMemoryBridge created')
  }

  static getInstance(): NativeMemoryBridge {
    if (!NativeMemoryBridge.instance) {
      NativeMemoryBridge.instance = new NativeMemoryBridge()
    }
    return NativeMemoryBridge.instance
  }

  // ==================== 初始化 ====================

  /**
   * 初始化 Native 模块
   */
  async initialize(config?: Partial<NativeMemoryBridgeConfig>): Promise<HealthStatus> {
    if (this.initialized) {
      return healthCheck()
    }

    if (config) {
      this.config = { ...this.config, ...config }
    }

    try {
      const health = await initializeNativeVCP()
      this.initialized = true

      logger.info('NativeMemoryBridge initialized', {
        isNative: health.isNative,
        features: health.features
      })

      // 自动初始化常用组件
      if (this.config.autoInit) {
        this.initializeComponents()
      }

      return health
    } catch (error) {
      logger.error('NativeMemoryBridge initialization failed', error as Error)
      throw error
    }
  }

  /**
   * 初始化常用组件
   */
  private initializeComponents(): void {
    try {
      // 初始化 TagMatrix
      this.tagMatrix = createTagCooccurrenceMatrix(0.8, 0.2)
      logger.debug('TagMatrix initialized')

      // 初始化 HybridSearch
      this.hybridSearch = createHybridSearchEngine(0.5, 0.5, 0.2)
      logger.debug('HybridSearch initialized')

      // 初始化 TextChunker
      this.textChunker = createTextChunker(1000, 200)
      logger.debug('TextChunker initialized')

      // 数据库和向量索引按需初始化
    } catch (error) {
      logger.warn('Some components failed to initialize', { error: String(error) })
    }
  }

  /**
   * 检查是否可用
   */
  isAvailable(): boolean {
    return this.initialized && isNativeModuleAvailable()
  }

  /**
   * 获取健康状态
   */
  getHealthStatus(): HealthStatus {
    return healthCheck()
  }

  // ==================== TagMemo 标签共现 ====================

  /**
   * 更新标签共现
   */
  updateTagCooccurrence(tag1: string, tag2: string, weight = 1.0): void {
    if (!this.tagMatrix) {
      this.tagMatrix = createTagCooccurrenceMatrix()
    }
    const matrix = this.tagMatrix as { update: (t1: string, t2: string, w?: number) => void }
    matrix.update(tag1, tag2, weight)
  }

  /**
   * 批量更新标签共现
   */
  batchUpdateTagCooccurrence(pairs: Array<{ tag1: string; tag2: string; weight?: number }>): void {
    if (!this.tagMatrix) {
      this.tagMatrix = createTagCooccurrenceMatrix()
    }
    const matrix = this.tagMatrix as { batchUpdate: (updates: Array<{ tag1: string; tag2: string; weight?: number }>) => void }
    matrix.batchUpdate(pairs)
  }

  /**
   * 计算 PMI
   */
  computePMI(tag1: string, tag2: string): number {
    if (!this.tagMatrix) return 0
    const matrix = this.tagMatrix as { computePmi: (t1: string, t2: string) => number }
    return matrix.computePmi(tag1, tag2)
  }

  /**
   * 获取关联标签
   */
  getTagAssociations(tag: string, topK = 10): TagAssociation[] {
    if (!this.tagMatrix) return []
    const matrix = this.tagMatrix as { getAssociations: (t: string, k?: number) => TagAssociation[] }
    return matrix.getAssociations(tag, topK)
  }

  /**
   * 扩展查询标签
   */
  expandQueryTags(tags: string[], expansionFactor = 0.5): string[] {
    if (!this.tagMatrix) return tags
    const matrix = this.tagMatrix as { expandQuery: (t: string[], f?: number) => string[] }
    return matrix.expandQuery(tags, expansionFactor)
  }

  /**
   * 获取 TagMatrix 统计
   */
  getTagMatrixStats(): TagMatrixStats | null {
    if (!this.tagMatrix) return null
    const matrix = this.tagMatrix as { getStats: () => TagMatrixStats }
    return matrix.getStats()
  }

  /**
   * 计算 TagBoost 增强
   */
  computeTagBoost(params: TagBoostParams): TagBoostResult {
    if (!this.tagMatrix) {
      return tagBoostOps.computeTagBoost(null, params)
    }
    return tagBoostOps.computeTagBoost(this.tagMatrix, params)
  }

  /**
   * 批量计算 TagBoost
   */
  batchComputeTagBoost(
    items: Array<{ contentTags: string[]; originalScore?: number }>,
    queryTags: string[],
    options?: TagBoostOptions
  ): TagBoostResult[] {
    if (!this.tagMatrix) {
      return tagBoostOps.batchComputeTagBoost(
        null,
        items,
        queryTags,
        options?.alphaMin,
        options?.alphaMax,
        options?.betaBase
      )
    }
    return tagBoostOps.batchComputeTagBoost(
      this.tagMatrix,
      items,
      queryTags,
      options?.alphaMin,
      options?.alphaMax,
      options?.betaBase
    )
  }

  /**
   * 导出 TagMatrix
   */
  exportTagMatrix(): string | null {
    if (!this.tagMatrix) return null
    const matrix = this.tagMatrix as { toJson: () => string }
    return matrix.toJson()
  }

  /**
   * 导入 TagMatrix
   */
  importTagMatrix(json: string): void {
    const MatrixClass = createTagCooccurrenceMatrix().constructor as {
      fromJson?: (json: string) => unknown
    }
    if (MatrixClass.fromJson) {
      this.tagMatrix = MatrixClass.fromJson(json)
    }
  }

  // ==================== Hybrid Search RRF ====================

  /**
   * RRF 融合搜索结果
   */
  fuseSearchResults(
    bm25Results: SearchResultItem[],
    vectorResults: SearchResultItem[],
    tagBoostScores?: Map<string, number>,
    options?: RRFMergeOptions
  ): HybridSearchResult[] {
    // 如果没有初始化 hybridSearch，使用快速融合
    if (!this.hybridSearch) {
      return quickRrfFusion(bm25Results, vectorResults, options?.limit)
    }

    const engine = this.hybridSearch as {
      setWeights: (bm25: number, vector: number, tagBoost: number) => void
      fuseResults: (
        bm25: SearchResultItem[],
        vector: SearchResultItem[],
        tagBoost?: Record<string, number>,
        limit?: number
      ) => HybridSearchResult[]
    }

    // 设置权重
    if (options?.bm25Weight !== undefined || options?.vectorWeight !== undefined || options?.tagBoostWeight !== undefined) {
      engine.setWeights(
        options.bm25Weight ?? 0.5,
        options.vectorWeight ?? 0.5,
        options.tagBoostWeight ?? 0.2
      )
    }

    // 转换 Map 为 Object
    const tagBoostObj = tagBoostScores ? Object.fromEntries(tagBoostScores) : undefined

    return engine.fuseResults(bm25Results, vectorResults, tagBoostObj, options?.limit)
  }

  /**
   * 快速 RRF 融合
   */
  quickFuse(
    bm25Results: SearchResultItem[],
    vectorResults: SearchResultItem[],
    limit?: number
  ): HybridSearchResult[] {
    return quickRrfFusion(bm25Results, vectorResults, limit)
  }

  // ==================== Text Chunking ====================

  /**
   * 分块文本
   */
  chunkText(text: string, maxChunkSize?: number, overlapSize?: number): TextChunk[] {
    if (!this.textChunker && (maxChunkSize !== undefined || overlapSize !== undefined)) {
      this.textChunker = createTextChunker(maxChunkSize, overlapSize)
    } else if (!this.textChunker) {
      this.textChunker = createTextChunker()
    }

    const chunker = this.textChunker as { chunk: (text: string) => TextChunk[] }
    return chunker.chunk(text)
  }

  /**
   * 批量分块
   */
  batchChunkTexts(texts: string[]): Array<{ docIndex: number; chunks: TextChunk[] }> {
    if (!this.textChunker) {
      this.textChunker = createTextChunker()
    }
    const chunker = this.textChunker as { chunkBatch: (texts: string[]) => Array<{ docIndex: number; chunks: TextChunk[] }> }
    return chunker.chunkBatch(texts)
  }

  /**
   * 估算 Token 数量
   */
  estimateTokens(text: string): number {
    if (!this.textChunker) {
      this.textChunker = createTextChunker()
    }
    const chunker = this.textChunker as { estimateTokens: (text: string) => number }
    return chunker.estimateTokens(text)
  }

  // ==================== Diary 操作 ====================

  /**
   * 初始化数据库
   */
  initializeDatabase(dbPath: string): void {
    if (this.database) return
    try {
      this.database = createUnifiedDatabase(dbPath)
      this.config.dbPath = dbPath
      logger.info('Database initialized', { dbPath })
    } catch (error) {
      logger.error('Failed to initialize database', error as Error)
      throw error
    }
  }

  /**
   * 保存日记
   */
  saveDiary(diary: DiaryRecord): void {
    if (!this.database) {
      throw new Error('Database not initialized. Call initializeDatabase first.')
    }
    diaryOps.saveDiary(this.database, diary)
  }

  /**
   * 获取日记
   */
  getDiary(id: string): DiaryRecord | null {
    if (!this.database) return null
    return diaryOps.getDiary(this.database, id)
  }

  /**
   * 删除日记
   */
  deleteDiary(id: string): boolean {
    if (!this.database) return false
    return diaryOps.deleteDiary(this.database, id)
  }

  /**
   * 按日期范围查询日记
   */
  queryDiaryByDateRange(query: DiaryDateQuery): DiaryRecord[] {
    if (!this.database) return []
    return diaryOps.queryDiaryByDateRange(this.database, query)
  }

  /**
   * 搜索日记
   */
  searchDiary(query: DiarySearchQuery): DiaryRecord[] {
    if (!this.database) return []
    return diaryOps.searchDiary(this.database, query)
  }

  /**
   * 按标签查询日记
   */
  queryDiaryByTags(tags: string[], limit?: number): DiaryRecord[] {
    if (!this.database) return []
    return diaryOps.queryDiaryByTags(this.database, tags, limit)
  }

  /**
   * 获取日记统计
   */
  getDiaryStats(bookName?: string): DiaryStats | null {
    if (!this.database) return null
    return diaryOps.getDiaryStats(this.database, bookName)
  }

  /**
   * 批量保存日记
   */
  batchSaveDiary(diaries: DiaryRecord[]): number {
    if (!this.database) return 0
    return diaryOps.batchSaveDiary(this.database, diaries)
  }

  // ==================== Vector Index ====================

  /**
   * 初始化向量索引
   */
  initializeVectorIndex(dim?: number, capacity?: number): void {
    if (this.vexusIndex) return
    const d = dim ?? this.config.vectorDim ?? 1536
    const c = capacity ?? this.config.vectorCapacity ?? 100000
    try {
      this.vexusIndex = createVexusIndex(d, c)
      logger.info('VexusIndex initialized', { dim: d, capacity: c })
    } catch (error) {
      logger.error('Failed to initialize VexusIndex', error as Error)
      throw error
    }
  }

  /**
   * 添加向量
   */
  addVector(id: number, vector: Buffer): void {
    if (!this.vexusIndex) {
      throw new Error('VexusIndex not initialized. Call initializeVectorIndex first.')
    }
    const index = this.vexusIndex as { add: (id: number, vector: Buffer) => void }
    index.add(id, vector)
  }

  /**
   * 批量添加向量
   */
  addVectorsBatch(ids: number[], vectors: Buffer): void {
    if (!this.vexusIndex) {
      throw new Error('VexusIndex not initialized')
    }
    const index = this.vexusIndex as { addBatch: (ids: number[], vectors: Buffer) => void }
    index.addBatch(ids, vectors)
  }

  /**
   * 向量搜索
   */
  searchVectors(query: Buffer, k: number): Array<{ id: number; score: number }> {
    if (!this.vexusIndex) return []
    const index = this.vexusIndex as { search: (query: Buffer, k: number) => Array<{ id: number; score: number }> }
    return index.search(query, k)
  }

  /**
   * 删除向量
   */
  removeVector(id: number): void {
    if (!this.vexusIndex) return
    const index = this.vexusIndex as { remove: (id: number) => void }
    index.remove(id)
  }

  /**
   * 获取向量索引统计
   */
  getVectorIndexStats(): { totalVectors: number; dimensions: number; capacity: number; memoryUsage: number } | null {
    if (!this.vexusIndex) return null
    const index = this.vexusIndex as { stats: () => { totalVectors: number; dimensions: number; capacity: number; memoryUsage: number } }
    return index.stats()
  }

  // ==================== 统一接口 ====================

  /**
   * 统一记忆搜索 (结合 TagMemo + RRF)
   */
  async unifiedMemorySearch(
    _query: string,
    bm25Results: SearchResultItem[],
    vectorResults: SearchResultItem[],
    queryTags: string[],
    options?: {
      rrf?: RRFMergeOptions
      tagBoost?: TagBoostOptions
      expandTags?: boolean
    }
  ): Promise<{
    results: HybridSearchResult[]
    expandedTags?: string[]
    tagBoostResults?: TagBoostResult[]
  }> {
    // 1. 扩展查询标签
    let expandedTags: string[] | undefined
    if (options?.expandTags && queryTags.length > 0) {
      expandedTags = this.expandQueryTags(queryTags)
    }

    // 2. 计算 TagBoost
    const allResults = [...bm25Results, ...vectorResults]
    const uniqueResults = allResults.filter(
      (r, i, arr) => arr.findIndex((x) => x.id === r.id) === i
    )

    // 提取每个结果的标签 (从 metadata)
    const tagBoostItems = uniqueResults.map((r) => {
      let tags: string[] = []
      if (r.metadata) {
        try {
          const meta = JSON.parse(r.metadata)
          tags = meta.tags || []
        } catch {
          // ignore
        }
      }
      return { contentTags: tags, originalScore: r.score }
    })

    const tagBoostResults = this.batchComputeTagBoost(
      tagBoostItems,
      expandedTags || queryTags,
      options?.tagBoost
    )

    // 3. 创建 TagBoost 分数映射
    const tagBoostScores = new Map<string, number>()
    uniqueResults.forEach((r, i) => {
      if (tagBoostResults[i]) {
        tagBoostScores.set(r.id, tagBoostResults[i].tagMatchScore)
      }
    })

    // 4. RRF 融合
    const results = this.fuseSearchResults(
      bm25Results,
      vectorResults,
      tagBoostScores,
      options?.rrf
    )

    return {
      results,
      expandedTags,
      tagBoostResults
    }
  }

  /**
   * 从文档列表中学习标签共现
   */
  learnFromDocuments(documents: Array<{ tags: string[] }>): void {
    for (const doc of documents) {
      const tags = doc.tags
      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          this.updateTagCooccurrence(tags[i], tags[j])
        }
      }
    }
  }

  // ==================== 清理 ====================

  /**
   * 清理所有资源
   */
  cleanup(): void {
    this.tagMatrix = null
    this.hybridSearch = null
    this.textChunker = null
    this.database = null
    this.vexusIndex = null
    logger.info('NativeMemoryBridge resources cleaned up')
  }
}

// ==================== 导出 ====================

let bridgeInstance: NativeMemoryBridge | null = null

export function getNativeMemoryBridge(): NativeMemoryBridge {
  if (!bridgeInstance) {
    bridgeInstance = NativeMemoryBridge.getInstance()
  }
  return bridgeInstance
}

/**
 * 初始化并返回 NativeMemoryBridge
 */
export async function initializeNativeMemoryBridge(
  config?: Partial<NativeMemoryBridgeConfig>
): Promise<NativeMemoryBridge> {
  const bridge = getNativeMemoryBridge()
  await bridge.initialize(config)
  return bridge
}

/**
 * 便捷函数: 统一记忆搜索
 */
export async function nativeUnifiedSearch(
  query: string,
  bm25Results: SearchResultItem[],
  vectorResults: SearchResultItem[],
  queryTags: string[],
  options?: {
    rrf?: RRFMergeOptions
    tagBoost?: TagBoostOptions
    expandTags?: boolean
  }
) {
  return getNativeMemoryBridge().unifiedMemorySearch(
    query,
    bm25Results,
    vectorResults,
    queryTags,
    options
  )
}

/**
 * 便捷函数: 快速 RRF 融合
 */
export function nativeQuickFuse(
  bm25Results: SearchResultItem[],
  vectorResults: SearchResultItem[],
  limit?: number
): HybridSearchResult[] {
  return getNativeMemoryBridge().quickFuse(bm25Results, vectorResults, limit)
}

/**
 * 便捷函数: 文本分块
 */
export function nativeChunkText(text: string, maxChunkSize?: number, overlapSize?: number): TextChunk[] {
  return getNativeMemoryBridge().chunkText(text, maxChunkSize, overlapSize)
}
