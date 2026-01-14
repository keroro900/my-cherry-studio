/**
 * 通用 MeshMemo 过滤召回服务
 *
 * 支持任意元数据 schema 的"先过滤后召回"检索策略：
 * 1. 元数据过滤 (基于可配置的 schema)
 * 2. 向量语义召回
 * 3. Rerank 精排
 * 4. 多样性采样 (MMR)
 * 5. 动态 K 值自适应 (VCPToolBox 对标)
 *
 * @version 2.1.0 - 集成动态 K 值
 */

import { loggerService } from '@logger'
import type { KnowledgeSearchResult } from '@types'

import type { TagMemoService } from '../tagmemo/TagMemoService'
import { getTagMemoService } from '../tagmemo/TagMemoService'
import { getDynamicKCalculator, type DynamicKResult } from './DynamicKCalculator'

const logger = loggerService.withContext('GenericMeshMemoService')

// ==================== 类型定义 ====================

/**
 * 通用元数据类型 - 用户可以传入任意结构
 */
export type GenericMetadata = Record<string, unknown>

/**
 * 带元数据的搜索结果
 */
export interface MeshMemoSearchResult<T extends GenericMetadata = GenericMetadata> extends KnowledgeSearchResult {
  metadata: T
  filterScore: number // 过滤匹配度
  semanticScore: number // 语义相似度
  finalScore: number // 最终得分
}

/**
 * 过滤条件定义
 */
export interface FilterCondition<T extends GenericMetadata = GenericMetadata> {
  /** 字段名 (支持嵌套路径，如 "category.name") */
  field: keyof T | string
  /** 操作符 */
  operator:
    | 'equals' // 精确匹配
    | 'not_equals' // 不等于
    | 'contains' // 包含 (字符串/数组)
    | 'not_contains' // 不包含
    | 'in' // 在列表中
    | 'not_in' // 不在列表中
    | 'range' // 范围 (数值)
    | 'exists' // 字段存在
    | 'regex' // 正则匹配
    | 'any_of' // 数组任意匹配
    | 'all_of' // 数组全部匹配
  /** 比较值 */
  value: unknown
  /** 是否忽略大小写 (字符串比较时) */
  ignoreCase?: boolean
}

/**
 * 复合过滤器
 */
export interface MeshMemoFilter<T extends GenericMetadata = GenericMetadata> {
  /** 过滤条件列表 */
  conditions?: FilterCondition<T>[]
  /** 条件逻辑 */
  logic?: 'and' | 'or'
  /** 自定义过滤函数 */
  customFilter?: (metadata: T) => boolean
}

/**
 * 召回配置
 */
export interface MeshMemoConfig<T extends GenericMetadata = GenericMetadata> {
  /** 过滤条件 */
  filter?: MeshMemoFilter<T>
  /** 语义查询 */
  query: string
  /** 初始召回数量 (过滤后) */
  initialTopK?: number
  /** 最终返回数量 */
  finalTopK?: number
  /** 相似度阈值 */
  threshold?: number
  /** 是否启用 rerank */
  rerank?: boolean
  /** Rerank 函数 (外部提供) */
  rerankFn?: (query: string, results: MeshMemoSearchResult<T>[]) => Promise<MeshMemoSearchResult<T>[]>
  /** 多样性采样 */
  diversitySampling?: boolean
  /** 多样性系数 (0-1, 越高越多样) */
  diversityLambda?: number
  /** 用于 MMR 的元数据相似度字段 */
  diversityFields?: (keyof T | string)[]
  /** TagMemo 增强 */
  tagMemo?: boolean
  /** TagMemo 使用的标签字段 */
  tagFields?: (keyof T | string)[]
  /** 时间衰减 */
  timeDecay?: boolean
  /** 时间字段名 */
  timeField?: keyof T | string
  /** 时间衰减半衰期 (天) */
  timeDecayHalfLife?: number
  /** 启用动态 K 值计算 (VCPToolBox 对标) */
  useDynamicK?: boolean
  /** 动态 K 计算回调 (可获取计算详情) */
  onDynamicKCalculated?: (result: DynamicKResult) => void
}

/**
 * Schema 定义 - 描述元数据结构以便优化过滤
 */
export interface MeshMemoSchema<T extends GenericMetadata = GenericMetadata> {
  /** Schema 名称 */
  name: string
  /** 字段定义 */
  fields: {
    [K in keyof T]?: {
      type: 'string' | 'number' | 'boolean' | 'array' | 'date' | 'object'
      indexed?: boolean // 是否建立索引以加速过滤
      description?: string
    }
  }
  /** 默认标签字段 (用于 TagMemo) */
  defaultTagFields?: (keyof T)[]
  /** 默认时间字段 */
  defaultTimeField?: keyof T
  /** 默认多样性比较字段 */
  defaultDiversityFields?: (keyof T)[]
}

