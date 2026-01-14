/**
 * Native MeshMemo 服务
 *
 * 使用 Rust 原生层进行高性能操作：
 * - VectorStore: 向量相似度搜索
 * - TagCooccurrenceMatrix: TagMemo 标签扩展
 * - 保持 TypeScript 过滤逻辑的灵活性
 *
 * @version 1.0.0
 */

import { app } from 'electron'
import path from 'path'

import { loggerService } from '@logger'
import type { KnowledgeSearchResult } from '@types'

import {
  createTagCooccurrenceMatrix,
  createUnifiedDatabase,
  createVectorStore,
  vectorOps,
  type MemoryRecord
} from '../../services/native'
import { getDynamicKCalculator, type DynamicKResult } from './DynamicKCalculator'

const logger = loggerService.withContext('NativeMeshMemoService')

// ==================== 类型定义 ====================

export type GenericMetadata = Record<string, unknown>

export interface MeshMemoSearchResult<T extends GenericMetadata = GenericMetadata> extends KnowledgeSearchResult {
  metadata: T
  filterScore: number
  semanticScore: number
  finalScore: number
}

export interface FilterCondition<T extends GenericMetadata = GenericMetadata> {
  field: keyof T | string
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'in'
    | 'not_in'
    | 'range'
    | 'exists'
    | 'regex'
    | 'any_of'
    | 'all_of'
  value: unknown
  ignoreCase?: boolean
}

export interface MeshMemoFilter<T extends GenericMetadata = GenericMetadata> {
  conditions?: FilterCondition<T>[]
  logic?: 'and' | 'or'
  customFilter?: (metadata: T) => boolean
}

export interface NativeMeshMemoConfig<T extends GenericMetadata = GenericMetadata> {
  filter?: MeshMemoFilter<T>
  query: string
  initialTopK?: number
  finalTopK?: number
  threshold?: number
  rerank?: boolean
  rerankFn?: (query: string, results: MeshMemoSearchResult<T>[]) => Promise<MeshMemoSearchResult<T>[]>
  diversitySampling?: boolean
  diversityLambda?: number
  diversityFields?: (keyof T | string)[]
  tagMemo?: boolean
  tagFields?: (keyof T | string)[]
  timeDecay?: boolean
  timeField?: keyof T | string
  timeDecayHalfLife?: number
  useDynamicK?: boolean
  onDynamicKCalculated?: (result: DynamicKResult) => void
}

export interface MeshMemoChunk<T extends GenericMetadata = GenericMetadata> {
  id: string
  content: string
  embedding?: number[]
  metadata: T
  createdAt?: Date
}

// ==================== Native MeshMemo 服务 ====================

export class NativeMeshMemoService<T extends GenericMetadata = GenericMetadata> {
  // Rust 原生组件
  private vectorStore: ReturnType<typeof createVectorStore> | null = null
  private tagMatrix: ReturnType<typeof createTagCooccurrenceMatrix>
  private database: ReturnType<typeof createUnifiedDatabase> | null = null
  private vectorDim: number = 1536
  private dbPath: string

  // 内存缓存 (用于快速查询和过滤)
  private chunks: Map<string, MeshMemoChunk<T>> = new Map()
  private idToIndex: Map<string, number> = new Map()
  private indexToId: Map<number, string> = new Map()
  private nextIndex: number = 0
  private initialized: boolean = false

  constructor(vectorDim: number = 1536, dbPath?: string) {
    this.vectorDim = vectorDim
    this.dbPath = dbPath || path.join(app.getPath('userData'), 'vcp-data', 'meshmemo.db')
    this.tagMatrix = createTagCooccurrenceMatrix(0.8, 0.2)

    // 延迟初始化 VectorStore
    try {
      this.vectorStore = createVectorStore(vectorDim)
      logger.info('NativeMeshMemoService initialized with Rust VectorStore', { vectorDim })
    } catch (error) {
      logger.warn('Failed to create Rust VectorStore, will use fallback', { error })
    }

    // 初始化数据库
    this.initializeDatabase()
  }

