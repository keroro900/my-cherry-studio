/**
 * TagMemo - 标签共现增强服务
 *
 * 基于 VCPToolBox KnowledgeBaseManager.js 核心算法:
 * - PMI (Pointwise Mutual Information) 共现矩阵
 * - 动态 Alpha/Beta Tag Boost 算法
 * - 标签扩展与传播
 *
 * 🚀 强制使用 Rust 原生实现 (native-vcp CooccurrenceMatrix)
 * 不提供 TypeScript fallback - 必须有 native 模块支持
 *
 * @author Cherry Studio Team
 * @license MIT
 */

import fs from 'node:fs'
import fsAsync from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { loggerService } from '@logger'
import type { KnowledgeSearchResult } from '@types'

// 延迟导入 electron 以避免模块加载时 electron 未初始化
let electronApp: typeof import('electron').app | undefined
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  electronApp = require('electron').app
} catch {
  // electron 未就绪
}

// 优先使用预加载的原生模块
import {
  isNativeModuleLoaded,
  isFeatureAvailable,
  createNativeCooccurrenceMatrix as preloadedCreateNativeCooccurrenceMatrix
} from '../native'

// 保留旧的导入用于 fallback (兼容性) 和类型
import {
  createNativeCooccurrenceMatrix as legacyCreateNativeCooccurrenceMatrix,
  isCooccurrenceMatrixAvailable as legacyIsCooccurrenceMatrixAvailable,
  type ICooccurrenceMatrix as NativeCooccurrenceMatrix,
  type DocumentInput,
  type TagCooccurrence as NativeTagCooccurrence
} from '../../knowledge/vector/VexusAdapter'

const logger = loggerService.withContext('TagMemo')

// ==================== 原生模块检测 ====================

/**
 * 检查原生 CooccurrenceMatrix 是否可用
 * 优先检查预加载的模块，然后检查传统加载方式
 */
function isCooccurrenceMatrixAvailable(): boolean {
  // 优先检查预加载的模块
  if (isNativeModuleLoaded() && isFeatureAvailable('cooccurrenceMatrix')) {
    return true
  }
  // 回退到传统检测
  return legacyIsCooccurrenceMatrixAvailable()
}

/**
 * 创建原生 CooccurrenceMatrix 实例
 * 优先使用预加载的模块，然后回退到传统加载方式
 */
function createNativeCooccurrenceMatrix(): NativeCooccurrenceMatrix | null {
  // 优先使用预加载的模块
  if (isNativeModuleLoaded() && isFeatureAvailable('cooccurrenceMatrix')) {
    const instance = preloadedCreateNativeCooccurrenceMatrix()
    if (instance) {
      logger.debug('Using preloaded native CooccurrenceMatrix')
      return instance as NativeCooccurrenceMatrix
    }
  }
  // 回退到传统加载方式
  const legacyInstance = legacyCreateNativeCooccurrenceMatrix()
  if (legacyInstance) {
    logger.debug('Using legacy native CooccurrenceMatrix')
  }
  return legacyInstance
}

// ==================== 持久化配置 ====================

const PERSISTENCE_DEBOUNCE_MS = 5000 // 5秒后自动保存
const PERSISTENCE_FILENAME = 'tagmemo-cooccurrence.json'

/**
 * 获取持久化文件路径
 */
function getPersistencePath(): string {
  const userDataPath = electronApp ? electronApp.getPath('userData') : path.join(os.tmpdir(), 'cherry-studio-data')
  const dataPath = path.join(userDataPath, 'Data', 'memory')
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true })
  }
  return path.join(dataPath, PERSISTENCE_FILENAME)
}

// ==================== 类型定义 ====================

export interface TagMemoConfig {
  enabled?: boolean
  /** 最小标签得分阈值 */
  minTagScore?: number
  /** 最大扩展深度 */
  maxExpansionDepth?: number
  /** 共现阈值 */
  cooccurrenceThreshold?: number
  /** 动态 Alpha 范围 [min, max] */
  alphaRange?: [number, number]
  /** 动态 Beta 基础值 */
  betaBase?: number
  /** 标签黑名单 (与 MemoryMaster 共享) */
  tagBlacklist?: string[]
}

