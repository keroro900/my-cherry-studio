/**
 * Native Knowledge Service
 *
 * 原生知识库服务 - 完全不依赖 VCPToolBox
 * 整合以下原生服务：
 * - NoteService: 笔记/日记管理 (统一入口)
 * - TagMemoService: 标签共现增强 (PMI)
 * - LightMemoService: 轻量级 BM25 + 向量检索
 * - DeepMemoService: 深度检索 (Tantivy + 向量)
 * - GenericMeshMemoService: 过滤召回 (元数据 + 向量 + MMR)
 *
 * @version 1.1.0
 */

import Embeddings from '@main/knowledge/embedjs/embeddings/Embeddings'
import { loggerService } from '@logger'
import type { ApiClient } from '@types'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

import { getDeepMemoService, type DeepMemoService } from '../knowledge/deepMemo/DeepMemoService'
import { getLightMemoService, type LightMemoService } from '../knowledge/lightMemo/LightMemoService'
import { createGenericMeshMemoService, type GenericMeshMemoService } from '../knowledge/meshMemo/GenericMeshMemoService'
import { getTagMemoService, type CooccurrenceMatrix, type TagMemoService } from '../knowledge/tagmemo'
import { getNotesDir } from '../utils/file'
import { getNoteService, type NoteService } from './notes/NoteService'
import { getVCPInfoService } from './vcp/VCPInfoService'

const logger = loggerService.withContext('NativeKnowledgeService')

// ==================== 类型定义 ====================

/**
 * 搜索结果
 */
export interface NativeSearchResult {
  text: string
  score: number
  sourceFile: string
  fullPath?: string
  matchedTags?: string[]
  boostFactor?: number
  tagMatchScore?: number
  tagMatchCount?: number
}

/**
 * TagBoost 信息
 */
export interface NativeTagBoostInfo {
  matchedTags: string[]
  boostFactor: number
  spikeCount: number
  totalSpikeScore: number
}

/**
 * 服务配置
 */
export interface NativeKnowledgeConfig {
  /** Root path for diary/knowledge files */
  rootPath: string
  /** Path for vector store data */
  storePath: string
  /** Vector dimension (depends on embedding model) */
  dimension: number
  /** Embedding API client */
  embedApiClient?: ApiClient
  /** Folders to ignore */
  ignoreFolders?: string[]
  /** File prefixes to ignore */
  ignorePrefixes?: string[]
  /** File suffixes to ignore */
  ignoreSuffixes?: string[]
  /** Tag blacklist */
  tagBlacklist?: string[]
  /** TagMemo expand max count */
  tagExpandMaxCount?: number
  /** Full scan on startup */
  fullScanOnStartup?: boolean
}

/**
 * 检索模式
 */
export type RetrievalMode = 'light' | 'deep' | 'mesh' | 'all'

/**
 * 检索选项
 */
export interface RetrievalOptions {
  /** 检索模式 */
  mode?: RetrievalMode
  /** 返回数量 */
  topK?: number
  /** 最低分数阈值 */
  threshold?: number
  /** 是否启用 TagMemo 增强 */
  tagMemo?: boolean
  /** TagMemo 增强强度 (0-1) */
  tagBoost?: number
  /** 是否启用 Rerank */
  rerank?: boolean
  /** 日记本名称过滤 */
  diaryName?: string
  /** 时间范围 */
  timeRange?: {
    start: string
    end: string
  }
}

// ==================== 原生知识库服务 ====================

export class NativeKnowledgeService {
  private config: NativeKnowledgeConfig
  private embeddings: Embeddings | null = null
  private initialized = false

  // 子服务
  private noteService: NoteService
  private tagMemoService: TagMemoService
  private lightMemoService: LightMemoService
  private deepMemoService: DeepMemoService
  private meshMemoService: GenericMeshMemoService

  // 索引状态
  private indexedFiles: Set<string> = new Set()
  private lastIndexTime: Date | null = null

