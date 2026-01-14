/**
 * Vexus 向量索引适配器
 *
 * 为 rust-vexus-lite 提供 TypeScript 接口适配
 * 许可证: CC BY-NC-SA 4.0 - 非商业使用完全允许
 *
 * 集成步骤:
 * 1. 下载预编译 .node 文件 (vexus-lite.win32-x64-msvc.node 等)
 * 2. 放置到 src/main/knowledge/vector/ 目录
 * 3. 使用 createVexusAdapter(dim, capacity, true) 启用原生模式
 */

import { loggerService } from '@logger'
import crypto from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'

// 延迟导入 electron 以避免模块加载时 electron 未初始化
let electronApp: typeof import('electron').app | undefined
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  electronApp = require('electron').app
} catch {
  // electron 未就绪
}

const logger = loggerService.withContext('VexusAdapter')

// ==================== Native 模块路径解析 ====================

/**
 * 获取 native-vcp 模块路径
 * 支持开发模式和生产模式
 */
function getNativeVCPPath(): string {
  const appPath = electronApp?.getAppPath() ?? process.cwd()
  const possiblePaths = [
    // 开发模式: 从项目根目录加载
    path.join(process.cwd(), 'native-vcp', 'index.js'),
    // 生产模式: 从 app 目录加载
    path.join(appPath, 'native-vcp', 'index.js'),
    // 备选: 相对于当前文件的位置 (编译后)
    path.join(__dirname, '..', '..', '..', '..', 'native-vcp', 'index.js'),
    // 备选: resources 目录
    path.join(appPath, '..', 'native-vcp', 'index.js')
  ]

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      logger.debug('Found native-vcp at', { path: p })
      return p
    }
  }

  logger.warn('Native VCP module not found in expected paths', { paths: possiblePaths })
  return ''
}

// ==================== 类型定义 (来自 vexus-lite.d.ts) ====================

/**
 * Vexus 搜索结果
 */
export interface VexusSearchResult {
  id: number
  score: number // 1.0 - L2sq_distance, 越大越相似
}

/**
 * Vexus 索引统计
 */
export interface VexusStats {
  totalVectors: number
  dimensions: number
  capacity: number
  memoryUsage: number
}

/**
 * Vexus 索引接口
 */
export interface IVexusIndex {
  save(indexPath: string): void
  add(id: number, vector: Buffer): void
  addBatch(ids: number[], vectors: Buffer): void
  search(query: Buffer, k: number): VexusSearchResult[]
  remove(id: number): void
  stats(): VexusStats
  recoverFromSqlite(dbPath: string, tableType: string, filterDiaryName?: string | null): Promise<unknown>
}

/**
 * Vexus 索引类接口
 */
export interface IVexusIndexClass {
  new (dim: number, capacity: number): IVexusIndex
  load(indexPath: string, unusedMapPath: string | null, dim: number, capacity: number): IVexusIndex
}

// ==================== PMI 共现矩阵类型 (Phase 3) ====================

/**
 * 标签共现关系
 */
export interface TagCooccurrence {
  tag1: string
  tag2: string
  weight: number
  count: number
}

/**
 * 标签信息
 */
export interface TagInfo {
  id: string
  name: string
  frequency: number
}

/**
 * 文档输入 (用于构建共现矩阵)
 */
export interface DocumentInput {
  id: string
  tags: string[]
}

/**
 * 共现矩阵接口 (Rust 原生实现)
 */
export interface ICooccurrenceMatrix {
  buildFromDocuments(documents: DocumentInput[]): number
  getCooccurrence(tag1: string, tag2: string): number
  getRelatedTags(tag: string, topK?: number, minWeight?: number): TagCooccurrence[]
  expandTags(seeds: string[], depth?: number, decayFactor?: number): TagCooccurrence[]
  getAllTags(): string[]
  tagCount(): number
  getTagInfo(tag: string): TagInfo | null
  toJson(): string
}

/**
 * 共现矩阵类接口
 */
export interface ICooccurrenceMatrixClass {
  new (): ICooccurrenceMatrix
}

// ==================== 语义组匹配类型 (Phase 3) ====================