export interface TagBoostResult {
  originalScore: number
  boostedScore: number
  matchedTags: string[]
  expansionTags?: string[]
  /** TagMemo 增强因子 */
  boostFactor: number
  /** Tag 匹配总分 (spike score) */
  tagMatchScore: number
  /** 详细的 spike 计算信息 */
  spikeDetails?: Array<{
    tag: string
    weight: number
    globalFreq: number
    score: number
  }>
}

export interface CooccurrenceRelation {
  tag1: string
  tag2: string
  weight: number
  /** PMI 得分 (可选) */
  pmi?: number
}

export interface TagInfo {
  name: string
  frequency: number
  documentCount: number
}

/**
 * 共现矩阵接口
 */
export interface CooccurrenceMatrix {
  /** 添加共现关系 */
  addRelation(tag1: string, tag2: string, weight?: number): void
  /** 从文档批量构建 */
  buildFromDocuments(docs: Array<{ id: string; tags: string[] }>): number
  /** 获取相关标签 */
  getRelatedTags(tag: string, topK?: number, minWeight?: number): CooccurrenceRelation[]
  /** 扩展标签 (多跳) */
  expandTags(seeds: string[], depth?: number, decayFactor?: number): CooccurrenceRelation[]
  /** 获取共现权重 */
  getWeight(tag1: string, tag2: string): number
  /** 获取所有标签 */
  getAllTags(): string[]
  /** 获取标签信息 */
  getTagInfo(tag: string): TagInfo | null
  /** 矩阵大小 */
  size(): number
  /** 总关系数 */
  relationCount(): number
  /** 导出为 JSON */
  toJSON(): string
  /** 从 JSON 导入 */
  fromJSON(json: string): void
  /** 清空矩阵 */
  clear(): void
  /** 设置修改回调 (用于自动持久化) */
  setOnModified?(callback: () => void): void
  /** 检查是否有未保存的修改 */
  hasPendingChanges?(): boolean
  /** 标记已保存 */
  markSaved?(): void
}

/**
 * TagMemo 服务接口
 */
export interface TagMemoService {
  initializeFromSearchResults(results: KnowledgeSearchResult[]): Promise<void>
  extractTagsFromQuery(query: string): string[]
  applyTagBoost<T extends KnowledgeSearchResult>(
    query: string,
    tags: string[],
    results: T[]
  ): Promise<(T & { tagMemoResult?: TagBoostResult })[]>
  getCooccurrenceMatrix(): CooccurrenceMatrix
  getStats(): TagMemoStats
  isNativeMode(): boolean
  initialize(docs: Array<{ id: string; tags: string[] }>): Promise<void>
  /** 计算向量增强 (用于向量搜索预处理) */
  computeVectorBoost(vector: number[], queryTags: string[]): VectorBoostResult
  /** 注册单个标签 (用于 MemoryMaster AI 生成的标签同步) */
  registerTag(tag: string): void
  /** 注册多个标签 (批量版本) */
  registerTags(tags: string[]): void
  /** 检查标签是否在黑名单中 */
  isTagBlacklisted(tag: string): boolean
  /** 过滤黑名单标签 */
  filterBlacklistedTags(tags: string[]): string[]
  /** 设置标签黑名单 */
  setBlacklist(tags: string[]): void
  /** 获取标签黑名单 */
  getBlacklist(): string[]
  /** 清理资源 (可选) */
  dispose?(): void
}

export interface TagMemoStats {
  mode: 'native' | 'stub'
  tagCount: number
  relationCount: number
  documentCount: number
}

export interface VectorBoostResult {
  /** 增强后的向量 */
  boostedVector: number[]
  /** 匹配的标签 */
  matchedTags: string[]
  /** 动态 Alpha */
  alpha: number
  /** 动态 Beta */
  beta: number
  /** 总增强分数 */
  totalBoostScore: number
}

// ==================== Native 共现矩阵适配器 ====================

