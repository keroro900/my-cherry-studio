/**
 * Native VCP Bridge (Refactored)
 *
 * Rust-first 桥接层，优先使用原生模块
 * 仅为非关键路径保留精简的 TypeScript fallback
 *
 * @module services/native/NativeVCPBridge
 */

import { loggerService } from '@logger'
import { app } from 'electron'
import * as path from 'path'

const logger = loggerService.withContext('NativeVCPBridge')

// ==================== 类型定义 ====================

export interface NativeVCPConfig {
  dataDir: string
  logLevel?: string
  enableSearch?: boolean
  vectorDim?: number
}

export interface HealthStatus {
  status: string
  version: string
  features: string[]
  isNative: boolean
}

export interface TagPairUpdate {
  tag1: string
  tag2: string
  weight?: number
}

export interface TagAssociation {
  tag: string
  pmi: number
  cooccurrence: number
  frequency: number
}

export interface TagMatrixStats {
  tagCount: number
  pairCount: number
  totalUpdates: number
  alpha: number
  beta: number
}

export interface TraceLog {
  traceId: string
  spanId?: string
  parentSpanId?: string
  operation: string
  level: string
  message?: string
  metadata?: string
  durationMs?: number
  createdAt?: string
}

export interface SpanInfo {
  spanId: string
  parentSpanId?: string
  operation: string
  startTime: string
  endTime?: string
  durationMs?: number
  status: string
  metadata?: string
}

export interface SearchDocument {
  id: string
  title?: string
  content: string
  tags?: string[]
}

export interface SearchResult {
  id: string
  title?: string
  content: string
  tags?: string[]
  score: number
}

export interface SearchStats {
  documentCount: number
}

export interface MemoryRecord {
  id: string
  content: string
  embedding?: number[]
  tags?: string[]
  importance?: number
  createdAt?: string
  updatedAt?: string
  metadata?: string
}

export interface MemoryQuery {
  text?: string
  tags?: string[]
  minImportance?: number
  limit?: number
}

export interface DatabaseStats {
  memoryCount: number
  knowledgeCount: number
  diaryCount: number
  tagCount: number
  traceCount: number
  fileSizeBytes: number
  path: string
}

export interface VectorEntry {
  id: string
  vector: number[]
}

export interface VectorSearchResult {
  id: string
  score: number
}

export interface VexusSearchResult {
  id: number
  score: number
}

export interface VexusStats {
  totalVectors: number
  dimensions: number
  capacity: number
  memoryUsage: number
}

export interface TagCooccurrence {
  tag1: string
  tag2: string
  weight: number
  count: number
}

export interface DocumentInput {
  id: string
  tags: string[]
}

export interface SemanticGroupMatch {
  groupType: string
  subGroup: string
  matchedKeywords: string[]
  weight: number
}

export interface GroupKeywords {
  groupType: string
  subGroup: string
  keywords: string[]
}

export interface ChineseSearchDocument {
  id: string
  title?: string
  content: string
  tags?: string[]
  metadata?: string
}

export interface ChineseSearchResult {
  id: string
  title?: string
  content: string
  tags?: string[]
  metadata?: string
  score: number
}

export interface KeywordResult {
  keyword: string
  weight: number
}

export interface DiaryRecord {
  id: string
  date: string
  content: string
  tags?: string[]
  embedding?: Uint8Array
  bookName: string
  createdAt?: string
  updatedAt?: string
}

export interface DiaryDateQuery {
  startDate?: string
  endDate?: string
  bookName?: string
  limit?: number
}

export interface DiarySearchQuery {
  keyword: string
  bookName?: string
  limit?: number
}

export interface DiaryBookInfo {
  bookName: string
  entryCount: number
  latestDate?: string
}

export interface DiaryStats {
  totalEntries: number
  totalWords: number
  firstEntryDate?: string
  lastEntryDate?: string
  topTags: Array<{ tag: string; count: number }>
  bookName?: string
}

export interface TagBoostParams {
  queryTags: string[]
  contentTags: string[]
  originalScore?: number
  alphaMin?: number
  alphaMax?: number
  betaBase?: number
}

export interface SpikeDetail {
  tag: string
  weight: number
  globalFreq: number
  score: number
}

export interface TagBoostResult {
  originalScore: number
  boostedScore: number
  matchedTags: string[]
  expansionTags: string[]
  boostFactor: number
  tagMatchScore: number
  spikeDetails: SpikeDetail[]
  dynamicAlpha: number
  dynamicBeta: number
}

export interface TagBoostBatchItem {
  contentTags: string[]
  originalScore?: number
}

// ==================== 向量级增强类型 (VCPToolBox _applyTagBoost 完整实现) ====================

export interface VectorBoostParams {
  /** 原始向量 */
  originalVector: number[]
  /** 查询标签列表 */
  queryTags: string[]
  /** 内容标签列表 */
  contentTags: string[]
  /** 标签对应的上下文向量 (扁平化: [tag1_dim0, tag1_dim1, ..., tag2_dim0, ...]) */
  tagVectors?: number[]
  /** 标签名列表 (与 tagVectors 对应) */
  tagNames?: string[]
  /** 向量维度 */
  vectorDim: number
  /** Alpha 最小值 (默认 1.5) */
  alphaMin?: number
  /** Alpha 最大值 (默认 3.5) */
  alphaMax?: number
  /** Beta 基础值 (默认 2.0) */
  betaBase?: number
  /** 最大增强比例 (默认 0.3, 即最多 30% 上下文融合) */
  maxBoostRatio?: number
}

export interface VectorBoostResult {
  /** 融合后的向量 */
  fusedVector: number[]
  /** 原始分数 */
  originalScore: number
  /** 增强后分数 */
  boostedScore: number
  /** 直接匹配的标签 */
  matchedTags: string[]
  /** 扩展匹配的标签 */
  expansionTags: string[]
  /** 增强因子 (1.0 表示无增强) */
  boostFactor: number
  /** 上下文融合比例 (0-1) */
  contextBlendRatio: number
  /** 动态 Alpha */
  dynamicAlpha: number
  /** 动态 Beta */
  dynamicBeta: number
}