/**
 * 语义组匹配结果
 */
export interface SemanticGroupMatch {
  groupType: string
  subGroup: string
  matchedKeywords: string[]
  weight: number
}

/**
 * 语义组关键词定义
 */
export interface GroupKeywords {
  groupType: string
  subGroup: string
  keywords: string[]
}

/**
 * 语义组匹配器接口 (Rust 原生实现)
 */
export interface ISemanticGroupMatcher {
  registerGroup(groupType: string, subGroup: string, keywords: string[]): void
  registerGroups(groups: GroupKeywords[]): void
  extractMatches(text: string): SemanticGroupMatch[]
  expandKeywords(matches: SemanticGroupMatch[]): string[]
  calculateOverlap(queryMatches: SemanticGroupMatch[], resultMatches: SemanticGroupMatch[]): number
  getGroupKeywords(groupType: string, subGroup?: string): string[]
  keywordCount(): number
  getGroupTypes(): string[]
}

/**
 * 语义组匹配器类接口
 */
export interface ISemanticGroupMatcherClass {
  new (): ISemanticGroupMatcher
}

// ==================== 向量数据库适配器 ====================

/**
 * Vexus 原始接口 (与标准 VectorDbAdapter 不同)
 */
export interface VexusRawAdapter {
  insert(vectors: number[][], ids: string[]): Promise<void>
  search(query: number[], topK: number): Promise<Array<{ id: string; score: number }>>
  delete(ids: string[]): Promise<void>
  save(path: string): Promise<void>
  load(path: string): Promise<void>
  stats(): Promise<{ totalVectors: number; dimensions: number }>
}

/**
 * ID 映射数据结构
 */
interface IdMapping {
  nextId: number
  idToNumeric: Record<string, number>
  numericToId: Record<number, string>
}

/**
 * Vexus 适配器 - 封装 rust-vexus-lite 接口
 */
export class VexusAdapter implements VexusRawAdapter {
  private index: IVexusIndex | null = null
  private idToNumeric: Map<string, number> = new Map()
  private numericToId: Map<number, string> = new Map()
  private nextId: number = 1
  private VexusIndexClass: IVexusIndexClass | null = null

  constructor(
    private dimensions: number = 1536,
    private capacity: number = 100000,
    useNative: boolean = false
  ) {
    if (useNative) {
      this.loadNativeModule()
    }

    if (this.VexusIndexClass) {
      this.index = new this.VexusIndexClass(dimensions, capacity)
      logger.info('VexusAdapter initialized with native module', { dimensions, capacity })
    } else {
      logger.info('VexusAdapter initialized with mock (native module not available)', { dimensions, capacity })
    }
  }

  /**
   * 尝试加载原生模块
   */
  private loadNativeModule(): void {
    try {
      // 使用动态路径解析加载 native-vcp 模块
      const modulePath = getNativeVCPPath()
      if (!modulePath) {
        throw new Error('Native VCP module path not found')
      }

      const vexusModule = require(modulePath)
      this.VexusIndexClass = vexusModule.VexusIndex
      logger.info('Native Vexus module loaded successfully', { path: modulePath })
    } catch (error) {
      logger.warn('Failed to load native Vexus module', { error: (error as Error).message })
      this.VexusIndexClass = null
    }
  }

  /**
   * 检查是否使用原生模块
   */
  isNativeMode(): boolean {
    return this.VexusIndexClass !== null && this.index !== null
  }

  /**
   * 插入向量
   */
  async insert(vectors: number[][], ids: string[]): Promise<void> {
    if (!this.index) {
      throw new Error('Index not initialized')
    }
    if (vectors.length !== ids.length) {
      throw new Error('Vectors and IDs length mismatch')
    }
    if (vectors.length === 0) return

    // 验证维度
    if (vectors[0].length !== this.dimensions) {
      throw new Error(`Dimension mismatch: expected ${this.dimensions}, got ${vectors[0].length}`)
    }

    // 生成数字 ID 映射
    const numericIds: number[] = []
    for (const id of ids) {
      if (this.idToNumeric.has(id)) {
        numericIds.push(this.idToNumeric.get(id)!)
      } else {
        const numId = this.nextId++
        this.idToNumeric.set(id, numId)
        this.numericToId.set(numId, id)
        numericIds.push(numId)
      }
    }

    // 转换为 Buffer 并批量插入
    const buffer = this.vectorsToBuffer(vectors)
    this.index.addBatch(numericIds, buffer)

    logger.debug('Vectors inserted', { count: vectors.length })
  }