/**
 * Native CooccurrenceMatrix 适配器
 *
 * 将 Rust 原生 CooccurrenceMatrix 适配到 TypeScript CooccurrenceMatrix 接口
 * 用于高性能的标签共现计算
 */
class NativeCooccurrenceMatrixAdapter implements CooccurrenceMatrix {
  private native: NativeCooccurrenceMatrix
  private onModified?: () => void
  private isDirty = false
  private pendingDocs: DocumentInput[] = []

  constructor(nativeMatrix: NativeCooccurrenceMatrix) {
    this.native = nativeMatrix
    logger.info('Using Native CooccurrenceMatrix (Rust NPMI)')
  }

  setOnModified(callback: () => void): void {
    this.onModified = callback
  }

  private notifyModified(): void {
    this.isDirty = true
    this.onModified?.()
  }

  hasPendingChanges(): boolean {
    return this.isDirty
  }

  markSaved(): void {
    this.isDirty = false
  }

  addRelation(tag1: string, tag2: string, _weight = 1): void {
    // Native doesn't support direct addRelation with weight, accumulate as single-doc batch
    // Weight is ignored in native mode (all relations treated as weight=1)
    const normalizedTag1 = tag1.toLowerCase().trim()
    const normalizedTag2 = tag2.toLowerCase().trim()
    if (normalizedTag1 && normalizedTag2 && normalizedTag1 !== normalizedTag2) {
      // Create a pseudo-document with these two tags
      const docId = `relation_${Date.now()}_${Math.random().toString(36).slice(2)}`
      this.pendingDocs.push({ id: docId, tags: [normalizedTag1, normalizedTag2] })

      // Batch rebuild periodically (every 100 relations)
      if (this.pendingDocs.length >= 100) {
        this.flushPendingDocs()
      }
      this.notifyModified()
    }
  }

  private flushPendingDocs(): void {
    if (this.pendingDocs.length > 0) {
      this.native.buildFromDocuments(this.pendingDocs)
      this.pendingDocs = []
    }
  }

  buildFromDocuments(docs: Array<{ id: string; tags: string[] }>): number {
    // Combine with pending docs
    const allDocs = [...this.pendingDocs, ...docs]
    this.pendingDocs = []
    const result = this.native.buildFromDocuments(allDocs)
    this.notifyModified()
    return result
  }

  getRelatedTags(tag: string, topK = 10, minWeight = 0): CooccurrenceRelation[] {
    this.flushPendingDocs() // Ensure pending relations are included
    const nativeResults = this.native.getRelatedTags(tag.toLowerCase().trim(), topK, minWeight)
    return nativeResults.map((r: NativeTagCooccurrence) => ({
      tag1: tag.toLowerCase().trim(),
      tag2: r.tag2,
      weight: r.weight,
      pmi: r.count // Native stores PMI in count field
    }))
  }

  expandTags(seeds: string[], depth = 2, decayFactor = 0.7): CooccurrenceRelation[] {
    this.flushPendingDocs()
    const nativeResults = this.native.expandTags(
      seeds.map((s) => s.toLowerCase()),
      depth,
      decayFactor
    )
    return nativeResults.map((r: NativeTagCooccurrence) => ({
      tag1: r.tag1,
      tag2: r.tag2,
      weight: r.weight,
      pmi: r.count
    }))
  }

  getWeight(tag1: string, tag2: string): number {
    this.flushPendingDocs()
    return this.native.getCooccurrence(tag1.toLowerCase(), tag2.toLowerCase())
  }

  getAllTags(): string[] {
    this.flushPendingDocs()
    return this.native.getAllTags()
  }

  getTagInfo(tag: string): TagInfo | null {
    this.flushPendingDocs()
    const nativeInfo = this.native.getTagInfo(tag.toLowerCase())
    if (!nativeInfo) return null
    return {
      name: nativeInfo.name,
      frequency: nativeInfo.frequency,
      documentCount: nativeInfo.frequency // Native doesn't track doc count separately
    }
  }

  size(): number {
    return this.native.tagCount()
  }