export interface TextChunk {
  content: string
  startOffset: number
  endOffset: number
  charCount: number
  index: number
}

export interface ChunkBatchResult {
  docIndex: number
  chunks: TextChunk[]
}

export interface ChunkerConfig {
  maxChunkSize: number
  overlapSize: number
  separators: string[]
}

export interface SearchResultItem {
  id: string
  content: string
  metadata?: string
  score: number
}

export interface HybridSearchResult {
  id: string
  content: string
  metadata?: string
  finalScore: number
  bm25Score: number
  bm25Rank?: number
  vectorScore: number
  vectorRank?: number
  tagBoostScore: number
  source: string
}

export interface HybridSearchConfig {
  bm25Weight: number
  vectorWeight: number
  tagBoostWeight: number
  rrfK: number
}

// ==================== Native 模块加载 ====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nativeModule: any = null
let isNativeAvailable = false

/**
 * 获取 Native 模块路径
 */
function getNativeVCPPath(): string | null {
  const possiblePaths = [
    // 1. 项目根目录 (开发模式)
    path.join(process.cwd(), 'native-vcp', 'index.js'),
    // 2. app 目录 (生产模式)
    path.join(app.getAppPath(), 'native-vcp', 'index.js'),
    // 3. __dirname 相对路径 (编译后 - out/main/)
    path.join(__dirname, '..', '..', 'native-vcp', 'index.js'),
    // 4. resources 目录 (打包后)
    path.join(app.getAppPath(), '..', 'native-vcp', 'index.js')
  ]

  const fs = require('fs')
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      logger.debug('Found native-vcp at', { path: p })
      return p
    }
  }

  logger.warn('Native-vcp not found in any of the paths', { searchedPaths: possiblePaths })
  return null
}

/**
 * 尝试加载 Native 模块
 */
async function tryLoadNativeModule(): Promise<boolean> {
  try {
    const modulePath = getNativeVCPPath()
    if (!modulePath) {
      logger.error('Native VCP module path not found')
      isNativeAvailable = false
      return false
    }

    logger.info('Loading native-vcp from', { path: modulePath })

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    nativeModule = require(modulePath)

    // 检查模块是否已被其他服务初始化 (如 NativeModulePreloader)
    let alreadyInitialized = false
    try {
      if (typeof nativeModule.healthCheck === 'function') {
        const testHealth = nativeModule.healthCheck()
        if (testHealth && testHealth.status === 'healthy') {
          alreadyInitialized = true
          logger.info('Native module already initialized by another service', {
            version: testHealth.version
          })
        }
      }
    } catch {
      alreadyInitialized = false
    }

    // 只在未初始化时调用 initialize
    if (!alreadyInitialized && typeof nativeModule.initialize === 'function') {
      const dataDir = path.join(app.getPath('userData'), 'native-vcp')
      nativeModule.initialize({
        dataDir,
        logLevel: 'info',
        enableSearch: true,
        vectorDim: 1536
      })
    }

    const health = nativeModule.healthCheck()
    logger.info('Native VCP module loaded', {
      version: health.version,
      features: health.features
    })

    isNativeAvailable = true
    return true
  } catch (error) {
    logger.error('Native VCP module failed to load', {
      error: error instanceof Error ? error.message : String(error)
    })
    isNativeAvailable = false
    return false
  }
}

// ==================== 核心错误类 ====================

export class NativeModuleNotAvailableError extends Error {
  constructor(module: string) {
    super(`Native module '${module}' is required but not available. Please ensure native-vcp is built.`)
    this.name = 'NativeModuleNotAvailableError'
  }
}

// ==================== 性能关键组件 (无 fallback) ====================

/**
 * 向量运算 - Rust 优先，fallback 仅用于简单操作
 */
export const vectorOps = {
  cosineSimilarity(a: number[], b: number[]): number {
    if (isNativeAvailable && nativeModule?.cosineSimilarity) {
      return nativeModule.cosineSimilarity(a, b)
    }
    // 简单 fallback
    let dot = 0, normA = 0, normB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB)
    return denom === 0 ? 0 : dot / denom
  },

  normalize(v: number[]): number[] {
    if (isNativeAvailable && nativeModule?.normalize) {
      return nativeModule.normalize(v)
    }
    const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0))
    return norm === 0 ? v : v.map((x) => x / norm)
  },

  batchCosineSimilarity(query: number[], vectors: number[][]): number[] {
    if (isNativeAvailable && nativeModule?.batchCosineSimilarity) {
      return nativeModule.batchCosineSimilarity(query, vectors)
    }
    return vectors.map((v) => this.cosineSimilarity(query, v))
  },

  topKSimilar(query: number[], vectors: number[][], k: number) {
    if (isNativeAvailable && nativeModule?.topKSimilar) {
      return nativeModule.topKSimilar(query, vectors, k)
    }
    const similarities = this.batchCosineSimilarity(query, vectors)
    const indexed = similarities.map((score, index) => ({ index, score }))
    indexed.sort((a, b) => b.score - a.score)
    return indexed.slice(0, k)
  }
}

/**
 * 创建 VexusIndex 实例 (HNSW向量索引) - 必须使用 Rust
 */
export function createVexusIndex(dim: number, capacity: number) {
  if (isNativeAvailable && nativeModule?.VexusIndex) {
    return new nativeModule.VexusIndex(dim, capacity)
  }
  throw new NativeModuleNotAvailableError('VexusIndex')
}

/**
 * 从文件加载 VexusIndex - 必须使用 Rust
 */
export function loadVexusIndex(indexPath: string, dim: number, capacity: number) {
  if (isNativeAvailable && nativeModule?.VexusIndex) {
    return nativeModule.VexusIndex.load(indexPath, dim, capacity)
  }
  throw new NativeModuleNotAvailableError('VexusIndex')
}

/**
 * 创建中文搜索引擎 - 必须使用 Rust
 */
export function createChineseSearchEngine(indexPath: string) {
  if (isNativeAvailable && nativeModule?.ChineseSearchEngine) {
    return nativeModule.ChineseSearchEngine.open(indexPath)
  }
  throw new NativeModuleNotAvailableError('ChineseSearchEngine')
}