  /**
   * 搜索相似向量
   */
  async search(query: number[], topK: number): Promise<Array<{ id: string; score: number }>> {
    if (!this.index) {
      throw new Error('Index not initialized')
    }
    // 维度不匹配时优雅降级：返回空结果并记录警告
    if (query.length !== this.dimensions) {
      logger.warn(`Dimension mismatch in vector search: index has ${this.dimensions} dimensions, query has ${query.length}. Consider re-indexing with the correct embedding model.`)
      return []
    }

    const buffer = this.vectorToBuffer(query)
    const results = this.index.search(buffer, topK)

    // 转换回字符串 ID
    return results
      .map((r) => ({
        id: this.numericToId.get(r.id) || String(r.id),
        score: r.score
      }))
      .filter((r) => this.numericToId.has(parseInt(r.id)) || this.numericToId.size === 0)
  }

  /**
   * 删除向量
   */
  async delete(ids: string[]): Promise<void> {
    if (!this.index) {
      throw new Error('Index not initialized')
    }

    for (const id of ids) {
      const numId = this.idToNumeric.get(id)
      if (numId !== undefined) {
        this.index.remove(numId)
        this.idToNumeric.delete(id)
        this.numericToId.delete(numId)
      }
    }

    logger.debug('Vectors deleted', { count: ids.length })
  }

  /**
   * 保存索引和 ID 映射
   */
  async save(path: string): Promise<void> {
    if (!this.index) {
      throw new Error('Index not initialized')
    }

    // 保存向量索引
    this.index.save(path)

    // 保存 ID 映射
    const mappingPath = path + '.mapping.json'
    const mapping: IdMapping = {
      nextId: this.nextId,
      idToNumeric: Object.fromEntries(this.idToNumeric),
      numericToId: Object.fromEntries(Array.from(this.numericToId.entries()).map(([k, v]) => [String(k), v]))
    }
    writeFileSync(mappingPath, JSON.stringify(mapping, null, 2))

    logger.info('Index and mapping saved', { path })
  }

  /**
   * 加载索引和 ID 映射
   */
  async load(path: string): Promise<void> {
    if (!this.VexusIndexClass) {
      throw new Error('Native module not loaded')
    }

    // 加载向量索引
    this.index = this.VexusIndexClass.load(path, null, this.dimensions, this.capacity)

    // 加载 ID 映射
    const mappingPath = path + '.mapping.json'
    if (existsSync(mappingPath)) {
      const mappingData = JSON.parse(readFileSync(mappingPath, 'utf-8')) as IdMapping
      this.nextId = mappingData.nextId
      this.idToNumeric = new Map(Object.entries(mappingData.idToNumeric))
      this.numericToId = new Map(Object.entries(mappingData.numericToId).map(([k, v]) => [parseInt(k), v as string]))
    }

    logger.info('Index and mapping loaded', { path })
  }

  /**
   * 获取统计信息
   */
  async stats(): Promise<{ totalVectors: number; dimensions: number }> {
    if (!this.index) {
      throw new Error('Index not initialized')
    }
    const s = this.index.stats()
    return {
      totalVectors: s.totalVectors,
      dimensions: s.dimensions
    }
  }

  /**
   * 从 SQLite 恢复索引
   */
  async recoverFromSqlite(dbPath: string, tableType: 'tags' | 'chunks', filterDiaryName?: string): Promise<void> {
    if (!this.index) {
      throw new Error('Index not initialized')
    }
    await this.index.recoverFromSqlite(dbPath, tableType, filterDiaryName)
    logger.info('Index recovered from SQLite', { dbPath, tableType })
  }

  // ==================== 私有方法 ====================