// ==================== 类型定义: Chunk ====================

/**
 * 存储的 Chunk 结构
 */
export interface MeshMemoChunk<T extends GenericMetadata = GenericMetadata> {
  id: string
  content: string
  embedding?: number[]
  metadata: T
  createdAt?: Date
}

// ==================== 通用 MeshMemo 服务类 ====================

export class GenericMeshMemoService<T extends GenericMetadata = GenericMetadata> {
  private tagMemo: TagMemoService
  private schema?: MeshMemoSchema<T>
  private chunks: Map<string, MeshMemoChunk<T>> = new Map()

  constructor(schema?: MeshMemoSchema<T>) {
    this.tagMemo = getTagMemoService()
    this.schema = schema
    logger.info('GenericMeshMemoService initialized', { schema: schema?.name })
  }

  // ==================== CRUD 操作 ====================

  /**
   * 添加单个 Chunk
   */
  addChunk(chunk: MeshMemoChunk<T>): void {
    const chunkWithTime = {
      ...chunk,
      createdAt: chunk.createdAt || new Date()
    }
    this.chunks.set(chunk.id, chunkWithTime)
    logger.debug('Chunk added', { id: chunk.id })
  }

  /**
   * 批量添加 Chunks
   */
  addChunks(chunks: MeshMemoChunk<T>[]): void {
    const now = new Date()
    for (const chunk of chunks) {
      const chunkWithTime = {
        ...chunk,
        createdAt: chunk.createdAt || now
      }
      this.chunks.set(chunk.id, chunkWithTime)
    }
    logger.info('Chunks added', { count: chunks.length })
  }

  /**
   * 添加文档（兼容 AdvancedMemoryIpcHandler 的接口）
   */
  addDocument(doc: { id: string; content: string; embedding?: number[]; metadata?: Record<string, unknown> }): void {
    this.addChunk({
      id: doc.id,
      content: doc.content,
      embedding: doc.embedding,
      metadata: (doc.metadata || {}) as T
    })
  }

  /**
   * 批量添加文档
   */
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

  /**
   * 获取 Chunk
   */
  getChunk(id: string): MeshMemoChunk<T> | undefined {
    return this.chunks.get(id)
  }

  /**
   * 删除 Chunk
   */
  removeChunk(id: string): boolean {
    return this.chunks.delete(id)
  }

  /**
   * 清空所有 Chunks
   */
  clear(): void {
    const count = this.chunks.size
    this.chunks.clear()
    logger.info('MeshMemo cleared', { removedCount: count })
  }

  /**
   * 获取 Chunk 数量
   */
  getChunkCount(): number {
    return this.chunks.size
  }

  /**
   * 获取所有 Chunks
   */
  getAllChunks(): MeshMemoChunk<T>[] {
    return Array.from(this.chunks.values())
  }

  /**
   * 执行 MeshMemo 风格的过滤召回
   *
   * @param allChunks - 外部传入的 chunks，如果为空数组则使用内部存储
   * @param queryEmbedding - 查询向量
   * @param config - 搜索配置
   */
  async search(
    allChunks: Array<{ content: string; metadata: T; embedding?: number[] }>,
    queryEmbedding: number[],
    config: MeshMemoConfig<T>
  ): Promise<MeshMemoSearchResult<T>[]> {
    // 如果没有传入 chunks，使用内部存储
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
      diversityFields = this.schema?.defaultDiversityFields as string[],
      tagMemo = false,
      tagFields = this.schema?.defaultTagFields as string[],
      timeDecay = false,
      timeField = this.schema?.defaultTimeField as string,
      timeDecayHalfLife = 30,
      useDynamicK = false,
      onDynamicKCalculated
    } = config

    // Step 0: 动态 K 值计算 (VCPToolBox 对标)
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

    logger.debug('MeshMemo search started', {
      totalChunks: chunksToSearch.length,
      usingInternalStorage: allChunks.length === 0,
      hasFilter: !!filter,
      initialTopK: effectiveInitialTopK,
      finalTopK
    })

    // Step 1: 元数据过滤
    const filteredChunks = filter ? this.applyMetadataFilter(chunksToSearch, filter) : chunksToSearch

    logger.debug('After metadata filter', { count: filteredChunks.length })

    // Step 2: 向量语义召回
    const semanticResults = await this.semanticSearch(filteredChunks, queryEmbedding, effectiveInitialTopK, threshold)

    logger.debug('After semantic search', { count: semanticResults.length })