/**
 * jieba 分词 - 必须使用 Rust
 */
export function jiebaCut(text: string, searchMode = true): string[] {
  if (isNativeAvailable && nativeModule?.jiebaCut) {
    return nativeModule.jiebaCut(text, searchMode)
  }
  throw new NativeModuleNotAvailableError('jiebaCut')
}

/**
 * jieba 关键词提取 - 必须使用 Rust
 */
export function jiebaExtractKeywords(text: string, topK = 10): KeywordResult[] {
  if (isNativeAvailable && nativeModule?.jiebaExtractKeywords) {
    return nativeModule.jiebaExtractKeywords(text, topK)
  }
  throw new NativeModuleNotAvailableError('jiebaExtractKeywords')
}

// ==================== 中等优先级组件 (精简 fallback) ====================

/**
 * 创建 TagCooccurrenceMatrix 实例
 */
export function createTagCooccurrenceMatrix(alpha?: number, beta?: number) {
  if (isNativeAvailable && nativeModule?.TagCooccurrenceMatrix) {
    return new nativeModule.TagCooccurrenceMatrix(alpha, beta)
  }
  logger.warn('TagCooccurrenceMatrix using fallback - performance may be degraded')
  return new MinimalTagMatrix(alpha, beta)
}

/**
 * 创建 CooccurrenceMatrix (NPMI)
 */
export function createCooccurrenceMatrix() {
  if (isNativeAvailable && nativeModule?.CooccurrenceMatrix) {
    return new nativeModule.CooccurrenceMatrix()
  }
  throw new NativeModuleNotAvailableError('CooccurrenceMatrix')
}

/**
 * 创建统一数据库
 */
export function createUnifiedDatabase(dbPath: string) {
  if (isNativeAvailable && nativeModule?.UnifiedDatabase) {
    return nativeModule.UnifiedDatabase.open(dbPath)
  }
  throw new NativeModuleNotAvailableError('UnifiedDatabase')
}

/**
 * 创建 SearchEngine
 */
export function createSearchEngine(indexPath: string) {
  if (isNativeAvailable && nativeModule?.SearchEngine) {
    return nativeModule.SearchEngine.open(indexPath)
  }
  throw new NativeModuleNotAvailableError('SearchEngine')
}

/**
 * 创建 VectorStore
 */
export function createVectorStore(dim: number) {
  if (isNativeAvailable && nativeModule?.VectorStore) {
    return new nativeModule.VectorStore(dim)
  }
  throw new NativeModuleNotAvailableError('VectorStore')
}

/**
 * 创建 SemanticGroupMatcher
 */
export function createSemanticGroupMatcher() {
  if (isNativeAvailable && nativeModule?.SemanticGroupMatcher) {
    return new nativeModule.SemanticGroupMatcher()
  }
  throw new NativeModuleNotAvailableError('SemanticGroupMatcher')
}

/**
 * 创建带服装语义组的 SemanticGroupMatcher
 */
export function createFashionSemanticGroupMatcher() {
  if (isNativeAvailable && nativeModule?.SemanticGroupMatcher?.withFashionGroups) {
    return nativeModule.SemanticGroupMatcher.withFashionGroups()
  }
  throw new NativeModuleNotAvailableError('SemanticGroupMatcher')
}

/**
 * 创建 TextChunker
 */
export function createTextChunker(maxChunkSize?: number, overlapSize?: number) {
  if (isNativeAvailable && nativeModule?.TextChunker) {
    return new nativeModule.TextChunker(maxChunkSize, overlapSize)
  }
  logger.warn('TextChunker using fallback')
  return new MinimalTextChunker(maxChunkSize, overlapSize)
}

/**
 * 创建 HybridSearchEngine
 */
export function createHybridSearchEngine(bm25Weight?: number, vectorWeight?: number, tagBoostWeight?: number) {
  if (isNativeAvailable && nativeModule?.HybridSearchEngine) {
    return new nativeModule.HybridSearchEngine(bm25Weight, vectorWeight, tagBoostWeight)
  }
  logger.warn('HybridSearchEngine using fallback')
  return new MinimalHybridSearch(bm25Weight, vectorWeight, tagBoostWeight)
}

// ==================== 便捷函数 ====================

export function quickChunk(text: string, maxSize?: number, overlap?: number): TextChunk[] {
  if (isNativeAvailable && nativeModule?.quickChunk) {
    return nativeModule.quickChunk(text, maxSize, overlap)
  }
  return new MinimalTextChunker(maxSize, overlap).chunk(text)
}

export function estimateTokenCount(text: string): number {
  if (isNativeAvailable && nativeModule?.estimateTokenCount) {
    return nativeModule.estimateTokenCount(text)
  }
  // 简单估算：中文约 1.5 字符/token，英文约 4 字符/token
  let chinese = 0, other = 0
  for (const c of text) {
    if (c >= '\u4e00' && c <= '\u9fff') chinese++
    else if (!/\s/.test(c)) other++
  }
  return Math.round(chinese / 1.5 + other / 4)
}

export function quickRrfFusion(
  bm25Results: SearchResultItem[],
  vectorResults: SearchResultItem[],
  limit?: number
): HybridSearchResult[] {
  if (isNativeAvailable && nativeModule?.quickRrfFusion) {
    return nativeModule.quickRrfFusion(bm25Results, vectorResults, limit)
  }
  return new MinimalHybridSearch().fuseResults(bm25Results, vectorResults, undefined, limit)
}

// ==================== Diary 操作 ====================