  private vectorToBuffer(vector: number[]): Buffer {
    const buffer = Buffer.alloc(vector.length * 4)
    vector.forEach((v, i) => buffer.writeFloatLE(v, i * 4))
    return buffer
  }

  private vectorsToBuffer(vectors: number[][]): Buffer {
    const dim = vectors[0].length
    const buffer = Buffer.alloc(vectors.length * dim * 4)
    vectors.forEach((vec, i) => {
      vec.forEach((v, j) => {
        buffer.writeFloatLE(v, (i * dim + j) * 4)
      })
    })
    return buffer
  }
}

// ==================== Mock 实现 (用于开发/测试) ====================

/**
 * Mock Vexus 索引 - 使用内存中的简单实现
 * 用于开发和测试，不依赖原生模块
 */
class MockVexusIndex implements IVexusIndex {
  private vectors: Map<number, number[]> = new Map()

  constructor(
    private dim: number,
    private _cap: number
  ) {}

  save(_indexPath: string): void {
    logger.debug('[Mock] save called')
  }

  add(id: number, vector: Buffer): void {
    const vec = this.bufferToVector(vector, this.dim)
    this.vectors.set(id, vec)
  }

  addBatch(ids: number[], vectors: Buffer): void {
    for (let i = 0; i < ids.length; i++) {
      const start = i * this.dim * 4
      const vecBuffer = vectors.subarray(start, start + this.dim * 4)
      this.add(ids[i], vecBuffer as Buffer)
    }
  }

  search(query: Buffer, k: number): VexusSearchResult[] {
    const queryVec = this.bufferToVector(query, this.dim)
    const results: VexusSearchResult[] = []

    for (const [id, vec] of this.vectors) {
      const dist = this.l2Distance(queryVec, vec)
      const score = 1.0 - Math.min(dist, 1.0)
      results.push({ id, score })
    }

    return results.sort((a, b) => b.score - a.score).slice(0, k)
  }

  remove(id: number): void {
    this.vectors.delete(id)
  }

  stats(): VexusStats {
    return {
      totalVectors: this.vectors.size,
      dimensions: this.dim,
      capacity: this._cap,
      memoryUsage: this.vectors.size * this.dim * 4
    }
  }

  async recoverFromSqlite(_dbPath: string, _tableType: string, _filterDiaryName?: string | null): Promise<unknown> {
    logger.debug('[Mock] recoverFromSqlite called')
    return {}
  }

  private bufferToVector(buffer: Buffer, dim: number): number[] {
    const vec: number[] = []
    for (let i = 0; i < dim; i++) {
      vec.push(buffer.readFloatLE(i * 4))
    }
    return vec
  }

  private l2Distance(a: number[], b: number[]): number {
    let sum = 0
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i]
      sum += diff * diff
    }
    return Math.sqrt(sum)
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 Vexus 适配器
 *
 * @param dimensions - 向量维度 (默认 1536 for OpenAI ada-002)
 * @param capacity - 最大向量数量
 * @param useNative - 是否使用原生模块
 */
export function createVexusAdapter(
  dimensions: number = 1536,
  capacity: number = 100000,
  useNative: boolean = true
): VexusAdapter {
  const adapter = new VexusAdapter(dimensions, capacity, useNative)

  // 如果原生模式失败，回退到 Mock
  if (useNative && !adapter.isNativeMode()) {
    logger.warn('Falling back to mock implementation')
    return new VexusAdapter(dimensions, capacity, false)
  }

  return adapter
}

/**
 * 创建 Mock 适配器 (用于测试)
 */
export function createMockVexusAdapter(dimensions: number = 1536, capacity: number = 100000): VexusAdapter {
  return new VexusAdapter(dimensions, capacity, false)
}

// 导出 Mock 类供直接使用
export { MockVexusIndex }

// ==================== Rust 原生模块加载器 ====================

// ==================== ChineseSearchEngine 类型定义 ====================

/**
 * 中文搜索结果
 */
export interface ChineseSearchResult {
  id: string
  title: string
  content: string
  score: number
  tags?: string[]
}

/**
 * 关键词提取结果
 */