    // Step 3: TagMemo 增强
    let enhancedResults = semanticResults
    if (tagMemo && tagFields?.length) {
      enhancedResults = await this.applyTagMemoEnhancement(query, semanticResults, tagFields as string[])
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
    if (diversitySampling && diversityFields?.length) {
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

    logger.info('MeshMemo search completed', {
      inputCount: chunksToSearch.length,
      filteredCount: filteredChunks.length,
      outputCount: finalResults.length
    })

    return finalResults
  }

  /**
   * 应用元数据过滤
   */
  private applyMetadataFilter(
    chunks: Array<{ content: string; metadata: T; embedding?: number[] }>,
    filter: MeshMemoFilter<T>
  ): typeof chunks {
    const { conditions = [], logic = 'and', customFilter } = filter

    return chunks.filter((chunk) => {
      const meta = chunk.metadata

      // 应用条件过滤
      let conditionResult = true
      if (conditions.length > 0) {
        if (logic === 'and') {
          conditionResult = conditions.every((cond) => this.evaluateCondition(meta, cond))
        } else {
          conditionResult = conditions.some((cond) => this.evaluateCondition(meta, cond))
        }
      }

      // 应用自定义过滤
      const customResult = customFilter ? customFilter(meta) : true

      return conditionResult && customResult
    })
  }

  /**
   * 评估单个过滤条件
   */
  private evaluateCondition(metadata: T, condition: FilterCondition<T>): boolean {
    const { field, operator, value, ignoreCase = false } = condition

    // 获取字段值 (支持嵌套路径)
    const fieldValue = this.getNestedValue(metadata, field as string)

    // 处理字符串大小写
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

  /**
   * 获取嵌套字段值
   */
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

  /**
   * 语义向量搜索
   */
  private async semanticSearch(
    chunks: Array<{ content: string; metadata: T; embedding?: number[] }>,
    queryEmbedding: number[],
    topK: number,
    threshold: number
  ): Promise<MeshMemoSearchResult<T>[]> {
    const results: MeshMemoSearchResult<T>[] = []

    for (const chunk of chunks) {
      if (!chunk.embedding) continue

      const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding)

      if (similarity >= threshold) {
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

    results.sort((a, b) => b.semanticScore - a.semanticScore)
    return results.slice(0, topK)
  }

  /**
   * 余弦相似度
   */
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

  /**
   * 应用 TagMemo 增强
   */
  private async applyTagMemoEnhancement(
    query: string,
    results: MeshMemoSearchResult<T>[],
    tagFields: string[]
  ): Promise<MeshMemoSearchResult<T>[]> {
    // 从结果中提取标签
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

    // 应用 TagMemo 增强
    const enhanced = await this.tagMemo.applyTagBoost(query, [...allTags], results)

    return enhanced.map((r) => ({
      ...r,
      finalScore: r.score
    })) as MeshMemoSearchResult<T>[]
  }

  /**
   * 应用时间衰减
   */
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

  /**
   * 默认 Rerank (关键词匹配)
   */
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

  /**
   * 应用 MMR (最大边际相关性) 多样性采样
   */
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

  /**
   * 元数据相似度 (用于 MMR)
   */
  private metadataSimilarity(a: T, b: T, fields: string[]): number {
    let score = 0
    let count = 0

    for (const field of fields) {
      const valueA = this.getNestedValue(a, field)
      const valueB = this.getNestedValue(b, field)

      if (valueA === undefined || valueB === undefined) continue

      count++

      if (Array.isArray(valueA) && Array.isArray(valueB)) {
        // 数组重叠度
        const setA = new Set(valueA.map(String))
        const setB = new Set(valueB.map(String))
        const intersection = [...setA].filter((x) => setB.has(x)).length
        const union = new Set([...setA, ...setB]).size
        score += union > 0 ? intersection / union : 0
      } else if (valueA === valueB) {
        // 精确匹配
        score += 1
      } else if (typeof valueA === 'string' && typeof valueB === 'string') {
        // 字符串部分匹配
        if (valueA.includes(valueB) || valueB.includes(valueA)) {
          score += 0.5
        }
      }
    }

    return count > 0 ? score / count : 0
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建通用 MeshMemo 服务
 */
export function createGenericMeshMemoService<T extends GenericMetadata = GenericMetadata>(
  schema?: MeshMemoSchema<T>
): GenericMeshMemoService<T> {
  return new GenericMeshMemoService<T>(schema)
}

/**
 * 创建无 schema 的 MeshMemo 服务
 */
export function createMeshMemoService(): GenericMeshMemoService {
  return new GenericMeshMemoService()
}