  constructor(config: Partial<NativeKnowledgeConfig> = {}) {
    const userData = this._getUserDataPath()

    // 使用统一的笔记目录 getNotesDir() 作为默认根目录
    // 保持与 NoteService 的路径一致: userData/Data/Notes
    this.config = {
      rootPath: config.rootPath || getNotesDir(),
      storePath: config.storePath || path.join(userData, 'VectorStore'),
      dimension: config.dimension || 3072,
      embedApiClient: config.embedApiClient,
      ignoreFolders: config.ignoreFolders || [],
      ignorePrefixes: config.ignorePrefixes || ['已整理'],
      ignoreSuffixes: config.ignoreSuffixes || [],
      tagBlacklist: config.tagBlacklist || [],
      tagExpandMaxCount: config.tagExpandMaxCount || 30,
      fullScanOnStartup: config.fullScanOnStartup ?? true
    }

    // 初始化子服务
    this.noteService = getNoteService()
    this.tagMemoService = getTagMemoService({
      enabled: true,
      maxExpansionDepth: 2
    })
    this.lightMemoService = getLightMemoService()
    this.deepMemoService = getDeepMemoService()
    this.meshMemoService = createGenericMeshMemoService()

    logger.info('NativeKnowledgeService created')
  }

  private _getUserDataPath(): string {
    try {
      return app.getPath('userData')
    } catch {
      return process.env.APPDATA || process.env.HOME || ''
    }
  }

  // ==================== 初始化 ====================

  /**
   * 设置 Embedding 客户端
   */
  setEmbedApiClient(client: ApiClient, dimensions?: number): void {
    this.embeddings = new Embeddings({
      embedApiClient: client,
      dimensions: dimensions || this.config.dimension
    })
    logger.info('Embeddings client configured', { dimensions: dimensions || this.config.dimension })
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true
    }