export interface KeywordResult {
  keyword: string
  weight: number
}

/**
 * ChineseSearchEngine 接口 (Rust 原生实现)
 */
export interface IChineseSearchEngine {
  addDocuments(
    docs: Array<{
      id: string
      title: string
      content: string
      tags?: string[]
    }>
  ): number
  search(query: string, limit: number): ChineseSearchResult[]
  deleteDocument(id: string): boolean
  commit(): void
  tokenize(text: string): string[]
  extractKeywords(text: string, topK: number): KeywordResult[]
  getStats(): { documentCount: number }
}

/**
 * ChineseSearchEngine 类接口
 */
export interface IChineseSearchEngineClass {
  open(indexPath: string): IChineseSearchEngine
}

// ==================== Native 模块完整接口 ====================

interface VexusNativeModule {
  VexusIndex: IVexusIndexClass
  CooccurrenceMatrix?: ICooccurrenceMatrixClass
  SemanticGroupMatcher?: ISemanticGroupMatcherClass
  ChineseSearchEngine?: IChineseSearchEngineClass
  // jieba 分词函数
  jiebaCut?: (text: string, hmm?: boolean) => string[]
  jiebaExtractKeywords?: (text: string, topK: number) => KeywordResult[]
}

let cachedNativeModule: VexusNativeModule | null = null

/**
 * 加载 Vexus 原生模块
 * 包含 VexusIndex, CooccurrenceMatrix, SemanticGroupMatcher
 */
export function loadVexusNativeModule(): VexusNativeModule | null {
  if (cachedNativeModule) {
    return cachedNativeModule
  }

  try {
    // 使用动态路径解析加载 native-vcp 模块
    const modulePath = getNativeVCPPath()
    if (!modulePath) {
      throw new Error('Native VCP module path not found')
    }

    const module = require(modulePath) as VexusNativeModule
    cachedNativeModule = module
    logger.info('Vexus native module loaded', {
      path: modulePath,
      hasVexusIndex: !!module.VexusIndex,
      hasCooccurrenceMatrix: !!module.CooccurrenceMatrix,
      hasSemanticGroupMatcher: !!module.SemanticGroupMatcher,
      hasChineseSearchEngine: !!module.ChineseSearchEngine
    })
    return module
  } catch (error) {
    logger.warn('Failed to load Vexus native module', { error: (error as Error).message })
    return null
  }
}

/**
 * 创建原生 CooccurrenceMatrix 实例
 * 如果原生模块不可用，返回 null
 */
export function createNativeCooccurrenceMatrix(): ICooccurrenceMatrix | null {
  const module = loadVexusNativeModule()
  if (module?.CooccurrenceMatrix) {
    return new module.CooccurrenceMatrix()
  }
  return null
}

/**
 * 创建原生 SemanticGroupMatcher 实例
 * 如果原生模块不可用，返回 null
 */
export function createNativeSemanticGroupMatcher(): ISemanticGroupMatcher | null {
  const module = loadVexusNativeModule()
  if (module?.SemanticGroupMatcher) {
    return new module.SemanticGroupMatcher()
  }
  return null
}

/**
 * 检查 Vexus 原生模块是否可用
 */
export function isVexusNativeAvailable(): boolean {
  return loadVexusNativeModule() !== null
}

/**
 * 检查 CooccurrenceMatrix 是否可用
 */
export function isCooccurrenceMatrixAvailable(): boolean {
  const module = loadVexusNativeModule()
  return !!module?.CooccurrenceMatrix
}

/**
 * 检查 SemanticGroupMatcher 是否可用
 */
export function isSemanticGroupMatcherAvailable(): boolean {
  const module = loadVexusNativeModule()
  return !!module?.SemanticGroupMatcher
}

/**
 * 检查 ChineseSearchEngine 是否可用
 */
export function isChineseSearchEngineAvailable(): boolean {
  const module = loadVexusNativeModule()
  return !!module?.ChineseSearchEngine
}

/**
 * 创建 ChineseSearchEngine 实例
 * @param indexPath - 索引存储路径
 * @returns ChineseSearchEngine 实例，如果不可用则返回 null
 */