export const diaryOps = {
  saveDiary(db: unknown, diary: DiaryRecord): void {
    const d = db as Record<string, unknown>
    if (typeof d.saveDiary === 'function') {
      (d.saveDiary as (diary: DiaryRecord) => void)(diary)
    } else {
      throw new NativeModuleNotAvailableError('UnifiedDatabase.saveDiary')
    }
  },

  getDiary(db: unknown, id: string): DiaryRecord | null {
    const d = db as Record<string, unknown>
    if (typeof d.getDiary === 'function') {
      return (d.getDiary as (id: string) => DiaryRecord | null)(id)
    }
    throw new NativeModuleNotAvailableError('UnifiedDatabase.getDiary')
  },

  deleteDiary(db: unknown, id: string): boolean {
    const d = db as Record<string, unknown>
    if (typeof d.deleteDiary === 'function') {
      return (d.deleteDiary as (id: string) => boolean)(id)
    }
    throw new NativeModuleNotAvailableError('UnifiedDatabase.deleteDiary')
  },

  queryDiaryByDateRange(db: unknown, query: DiaryDateQuery): DiaryRecord[] {
    const d = db as Record<string, unknown>
    if (typeof d.queryDiaryByDateRange === 'function') {
      return (d.queryDiaryByDateRange as (q: DiaryDateQuery) => DiaryRecord[])(query)
    }
    throw new NativeModuleNotAvailableError('UnifiedDatabase.queryDiaryByDateRange')
  },

  searchDiary(db: unknown, query: DiarySearchQuery): DiaryRecord[] {
    const d = db as Record<string, unknown>
    if (typeof d.searchDiary === 'function') {
      return (d.searchDiary as (q: DiarySearchQuery) => DiaryRecord[])(query)
    }
    throw new NativeModuleNotAvailableError('UnifiedDatabase.searchDiary')
  },

  queryDiaryByTags(db: unknown, tags: string[], limit?: number): DiaryRecord[] {
    const d = db as Record<string, unknown>
    if (typeof d.queryDiaryByTags === 'function') {
      return (d.queryDiaryByTags as (t: string[], l?: number) => DiaryRecord[])(tags, limit)
    }
    throw new NativeModuleNotAvailableError('UnifiedDatabase.queryDiaryByTags')
  },

  listDiaryBooks(db: unknown): DiaryBookInfo[] {
    const d = db as Record<string, unknown>
    if (typeof d.listDiaryBooks === 'function') {
      return (d.listDiaryBooks as () => DiaryBookInfo[])()
    }
    throw new NativeModuleNotAvailableError('UnifiedDatabase.listDiaryBooks')
  },

  getDiaryStats(db: unknown, bookName?: string): DiaryStats | null {
    const d = db as Record<string, unknown>
    if (typeof d.getDiaryStats === 'function') {
      return (d.getDiaryStats as (b?: string) => DiaryStats)(bookName)
    }
    throw new NativeModuleNotAvailableError('UnifiedDatabase.getDiaryStats')
  },

  batchSaveDiary(db: unknown, diaries: DiaryRecord[]): number {
    const d = db as Record<string, unknown>
    if (typeof d.batchSaveDiary === 'function') {
      return (d.batchSaveDiary as (d: DiaryRecord[]) => number)(diaries)
    }
    throw new NativeModuleNotAvailableError('UnifiedDatabase.batchSaveDiary')
  }
}

// ==================== TagBoost 操作 ====================

export const tagBoostOps = {
  computeTagBoost(matrix: unknown, params: TagBoostParams): TagBoostResult {
    const m = matrix as Record<string, unknown>
    if (typeof m.computeTagBoost === 'function') {
      return (m.computeTagBoost as (p: TagBoostParams) => TagBoostResult)(params)
    }
    // Fallback: 无增强
    return {
      originalScore: params.originalScore || 0,
      boostedScore: params.originalScore || 0,
      matchedTags: [],
      expansionTags: [],
      boostFactor: 1.0,
      tagMatchScore: 0,
      spikeDetails: [],
      dynamicAlpha: params.alphaMin || 1.5,
      dynamicBeta: params.betaBase || 2.0
    }
  },

  batchComputeTagBoost(
    matrix: unknown,
    items: TagBoostBatchItem[],
    queryTags: string[],
    alphaMin?: number,
    alphaMax?: number,
    betaBase?: number
  ): TagBoostResult[] {
    const m = matrix as Record<string, unknown>
    if (typeof m.batchComputeTagBoost === 'function') {
      return (m.batchComputeTagBoost as (
        i: TagBoostBatchItem[],
        q: string[],
        amin?: number,
        amax?: number,
        b?: number
      ) => TagBoostResult[])(items, queryTags, alphaMin, alphaMax, betaBase)
    }
    // Fallback
    return items.map((item) => ({
      originalScore: item.originalScore || 0,
      boostedScore: item.originalScore || 0,
      matchedTags: [],
      expansionTags: [],
      boostFactor: 1.0,
      tagMatchScore: 0,
      spikeDetails: [],
      dynamicAlpha: alphaMin || 1.5,
      dynamicBeta: betaBase || 2.0
    }))
  }
}

// ==================== 向量级增强操作 (VCPToolBox _applyTagBoost 完整实现) ====================

export const vectorBoostOps = {
  /**
   * 向量级标签增强
   *
   * 完整实现 VCPToolBox _applyTagBoost 的向量融合算法：
   * 1. 计算动态 Alpha/Beta
   * 2. 标签索引召回 + 共现扩展
   * 3. 构建上下文向量
   * 4. 线性融合: fused = (1-ratio)*original + ratio*context
   * 5. L2 归一化
   */
  boostVector(matrix: unknown, params: VectorBoostParams): VectorBoostResult {
    const m = matrix as Record<string, unknown>
    if (typeof m.boostVector === 'function') {
      return (m.boostVector as (p: VectorBoostParams) => VectorBoostResult)(params)
    }
    // Fallback: 返回原始向量
    return {
      fusedVector: params.originalVector,
      originalScore: 0,
      boostedScore: 0,
      matchedTags: [],
      expansionTags: [],
      boostFactor: 1.0,
      contextBlendRatio: 0,
      dynamicAlpha: params.alphaMin || 1.5,
      dynamicBeta: params.betaBase || 2.0
    }
  },

  /**
   * 批量向量增强
   */
  batchBoostVectors(
    matrix: unknown,
    originalVectors: number[][],
    queryTags: string[],
    contentTagsList: string[][],
    tagVectors?: number[],
    tagNames?: string[],
    vectorDim?: number,
    alphaMin?: number,
    alphaMax?: number,
    betaBase?: number,
    maxBoostRatio?: number
  ): VectorBoostResult[] {
    const m = matrix as Record<string, unknown>
    if (typeof m.batchBoostVectors === 'function') {
      return (m.batchBoostVectors as (
        vecs: number[][],
        qt: string[],
        ctl: string[][],
        tv?: number[],
        tn?: string[],
        dim?: number,
        amin?: number,
        amax?: number,
        b?: number,
        mbr?: number
      ) => VectorBoostResult[])(
        originalVectors,
        queryTags,
        contentTagsList,
        tagVectors,
        tagNames,
        vectorDim,
        alphaMin,
        alphaMax,
        betaBase,
        maxBoostRatio
      )
    }
    // Fallback: 返回原始向量
    return originalVectors.map((vec) => ({
      fusedVector: vec,
      originalScore: 0,
      boostedScore: 0,
      matchedTags: [],
      expansionTags: [],
      boostFactor: 1.0,
      contextBlendRatio: 0,
      dynamicAlpha: alphaMin || 1.5,
      dynamicBeta: betaBase || 2.0
    }))
  }
}