  relationCount(): number {
    // Estimate: each tag has ~5 relations on average
    return this.native.tagCount() * 5
  }

  toJSON(): string {
    this.flushPendingDocs()
    return this.native.toJson()
  }

  fromJSON(_json: string): void {
    // Native doesn't support fromJSON, log warning
    logger.warn('Native CooccurrenceMatrix does not support fromJSON, data will be rebuilt on next initialization')
  }

  clear(): void {
    // Native doesn't have clear, create new instance would be needed
    // For now, just clear pending docs
    this.pendingDocs = []
    logger.warn('Native CooccurrenceMatrix clear() is a no-op, consider rebuilding')
  }
}

// ==================== TagMemo 服务实现 ====================

/**
 * TagMemo 服务 - 标签共现增强
 *
 * 核心算法来源: VCPToolBox _applyTagBoost
 * - 动态 Alpha: 基于平均标签得分调整增强强度 [1.5, 3.5]
 * - 动态 Beta: 模糊查询时提高降噪常数
 * - 共现传播: 通过共现矩阵扩展相关标签
 * - 自动持久化: debounced 保存到磁盘
 */
class NativeTagMemoServiceImpl implements TagMemoService {
  private matrix: CooccurrenceMatrix
  private config: Required<Omit<TagMemoConfig, 'tagBlacklist'>> & { tagBlacklist: string[] }
  private documentCount = 0
  /** 标签向量缓存 (可选，用于向量级增强) */
  private tagVectorCache: Map<string, number[]> = new Map()
  /** 持久化定时器 */
  private saveTimer: NodeJS.Timeout | null = null
  /** 自学习服务 (懒加载) */
  private selfLearningService: import('./SelfLearningService').SelfLearningService | null = null
  /** 是否使用 Native 实现 */
  private useNativeMatrix = false
  /** 黑名单缓存 (Set 便于快速查找) */
  private blacklistSet: Set<string> = new Set()