export function createChineseSearchEngine(indexPath: string): IChineseSearchEngine | null {
  const module = loadVexusNativeModule()
  if (module?.ChineseSearchEngine) {
    return module.ChineseSearchEngine.open(indexPath)
  }
  return null
}

/**
 * jieba 分词
 * @param text - 待分词文本
 * @param hmm - 是否使用 HMM 模型 (默认 true)
 * @returns 分词结果数组，如果不可用则返回空数组
 */
export function jiebaCut(text: string, hmm: boolean = true): string[] {
  const module = loadVexusNativeModule()
  if (module?.jiebaCut) {
    return module.jiebaCut(text, hmm)
  }
  return []
}

/**
 * jieba 关键词提取
 * @param text - 待提取文本
 * @param topK - 返回前 K 个关键词
 * @returns 关键词结果数组，如果不可用则返回空数组
 */
export function jiebaExtractKeywords(text: string, topK: number): KeywordResult[] {
  const module = loadVexusNativeModule()
  if (module?.jiebaExtractKeywords) {
    return module.jiebaExtractKeywords(text, topK)
  }
  return []
}

// ==================== 标准 VectorDbAdapter 包装器 ====================

import type { VectorDbAdapter, VectorDbConfig, VectorDbStats, VectorSearchResult } from './types'

/**
 * VexusDbAdapter - 将 VexusAdapter 适配到标准 VectorDbAdapter 接口
 *
 * 注意：由于 Vexus 不存储元数据，此适配器会在内存中维护元数据映射
 */
export class VexusDbAdapter implements VectorDbAdapter {
  private vexusAdapter: VexusAdapter
  private entries: Map<
    string,
    {
      pageContent: string
      metadata: Record<string, any>
      loaderId?: string
    }
  > = new Map()

  private config: VectorDbConfig

  constructor(config: VectorDbConfig) {
    this.config = config
    this.vexusAdapter = createVexusAdapter(config.dimensions || 1536, config.capacity || 100000, true)
  }

  async initialize(): Promise<void> {
    // 尝试加载已有数据
    try {
      await this.vexusAdapter.load(this.config.path)
    } catch {
      // 忽略，可能是新索引
    }
  }

  async insertChunks(
    chunks: Array<{
      pageContent: string
      metadata: Record<string, any>
    }>,
    vectors: number[][]
  ): Promise<number> {
    if (chunks.length === 0) return 0

    const ids: string[] = []
    const loaderId = chunks[0].metadata?.uniqueLoaderId || `loader_${Date.now()}`

    for (let i = 0; i < chunks.length; i++) {
      const id = `${loaderId}_${i}`
      ids.push(id)

      // 存储元数据
      this.entries.set(id, {
        pageContent: chunks[i].pageContent,
        metadata: chunks[i].metadata,
        loaderId
      })
    }

    await this.vexusAdapter.insert(vectors, ids)
    return chunks.length
  }

  async similaritySearch(queryVector: number[], k: number): Promise<VectorSearchResult[]> {
    const results = await this.vexusAdapter.search(queryVector, k)

    return results.map((r) => {
      const entry = this.entries.get(r.id)
      return {
        id: r.id,
        score: r.score,
        metadata: entry?.metadata,
        pageContent: entry?.pageContent
      }
    })
  }

  async deleteKeys(uniqueLoaderId: string): Promise<boolean> {
    const idsToDelete: string[] = []

    for (const [id, entry] of this.entries) {
      if (entry.loaderId === uniqueLoaderId || entry.metadata?.uniqueLoaderId === uniqueLoaderId) {
        idsToDelete.push(id)
      }
    }

    if (idsToDelete.length === 0) return false

    await this.vexusAdapter.delete(idsToDelete)

    for (const id of idsToDelete) {
      this.entries.delete(id)
    }

    return true
  }

  async reset(): Promise<void> {
    const allIds = Array.from(this.entries.keys())
    if (allIds.length > 0) {
      await this.vexusAdapter.delete(allIds)
    }
    this.entries.clear()
  }