  /**
   * 初始化数据库并加载缓存
   */
  private async initializeDatabase(): Promise<void> {
    if (this.initialized) return

    try {
      this.database = createUnifiedDatabase(this.dbPath)
      logger.info('NativeMeshMemoService database initialized', { dbPath: this.dbPath })

      // 从数据库加载现有数据到内存缓存
      await this.loadFromDatabase()
      this.initialized = true
    } catch (error) {
      logger.error('Failed to initialize NativeMeshMemoService database', { error })
    }
  }

  /**
   * 从数据库加载数据到内存缓存
   */
  private async loadFromDatabase(): Promise<void> {
    if (!this.database) return

    try {
      // 搜索所有记录（使用空查询）
      const records = (this.database as any).searchMemories({ limit: 10000 }) as MemoryRecord[]

      for (const record of records) {
        const chunk = this.recordToChunk(record)
        if (chunk) {
          this.chunks.set(chunk.id, chunk)

          if (chunk.embedding && this.vectorStore) {
            const index = this.nextIndex++
            this.idToIndex.set(chunk.id, index)
            this.indexToId.set(index, chunk.id)

            try {
              ;(this.vectorStore as any).add(chunk.id, chunk.embedding)
            } catch {
              // 忽略向量添加失败
            }
          }
        }
      }

      logger.info('Loaded chunks from database', { count: this.chunks.size })
    } catch (error) {
      logger.warn('Failed to load from database', { error })
    }
  }

  /**
   * 将 MemoryRecord 转换为 MeshMemoChunk
   */
  private recordToChunk(record: MemoryRecord): MeshMemoChunk<T> | null {
    try {
      let metadata: T = {} as T
      if (record.metadata) {
        try {
          metadata = JSON.parse(record.metadata) as T
        } catch {
          // 解析失败则使用空对象
        }
      }

      return {
        id: record.id,
        content: record.content,
        embedding: record.embedding,
        metadata,
        createdAt: record.createdAt ? new Date(record.createdAt) : undefined
      }
    } catch {
      return null
    }
  }