  constructor(config: TagMemoConfig = {}) {
    // 必须使用 Native CooccurrenceMatrix (Rust 层)
    if (!isCooccurrenceMatrixAvailable()) {
      throw new Error('TagMemoService requires native CooccurrenceMatrix (native-vcp module not available)')
    }

    const nativeMatrix = createNativeCooccurrenceMatrix()
    if (!nativeMatrix) {
      throw new Error('Failed to create native CooccurrenceMatrix instance')
    }

    this.matrix = new NativeCooccurrenceMatrixAdapter(nativeMatrix)
    this.useNativeMatrix = true
    logger.info('TagMemoService using Native CooccurrenceMatrix (Rust NPMI)')

    this.config = {
      enabled: config.enabled ?? true,
      minTagScore: config.minTagScore ?? 0.3,
      maxExpansionDepth: config.maxExpansionDepth ?? 2,
      cooccurrenceThreshold: config.cooccurrenceThreshold ?? 0.3,
      alphaRange: config.alphaRange ?? [1.5, 3.5],
      betaBase: config.betaBase ?? 2,
      tagBlacklist: config.tagBlacklist ?? []
    }

    // 初始化黑名单缓存
    this.rebuildBlacklistCache()

    // 设置修改回调 - debounced 自动保存
    this.matrix.setOnModified?.(() => {
      this.scheduleSave()
    })

    // 延迟初始化自学习服务 (避免循环依赖)
    setTimeout(() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getSelfLearningService } = require('./SelfLearningService')
        this.selfLearningService = getSelfLearningService()
        logger.debug('SelfLearningService integrated with TagMemo')
      } catch {
        logger.debug('SelfLearningService not available')
      }
    }, 1000)

    logger.info('NativeTagMemoService initialized (Rust native only)', {
      mode: 'native'
    })
  }

  /**
   * 调度保存 (debounced)
   */
  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
    }
    this.saveTimer = setTimeout(() => {
      this.saveToDisk()
    }, PERSISTENCE_DEBOUNCE_MS)
  }

  /**
   * 保存到磁盘
   */
  private async saveToDisk(): Promise<void> {
    if (this.matrix.hasPendingChanges && !this.matrix.hasPendingChanges()) {
      return
    }

    try {
      const filePath = getPersistencePath()
      const json = this.matrix.toJSON()
      await fsAsync.writeFile(filePath, json, 'utf-8')
      this.matrix.markSaved?.()
      logger.debug('Saved cooccurrence matrix to disk', {
        path: filePath,
        tags: this.matrix.size(),
        relations: this.matrix.relationCount()
      })
    } catch (error) {
      logger.error('Failed to save cooccurrence matrix', error as Error)
    }
  }

  /**
   * 强制保存 (用于应用退出前)
   */
  async forceSave(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    await this.saveToDisk()
  }

  /**
   * 从搜索结果初始化共现矩阵
   */
  async initializeFromSearchResults(results: KnowledgeSearchResult[]): Promise<void> {
    const docs: Array<{ id: string; tags: string[] }> = []

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const tags = this.extractTagsFromContent(result.pageContent)

      if (tags.length > 0) {
        docs.push({
          id: `result_${i}`,
          tags
        })
      }
    }

    this.matrix.buildFromDocuments(docs)
    this.documentCount = docs.length
    logger.debug('Initialized from search results', { resultCount: results.length, docsWithTags: docs.length })
  }

  /**
   * 从查询中提取标签
   */
  extractTagsFromQuery(query: string): string[] {
    const tags: string[] = []

    // 1. 提取 #tag 格式
    const hashTags = query.match(/#[\w\u4e00-\u9fa5]+/g) || []
    tags.push(...hashTags.map((t) => t.slice(1).toLowerCase()))

    // 2. 提取中括号内容 [tag]
    const bracketTags = query.match(/\[([^\]]+)\]/g) || []
    tags.push(...bracketTags.map((t) => t.slice(1, -1).toLowerCase()))

    // 3. 分词 (中英文混合)
    const words = query
      .replace(/#[\w\u4e00-\u9fa5]+/g, '') // 移除已处理的 hashtag
      .replace(/\[[^\]]+\]/g, '') // 移除已处理的方括号
      .split(/[\s,，、;；：:!！?？.。]+/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length >= 2 && w.length <= 20)

    tags.push(...words)

    // 去重
    return [...new Set(tags)]
  }

  /**
   * 从内容中提取标签
   */
  private extractTagsFromContent(content: string): string[] {
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

    return [...new Set(tags.filter((t) => t.length >= 2))]
  }

  /**
   * 应用 TagMemo 增强
   *
   * 核心算法来源: VCPToolBox _applyTagBoost
   */
  async applyTagBoost<T extends KnowledgeSearchResult>(
    _query: string,
    tags: string[],
    results: T[]
  ): Promise<(T & { tagMemoResult?: TagBoostResult })[]> {
    if (!this.config.enabled || tags.length === 0 || results.length === 0) {
      return results
    }

    // 扩展标签 (通过共现矩阵)
    const expandedTags = this.matrix.expandTags(tags, this.config.maxExpansionDepth, 0.7)

    // 计算动态参数
    const tagScores = tags.map((t) => {
      const info = this.matrix.getTagInfo(t)
      return info ? info.frequency / (this.documentCount || 1) : 0
    })
    const avgScore = tagScores.length > 0 ? tagScores.reduce((a, b) => a + b, 0) / tagScores.length : 0

    // 动态 Alpha: [1.5, 3.5] 映射自 avgScore [0, 1]
    const [alphaMin, alphaMax] = this.config.alphaRange
    const dynamicAlpha = Math.min(alphaMax, Math.max(alphaMin, alphaMin + (alphaMax - alphaMin) * avgScore))

    // 动态 Beta: 模糊查询时提高降噪
    const dynamicBeta = this.config.betaBase + (1 - avgScore) * 3

    logger.debug('TagMemo boost params', {
      avgScore: avgScore.toFixed(3),
      alpha: dynamicAlpha.toFixed(3),
      beta: dynamicBeta.toFixed(3),
      queryTags: tags.length,
      expandedTags: expandedTags.length
    })

    return results.map((result) => {
      const contentTags = this.extractTagsFromContent(result.pageContent)
      const contentTagSet = new Set(contentTags)

      // 直接匹配
      const directMatches = tags.filter((t) => contentTagSet.has(t.toLowerCase()))

      // 扩展匹配
      const expansionMatches = expandedTags.filter((r) => contentTagSet.has(r.tag2)).map((r) => r.tag2)

      if (directMatches.length === 0 && expansionMatches.length === 0) {
        return result
      }

      // 计算增强分数 - 同步 VCPToolBox _applyTagBoost 核心算法
      // 💡 指数级毛刺增强 + 对数级降噪

      let totalSpikeScore = 0
      const spikeDetails: Array<{ tag: string; weight: number; globalFreq: number; score: number }> = []

      // 处理直接匹配标签
      for (const tag of directMatches) {
        const tagInfo = this.matrix.getTagInfo(tag)
        const coWeight = tagInfo?.frequency || 1
        const globalFreq = tagInfo?.documentCount || 1

        // 1. 基础强度：共现权重的 Alpha 次方 (指数级增强)
        const logicStrength = Math.pow(coWeight, dynamicAlpha)

        // 2. 降噪因子：全局频率的对数 (动态 Beta 降噪)
        const noisePenalty = Math.log(globalFreq + dynamicBeta)

        // 3. 最终得分
        let score = noisePenalty > 0 ? logicStrength / noisePenalty : logicStrength
        if (!isFinite(score) || isNaN(score)) score = 0

        totalSpikeScore += score
        spikeDetails.push({ tag, weight: coWeight, globalFreq, score })
      }

      // 处理扩展匹配标签 (权重衰减 50%)
      for (const tag of expansionMatches) {
        const tagInfo = this.matrix.getTagInfo(tag)
        const coWeight = (tagInfo?.frequency || 1) * 0.5 // 扩展标签权重衰减
        const globalFreq = tagInfo?.documentCount || 1

        const logicStrength = Math.pow(coWeight, dynamicAlpha)
        const noisePenalty = Math.log(globalFreq + dynamicBeta)

        let score = noisePenalty > 0 ? logicStrength / noisePenalty : logicStrength
        if (!isFinite(score) || isNaN(score)) score = 0

        totalSpikeScore += score * 0.5 // 扩展匹配额外衰减
        spikeDetails.push({ tag, weight: coWeight, globalFreq, score: score * 0.5 })
      }

      // 归一化 spike 分数 (防止极端值)
      // 使用 sigmoid 变体将 spike 映射到 [0, 1] 区间
      const normalizedSpike = totalSpikeScore / (totalSpikeScore + dynamicBeta * 2)
      const boostFactor = 1 + normalizedSpike * 0.5 // 最多提升 50%

      // 计算最终分数
      const boostedScore = Math.min(result.score * boostFactor, 1.0)

      return {
        ...result,
        score: boostedScore,
        tagMemoResult: {
          originalScore: result.score,
          boostedScore,
          matchedTags: directMatches,
          expansionTags: expansionMatches,
          boostFactor,
          tagMatchScore: totalSpikeScore,
          spikeDetails // 新增：详细的 spike 计算信息
        }
      }
    })
  }

  /**
   * 计算向量级增强 (用于向量搜索预处理)
   *
   * 同步 VCPToolBox _applyTagBoost 向量融合算法:
   * 1. 指数级毛刺增强计算权重
   * 2. 对数级降噪惩罚高频标签
   * 3. 加权平均构建上下文向量
   * 4. 与原向量融合并归一化
   */
  computeVectorBoost(vector: number[], queryTags: string[], tagBoost = 0.3): VectorBoostResult {
    if (!this.config.enabled || queryTags.length === 0) {
      return {
        boostedVector: vector,
        matchedTags: [],
        alpha: 0,
        beta: 0,
        totalBoostScore: 0
      }
    }

    // 获取标签向量并计算权重
    const tagVectorsWithWeight: Array<{ vec: number[]; weight: number; tag: string }> = []
    const matchedTags: string[] = []

    // 计算动态参数
    const tagScores = queryTags.map((t) => {
      const info = this.matrix.getTagInfo(t)
      return info ? info.frequency / (this.documentCount || 1) : 0
    })
    const avgScore = tagScores.length > 0 ? tagScores.reduce((a, b) => a + b, 0) / tagScores.length : 0

    const [alphaMin, alphaMax] = this.config.alphaRange
    const alpha = Math.min(alphaMax, Math.max(alphaMin, alphaMin + (alphaMax - alphaMin) * avgScore))
    const beta = this.config.betaBase + (1 - avgScore) * 3

    // 收集标签向量并计算 spike 权重
    let totalSpikeScore = 0
    for (const tag of queryTags) {
      const tagVec = this.tagVectorCache.get(tag.toLowerCase())
      if (!tagVec) continue

      const tagInfo = this.matrix.getTagInfo(tag)
      const coWeight = tagInfo?.frequency || 1
      const globalFreq = tagInfo?.documentCount || 1

      // 💡 VCPToolBox 核心算法：指数级毛刺 + 对数降噪
      const logicStrength = Math.pow(coWeight, alpha)
      const noisePenalty = Math.log(globalFreq + beta)
      let score = noisePenalty > 0 ? logicStrength / noisePenalty : logicStrength
      if (!isFinite(score) || isNaN(score)) score = 0

      // 🎓 自学习权重增强：根据用户查询频率和反馈调整
      if (this.selfLearningService) {
        const learnedWeight = this.selfLearningService.getLearnedWeight(tag)
        score *= learnedWeight
      }

      tagVectorsWithWeight.push({ vec: tagVec, weight: score, tag })
      matchedTags.push(tag)
      totalSpikeScore += score
    }

    if (tagVectorsWithWeight.length === 0) {
      return {
        boostedVector: vector,
        matchedTags: [],
        alpha,
        beta,
        totalBoostScore: 0
      }
    }

    // 构建加权上下文向量
    const dim = vector.length
    const contextVec = new Array(dim).fill(0)

    for (const { vec, weight } of tagVectorsWithWeight) {
      for (let i = 0; i < dim && i < vec.length; i++) {
        contextVec[i] += vec[i] * weight
      }
    }

    // 归一化上下文向量
    if (totalSpikeScore > 0) {
      let mag = 0
      for (let i = 0; i < dim; i++) {
        contextVec[i] /= totalSpikeScore
        mag += contextVec[i] * contextVec[i]
      }
      mag = Math.sqrt(mag)
      if (mag > 1e-9) {
        for (let i = 0; i < dim; i++) {
          contextVec[i] /= mag
        }
      }
    }

    // 向量融合: fused = (1 - boost) * original + boost * context
    const boostedVector = vector.map((v, i) => {
      return (1 - tagBoost) * v + tagBoost * (contextVec[i] || 0)
    })

    // 最终归一化
    let fusedMag = 0
    for (let i = 0; i < dim; i++) {
      fusedMag += boostedVector[i] * boostedVector[i]
    }
    fusedMag = Math.sqrt(fusedMag)
    const normalizedVector = fusedMag > 1e-9 ? boostedVector.map((v) => v / fusedMag) : boostedVector

    return {
      boostedVector: normalizedVector,
      matchedTags,
      alpha,
      beta,
      totalBoostScore: totalSpikeScore
    }
  }

  /**
   * 缓存标签向量 (可选)
   */
  setTagVector(tag: string, vector: number[]): void {
    this.tagVectorCache.set(tag.toLowerCase(), vector)
  }

  getCooccurrenceMatrix(): CooccurrenceMatrix {
    return this.matrix
  }

  getStats(): TagMemoStats {
    return {
      mode: this.useNativeMatrix ? 'native' : 'stub',
      tagCount: this.matrix.size(),
      relationCount: this.matrix.relationCount(),
      documentCount: this.documentCount
    }
  }

  isNativeMode(): boolean {
    return this.useNativeMatrix
  }

  async initialize(docs: Array<{ id: string; tags: string[] }>): Promise<void> {
    this.matrix.buildFromDocuments(docs)
    this.documentCount = docs.length
    logger.info('TagMemo initialized', { docs: docs.length, tags: this.matrix.size() })
  }

  /**
   * 注册单个标签
   * 用于 MemoryMaster AI 生成的标签同步
   */
  registerTag(tag: string): void {
    if (!tag || tag.trim().length === 0) return

    const normalizedTag = tag.trim().toLowerCase()

    // 检查黑名单
    if (this.isTagBlacklisted(normalizedTag)) {
      logger.debug('Tag registration blocked by blacklist', { tag: normalizedTag })
      return
    }

    // 自关联权重设为小值，主要目的是注册标签存在
    this.matrix.addRelation(normalizedTag, normalizedTag, 0.1)
    logger.debug('Tag registered', { tag: normalizedTag })
  }

  /**
   * 注册多个标签 (批量版本)
   * 同时建立标签间的共现关系
   */
  registerTags(tags: string[]): void {
    if (!tags || tags.length === 0) return

    const normalizedTags = tags
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0)
      .filter((t) => !this.isTagBlacklisted(t)) // 过滤黑名单标签

    // 注册每个标签并建立共现关系
    for (let i = 0; i < normalizedTags.length; i++) {
      for (let j = i + 1; j < normalizedTags.length; j++) {
        this.matrix.addRelation(normalizedTags[i], normalizedTags[j], 1)
      }
    }

    logger.debug('Tags registered', { count: normalizedTags.length })
  }

  // ==================== 标签黑名单管理 ====================

  /**
   * 重建黑名单缓存
   */
  private rebuildBlacklistCache(): void {
    this.blacklistSet.clear()
    for (const tag of this.config.tagBlacklist) {
      this.blacklistSet.add(tag.toLowerCase().trim())
    }
  }

  /**
   * 检查标签是否在黑名单中
   */
  isTagBlacklisted(tag: string): boolean {
    return this.blacklistSet.has(tag.toLowerCase().trim())
  }

  /**
   * 过滤黑名单标签
   */
  filterBlacklistedTags(tags: string[]): string[] {
    return tags.filter((t) => !this.isTagBlacklisted(t))
  }

  /**
   * 设置标签黑名单
   */
  setBlacklist(tags: string[]): void {
    this.config.tagBlacklist = tags.map((t) => t.toLowerCase().trim()).filter(Boolean)
    this.rebuildBlacklistCache()
    logger.debug('Blacklist updated', { size: this.blacklistSet.size })
  }

  /**
   * 获取标签黑名单
   */
  getBlacklist(): string[] {
    return [...this.config.tagBlacklist]
  }
}