  async getVectorCount(): Promise<number> {
    const stats = await this.vexusAdapter.stats()
    return stats.totalVectors
  }

  async getStats(): Promise<VectorDbStats> {
    const stats = await this.vexusAdapter.stats()
    return {
      totalVectors: stats.totalVectors,
      dimensions: stats.dimensions,
      indexType: 'vexus-hnsw'
    }
  }

  async close(): Promise<void> {
    await this.vexusAdapter.save(this.config.path)
  }

  /**
   * 检查是否使用原生模块
   */
  isNativeMode(): boolean {
    return this.vexusAdapter.isNativeMode()
  }
}

/**
 * 创建标准 VectorDbAdapter 接口的 Vexus 适配器
 */
export function createVexusDbAdapter(config: VectorDbConfig): VexusDbAdapter {
  return new VexusDbAdapter(config)
}

// ==================== 角色索引管理器 (VCPToolBox 移植) ====================

/**
 * 角色索引管理器 - 每个角色/人物一个独立的向量索引
 *
 * 移植自 VCPToolBox KnowledgeBaseManager.js
 * 实现多日记本独立索引架构，支持懒加载
 *
 * @example
 * const manager = createCharacterIndexManager('/path/to/indices')
 * const index = await manager.getOrLoadCharacterIndex('角色A')
 * const results = await manager.searchByCharacter('角色A', queryVector, 10)
 */
export class CharacterIndexManager {
  private characterIndices: Map<string, VexusAdapter> = new Map()
  private readonly dimensions: number
  private readonly capacity: number
  private readonly basePath: string

  /**
   * @param basePath - 索引文件存储的基础路径
   * @param dimensions - 向量维度 (默认 1536 for OpenAI ada-002)
   * @param capacity - 每个索引的最大向量数量 (默认 50000)
   */
  constructor(basePath: string, dimensions = 1536, capacity = 50000) {
    this.basePath = basePath
    this.dimensions = dimensions
    this.capacity = capacity

    // 确保目录存在
    if (!existsSync(basePath)) {
      mkdirSync(basePath, { recursive: true })
    }

    logger.info('CharacterIndexManager initialized', { basePath, dimensions, capacity })
  }

  /**
   * 获取或加载角色索引 (懒加载)
   *
   * 移植自 VCPToolBox _getOrLoadDiaryIndex
   * - 首次访问时创建或从磁盘加载索引
   * - 后续访问直接返回缓存的索引
   *
   * @param characterName - 角色/人物名称
   * @returns VexusAdapter 实例
   */
  async getOrLoadCharacterIndex(characterName: string): Promise<VexusAdapter> {
    if (this.characterIndices.has(characterName)) {
      return this.characterIndices.get(characterName)!
    }

    // 生成安全的索引文件名 (使用 MD5 哈希处理中文等特殊字符)
    const safeName = crypto.createHash('md5').update(characterName).digest('hex')
    const indexPath = path.join(this.basePath, `character_${safeName}`)

    const adapter = createVexusAdapter(this.dimensions, this.capacity, true)

    // 尝试加载已有索引
    try {
      if (existsSync(indexPath)) {
        await adapter.load(indexPath)
        logger.info('Loaded character index from disk', { characterName, indexPath })
      }
    } catch (error) {
      logger.debug('No existing index found, creating new one', { characterName })
    }

    this.characterIndices.set(characterName, adapter)
    return adapter
  }

  /**
   * 按角色插入向量
   *
   * @param characterName - 角色名称
   * @param vectors - 向量数组
   * @param ids - 向量 ID 数组
   */
  async insertByCharacter(characterName: string, vectors: number[][], ids: string[]): Promise<void> {
    const index = await this.getOrLoadCharacterIndex(characterName)
    await index.insert(vectors, ids)
    logger.debug('Vectors inserted for character', { characterName, count: vectors.length })
  }

  /**
   * 按角色搜索
   *
   * @param characterName - 角色名称
   * @param queryVector - 查询向量
   * @param topK - 返回结果数量
   * @returns 搜索结果数组
   */
  async searchByCharacter(
    characterName: string,
    queryVector: number[],
    topK: number
  ): Promise<Array<{ id: string; score: number }>> {
    const index = await this.getOrLoadCharacterIndex(characterName)
    return index.search(queryVector, topK)
  }