// ==================== 精简 Fallback 实现 ====================

/**
 * 最小化 TagMatrix fallback
 */
class MinimalTagMatrix {
  private alpha: number
  private beta: number
  private cooccurrence = new Map<string, Map<string, number>>()
  private frequencies = new Map<string, number>()
  private totalCount = 0

  constructor(alpha = 0.8, beta = 0.2) {
    this.alpha = alpha
    this.beta = beta
  }

  update(tag1: string, tag2: string, weight = 1.0): void {
    if (!this.cooccurrence.has(tag1)) this.cooccurrence.set(tag1, new Map())
    const c1 = this.cooccurrence.get(tag1)!.get(tag2) || 0
    this.cooccurrence.get(tag1)!.set(tag2, c1 * this.beta + weight * this.alpha)

    if (!this.cooccurrence.has(tag2)) this.cooccurrence.set(tag2, new Map())
    const c2 = this.cooccurrence.get(tag2)!.get(tag1) || 0
    this.cooccurrence.get(tag2)!.set(tag1, c2 * this.beta + weight * this.alpha)

    this.frequencies.set(tag1, (this.frequencies.get(tag1) || 0) + weight)
    this.frequencies.set(tag2, (this.frequencies.get(tag2) || 0) + weight)
    this.totalCount += weight * 2
  }

  batchUpdate(updates: TagPairUpdate[]): void {
    for (const u of updates) this.update(u.tag1, u.tag2, u.weight)
  }

  computePmi(tag1: string, tag2: string): number {
    if (this.totalCount === 0) return 0
    const f1 = this.frequencies.get(tag1) || 0
    const f2 = this.frequencies.get(tag2) || 0
    if (f1 === 0 || f2 === 0) return 0
    const cooc = this.cooccurrence.get(tag1)?.get(tag2) || 0
    if (cooc === 0) return 0
    return Math.log((cooc / this.totalCount) / ((f1 / this.totalCount) * (f2 / this.totalCount)))
  }

  getAssociations(tag: string, topK = 10): TagAssociation[] {
    const coocs = this.cooccurrence.get(tag)
    if (!coocs) return []
    const result: TagAssociation[] = []
    for (const [other, cooc] of coocs) {
      result.push({
        tag: other,
        pmi: this.computePmi(tag, other),
        cooccurrence: cooc,
        frequency: this.frequencies.get(other) || 0
      })
    }
    result.sort((a, b) => b.pmi - a.pmi)
    return result.slice(0, topK)
  }

  expandQuery(tags: string[], expansionFactor = 0.5): string[] {
    const expanded = new Map<string, number>(tags.map((t) => [t, 1.0]))
    for (const tag of tags) {
      const coocs = this.cooccurrence.get(tag)
      if (!coocs) continue
      for (const [other, cooc] of coocs) {
        if (!expanded.has(other)) {
          const f1 = this.frequencies.get(tag) || 1
          const f2 = this.frequencies.get(other) || 1
          expanded.set(other, Math.exp(cooc / Math.sqrt(f1 * f2)) * expansionFactor)
        }
      }
    }
    return Array.from(expanded.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t)
  }

  getStats(): TagMatrixStats {
    let pairs = 0
    for (const m of this.cooccurrence.values()) pairs += m.size
    return {
      tagCount: this.frequencies.size,
      pairCount: Math.floor(pairs / 2),
      totalUpdates: this.totalCount,
      alpha: this.alpha,
      beta: this.beta
    }
  }

  toJson(): string {
    return JSON.stringify({
      alpha: this.alpha,
      beta: this.beta,
      cooccurrence: Object.fromEntries(Array.from(this.cooccurrence.entries()).map(([k, v]) => [k, Object.fromEntries(v)])),
      frequencies: Object.fromEntries(this.frequencies),
      totalCount: this.totalCount
    })
  }

  static fromJson(json: string): MinimalTagMatrix {
    const data = JSON.parse(json)
    const m = new MinimalTagMatrix(data.alpha, data.beta)
    for (const [t1, coocs] of Object.entries(data.cooccurrence || {})) {
      m.cooccurrence.set(t1, new Map(Object.entries(coocs as Record<string, number>)))
    }
    for (const [t, f] of Object.entries(data.frequencies || {})) {
      m.frequencies.set(t, f as number)
    }
    m.totalCount = data.totalCount || 0
    return m
  }

  clear(): void {
    this.cooccurrence.clear()
    this.frequencies.clear()
    this.totalCount = 0
  }
}

/**
 * 最小化 TextChunker fallback
 */
class MinimalTextChunker {
  private maxChunkSize: number
  private overlapSize: number
  private separators = ['\n\n', '\n', '。', '！', '？', '；', '. ', '! ', '? ', '; ']

  constructor(maxChunkSize = 1000, overlapSize = 200) {
    this.maxChunkSize = maxChunkSize
    this.overlapSize = overlapSize
  }

  setSeparators(separators: string[]): void {
    this.separators = separators
  }