    try {
      logger.info('Initializing NativeKnowledgeService...')

      // 1. 确保目录存在
      this._ensureDirectories()

      // 2. 加载现有索引数据
      await this._loadIndexData()

      // 3. 初始化 TagMemo 共现矩阵
      await this._initializeTagMemo()

      // 4. 可选: 全量扫描
      if (this.config.fullScanOnStartup) {
        await this.rebuildIndex()
      }

      this.initialized = true
      logger.info('NativeKnowledgeService initialized successfully')

      return true
    } catch (error) {
      logger.error('Failed to initialize NativeKnowledgeService', {
        error: error instanceof Error ? error : new Error(String(error))
      })
      return false
    }
  }

  private _ensureDirectories(): void {
    const dirs = [this.config.rootPath, this.config.storePath, path.join(this.config.storePath, 'diary')]

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  }

  private async _loadIndexData(): Promise<void> {
    const indexPath = path.join(this.config.storePath, 'index-state.json')

    if (fs.existsSync(indexPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
        this.indexedFiles = new Set(data.indexedFiles || [])
        this.lastIndexTime = data.lastIndexTime ? new Date(data.lastIndexTime) : null

        // 加载 TagMemo 共现矩阵
        const matrixPath = path.join(this.config.storePath, 'cooccurrence-matrix.json')
        if (fs.existsSync(matrixPath)) {
          const matrixJson = fs.readFileSync(matrixPath, 'utf-8')
          this.tagMemoService.getCooccurrenceMatrix().fromJSON(matrixJson)
        }

        logger.info('Loaded index state', {
          indexedFiles: this.indexedFiles.size,
          lastIndexTime: this.lastIndexTime
        })
      } catch (error) {
        logger.warn('Failed to load index state', { error: String(error) })
      }
    }
  }

  private async _initializeTagMemo(): Promise<void> {
    // 从笔记服务获取所有条目，构建 TagMemo
    const notes = await this.noteService.listAll()
    const docs: Array<{ id: string; tags: string[] }> = []

    for (const note of notes) {
      docs.push({
        id: note.id,
        tags: note.frontmatter.tags || []
      })
    }

    if (docs.length > 0) {
      await this.tagMemoService.initialize(docs)
      logger.info('TagMemo initialized from notes', { documentCount: docs.length })
    }
  }

  // ==================== 搜索 API ====================

  /**
   * 向量搜索
   */
  async search(
    diaryName: string | null,
    queryVector: number[],
    k: number = 5,
    tagBoost: number = 0
  ): Promise<NativeSearchResult[]> {
    if (!this.initialized) {
      logger.warn('Service not initialized')
      return []
    }

    const options: RetrievalOptions = {
      mode: 'deep',
      topK: k,
      tagMemo: tagBoost > 0,
      tagBoost,
      diaryName: diaryName || undefined
    }

    return this._performSearch(queryVector, '', options)
  }

  /**
   * 文本搜索 (先向量化再搜索)
   */
  async searchByText(
    diaryName: string | null,
    queryText: string,
    k: number = 5,
    tagBoost: number = 0
  ): Promise<NativeSearchResult[]> {
    if (!this.initialized) {
      logger.warn('Service not initialized')
      return []
    }

    // 向量化查询
    let queryVector: number[] = []
    if (this.embeddings) {
      try {
        queryVector = await this.embeddings.embedQuery(queryText)
      } catch (error) {
        logger.error('Query embedding failed', { error: String(error) })
      }
    }

    const options: RetrievalOptions = {
      mode: queryVector.length > 0 ? 'deep' : 'light',
      topK: k,
      tagMemo: tagBoost > 0,
      tagBoost,
      diaryName: diaryName || undefined
    }

    return this._performSearch(queryVector, queryText, options)
  }

  /**
   * 高级搜索 (支持多种检索模式)
   */
  async advancedSearch(queryText: string, options: RetrievalOptions = {}): Promise<NativeSearchResult[]> {
    if (!this.initialized) {
      logger.warn('Service not initialized')
      return []
    }

    let queryVector: number[] = []
    if (this.embeddings) {
      try {
        queryVector = await this.embeddings.embedQuery(queryText)
      } catch (error) {
        logger.error('Query embedding failed', { error: String(error) })
      }
    }

    return this._performSearch(queryVector, queryText, options)
  }

  /**
   * 内部搜索实现
   */
  private async _performSearch(
    queryVector: number[],
    queryText: string,
    options: RetrievalOptions
  ): Promise<NativeSearchResult[]> {
    const { mode = 'deep', topK = 10, threshold = 0, tagMemo = false, tagBoost = 0, diaryName } = options

    let results: NativeSearchResult[] = []

    // 1. 收集待搜索文档
    const documents = await this._getSearchableDocuments(diaryName)

    if (documents.length === 0) {
      return []
    }

    // 2. 根据模式执行检索
    switch (mode) {
      case 'light':
        results = await this._lightSearch(queryText, documents, topK)
        break

      case 'deep':
        results = await this._deepSearch(queryVector, queryText, documents, topK)
        break

      case 'mesh':
        results = await this._meshSearch(queryVector, queryText, documents, topK)
        break

      case 'all':
        // 混合所有模式
        const lightResults = await this._lightSearch(queryText, documents, topK)
        const deepResults =
          queryVector.length > 0 ? await this._deepSearch(queryVector, queryText, documents, topK) : []

        // 融合结果
        results = this._fuseResults(lightResults, deepResults, topK)
        break
    }

    // 3. 应用 TagMemo 增强
    if (tagMemo && tagBoost > 0) {
      results = await this._applyTagBoost(queryText, results, tagBoost)
    }

    // 4. 过滤低分结果
    results = results.filter((r) => r.score >= threshold)

    // 5. 排序并返回
    const finalResults = results.sort((a, b) => b.score - a.score).slice(0, topK)

    // 6. 广播 RAG 检索事件
    this._broadcastRAGEvent(queryText, mode, topK, tagMemo, tagBoost, finalResults)

    return finalResults
  }

  private async _getSearchableDocuments(
    diaryName?: string
  ): Promise<Array<{ id: string; content: string; tags: string[]; sourceFile: string; embedding?: number[] }>> {
    const documents: Array<{
      id: string
      content: string
      tags: string[]
      sourceFile: string
      embedding?: number[]
    }> = []

    // 从笔记服务获取
    const notes = await this.noteService.listAll()

    for (const note of notes) {
      // 如果指定了 diaryName，只获取该目录下的笔记
      if (diaryName && !note.filePath.includes(diaryName)) {
        continue
      }

      documents.push({
        id: note.id,
        content: note.content,
        tags: note.frontmatter.tags || [],
        sourceFile: note.filePath
      })
    }

    // 从文件系统扫描 Markdown 文件
    const rootPath = diaryName ? path.join(this.config.rootPath, diaryName) : this.config.rootPath

    if (fs.existsSync(rootPath)) {
      const files = this._getMarkdownFiles(rootPath, diaryName ? 1 : 2)

      for (const file of files) {
        const relativePath = path.relative(this.config.rootPath, file)
        const existingDoc = documents.find((d) => d.sourceFile === relativePath || d.sourceFile.includes(relativePath))

        if (!existingDoc) {
          try {
            const content = fs.readFileSync(file, 'utf-8')
            const tags = this._extractTagsFromContent(content)

            documents.push({
              id: `file_${Buffer.from(file).toString('base64').slice(0, 16)}`,
              content,
              tags,
              sourceFile: relativePath
            })
          } catch {
            // ignore read errors
          }
        }
      }
    }

    return documents
  }

  private async _lightSearch(
    queryText: string,
    documents: Array<{ id: string; content: string; tags: string[]; sourceFile: string }>,
    topK: number
  ): Promise<NativeSearchResult[]> {
    // 使用 LightMemoService 进行 BM25 搜索
    this.lightMemoService.clear()

    for (const doc of documents) {
      this.lightMemoService.addDocument({
        id: doc.id,
        content: doc.content,
        metadata: { sourceFile: doc.sourceFile, tags: doc.tags }
      })
    }

    this.lightMemoService.buildIndex()
    const results = await this.lightMemoService.search(queryText, undefined, { topK })

    return results.map((r) => ({
      text: r.content.slice(0, 500),
      score: r.score,
      sourceFile: (r.metadata?.sourceFile as string) || '',
      matchedTags: (r.metadata?.tags as string[]) || []
    }))
  }

  private async _deepSearch(
    queryVector: number[],
    queryText: string,
    documents: Array<{ id: string; content: string; tags: string[]; sourceFile: string; embedding?: number[] }>,
    topK: number
  ): Promise<NativeSearchResult[]> {
    // 使用 DeepMemoService 进行深度搜索
    await this.deepMemoService.clear()

    for (const doc of documents) {
      await this.deepMemoService.addDocument({
        id: doc.id,
        content: doc.content,
        embedding: doc.embedding,
        metadata: { sourceFile: doc.sourceFile, tags: doc.tags }
      })
    }

    const results = await this.deepMemoService.search(queryText, queryVector.length > 0 ? queryVector : undefined, {
      finalTopK: topK,
      rerank: true
    })

    return results.map((r) => ({
      text: r.content.slice(0, 500),
      score: r.score,
      sourceFile: (r.metadata?.sourceFile as string) || '',
      matchedTags: (r.metadata?.tags as string[]) || []
    }))
  }

  private async _meshSearch(
    queryVector: number[],
    queryText: string,
    documents: Array<{ id: string; content: string; tags: string[]; sourceFile: string; embedding?: number[] }>,
    topK: number
  ): Promise<NativeSearchResult[]> {
    if (queryVector.length === 0) {
      return this._lightSearch(queryText, documents, topK)
    }

    // 使用 MeshMemoService 进行过滤召回
    const chunks = documents.map((doc) => ({
      content: doc.content,
      metadata: { sourceFile: doc.sourceFile, tags: doc.tags, id: doc.id },
      embedding: doc.embedding
    }))

    const results = await this.meshMemoService.search(chunks, queryVector, {
      query: queryText,
      finalTopK: topK,
      tagMemo: true,
      tagFields: ['tags']
    })

    return results.map((r) => ({
      text: r.pageContent.slice(0, 500),
      score: r.finalScore,
      sourceFile: (r.metadata?.sourceFile as string) || '',
      matchedTags: (r.metadata?.tags as string[]) || []
    }))
  }

  private _fuseResults(
    lightResults: NativeSearchResult[],
    deepResults: NativeSearchResult[],
    topK: number
  ): NativeSearchResult[] {
    const resultMap = new Map<string, NativeSearchResult>()

    // 合并结果
    for (const r of lightResults) {
      resultMap.set(r.sourceFile, r)
    }

    for (const r of deepResults) {
      const existing = resultMap.get(r.sourceFile)
      if (existing) {
        // 融合分数
        existing.score = existing.score * 0.3 + r.score * 0.7
      } else {
        resultMap.set(r.sourceFile, r)
      }
    }

    return Array.from(resultMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  private async _applyTagBoost(
    queryText: string,
    results: NativeSearchResult[],
    _tagBoost: number
  ): Promise<NativeSearchResult[]> {
    const queryTags = this.tagMemoService.extractTagsFromQuery(queryText)

    if (queryTags.length === 0) {
      return results
    }

    // 将结果转换为 KnowledgeSearchResult 格式
    const knowledgeResults = results.map((r) => ({
      pageContent: r.text,
      score: r.score,
      metadata: { tags: r.matchedTags || [], sourceFile: r.sourceFile }
    }))

    const enhanced = await this.tagMemoService.applyTagBoost(queryText, queryTags, knowledgeResults)

    return enhanced.map((r, i) => ({
      ...results[i],
      score: r.score,
      boostFactor: r.tagMemoResult?.boostFactor,
      tagMatchScore: r.tagMemoResult?.tagMatchScore,
      matchedTags: r.tagMemoResult?.matchedTags || results[i].matchedTags
    }))
  }

  // ==================== TagMemo API ====================

  /**
   * 搜索相似标签
   */
  async searchSimilarTags(query: string | number[], k: number = 10): Promise<{ tag: string; score: number }[]> {
    const matrix = this.tagMemoService.getCooccurrenceMatrix()

    if (typeof query === 'string') {
      const tags = this.tagMemoService.extractTagsFromQuery(query)
      if (tags.length === 0) return []

      const related = matrix.expandTags(tags, 2, 0.7)
      return related.slice(0, k).map((r) => ({
        tag: r.tag2,
        score: r.weight
      }))
    }

    return []
  }

  /**
   * 应用 TagBoost
   */
  applyTagBoost(
    vector: Float32Array | number[],
    _tagBoost: number
  ): { vector: Float32Array; info: NativeTagBoostInfo | null } {
    const queryTags = this.tagMemoService.extractTagsFromQuery('')
    const vectorBoost = this.tagMemoService.computeVectorBoost(Array.from(vector), queryTags)

    return {
      vector: new Float32Array(vectorBoost.boostedVector),
      info: {
        matchedTags: vectorBoost.matchedTags,
        boostFactor: vectorBoost.alpha,
        spikeCount: vectorBoost.matchedTags.length,
        totalSpikeScore: vectorBoost.totalBoostScore
      }
    }
  }

  /**
   * 获取日记名称向量
   */
  async getDiaryNameVector(diaryName: string): Promise<number[] | null> {
    if (!this.embeddings) {
      return null
    }

    try {
      return await this.embeddings.embedQuery(diaryName)
    } catch {
      return null
    }
  }

  /**
   * 获取共现矩阵
   */
  getCooccurrenceMatrix(): CooccurrenceMatrix | null {
    return this.tagMemoService.getCooccurrenceMatrix()
  }

  // ==================== 日记 API ====================

  /**
   * 获取可用的日记本列表
   */
  async getAvailableDiaries(): Promise<string[]> {
    if (!fs.existsSync(this.config.rootPath)) {
      return []
    }

    try {
      const entries = fs.readdirSync(this.config.rootPath, { withFileTypes: true })
      return entries
        .filter((e) => e.isDirectory())
        .filter((e) => !this.config.ignoreFolders?.includes(e.name))
        .filter((e) => !this.config.ignorePrefixes?.some((p) => e.name.startsWith(p)))
        .map((e) => e.name)
    } catch {
      return []
    }
  }

  /**
   * 获取笔记服务
   */
  getNoteService(): NoteService {
    return this.noteService
  }

  // ==================== 索引管理 ====================

  /**
   * 重建索引
   */
  async rebuildIndex(): Promise<void> {
    logger.info('Rebuilding index...')

    const documents = await this._getSearchableDocuments()

    // 重建 TagMemo
    const docs = documents.map((d) => ({ id: d.id, tags: d.tags }))
    await this.tagMemoService.initialize(docs)

    // 保存索引状态
    this.indexedFiles = new Set(documents.map((d) => d.sourceFile))
    this.lastIndexTime = new Date()
    await this._saveIndexState()

    logger.info('Index rebuilt', { documentCount: documents.length })
  }

  private async _saveIndexState(): Promise<void> {
    const indexPath = path.join(this.config.storePath, 'index-state.json')
    const data = {
      indexedFiles: Array.from(this.indexedFiles),
      lastIndexTime: this.lastIndexTime?.toISOString()
    }

    await fs.promises.writeFile(indexPath, JSON.stringify(data, null, 2))

    // 保存共现矩阵
    const matrixPath = path.join(this.config.storePath, 'cooccurrence-matrix.json')
    const matrix = this.tagMemoService.getCooccurrenceMatrix()
    await fs.promises.writeFile(matrixPath, matrix.toJSON())
  }

  // ==================== 统计 ====================

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    totalFiles: number
    totalChunks: number
    totalTags: number
    diaryCount: number
    tagCooccurrenceSize: number
    isNativeMode: boolean
  }> {
    const diaries = await this.getAvailableDiaries()
    const notes = await this.noteService.listAll()
    const tagMemoStats = this.tagMemoService.getStats()

    return {
      totalFiles: this.indexedFiles.size,
      totalChunks: notes.length,
      totalTags: tagMemoStats.tagCount,
      diaryCount: diaries.length,
      tagCooccurrenceSize: tagMemoStats.relationCount,
      isNativeMode: true // 始终为原生模式
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<NativeKnowledgeConfig>): void {
    Object.assign(this.config, config)
  }

  /**
   * 关闭服务
   */
  async shutdown(): Promise<void> {
    await this._saveIndexState()
    this.initialized = false
    logger.info('NativeKnowledgeService shutdown complete')
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized
  }

  // ==================== 工具方法 ====================

  private _getMarkdownFiles(dirPath: string, depth: number = 1): string[] {
    const files: string[] = []

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)

        if (entry.isFile() && entry.name.endsWith('.md')) {
          // 检查忽略规则
          if (this.config.ignorePrefixes?.some((p) => entry.name.startsWith(p))) continue
          if (this.config.ignoreSuffixes?.some((s) => entry.name.endsWith(s))) continue

          files.push(fullPath)
        } else if (entry.isDirectory() && depth > 1) {
          if (!this.config.ignoreFolders?.includes(entry.name)) {
            files.push(...this._getMarkdownFiles(fullPath, depth - 1))
          }
        }
      }
    } catch {
      // ignore
    }

    return files
  }

  private _extractTagsFromContent(content: string): string[] {
    const tags: string[] = []

    // #tag 格式
    const hashTags = content.match(/#[\w\u4e00-\u9fa5]+/g) || []
    tags.push(...hashTags.map((t) => t.slice(1).toLowerCase()))

    // [tag] 格式
    const bracketTags = content.match(/\[([^\]]+)\]/g) || []
    tags.push(...bracketTags.map((t) => t.slice(1, -1).toLowerCase()))

    // YAML frontmatter tags
    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (yamlMatch) {
      const tagLine = yamlMatch[1].match(/tags?:\s*\[?([^\]\n]+)\]?/i)
      if (tagLine) {
        const yamlTags = tagLine[1].split(/[,，]/).map((t) => t.trim().toLowerCase())
        tags.push(...yamlTags)
      }
    }

    // 过滤黑名单
    const blacklist = new Set(this.config.tagBlacklist?.map((t) => t.toLowerCase()))

    return [...new Set(tags.filter((t) => t.length >= 2 && !blacklist.has(t)))]
  }

  /**
   * 广播 RAG 检索事件到 VCPInfoService (IPC)
   */
  private _broadcastRAGEvent(
    query: string,
    mode: RetrievalMode,
    k: number,
    useTagMemo: boolean,
    tagBoost: number,
    results: NativeSearchResult[]
  ): void {
    try {
      const vcpInfoService = getVCPInfoService()
      const startTime = Date.now()

      // 发送扁平结构，与 RAGObserverPanel 期望的 RAGRetrievalEvent 格式一致
      vcpInfoService.broadcastEvent({
        type: 'RAG_RETRIEVAL_DETAILS',
        dbName: `NativeKnowledge(${mode})`,
        query: query || '[vector query]',
        k,
        useTime: `${Date.now() - startTime}ms`,
        useRerank: false,
        useTagMemo,
        tagWeight: tagBoost,
        results: results.map((r) => ({
          text: r.text.slice(0, 500), // 截断长文本
          score: r.score,
          source: r.sourceFile,
          matchedTags: r.matchedTags
        })),
        timestamp: Date.now()
      })
    } catch (error) {
      // 静默失败，不影响搜索功能
      logger.debug('Failed to broadcast RAG event', { error: String(error) })
    }
  }
}