  /**
   * 跨角色搜索 (搜索多个角色的索引)
   *
   * @param characterNames - 角色名称列表
   * @param queryVector - 查询向量
   * @param topK - 每个角色返回的结果数量
   * @returns 合并后的搜索结果 (按分数降序)
   */
  async searchAcrossCharacters(
    characterNames: string[],
    queryVector: number[],
    topK: number
  ): Promise<Array<{ id: string; score: number; characterName: string }>> {
    const allResults: Array<{ id: string; score: number; characterName: string }> = []

    for (const characterName of characterNames) {
      try {
        const results = await this.searchByCharacter(characterName, queryVector, topK)
        allResults.push(...results.map((r) => ({ ...r, characterName })))
      } catch (error) {
        logger.warn('Failed to search character index', { characterName, error })
      }
    }

    // 按分数降序排序并返回 top K
    return allResults.sort((a, b) => b.score - a.score).slice(0, topK)
  }

  /**
   * 按角色删除向量
   */
  async deleteByCharacter(characterName: string, ids: string[]): Promise<void> {
    if (!this.characterIndices.has(characterName)) {
      return
    }
    const index = this.characterIndices.get(characterName)!
    await index.delete(ids)
  }

  /**
   * 保存指定角色的索引
   */
  async saveCharacterIndex(characterName: string): Promise<void> {
    if (!this.characterIndices.has(characterName)) {
      return
    }

    const safeName = crypto.createHash('md5').update(characterName).digest('hex')
    const indexPath = path.join(this.basePath, `character_${safeName}`)
    const adapter = this.characterIndices.get(characterName)!

    await adapter.save(indexPath)
    logger.debug('Saved character index', { characterName, indexPath })
  }

  /**
   * 保存所有索引
   */
  async saveAll(): Promise<void> {
    for (const characterName of this.characterIndices.keys()) {
      await this.saveCharacterIndex(characterName)
    }
    logger.info('Saved all character indices', { count: this.characterIndices.size })
  }

  /**
   * 卸载指定角色的索引 (释放内存)
   */
  async unloadCharacterIndex(characterName: string, save = true): Promise<void> {
    if (!this.characterIndices.has(characterName)) {
      return
    }

    if (save) {
      await this.saveCharacterIndex(characterName)
    }

    this.characterIndices.delete(characterName)
    logger.debug('Unloaded character index', { characterName })
  }

  /**
   * 列出所有已加载的角色
   */
  listLoadedCharacters(): string[] {
    return Array.from(this.characterIndices.keys())
  }

  /**
   * 获取角色索引统计
   */
  async getCharacterStats(characterName: string): Promise<{ totalVectors: number; dimensions: number } | null> {
    if (!this.characterIndices.has(characterName)) {
      return null
    }
    return this.characterIndices.get(characterName)!.stats()
  }

  /**
   * 获取所有角色的统计信息
   */
  async getAllStats(): Promise<Map<string, { totalVectors: number; dimensions: number; isNative: boolean }>> {
    const stats = new Map<string, { totalVectors: number; dimensions: number; isNative: boolean }>()

    for (const [name, adapter] of this.characterIndices) {
      const s = await adapter.stats()
      stats.set(name, {
        ...s,
        isNative: adapter.isNativeMode()
      })
    }

    return stats
  }

  /**
   * 清理资源
   */
  async dispose(save = true): Promise<void> {
    if (save) {
      await this.saveAll()
    }
    this.characterIndices.clear()
    logger.info('CharacterIndexManager disposed')
  }
}

/**
 * 创建角色索引管理器
 *
 * @param basePath - 索引文件存储的基础路径
 * @param dimensions - 向量维度 (默认 1536)
 * @param capacity - 每个索引的最大向量数量 (默认 50000)
 */
export function createCharacterIndexManager(
  basePath: string,
  dimensions = 1536,
  capacity = 50000
): CharacterIndexManager {
  return new CharacterIndexManager(basePath, dimensions, capacity)
}