  /**
   * 将 MeshMemoChunk 转换为 MemoryRecord
   */
  private chunkToRecord(chunk: MeshMemoChunk<T>): MemoryRecord {
    // 从 metadata 中提取 tags
    const tags: string[] = []
    const extractTags = (obj: unknown, depth = 0): void => {
      if (depth > 2) return
      if (Array.isArray(obj)) {
        for (const item of obj) {
          if (typeof item === 'string') tags.push(item)
        }
      } else if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          if (key.toLowerCase().includes('tag') && typeof value === 'string') {
            tags.push(value)
          } else if (Array.isArray(value) && key.toLowerCase().includes('tag')) {
            for (const item of value) {
              if (typeof item === 'string') tags.push(item)
            }
          }
        }
      }
    }
    extractTags(chunk.metadata)

    return {
      id: chunk.id,
      content: chunk.content,
      embedding: chunk.embedding,
      tags: tags.length > 0 ? tags : undefined,
      importance: (chunk.metadata as any)?.importance,
      createdAt: chunk.createdAt?.toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: JSON.stringify(chunk.metadata)
    }
  }

  // ==================== CRUD 操作 ====================

  addChunk(chunk: MeshMemoChunk<T>): void {
    const chunkWithTime = {
      ...chunk,
      createdAt: chunk.createdAt || new Date()
    }
    this.chunks.set(chunk.id, chunkWithTime)

    // 保存到数据库
    if (this.database) {
      try {
        const record = this.chunkToRecord(chunkWithTime)
        ;(this.database as any).saveMemory(record)
      } catch (error) {
        logger.warn('Failed to save chunk to database', { id: chunk.id, error })
      }
    }

    // 添加到向量索引
    if (chunk.embedding && this.vectorStore) {
      const index = this.nextIndex++
      this.idToIndex.set(chunk.id, index)
      this.indexToId.set(index, chunk.id)

      try {
        ;(this.vectorStore as any).add(chunk.id, chunk.embedding)
      } catch (error) {
        logger.warn('Failed to add vector to VectorStore', { id: chunk.id, error })
      }
    }

    // 更新 TagMemo
    this.updateTagCooccurrence(chunkWithTime)

    logger.debug('Chunk added to NativeMeshMemo', { id: chunk.id, persisted: !!this.database })
  }

  addChunks(chunks: MeshMemoChunk<T>[]): void {
    const now = new Date()
    const records: MemoryRecord[] = []

    for (const chunk of chunks) {
      const chunkWithTime = {
        ...chunk,
        createdAt: chunk.createdAt || now
      }
      this.chunks.set(chunk.id, chunkWithTime)

      // 准备数据库记录
      if (this.database) {
        records.push(this.chunkToRecord(chunkWithTime))
      }

      if (chunk.embedding && this.vectorStore) {
        const index = this.nextIndex++
        this.idToIndex.set(chunk.id, index)
        this.indexToId.set(index, chunk.id)

        try {
          ;(this.vectorStore as any).add(chunk.id, chunk.embedding)
        } catch {
          // 忽略单个失败
        }
      }

      this.updateTagCooccurrence(chunkWithTime)
    }

    // 批量保存到数据库
    if (this.database && records.length > 0) {
      try {
        for (const record of records) {
          ;(this.database as any).saveMemory(record)
        }
        logger.info('Chunks saved to database', { count: records.length })
      } catch (error) {
        logger.warn('Failed to save chunks to database', { error })
      }
    }

    logger.info('Chunks added to NativeMeshMemo', { count: chunks.length, persisted: records.length })
  }

  addDocument(doc: { id: string; content: string; embedding?: number[]; metadata?: Record<string, unknown> }): void {
    this.addChunk({
      id: doc.id,
      content: doc.content,
      embedding: doc.embedding,
      metadata: (doc.metadata || {}) as T
    })
  }

  addDocuments(
    docs: Array<{
      id: string
      content: string
      embedding?: number[]
      metadata?: Record<string, unknown>
    }>
  ): void {
    this.addChunks(
      docs.map((doc) => ({
        id: doc.id,
        content: doc.content,
        embedding: doc.embedding,
        metadata: (doc.metadata || {}) as T
      }))
    )
  }

  getChunk(id: string): MeshMemoChunk<T> | undefined {
    return this.chunks.get(id)
  }

  removeChunk(id: string): boolean {
    const result = this.chunks.delete(id)
    // Note: VectorStore doesn't support deletion in current implementation
    return result
  }

  clear(): void {
    const count = this.chunks.size
    this.chunks.clear()
    this.idToIndex.clear()
    this.indexToId.clear()
    this.nextIndex = 0

    // 重新创建 VectorStore
    try {
      this.vectorStore = createVectorStore(this.vectorDim)
    } catch {
      // 忽略
    }

    logger.info('NativeMeshMemo cleared', { removedCount: count })
  }

  getChunkCount(): number {
    return this.chunks.size
  }

  getAllChunks(): MeshMemoChunk<T>[] {
    return Array.from(this.chunks.values())
  }

  // ==================== 搜索 ====================

  async search(
    allChunks: Array<{ content: string; metadata: T; embedding?: number[] }>,
    queryEmbedding: number[],
    config: NativeMeshMemoConfig<T>
  ): Promise<MeshMemoSearchResult<T>[]> {
    const chunksToSearch =
      allChunks.length > 0
        ? allChunks
        : this.getAllChunks().map((c) => ({
            content: c.content,
            metadata: c.metadata,
            embedding: c.embedding
          }))

    const {
      filter,
      query,
      initialTopK = 100,
      finalTopK = 10,
      threshold = 0.5,
      rerank = false,
      rerankFn,
      diversitySampling = false,
      diversityLambda = 0.5,
      diversityFields = [],
      tagMemo = false,
      tagFields = [],
      timeDecay = false,
      timeField,
      timeDecayHalfLife = 30,
      useDynamicK = false,
      onDynamicKCalculated
    } = config

    // Step 0: 动态 K 值计算
    let effectiveInitialTopK = initialTopK
    if (useDynamicK) {
      const calculator = getDynamicKCalculator()
      const queryAnalysis = calculator.analyzeQuery(query)
      const corpusSize = chunksToSearch.length
      const dynamicKResult = calculator.calculateWithDetails(queryAnalysis, corpusSize)

      effectiveInitialTopK = dynamicKResult.k
      onDynamicKCalculated?.(dynamicKResult)

      logger.debug('Dynamic K calculated', {
        originalK: initialTopK,
        dynamicK: effectiveInitialTopK,
        reasons: dynamicKResult.reasons
      })
    }

    logger.debug('NativeMeshMemo search started', {
      totalChunks: chunksToSearch.length,
      hasFilter: !!filter,
      initialTopK: effectiveInitialTopK,
      finalTopK,
      useNativeVector: !!this.vectorStore
    })

    // Step 1: 元数据过滤
    const filteredChunks = filter ? this.applyMetadataFilter(chunksToSearch, filter) : chunksToSearch

    logger.debug('After metadata filter', { count: filteredChunks.length })

    // Step 2: 向量语义召回 (使用 Rust)
    const semanticResults = await this.nativeSemanticSearch(
      filteredChunks,
      queryEmbedding,
      effectiveInitialTopK,
      threshold
    )

    logger.debug('After semantic search', { count: semanticResults.length })

    // Step 3: TagMemo 增强 (使用 Rust)
    let enhancedResults = semanticResults
    if (tagMemo && tagFields.length > 0) {
      enhancedResults = this.applyNativeTagMemoEnhancement(query, semanticResults, tagFields as string[])
    }

    // Step 4: 时间衰减
    if (timeDecay && timeField) {
      enhancedResults = this.applyTimeDecay(enhancedResults, timeField as string, timeDecayHalfLife)
    }

    // Step 5: Rerank 精排
    if (rerank) {
      if (rerankFn) {
        enhancedResults = await rerankFn(query, enhancedResults)
      } else {
        enhancedResults = await this.applyDefaultRerank(query, enhancedResults)
      }
    }

    // Step 6: 多样性采样 (MMR)
    if (diversitySampling && diversityFields.length > 0) {
      enhancedResults = this.applyMMR(
        enhancedResults,
        queryEmbedding,
        diversityLambda,
        finalTopK,
        diversityFields as string[]
      )
    }

    // Step 7: 截取最终结果
    const finalResults = enhancedResults.slice(0, finalTopK)

    logger.info('NativeMeshMemo search completed', {
      inputCount: chunksToSearch.length,
      filteredCount: filteredChunks.length,
      outputCount: finalResults.length
    })

    return finalResults
  }

  // ==================== Native 向量搜索 ====================

  private async nativeSemanticSearch(
    chunks: Array<{ content: string; metadata: T; embedding?: number[] }>,
    queryEmbedding: number[],
    topK: number,
    threshold: number
  ): Promise<MeshMemoSearchResult<T>[]> {
    // 过滤有 embedding 的 chunks
    const chunksWithEmbedding = chunks.filter((c) => c.embedding && c.embedding.length > 0)

    if (chunksWithEmbedding.length === 0) {
      return []
    }

    // 使用 Rust 批量计算相似度
    const embeddings = chunksWithEmbedding.map((c) => c.embedding!)

    let similarities: number[]

    try {
      // 使用 Rust vectorOps 进行批量计算
      similarities = vectorOps.batchCosineSimilarity(queryEmbedding, embeddings)
    } catch (error) {
      logger.warn('Failed to use Rust batch similarity, falling back to TypeScript', { error })
      // 回退到 TypeScript
      similarities = embeddings.map((emb) => this.cosineSimilarity(queryEmbedding, emb))
    }

    // 构建结果并过滤
    const results: MeshMemoSearchResult<T>[] = []

    for (let i = 0; i < chunksWithEmbedding.length; i++) {
      const similarity = similarities[i]

      if (similarity >= threshold) {
        const chunk = chunksWithEmbedding[i]
        results.push({
          pageContent: chunk.content,
          score: similarity,
          metadata: chunk.metadata,
          filterScore: 1.0,
          semanticScore: similarity,
          finalScore: similarity
        })
      }
    }

    // 排序并截取
    results.sort((a, b) => b.semanticScore - a.semanticScore)
    return results.slice(0, topK)
  }

  // ==================== Native TagMemo 增强 ====================

  private applyNativeTagMemoEnhancement(
    query: string,
    results: MeshMemoSearchResult<T>[],
    tagFields: string[]
  ): MeshMemoSearchResult<T>[] {
    // 从结果中提取所有标签
    const allTags = new Set<string>()
    for (const r of results) {
      for (const field of tagFields) {
        const value = this.getNestedValue(r.metadata, field)
        if (Array.isArray(value)) {
          value.forEach((t) => {
            if (typeof t === 'string') allTags.add(t)
          })
        } else if (typeof value === 'string') {
          allTags.add(value)
        }
      }
    }

    // 提取查询中的标签 (简单分词)
    const queryTerms = query.toLowerCase().split(/\s+/)

    // 使用 Rust TagMemo 扩展查询标签
    let expandedTags: string[]
    try {
      expandedTags = this.tagMatrix.expandQuery(queryTerms, 0.5)
    } catch {
      expandedTags = queryTerms
    }

    // 计算标签增强分数
    const expandedSet = new Set(expandedTags.map((t) => t.toLowerCase()))

    return results
      .map((r) => {
        let tagBoost = 0
        for (const field of tagFields) {
          const value = this.getNestedValue(r.metadata, field)
          const tags: string[] = Array.isArray(value)
            ? value.filter((t): t is string => typeof t === 'string')
            : typeof value === 'string'
              ? [value]
              : []

          for (const tag of tags) {
            if (expandedSet.has(tag.toLowerCase())) {
              tagBoost += 0.1
            }
          }
        }

        const boostedScore = r.finalScore * (1 + Math.min(tagBoost, 0.3))
        return {
          ...r,
          finalScore: boostedScore
        }
      })
      .sort((a, b) => b.finalScore - a.finalScore)
  }

  // ==================== 辅助方法 ====================

  private updateTagCooccurrence(chunk: MeshMemoChunk<T>): void {
    // 从元数据中提取标签
    const tags: string[] = []

    const extractTags = (obj: unknown, depth = 0): void => {
      if (depth > 3) return

      if (Array.isArray(obj)) {
        for (const item of obj) {
          if (typeof item === 'string') {
            tags.push(item)
          } else {
            extractTags(item, depth + 1)
          }
        }
      } else if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          if (key.toLowerCase().includes('tag') && typeof value === 'string') {
            tags.push(value)
          } else if (Array.isArray(value) && key.toLowerCase().includes('tag')) {
            for (const item of value) {
              if (typeof item === 'string') tags.push(item)
            }
          } else {
            extractTags(value, depth + 1)
          }
        }
      }
    }

    extractTags(chunk.metadata)

    // 更新标签共现
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        try {
          this.tagMatrix.update(tags[i], tags[j], 1.0)
        } catch {
          // 忽略更新失败
        }
      }
    }
  }

  private applyMetadataFilter(
    chunks: Array<{ content: string; metadata: T; embedding?: number[] }>,
    filter: MeshMemoFilter<T>
  ): typeof chunks {
    const { conditions = [], logic = 'and', customFilter } = filter

    return chunks.filter((chunk) => {
      const meta = chunk.metadata

      let conditionResult = true
      if (conditions.length > 0) {
        if (logic === 'and') {
          conditionResult = conditions.every((cond) => this.evaluateCondition(meta, cond))
        } else {
          conditionResult = conditions.some((cond) => this.evaluateCondition(meta, cond))
        }
      }

      const customResult = customFilter ? customFilter(meta) : true

      return conditionResult && customResult
    })
  }

  private evaluateCondition(metadata: T, condition: FilterCondition<T>): boolean {
    const { field, operator, value, ignoreCase = false } = condition
    const fieldValue = this.getNestedValue(metadata, field as string)

    const normalize = (v: unknown): unknown => {
      if (ignoreCase && typeof v === 'string') {
        return v.toLowerCase()
      }
      return v
    }

    const normalizedFieldValue = normalize(fieldValue)
    const normalizedValue = normalize(value)

    switch (operator) {
      case 'equals':
        return normalizedFieldValue === normalizedValue
      case 'not_equals':
        return normalizedFieldValue !== normalizedValue
      case 'contains':
        if (typeof normalizedFieldValue === 'string' && typeof normalizedValue === 'string') {
          return normalizedFieldValue.includes(normalizedValue)
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.some((item) => normalize(item) === normalizedValue)
        }
        return false
      case 'not_contains':
        if (typeof normalizedFieldValue === 'string' && typeof normalizedValue === 'string') {
          return !normalizedFieldValue.includes(normalizedValue)
        }
        if (Array.isArray(fieldValue)) {
          return !fieldValue.some((item) => normalize(item) === normalizedValue)
        }
        return true
      case 'in':
        if (Array.isArray(value)) {
          return value.some((v) => normalize(v) === normalizedFieldValue)
        }
        return false
      case 'not_in':
        if (Array.isArray(value)) {
          return !value.some((v) => normalize(v) === normalizedFieldValue)
        }
        return true
      case 'range':
        if (typeof fieldValue === 'number' && typeof value === 'object' && value !== null) {
          const { min, max } = value as { min?: number; max?: number }
          if (min !== undefined && fieldValue < min) return false
          if (max !== undefined && fieldValue > max) return false
          return true
        }
        return false
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null
      case 'regex':
        if (typeof fieldValue === 'string' && typeof value === 'string') {
          try {
            const regex = new RegExp(value, ignoreCase ? 'i' : '')
            return regex.test(fieldValue)
          } catch {
            return false
          }
        }
        return false
      case 'any_of':
        if (Array.isArray(fieldValue) && Array.isArray(value)) {
          return fieldValue.some((item) => value.some((v) => normalize(v) === normalize(item)))
        }
        return false
      case 'all_of':
        if (Array.isArray(fieldValue) && Array.isArray(value)) {
          return value.every((v) => fieldValue.some((item) => normalize(v) === normalize(item)))
        }
        return false
      default:
        return true
    }
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split('.')
    let current: unknown = obj

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined
      }
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part]
      } else {
        return undefined
      }
    }

    return current
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
    return magnitude === 0 ? 0 : dotProduct / magnitude
  }

  private applyTimeDecay(
    results: MeshMemoSearchResult<T>[],
    timeField: string,
    halfLifeDays: number
  ): MeshMemoSearchResult<T>[] {
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000

    return results
      .map((r) => {
        const timeValue = this.getNestedValue(r.metadata, timeField)
        let createdAt: number

        if (timeValue instanceof Date) {
          createdAt = timeValue.getTime()
        } else if (typeof timeValue === 'number') {
          createdAt = timeValue
        } else if (typeof timeValue === 'string') {
          createdAt = new Date(timeValue).getTime()
        } else {
          createdAt = now
        }

        const ageDays = (now - createdAt) / dayMs
        const decay = Math.exp((-ageDays / halfLifeDays) * Math.LN2)
        const decayedScore = r.finalScore * (0.5 + 0.5 * decay)

        return {
          ...r,
          finalScore: decayedScore
        }
      })
      .sort((a, b) => b.finalScore - a.finalScore)
  }

  private async applyDefaultRerank(
    query: string,
    results: MeshMemoSearchResult<T>[]
  ): Promise<MeshMemoSearchResult<T>[]> {
    const queryTerms = query.toLowerCase().split(/\s+/)

    return results
      .map((r) => {
        const content = r.pageContent.toLowerCase()
        let keywordScore = 0

        for (const term of queryTerms) {
          if (content.includes(term)) {
            keywordScore += 0.1
          }
        }

        return {
          ...r,
          finalScore: r.finalScore * (1 + Math.min(keywordScore, 0.3))
        }
      })
      .sort((a, b) => b.finalScore - a.finalScore)
  }

  private applyMMR(
    results: MeshMemoSearchResult<T>[],
    _queryEmbedding: number[],
    lambda: number,
    topK: number,
    diversityFields: string[]
  ): MeshMemoSearchResult<T>[] {
    if (results.length <= topK) return results

    const selected: MeshMemoSearchResult<T>[] = []
    const remaining = [...results]

    selected.push(remaining.shift()!)

    while (selected.length < topK && remaining.length > 0) {
      let bestIdx = 0
      let bestScore = -Infinity

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i]
        const relevance = candidate.semanticScore

        let maxSimilarity = 0
        for (const sel of selected) {
          const similarity = this.metadataSimilarity(candidate.metadata, sel.metadata, diversityFields)
          maxSimilarity = Math.max(maxSimilarity, similarity)
        }

        const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity

        if (mmrScore > bestScore) {
          bestScore = mmrScore
          bestIdx = i
        }
      }

      selected.push(remaining.splice(bestIdx, 1)[0])
    }

    return selected
  }

  private metadataSimilarity(a: T, b: T, fields: string[]): number {
    let score = 0
    let count = 0

    for (const field of fields) {
      const valueA = this.getNestedValue(a, field)
      const valueB = this.getNestedValue(b, field)

      if (valueA === undefined || valueB === undefined) continue

      count++

      if (Array.isArray(valueA) && Array.isArray(valueB)) {
        const setA = new Set(valueA.map(String))
        const setB = new Set(valueB.map(String))
        const intersection = [...setA].filter((x) => setB.has(x)).length
        const union = new Set([...setA, ...setB]).size
        score += union > 0 ? intersection / union : 0
      } else if (valueA === valueB) {
        score += 1
      } else if (typeof valueA === 'string' && typeof valueB === 'string') {
        if (valueA.includes(valueB) || valueB.includes(valueA)) {
          score += 0.5
        }
      }
    }

    return count > 0 ? score / count : 0
  }
}

// ==================== 工厂函数 ====================

let nativeMeshMemoInstance: NativeMeshMemoService | null = null

/**
 * 获取 Native MeshMemo 服务单例
 */
export function getNativeMeshMemoService<T extends GenericMetadata = GenericMetadata>(
  vectorDim: number = 1536,
  dbPath?: string
): NativeMeshMemoService<T> {
  if (!nativeMeshMemoInstance) {
    nativeMeshMemoInstance = new NativeMeshMemoService(vectorDim, dbPath)
  }
  return nativeMeshMemoInstance as NativeMeshMemoService<T>
}

/**
 * 创建新的 Native MeshMemo 服务实例
 */
export function createNativeMeshMemoService<T extends GenericMetadata = GenericMetadata>(
  vectorDim: number = 1536,
  dbPath?: string
): NativeMeshMemoService<T> {
  return new NativeMeshMemoService<T>(vectorDim, dbPath)
}