  chunk(text: string): TextChunk[] {
    if (!text) return []
    if (text.length <= this.maxChunkSize) {
      return [{ content: text, startOffset: 0, endOffset: text.length, charCount: text.length, index: 0 }]
    }

    const chunks: TextChunk[] = []
    let start = 0, index = 0

    while (start < text.length) {
      let end = Math.min(start + this.maxChunkSize, text.length)
      if (end < text.length) {
        for (const sep of this.separators) {
          const idx = text.lastIndexOf(sep, end)
          if (idx > start + this.maxChunkSize / 2) {
            end = idx + sep.length
            break
          }
        }
      }
      const content = text.slice(start, end)
      chunks.push({ content, startOffset: start, endOffset: end, charCount: content.length, index })
      start = Math.max(start + 1, end - this.overlapSize)
      index++
    }
    return chunks
  }

  chunkBatch(texts: string[]): ChunkBatchResult[] {
    return texts.map((text, docIndex) => ({ docIndex, chunks: this.chunk(text) }))
  }

  estimateTokens(text: string): number {
    let chinese = 0, other = 0
    for (const c of text) {
      if (c >= '\u4e00' && c <= '\u9fff') chinese++
      else if (!/\s/.test(c)) other++
    }
    return Math.round(chinese / 1.5 + other / 4)
  }

  chunkByTokens(text: string, maxTokens = 500, overlapTokens = 50): TextChunk[] {
    return new MinimalTextChunker(Math.round(maxTokens * 2.5), Math.round(overlapTokens * 2.5)).chunk(text)
  }

  getConfig(): ChunkerConfig {
    return { maxChunkSize: this.maxChunkSize, overlapSize: this.overlapSize, separators: this.separators }
  }
}

/**
 * 最小化 HybridSearch fallback
 */
class MinimalHybridSearch {
  private bm25Weight: number
  private vectorWeight: number
  private tagBoostWeight: number
  private rrfK = 60

  constructor(bm25Weight = 0.5, vectorWeight = 0.5, tagBoostWeight = 0.2) {
    this.bm25Weight = bm25Weight
    this.vectorWeight = vectorWeight
    this.tagBoostWeight = tagBoostWeight
  }

  setRrfK(k: number): void {
    this.rrfK = k
  }

  setWeights(bm25: number, vector: number, tagBoost: number): void {
    this.bm25Weight = bm25
    this.vectorWeight = vector
    this.tagBoostWeight = tagBoost
  }

  fuseResults(
    bm25Results: SearchResultItem[],
    vectorResults: SearchResultItem[],
    tagBoostScores?: Map<string, number>,
    limit = 20
  ): HybridSearchResult[] {
    const scores = new Map<string, {
      content: string
      metadata?: string
      bm25Score: number
      bm25Rank?: number
      bm25Rrf: number
      vectorScore: number
      vectorRank?: number
      vectorRrf: number
      tagBoostScore: number
    }>()

    for (let rank = 0; rank < bm25Results.length; rank++) {
      const item = bm25Results[rank]
      const rrf = 1.0 / (this.rrfK + rank + 1)
      scores.set(item.id, {
        content: item.content,
        metadata: item.metadata,
        bm25Score: item.score,
        bm25Rank: rank,
        bm25Rrf: rrf * this.bm25Weight,
        vectorScore: 0,
        vectorRrf: 0,
        tagBoostScore: 0
      })
    }

    for (let rank = 0; rank < vectorResults.length; rank++) {
      const item = vectorResults[rank]
      const rrf = 1.0 / (this.rrfK + rank + 1)
      const existing = scores.get(item.id)
      if (existing) {
        existing.vectorScore = item.score
        existing.vectorRank = rank
        existing.vectorRrf = rrf * this.vectorWeight
      } else {
        scores.set(item.id, {
          content: item.content,
          metadata: item.metadata,
          bm25Score: 0,
          bm25Rrf: 0,
          vectorScore: item.score,
          vectorRank: rank,
          vectorRrf: rrf * this.vectorWeight,
          tagBoostScore: 0
        })
      }
    }

    if (tagBoostScores) {
      for (const [id, boost] of tagBoostScores) {
        const e = scores.get(id)
        if (e) e.tagBoostScore = boost
      }
    }

    const results: HybridSearchResult[] = []
    for (const [id, e] of scores) {
      const base = e.bm25Rrf + e.vectorRrf
      const final = base * (1 + e.tagBoostScore * this.tagBoostWeight)
      results.push({
        id,
        content: e.content,
        metadata: e.metadata,
        finalScore: final,
        bm25Score: e.bm25Score,
        bm25Rank: e.bm25Rank,
        vectorScore: e.vectorScore,
        vectorRank: e.vectorRank,
        tagBoostScore: e.tagBoostScore,
        source: e.bm25Rank !== undefined && e.vectorRank !== undefined ? 'both' : e.bm25Rank !== undefined ? 'bm25' : 'vector'
      })
    }

    results.sort((a, b) => b.finalScore - a.finalScore)
    return results.slice(0, limit)
  }

  getConfig(): HybridSearchConfig {
    return { bm25Weight: this.bm25Weight, vectorWeight: this.vectorWeight, tagBoostWeight: this.tagBoostWeight, rrfK: this.rrfK }
  }
}

// ==================== Tracer (保留 fallback) ====================

class FallbackTracer {
  private traceId: string
  private spans: SpanInfo[] = []

  constructor(traceId?: string) {
    this.traceId = traceId || crypto.randomUUID()
  }

  getTraceId(): string {
    return this.traceId
  }

  startSpan(operation: string, parentSpanId?: string): string {
    const spanId = crypto.randomUUID().slice(0, 8)
    this.spans.push({ spanId, parentSpanId, operation, startTime: new Date().toISOString(), status: 'running' })
    return spanId
  }

  endSpan(spanId: string, status?: string, metadata?: string): void {
    const span = this.spans.find((s) => s.spanId === spanId)
    if (span) {
      const endTime = new Date()
      span.endTime = endTime.toISOString()
      span.status = status || 'completed'
      span.metadata = metadata
      span.durationMs = endTime.getTime() - new Date(span.startTime).getTime()
    }
  }

  logEvent(spanId: string | undefined | null, level: string, message: string, metadata?: string): void {
    logger.info(`[Trace:${this.traceId}][Span:${spanId || 'none'}] ${message}`, { level, metadata })
  }

  getSpans(): SpanInfo[] {
    return [...this.spans]
  }