// ==================== 单例和工厂函数 ====================

let nativeKnowledgeService: NativeKnowledgeService | null = null

/**
 * 获取或创建原生知识库服务
 */
export function getNativeKnowledgeService(config?: Partial<NativeKnowledgeConfig>): NativeKnowledgeService {
  if (!nativeKnowledgeService) {
    nativeKnowledgeService = new NativeKnowledgeService(config)
  } else if (config) {
    nativeKnowledgeService.updateConfig(config)
  }
  return nativeKnowledgeService
}

/**
 * 创建新的原生知识库服务实例
 */
export function createNativeKnowledgeService(config?: Partial<NativeKnowledgeConfig>): NativeKnowledgeService {
  return new NativeKnowledgeService(config)
}

// ==================== 兼容类型别名 (取代 UnifiedKnowledgeAdapter) ====================

/**
 * @deprecated 使用 NativeSearchResult
 */
export type VCPSearchResult = NativeSearchResult

/**
 * @deprecated 使用 NativeTagBoostInfo
 */
export type TagBoostInfo = NativeTagBoostInfo

/**
 * @deprecated 使用 NativeKnowledgeConfig
 */
export type UnifiedKnowledgeConfig = NativeKnowledgeConfig

/**
 * @deprecated 使用 NativeKnowledgeService
 */
export type UnifiedKnowledgeAdapter = NativeKnowledgeService

/**
 * @deprecated 使用 getNativeKnowledgeService()
 */
export const getUnifiedKnowledgeAdapter = getNativeKnowledgeService

/**
 * @deprecated 使用 createNativeKnowledgeService()
 */
export const createUnifiedKnowledgeAdapter = createNativeKnowledgeService

export default NativeKnowledgeService