// ==================== 单例管理 ====================

let tagMemoServiceInstance: TagMemoService | null = null

/**
 * 获取 TagMemo 服务单例
 * 确保全局只有一个 TagMemo 实例，避免学习数据分散
 */
export function getTagMemoService(config?: TagMemoConfig): TagMemoService {
  if (!tagMemoServiceInstance) {
    tagMemoServiceInstance = new NativeTagMemoServiceImpl(config)
    logger.info('TagMemoService singleton created')
  }
  return tagMemoServiceInstance
}

/**
 * 重置 TagMemo 服务单例 (仅用于测试)
 */
export function resetTagMemoService(): void {
  if (tagMemoServiceInstance) {
    tagMemoServiceInstance.dispose?.()
    tagMemoServiceInstance = null
    logger.info('TagMemoService singleton reset')
  }
}

// ==================== 导出 ====================

/**
 * 创建 TagMemo 服务
 * @deprecated 请使用 getTagMemoService() 获取单例，避免多实例导致学习数据分散
 */
export function createTagMemoService(config?: TagMemoConfig): TagMemoService {
  logger.warn('createTagMemoService is deprecated, use getTagMemoService() for singleton')
  return new NativeTagMemoServiceImpl(config)
}

// 导出类 (用于类型和继承)
export const NativeTagMemoService = NativeTagMemoServiceImpl

// 兼容旧名称
export const SimpleTagMemoService = NativeTagMemoServiceImpl