  toJson(): string {
    return JSON.stringify({ traceId: this.traceId, spans: this.spans }, null, 2)
  }
}

export function createTracer(traceId?: string) {
  if (isNativeAvailable && nativeModule?.Tracer) {
    return new nativeModule.Tracer(traceId)
  }
  return new FallbackTracer(traceId)
}

// ==================== WaveRAG 三阶段检索类型 ====================

export interface WaveRAGConfig {
  /** 透镜阶段: 最大标签数 */
  lensMaxTags?: number
  /** 扩展阶段: 扩散深度 */
  expansionDepth?: number
  /** 扩展阶段: 共现阈值 */
  expansionThreshold?: number
  /** 扩展阶段: 最大扩展标签数 */
  expansionMaxTags?: number
  /** 聚焦阶段: 结果数量 */
  focusTopK?: number
  /** 聚焦阶段: 分数阈值 */
  focusScoreThreshold?: number
  /** TagMemo 权重 */
  tagMemoWeight?: number
  /** BM25 权重 */
  bm25Weight?: number
  /** 向量搜索权重 */
  vectorWeight?: number
}

export interface LensPhaseResult {
  tags: string[]
  expandedTags: string[]
  durationMs: number
}

export interface ExpansionPhaseResult {
  allTags: string[]
  depthReached: number
  durationMs: number
}

export interface FocusPhaseResult {
  resultCount: number
  tagBoostApplied: boolean
  durationMs: number
}

export interface WaveRAGResultItem {
  id: string
  content: string
  finalScore: number
  originalScore: number
  tagBoostScore: number
  matchedTags: string[]
  metadata?: string
  source: string
}

export interface WaveRAGResult {
  results: WaveRAGResultItem[]
  lensPhase: LensPhaseResult
  expansionPhase: ExpansionPhaseResult
  focusPhase: FocusPhaseResult
  queryTags: string[]
  expansionTags: string[]
  totalDurationMs: number
  traceId: string
}

export interface WaveRAGStats {
  tagCount: number
  pairCount: number
  totalUpdates: number
  cooccurrenceTags: number
}

// ==================== 日志回调桥接 ====================

export interface NativeLogEntry {
  timestamp: string
  level: string
  target: string
  message: string
  fields?: string
  span?: string
}

export type LogCallback = (entry: NativeLogEntry) => void

let logCallback: LogCallback | null = null

/**
 * 设置日志回调函数，用于接收来自 Rust 的日志
 * @param callback 回调函数，接收 NativeLogEntry
 */
export function setLogCallback(callback: LogCallback): void {
  logCallback = callback

  if (isNativeAvailable && nativeModule?.setLogCallback) {
    try {
      nativeModule.setLogCallback((entry: NativeLogEntry) => {
        if (logCallback) {
          logCallback(entry)
        }
      })
      logger.info('Native log callback registered')
    } catch (error) {
      logger.warn('Failed to set native log callback', { error: String(error) })
    }
  } else {
    logger.warn('Native module not available, log callback will only capture JS logs')
  }
}

/**
 * 移除日志回调
 */
export function clearLogCallback(): void {
  logCallback = null
  logger.info('Log callback cleared')
}

/**
 * 检查是否有活跃的日志回调
 */
export function hasLogCallback(): boolean {
  return logCallback !== null
}

// ==================== WaveRAG 操作 ====================

/**
 * 创建 WaveRAG 三阶段检索引擎 - 必须使用 Rust
 */
export function createWaveRAGEngine(config?: WaveRAGConfig) {
  if (isNativeAvailable && nativeModule?.WaveRAGEngine) {
    return new nativeModule.WaveRAGEngine(config)
  }
  throw new NativeModuleNotAvailableError('WaveRAGEngine')
}

/**
 * 快速三阶段检索 (无状态) - 必须使用 Rust
 */
export function quickWaveRAGSearch(
  queryTags: string[],
  bm25Results: SearchResultItem[],
  vectorResults: SearchResultItem[],
  config?: WaveRAGConfig
): WaveRAGResult {
  if (isNativeAvailable && nativeModule?.quickWaveragSearch) {
    return nativeModule.quickWaveragSearch(queryTags, bm25Results, vectorResults, config)
  }
  throw new NativeModuleNotAvailableError('quickWaveragSearch')
}

/**
 * WaveRAG 操作集合
 */
export const waveragOps = {
  /**
   * 执行三阶段检索
   */
  search(
    engine: unknown,
    queryTags: string[],
    bm25Results: SearchResultItem[],
    vectorResults: SearchResultItem[],
    configOverride?: WaveRAGConfig
  ): WaveRAGResult {
    const e = engine as Record<string, unknown>
    if (typeof e.search === 'function') {
      return (
        e.search as (
          qt: string[],
          bm25: SearchResultItem[],
          vec: SearchResultItem[],
          cfg?: WaveRAGConfig
        ) => WaveRAGResult
      )(queryTags, bm25Results, vectorResults, configOverride)
    }
    throw new NativeModuleNotAvailableError('WaveRAGEngine.search')
  },

  /**
   * 更新 TagMemo 共现矩阵
   */
  updateTagMatrix(engine: unknown, tag1: string, tag2: string, weight?: number): void {
    const e = engine as Record<string, unknown>
    if (typeof e.updateTagMatrix === 'function') {
      ;(e.updateTagMatrix as (t1: string, t2: string, w?: number) => void)(tag1, tag2, weight)
    } else {
      throw new NativeModuleNotAvailableError('WaveRAGEngine.updateTagMatrix')
    }
  },

  /**
   * 批量更新 TagMemo 共现矩阵
   */
  batchUpdateTagMatrix(engine: unknown, updates: TagPairUpdate[]): void {
    const e = engine as Record<string, unknown>
    if (typeof e.batchUpdateTagMatrix === 'function') {
      ;(e.batchUpdateTagMatrix as (u: TagPairUpdate[]) => void)(updates)
    } else {
      throw new NativeModuleNotAvailableError('WaveRAGEngine.batchUpdateTagMatrix')
    }
  },

  /**
   * 从 JSON 加载 TagMemo 矩阵
   */
  loadTagMatrixFromJson(engine: unknown, json: string): void {
    const e = engine as Record<string, unknown>
    if (typeof e.loadTagMatrixFromJson === 'function') {
      ;(e.loadTagMatrixFromJson as (j: string) => void)(json)
    } else {
      throw new NativeModuleNotAvailableError('WaveRAGEngine.loadTagMatrixFromJson')
    }
  },

  /**
   * 导出 TagMemo 矩阵为 JSON
   */
  exportTagMatrixToJson(engine: unknown): string {
    const e = engine as Record<string, unknown>
    if (typeof e.exportTagMatrixToJson === 'function') {
      return (e.exportTagMatrixToJson as () => string)()
    }
    throw new NativeModuleNotAvailableError('WaveRAGEngine.exportTagMatrixToJson')
  },

  /**
   * 获取配置
   */
  getConfig(engine: unknown): WaveRAGConfig {
    const e = engine as Record<string, unknown>
    if (typeof e.getConfig === 'function') {
      return (e.getConfig as () => WaveRAGConfig)()
    }
    throw new NativeModuleNotAvailableError('WaveRAGEngine.getConfig')
  },

  /**
   * 更新配置
   */
  updateConfig(engine: unknown, config: WaveRAGConfig): void {
    const e = engine as Record<string, unknown>
    if (typeof e.updateConfig === 'function') {
      ;(e.updateConfig as (c: WaveRAGConfig) => void)(config)
    } else {
      throw new NativeModuleNotAvailableError('WaveRAGEngine.updateConfig')
    }
  },

  /**
   * 获取统计信息
   */
  getStats(engine: unknown): WaveRAGStats {
    const e = engine as Record<string, unknown>
    if (typeof e.getStats === 'function') {
      return (e.getStats as () => WaveRAGStats)()
    }
    throw new NativeModuleNotAvailableError('WaveRAGEngine.getStats')
  },

  /**
   * 计算 TagBoost
   */
  computeTagBoost(engine: unknown, params: TagBoostParams): TagBoostResult {
    const e = engine as Record<string, unknown>
    if (typeof e.computeTagBoost === 'function') {
      return (e.computeTagBoost as (p: TagBoostParams) => TagBoostResult)(params)
    }
    throw new NativeModuleNotAvailableError('WaveRAGEngine.computeTagBoost')
  },

  /**
   * 批量计算 TagBoost
   */
  batchComputeTagBoost(engine: unknown, items: TagBoostBatchItem[], queryTags: string[]): TagBoostResult[] {
    const e = engine as Record<string, unknown>
    if (typeof e.batchComputeTagBoost === 'function') {
      return (e.batchComputeTagBoost as (i: TagBoostBatchItem[], q: string[]) => TagBoostResult[])(items, queryTags)
    }
    throw new NativeModuleNotAvailableError('WaveRAGEngine.batchComputeTagBoost')
  }
}

// ==================== 初始化和工具函数 ====================

let initialized = false

export async function initializeNativeVCP(): Promise<HealthStatus> {
  if (initialized) return healthCheck()
  await tryLoadNativeModule()
  initialized = true
  const health = healthCheck()
  logger.info('Native VCP Bridge initialized', health)
  return health
}

/**
 * 同步尝试加载 Native 模块（用于 healthCheck 的懒加载）
 */
function tryLoadNativeModuleSync(): void {
  if (initialized || isNativeAvailable) return

  try {
    const modulePath = getNativeVCPPath()
    if (!modulePath) {
      logger.debug('Native VCP module path not found (sync check)')
      return
    }

    logger.info('Loading native-vcp (sync) from', { path: modulePath })

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    nativeModule = require(modulePath)
    logger.info('Native module required successfully', { hasModule: !!nativeModule })

    // 检查模块是否已被其他服务初始化 (如 NativeModulePreloader)
    // 通过尝试 healthCheck 来判断
    let alreadyInitialized = false
    try {
      if (typeof nativeModule.healthCheck === 'function') {
        const testHealth = nativeModule.healthCheck()
        if (testHealth && testHealth.status === 'healthy') {
          alreadyInitialized = true
          logger.info('Native module already initialized by another service', {
            version: testHealth.version
          })
        }
      }
    } catch {
      // healthCheck 失败说明还没初始化
      alreadyInitialized = false
    }

    // 只在未初始化时调用 initialize
    if (!alreadyInitialized && typeof nativeModule.initialize === 'function') {
      // 安全获取 userData 路径
      let dataDir: string
      try {
        dataDir = path.join(app.getPath('userData'), 'native-vcp')
      } catch {
        dataDir = path.join(process.cwd(), 'native-vcp-data')
        logger.warn('app.getPath failed, using fallback dataDir', { dataDir })
      }

      logger.info('Initializing native module', { dataDir })
      nativeModule.initialize({
        dataDir,
        logLevel: 'info',
        enableSearch: true,
        vectorDim: 1536
      })
      logger.info('Native module initialized successfully')
    }

    const health = nativeModule.healthCheck()
    logger.info('Native VCP module loaded (sync)', {
      version: health.version,
      features: health.features
    })

    isNativeAvailable = true
    initialized = true
  } catch (error) {
    // 使用 error 级别确保日志可见
    logger.error('Native VCP module sync load FAILED', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
  }
}

export function healthCheck(): HealthStatus {
  // 懒加载: 如果还没初始化，尝试同步加载
  if (!initialized && !isNativeAvailable) {
    tryLoadNativeModuleSync()
  }

  if (isNativeAvailable && nativeModule) {
    const health = nativeModule.healthCheck()
    return { ...health, isNative: true }
  }
  return { status: 'degraded', version: '1.0.0-fallback', features: ['tagmemo', 'tracing', 'chunker', 'hybrid_search'], isNative: false }
}

export function isNativeModuleAvailable(): boolean {
  return isNativeAvailable
}

export function getNativeModule() {
  return nativeModule
}

// ==================== 导出 ====================

export {
  MinimalTagMatrix as FallbackTagCooccurrenceMatrix,
  MinimalTextChunker as FallbackTextChunker,
  MinimalHybridSearch as FallbackHybridSearchEngine,
  FallbackTracer
}
