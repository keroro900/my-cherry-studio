/**
 * SemanticGroupService - 语义组查询扩展服务
 *
 * 移植自 VCPToolBox LightMemo + SemanticGroupManager:
 * - 基于预定义的语义组扩展查询关键词
 * - 支持同义词和相关词扩展
 * - 提高搜索召回率
 * - 向量预计算和磁盘缓存
 * - Hash-based 变更检测
 * - 动态权重向量融合
 *
 * @author Cherry Studio Team
 */

import crypto from 'node:crypto'
import * as fs from 'node:fs'
import os from 'node:os'
import * as path from 'node:path'

import { loggerService } from '@logger'

// 延迟导入 electron 以避免模块加载时 electron 未初始化
let electronApp: typeof import('electron').app | undefined
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  electronApp = require('electron').app
} catch {
  // electron 未就绪
}

const logger = loggerService.withContext('SemanticGroupService')

// ==================== 类型定义 ====================

/**
 * 语义组定义
 */
export interface SemanticGroup {
  /** 组名 */
  name: string
  /** 组内词语列表 */
  words: string[]
  /** 自动学习的词语 */
  autoLearned?: string[]
  /** 描述 */
  description?: string
  /** 组权重 (默认 1.0) */
  weight?: number
  /** 向量 ID (用于磁盘缓存) */
  vectorId?: string
  /** 词元 hash (用于变更检测) */
  wordsHash?: string
  /** 最后激活时间 */
  lastActivated?: string
  /** 激活次数 */
  activationCount?: number
}

/**
 * 激活的语义组信息
 */
export interface ActivatedGroup {
  /** 激活强度 (0-1) */
  strength: number
  /** 匹配的词语 */
  matchedWords: string[]
  /** 组内所有词语 */
  allWords: string[]
}

/**
 * 语义组配置
 */
export interface SemanticGroupConfig {
  /** 启用语义组扩展 */
  enabled: boolean
  /** 最大扩展词数量 */
  maxExpandedWords: number
  /** 启用向量预计算 */
  vectorPrecomputation: boolean
  /** 语义组列表 */
  groups: Record<string, SemanticGroup>
}

/**
 * 嵌入函数类型
 */
export type EmbeddingFunction = (text: string) => Promise<number[] | null>

// ==================== 默认语义组 ====================

const DEFAULT_SEMANTIC_GROUPS: Record<string, SemanticGroup> = {
  // 情感相关
  emotion_positive: {
    name: '正面情感',
    words: ['开心', '高兴', '快乐', '满足', '幸福', 'happy', 'glad', 'joyful', '满意', '愉快'],
    description: '正面情感词汇'
  },
  emotion_negative: {
    name: '负面情感',
    words: ['难过', '伤心', '失望', '沮丧', '焦虑', 'sad', 'upset', 'anxious', '担心', '烦恼'],
    description: '负面情感词汇'
  },

  // 时间相关
  time_recent: {
    name: '近期时间',
    words: ['今天', '昨天', '前天', '最近', '近期', 'today', 'yesterday', 'recently', '这几天', '这周'],
    description: '近期时间词汇'
  },
  time_past: {
    name: '过去时间',
    words: ['之前', '以前', '过去', '曾经', '去年', 'before', 'ago', 'past', '上次', '那时候'],
    description: '过去时间词汇'
  },

  // 工作相关
  work: {
    name: '工作',
    words: ['工作', '项目', '任务', '会议', '开发', 'work', 'project', 'task', 'meeting', '进度'],
    description: '工作相关词汇'
  },

  // 学习相关
  learning: {
    name: '学习',
    words: ['学习', '笔记', '知识', '理解', '掌握', 'learn', 'study', 'note', '教程', '资料'],
    description: '学习相关词汇'
  },

  // 技术相关
  tech_frontend: {
    name: '前端技术',
    words: ['React', 'Vue', 'Angular', 'JavaScript', 'TypeScript', 'CSS', 'HTML', '前端', 'Svelte', 'Next.js'],
    description: '前端技术词汇'
  },
  tech_backend: {
    name: '后端技术',
    words: ['Node.js', 'Python', 'Java', 'Go', 'Rust', '后端', 'API', '数据库', 'SQL', 'FastAPI'],
    description: '后端技术词汇'
  },
  tech_ai: {
    name: 'AI技术',
    words: ['AI', '人工智能', '机器学习', '深度学习', 'GPT', 'Claude', '模型', 'LLM', '向量', '嵌入'],
    description: 'AI相关词汇'
  }
}

// ==================== SemanticGroupService ====================

export class SemanticGroupService {
  private static instance: SemanticGroupService

  /** 配置 */
  private config: SemanticGroupConfig = {
    enabled: true,
    maxExpandedWords: 10,
    vectorPrecomputation: true,
    groups: DEFAULT_SEMANTIC_GROUPS
  }

  /** 词语到组的映射 (用于快速查找) */
  private wordToGroupMap: Map<string, string[]> = new Map()

  /** 组向量缓存 (内存) */
  private groupVectorCache: Map<string, number[]> = new Map()

  /** 嵌入函数 (延迟注入) */
  private embeddingFunction: EmbeddingFunction | null = null

  /** 数据目录 */
  private dataDir: string

  /** 向量目录 */
  private vectorsDir: string

  /** 保存锁 (防止并发写入) */
  private saveLock = false

  private constructor() {
    const userDataPath = electronApp ? electronApp.getPath('userData') : path.join(os.tmpdir(), 'cherry-studio-data')
    this.dataDir = path.join(userDataPath, 'Data', 'semantic-groups')
    this.vectorsDir = path.join(this.dataDir, 'vectors')
    this.ensureDataDir()
    this.loadConfig()
    this.buildWordToGroupMap()
    logger.info('SemanticGroupService initialized', { groupCount: Object.keys(this.config.groups).length })
  }

  static getInstance(): SemanticGroupService {
    if (!SemanticGroupService.instance) {
      SemanticGroupService.instance = new SemanticGroupService()
    }
    return SemanticGroupService.instance
  }

  /**
   * 设置嵌入函数 (用于向量预计算)
   */
  setEmbeddingFunction(fn: EmbeddingFunction): void {
    this.embeddingFunction = fn
    logger.info('Embedding function set')
  }

  // ==================== 向量预计算功能 ====================

  /**
   * 计算词元列表的 hash (用于变更检测)
   */
  private getWordsHash(words: string[]): string | undefined {
    if (!words || words.length === 0) return undefined
    const sortedWords = [...words].sort()
    return crypto.createHash('sha256').update(JSON.stringify(sortedWords)).digest('hex')
  }

  /**
   * 预计算所有组的向量
   */
  async precomputeGroupVectors(): Promise<boolean> {
    if (!this.embeddingFunction) {
      logger.warn('Cannot precompute vectors: embedding function not set')
      return false
    }

    if (!this.config.vectorPrecomputation) {
      logger.debug('Vector precomputation is disabled')
      return false
    }

    logger.info('Starting group vector precomputation...')
    let changesMade = false

    for (const [groupId, group] of Object.entries(this.config.groups)) {
      const allWords = [...group.words, ...(group.autoLearned || [])]

      // 处理空词元组
      if (allWords.length === 0) {
        if (group.vectorId) {
          logger.debug(`Group "${groupId}" has no words, cleaning up vector...`)
          await this.deleteVectorFile(group.vectorId)
          delete group.vectorId
          delete group.wordsHash
          this.groupVectorCache.delete(groupId)
          changesMade = true
        }
        continue
      }

      const currentHash = this.getWordsHash(allWords)
      const vectorExists = this.groupVectorCache.has(groupId)

      // 检查是否需要重新计算
      if (currentHash !== group.wordsHash || !vectorExists) {
        if (!vectorExists) {
          logger.debug(`Group "${groupId}" vector not cached, computing...`)
        } else {
          logger.debug(`Group "${groupId}" words changed, recomputing...`)
        }

        // 生成组描述并计算向量
        const groupDescription = `${group.name}相关主题：${allWords.join(', ')}`
        const vector = await this.embeddingFunction(groupDescription)

        if (vector) {
          // 清理旧向量文件
          if (group.vectorId) {
            await this.deleteVectorFile(group.vectorId)
          }

          // 保存新向量
          const vectorId = crypto.randomUUID()
          await this.saveVectorFile(vectorId, vector)

          this.groupVectorCache.set(groupId, vector)
          group.vectorId = vectorId
          group.wordsHash = currentHash
          changesMade = true

          logger.debug(`Computed and saved vector for "${groupId}" (ID: ${vectorId})`)
        }
      }
    }

    if (changesMade) {
      logger.info('Vector changes detected, saving config...')
      this.saveConfig()
    } else {
      logger.debug('All group vectors are up to date')
    }

    return changesMade
  }

  /**
   * 加载所有组的向量
   */
  async loadGroupVectors(): Promise<void> {
    for (const [groupId, group] of Object.entries(this.config.groups)) {
      if (group.vectorId) {
        try {
          const vector = await this.loadVectorFile(group.vectorId)
          if (vector) {
            this.groupVectorCache.set(groupId, vector)
          }
        } catch (error) {
          logger.warn(`Failed to load vector for group "${groupId}"`, { vectorId: group.vectorId })
          // 清除无效的 vectorId
          delete group.vectorId
        }
      }
    }
    logger.info('Group vectors loaded', { cachedCount: this.groupVectorCache.size })
  }

  /**
   * 检测并激活语义组
   */
  detectAndActivateGroups(text: string): Map<string, ActivatedGroup> {
    const activatedGroups = new Map<string, ActivatedGroup>()

    for (const [groupId, group] of Object.entries(this.config.groups)) {
      const allWords = [...group.words, ...(group.autoLearned || [])]
      const matchedWords = allWords.filter((word) => this.flexibleMatch(text, word))

      if (matchedWords.length > 0) {
        const activationStrength = matchedWords.length / allWords.length
        activatedGroups.set(groupId, {
          strength: activationStrength,
          matchedWords,
          allWords
        })

        // 更新激活统计
        this.updateGroupStats(groupId)
      }
    }

    return activatedGroups
  }

  /**
   * 获取增强的查询向量
   * 将查询向量与激活的语义组向量融合
   */
  async getEnhancedVector(
    originalQuery: string,
    activatedGroups: Map<string, ActivatedGroup>,
    precomputedQueryVector?: number[]
  ): Promise<number[] | undefined> {
    let queryVector = precomputedQueryVector

    if (!queryVector && this.embeddingFunction) {
      logger.debug('Computing query vector...')
      queryVector = await this.embeddingFunction(originalQuery) ?? undefined
    }

    if (!queryVector) {
      logger.warn('Query vector is undefined, cannot enhance')
      return undefined
    }

    if (activatedGroups.size === 0) {
      return queryVector
    }

    const vectors: number[][] = [queryVector]
    const weights: number[] = [1.0] // 原始查询权重

    for (const [groupId, data] of activatedGroups) {
      const groupVector = this.groupVectorCache.get(groupId)
      if (groupVector) {
        vectors.push(groupVector)
        // 权重 = 组权重 * 激活强度
        const group = this.config.groups[groupId]
        const groupWeight = (group?.weight || 1.0) * data.strength
        weights.push(groupWeight)
      }
    }

    if (vectors.length === 1) {
      return queryVector // 没有有效的组向量被添加
    }

    const enhancedVector = this.weightedAverageVectors(vectors, weights)
    logger.debug(`Enhanced query vector with ${activatedGroups.size} groups`)
    return enhancedVector
  }

  /**
   * 加权平均向量
   */
  private weightedAverageVectors(vectors: number[][], weights: number[]): number[] | undefined {
    if (!vectors || vectors.length === 0) return undefined

    const dim = vectors[0].length
    const result = new Array(dim).fill(0)

    let totalWeight = 0
    for (let i = 0; i < vectors.length; i++) {
      if (!vectors[i] || vectors[i].length !== dim) continue
      const weight = weights[i]
      totalWeight += weight
      for (let j = 0; j < dim; j++) {
        result[j] += vectors[i][j] * weight
      }
    }

    if (totalWeight === 0) return undefined

    // 归一化
    for (let j = 0; j < dim; j++) {
      result[j] /= totalWeight
    }

    return result
  }

  /**
   * 灵活匹配 (大小写不敏感)
   */
  private flexibleMatch(text: string, word: string): boolean {
    return text.toLowerCase().includes(word.toLowerCase())
  }

  /**
   * 更新组统计信息
   */
  private updateGroupStats(groupId: string): void {
    const group = this.config.groups[groupId]
    if (group) {
      group.lastActivated = new Date().toISOString()
      group.activationCount = (group.activationCount || 0) + 1
    }
  }

  // ==================== 向量文件操作 ====================

  private async saveVectorFile(vectorId: string, vector: number[]): Promise<void> {
    const vectorPath = path.join(this.vectorsDir, `${vectorId}.json`)
    await fs.promises.writeFile(vectorPath, JSON.stringify(vector))
  }

  private async loadVectorFile(vectorId: string): Promise<number[] | null> {
    const vectorPath = path.join(this.vectorsDir, `${vectorId}.json`)
    try {
      const data = await fs.promises.readFile(vectorPath, 'utf-8')
      return JSON.parse(data)
    } catch {
      return null
    }
  }

  private async deleteVectorFile(vectorId: string): Promise<void> {
    const vectorPath = path.join(this.vectorsDir, `${vectorId}.json`)
    try {
      await fs.promises.unlink(vectorPath)
    } catch {
      // 忽略文件不存在的错误
    }
  }

  // ==================== 核心功能 ====================

  /**
   * 扩展查询关键词
   * 移植自 VCPToolBox LightMemo._expandQueryTokens()
   *
   * @param queryTokens 原始查询词
   * @returns 扩展后的词列表 (不包含原始词)
   */
  expandQueryTokens(queryTokens: string[]): string[] {
    if (!this.config.enabled || queryTokens.length === 0) {
      return []
    }

    const expandedTokens = new Set<string>()
    const activatedGroups = new Set<string>()

    for (const token of queryTokens) {
      const normalizedToken = token.toLowerCase()
      const groupNames = this.wordToGroupMap.get(normalizedToken)

      if (groupNames) {
        for (const groupName of groupNames) {
          // 避免同一组多次激活
          if (activatedGroups.has(groupName)) continue
          activatedGroups.add(groupName)

          const group = this.config.groups[groupName]
          if (group) {
            for (const word of group.words) {
              const normalizedWord = word.toLowerCase()
              // 不添加原始查询词
              if (!queryTokens.some((t) => t.toLowerCase() === normalizedWord)) {
                expandedTokens.add(word)
              }
            }
          }
        }
      }
    }

    // 限制扩展词数量
    const result = Array.from(expandedTokens).slice(0, this.config.maxExpandedWords)

    if (result.length > 0) {
      logger.debug('Query tokens expanded', {
        original: queryTokens,
        expanded: result,
        activatedGroups: Array.from(activatedGroups)
      })
    }

    return result
  }

  /**
   * 获取词语所属的语义组
   */
  getGroupsForWord(word: string): SemanticGroup[] {
    const groupNames = this.wordToGroupMap.get(word.toLowerCase())
    if (!groupNames) return []

    return groupNames.map((name) => this.config.groups[name]).filter(Boolean)
  }

  /**
   * 获取组内所有词语
   */
  getWordsInGroup(groupName: string): string[] {
    return this.config.groups[groupName]?.words || []
  }

  // ==================== 配置管理 ====================

  /**
   * 获取所有语义组
   */
  getAllGroups(): Record<string, SemanticGroup> {
    return { ...this.config.groups }
  }

  /**
   * 添加语义组
   */
  addGroup(groupId: string, group: SemanticGroup): void {
    this.config.groups[groupId] = group
    this.buildWordToGroupMap()
    this.saveConfig()
    logger.info('Semantic group added', { groupId, wordCount: group.words.length })
  }

  /**
   * 删除语义组
   */
  removeGroup(groupId: string): boolean {
    if (this.config.groups[groupId]) {
      delete this.config.groups[groupId]
      this.buildWordToGroupMap()
      this.saveConfig()
      logger.info('Semantic group removed', { groupId })
      return true
    }
    return false
  }

  /**
   * 向组中添加词语
   */
  addWordsToGroup(groupId: string, words: string[]): void {
    const group = this.config.groups[groupId]
    if (group) {
      const existingWords = new Set(group.words.map((w) => w.toLowerCase()))
      const newWords = words.filter((w) => !existingWords.has(w.toLowerCase()))
      group.words.push(...newWords)
      this.buildWordToGroupMap()
      this.saveConfig()
      logger.debug('Words added to group', { groupId, addedCount: newWords.length })
    }
  }

  /**
   * 获取配置
   */
  getConfig(): SemanticGroupConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<SemanticGroupConfig>): void {
    if (updates.enabled !== undefined) {
      this.config.enabled = updates.enabled
    }
    if (updates.maxExpandedWords !== undefined) {
      this.config.maxExpandedWords = updates.maxExpandedWords
    }
    if (updates.groups) {
      this.config.groups = { ...this.config.groups, ...updates.groups }
      this.buildWordToGroupMap()
    }
    this.saveConfig()
    logger.info('Config updated')
  }

  /**
   * 获取缓存的组向量
   */
  getGroupVectorFromCache(groupId: string): number[] | null {
    return this.groupVectorCache.get(groupId) ?? null
  }

  /**
   * 列出所有语义组
   */
  listGroups(): Array<SemanticGroup & { id: string }> {
    return Object.entries(this.config.groups).map(([id, group]) => ({
      id,
      ...group
    }))
  }

  /**
   * 获取服务统计信息
   */
  getStats(): {
    totalGroups: number
    cachedVectors: number
    cacheHitRate: number
    lastCacheUpdate?: string
  } {
    const totalGroups = Object.keys(this.config.groups).length
    const cachedVectors = this.groupVectorCache.size

    // 计算缓存命中率 (基于有多少组有向量)
    const cacheHitRate = totalGroups > 0 ? cachedVectors / totalGroups : 0

    // 找到最近更新的组
    let lastCacheUpdate: string | undefined
    for (const group of Object.values(this.config.groups)) {
      if (group.lastActivated) {
        if (!lastCacheUpdate || group.lastActivated > lastCacheUpdate) {
          lastCacheUpdate = group.lastActivated
        }
      }
    }

    return {
      totalGroups,
      cachedVectors,
      cacheHitRate,
      lastCacheUpdate
    }
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.groupVectorCache.clear()
    logger.info('Vector cache cleared')
  }

  // ==================== 辅助方法 ====================

  private buildWordToGroupMap(): void {
    this.wordToGroupMap.clear()

    for (const [groupId, group] of Object.entries(this.config.groups)) {
      for (const word of group.words) {
        const normalizedWord = word.toLowerCase()
        const existing = this.wordToGroupMap.get(normalizedWord) || []
        existing.push(groupId)
        this.wordToGroupMap.set(normalizedWord, existing)
      }
    }

    logger.debug('Word to group map built', { wordCount: this.wordToGroupMap.size })
  }

  // ==================== 持久化 ====================

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
    }
    if (!fs.existsSync(this.vectorsDir)) {
      fs.mkdirSync(this.vectorsDir, { recursive: true })
    }
  }

  private getConfigPath(): string {
    return path.join(this.dataDir, 'semantic-groups.json')
  }

  private loadConfig(): void {
    try {
      const configPath = this.getConfigPath()
      if (fs.existsSync(configPath)) {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'))
        if (data.enabled !== undefined) this.config.enabled = data.enabled
        if (data.maxExpandedWords) this.config.maxExpandedWords = data.maxExpandedWords
        if (data.vectorPrecomputation !== undefined) this.config.vectorPrecomputation = data.vectorPrecomputation
        if (data.groups) {
          // 合并用户自定义组和默认组，保留向量相关字段
          this.config.groups = { ...DEFAULT_SEMANTIC_GROUPS }
          for (const [key, group] of Object.entries(data.groups)) {
            const existingGroup = this.config.groups[key]
            if (existingGroup) {
              // 合并，保留用户自定义字段
              this.config.groups[key] = { ...existingGroup, ...(group as SemanticGroup) }
            } else {
              this.config.groups[key] = group as SemanticGroup
            }
          }
        }
        logger.info('Config loaded', { groupCount: Object.keys(this.config.groups).length })
      }
    } catch (error) {
      logger.warn('Failed to load config, using defaults', error as Error)
    }
  }

  private saveConfig(): void {
    if (this.saveLock) {
      logger.warn('Save operation already in progress')
      return
    }

    this.saveLock = true
    try {
      // 保存所有组（包含向量相关字段）
      const groupsToSave: Record<string, SemanticGroup> = {}
      for (const [key, group] of Object.entries(this.config.groups)) {
        // 创建不含临时数据的副本
        const groupCopy = { ...group }
        // 保存向量相关元数据但不保存实际向量
        groupsToSave[key] = groupCopy
      }

      const data = {
        enabled: this.config.enabled,
        maxExpandedWords: this.config.maxExpandedWords,
        vectorPrecomputation: this.config.vectorPrecomputation,
        groups: groupsToSave
      }
      fs.writeFileSync(this.getConfigPath(), JSON.stringify(data, null, 2))
      logger.debug('Config saved')
    } catch (error) {
      logger.error('Failed to save config', error as Error)
    } finally {
      this.saveLock = false
    }
  }
}

// ==================== 导出 ====================

let serviceInstance: SemanticGroupService | null = null

export function getSemanticGroupService(): SemanticGroupService {
  if (!serviceInstance) {
    serviceInstance = SemanticGroupService.getInstance()
  }
  return serviceInstance
}

// ==================== Native TagMemo 集成 ====================

import {
  createTagCooccurrenceMatrix,
  isNativeModuleAvailable,
  type TagAssociation
} from '@main/services/native'

import {
  createNativeSemanticGroupMatcher,
  isSemanticGroupMatcherAvailable,
  type ISemanticGroupMatcher,
  type SemanticGroupMatch
} from '@main/knowledge/vector/VexusAdapter'

/**
 * Native TagMemo 增强版语义组服务
 *
 * 结合预定义语义组和 Rust 原生模块：
 * - 预定义语义组: 人工定义的同义词/相关词扩展
 * - SemanticGroupMatcher: Rust 原生的高效文本匹配
 * - TagMemo PMI: 基于共现数据自动学习的关联词
 *
 * 使用策略:
 * 1. 使用 SemanticGroupMatcher 进行高效文本匹配
 * 2. 通过预定义语义组扩展关键词
 * 3. 通过 TagMemo 扩展动态关联词
 * 4. 合并并去重
 */
export class NativeSemanticGroupService {
  private baseService: SemanticGroupService
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tagMatrix: any = null
  private semanticMatcher: ISemanticGroupMatcher | null = null
  private isNativeMode: boolean = false
  private isMatcherNative: boolean = false

  constructor() {
    this.baseService = SemanticGroupService.getInstance()
    this.initializeNative()
    this.initializeSemanticMatcher()
  }

  /**
   * 初始化 Native TagMemo
   */
  private initializeNative(): void {
    if (isNativeModuleAvailable()) {
      try {
        this.tagMatrix = createTagCooccurrenceMatrix(0.8, 0.2) // alpha=0.8, beta=0.2
        this.isNativeMode = true
        logger.info('NativeSemanticGroupService using Rust TagMemo backend')
      } catch (error) {
        logger.warn('Failed to initialize Native TagMemo, using fallback', { error })
        this.isNativeMode = false
      }
    } else {
      logger.info('Native module not available, using base SemanticGroupService only')
      this.isNativeMode = false
    }
  }

  /**
   * 初始化 Native SemanticGroupMatcher
   */
  private initializeSemanticMatcher(): void {
    if (isSemanticGroupMatcherAvailable()) {
      try {
        this.semanticMatcher = createNativeSemanticGroupMatcher()
        if (this.semanticMatcher) {
          this.isMatcherNative = true
          // 注册预定义语义组到 Native matcher
          this.registerDefaultGroupsToMatcher()
          logger.info('SemanticGroupMatcher using Rust native backend')
        }
      } catch (error) {
        logger.warn('Failed to initialize Native SemanticGroupMatcher', { error })
        this.isMatcherNative = false
      }
    }
  }

  /**
   * 将预定义语义组注册到 Native matcher
   */
  private registerDefaultGroupsToMatcher(): void {
    if (!this.semanticMatcher) return

    const groups = this.baseService.getAllGroups()
    for (const [groupId, group] of Object.entries(groups)) {
      // 将 groupId 分解为 groupType 和 subGroup
      // 例如: "emotion_positive" -> groupType="emotion", subGroup="positive"
      const parts = groupId.split('_')
      const groupType = parts[0]
      const subGroup = parts.slice(1).join('_') || 'default'

      this.semanticMatcher.registerGroup(groupType, subGroup, group.words)
    }

    logger.debug('Registered default semantic groups to Native matcher', {
      groupCount: Object.keys(groups).length,
      keywordCount: this.semanticMatcher.keywordCount()
    })
  }

  /**
   * 是否使用 Native 模式
   */
  isUsingNativeMode(): boolean {
    return this.isNativeMode
  }

  /**
   * 是否使用 Native SemanticGroupMatcher
   */
  isUsingNativeMatcher(): boolean {
    return this.isMatcherNative
  }

  /**
   * 使用 Native matcher 提取文本中的语义匹配
   */
  extractSemanticMatches(text: string): SemanticGroupMatch[] {
    if (this.isMatcherNative && this.semanticMatcher) {
      return this.semanticMatcher.extractMatches(text)
    }
    // Fallback: 使用基础服务的检测方法并转换格式
    const activated = this.baseService.detectAndActivateGroups(text)
    const matches: SemanticGroupMatch[] = []
    for (const [groupId, data] of activated) {
      const parts = groupId.split('_')
      matches.push({
        groupType: parts[0],
        subGroup: parts.slice(1).join('_') || 'default',
        matchedKeywords: data.matchedWords,
        weight: data.strength
      })
    }
    return matches
  }

  /**
   * 计算查询和结果之间的语义重叠度
   */
  calculateSemanticOverlap(queryText: string, resultText: string): number {
    if (this.isMatcherNative && this.semanticMatcher) {
      const queryMatches = this.semanticMatcher.extractMatches(queryText)
      const resultMatches = this.semanticMatcher.extractMatches(resultText)
      return this.semanticMatcher.calculateOverlap(queryMatches, resultMatches)
    }
    // Fallback: 简单的关键词重叠计算
    const queryActivated = this.baseService.detectAndActivateGroups(queryText)
    const resultActivated = this.baseService.detectAndActivateGroups(resultText)

    let overlap = 0
    for (const [groupId] of queryActivated) {
      if (resultActivated.has(groupId)) {
        overlap += 1
      }
    }
    return queryActivated.size > 0 ? overlap / queryActivated.size : 0
  }

  /**
   * 更新标签共现 (用于学习)
   */
  updateTagCooccurrence(tag1: string, tag2: string, weight = 1.0): void {
    if (this.isNativeMode && this.tagMatrix) {
      this.tagMatrix.update(tag1, tag2, weight)
    }
  }

  /**
   * 批量更新标签共现
   */
  batchUpdateTagCooccurrence(pairs: Array<{ tag1: string; tag2: string; weight?: number }>): void {
    if (this.isNativeMode && this.tagMatrix) {
      this.tagMatrix.batchUpdate(
        pairs.map((p) => ({ tag1: p.tag1, tag2: p.tag2, weight: p.weight }))
      )
    }
  }

  /**
   * 获取标签关联 (PMI 排序)
   */
  getTagAssociations(tag: string, topK = 10): TagAssociation[] {
    if (this.isNativeMode && this.tagMatrix) {
      return this.tagMatrix.getAssociations(tag, topK)
    }
    return []
  }

  /**
   * 扩展查询关键词 (组合预定义语义组 + Native matcher + TagMemo)
   *
   * @param queryTokens 原始查询词
   * @param options 扩展选项
   * @returns 扩展后的词列表
   */
  expandQueryTokens(
    queryTokens: string[],
    options: {
      /** 使用预定义语义组 */
      useSemanticGroups?: boolean
      /** 使用 TagMemo 动态关联 */
      useTagMemo?: boolean
      /** TagMemo 扩展因子 (0-1) */
      tagMemoExpansionFactor?: number
      /** 最大扩展词数量 */
      maxExpandedWords?: number
    } = {}
  ): string[] {
    const {
      useSemanticGroups = true,
      useTagMemo = true,
      tagMemoExpansionFactor = 0.5,
      maxExpandedWords = 20
    } = options

    const expandedSet = new Set<string>()

    // 1. 使用 Native matcher 扩展 (如果可用)
    if (useSemanticGroups && this.isMatcherNative && this.semanticMatcher) {
      const queryText = queryTokens.join(' ')
      const matches = this.semanticMatcher.extractMatches(queryText)
      const expandedKeywords = this.semanticMatcher.expandKeywords(matches)
      for (const word of expandedKeywords) {
        if (!queryTokens.some((t) => t.toLowerCase() === word.toLowerCase())) {
          expandedSet.add(word)
        }
      }
    }
    // Fallback: 预定义语义组扩展
    else if (useSemanticGroups) {
      const semanticExpanded = this.baseService.expandQueryTokens(queryTokens)
      for (const word of semanticExpanded) {
        expandedSet.add(word)
      }
    }

    // 2. TagMemo 动态关联扩展
    if (useTagMemo && this.isNativeMode && this.tagMatrix) {
      const tagMemoExpanded = this.tagMatrix.expandQuery(queryTokens, tagMemoExpansionFactor)

      for (const word of tagMemoExpanded) {
        // 不添加原始查询词
        if (!queryTokens.some((t) => t.toLowerCase() === word.toLowerCase())) {
          expandedSet.add(word)
        }
      }
    }

    // 限制扩展词数量
    const result = Array.from(expandedSet).slice(0, maxExpandedWords)

    if (result.length > 0) {
      logger.debug('Query tokens expanded (Native)', {
        original: queryTokens,
        expanded: result,
        useNativeMatcher: this.isMatcherNative,
        useTagMemo: this.isNativeMode && useTagMemo
      })
    }

    return result
  }

  /**
   * 计算两个标签的 PMI (点互信息)
   */
  computePMI(tag1: string, tag2: string): number {
    if (this.isNativeMode && this.tagMatrix) {
      return this.tagMatrix.computePmi(tag1, tag2)
    }
    return 0
  }

  /**
   * 获取 TagMemo 统计信息
   */
  getTagMemoStats(): { tagCount: number; pairCount: number; totalUpdates: number } | null {
    if (this.isNativeMode && this.tagMatrix) {
      return this.tagMatrix.getStats()
    }
    return null
  }

  /**
   * 导出 TagMemo 数据为 JSON
   */
  exportTagMemo(): string | null {
    if (this.isNativeMode && this.tagMatrix) {
      return this.tagMatrix.toJson()
    }
    return null
  }

  /**
   * 从 JSON 导入 TagMemo 数据
   */
  importTagMemo(json: string): boolean {
    if (this.isNativeMode) {
      try {
        // 重新创建矩阵并从 JSON 加载
        const nativeModule = require('../../../native-vcp')
        this.tagMatrix = nativeModule.TagCooccurrenceMatrix.fromJson(json)
        return true
      } catch (error) {
        logger.error('Failed to import TagMemo data', { error })
        return false
      }
    }
    return false
  }

  /**
   * 清空 TagMemo 数据
   */
  clearTagMemo(): void {
    if (this.isNativeMode && this.tagMatrix) {
      this.tagMatrix.clear()
    }
  }

  /**
   * 获取综合统计信息
   */
  getStats(): {
    isNative: boolean
    isMatcherNative: boolean
    semanticGroups: ReturnType<SemanticGroupService['getStats']>
    matcherKeywordCount: number
    tagMemo: { tagCount: number; pairCount: number; totalUpdates: number } | null
  } {
    return {
      isNative: this.isNativeMode,
      isMatcherNative: this.isMatcherNative,
      semanticGroups: this.baseService.getStats(),
      matcherKeywordCount: this.semanticMatcher?.keywordCount() ?? 0,
      tagMemo: this.getTagMemoStats()
    }
  }

  /**
   * 获取基础服务 (用于访问预定义语义组功能)
   */
  getBaseService(): SemanticGroupService {
    return this.baseService
  }

  /**
   * 按指定组名扩展查询 (支持 ::Group(a,b,c) 语法)
   *
   * @param queryTokens 原始查询词
   * @param groupNames 指定的组名列表 (如 ['emotion', 'time'])
   * @param options 扩展选项
   * @returns 扩展后的词列表
   */
  expandBySpecificGroups(
    queryTokens: string[],
    groupNames: string[],
    options: {
      /** 是否包含子组 (如 emotion 包含 emotion_positive, emotion_negative) */
      includeSubGroups?: boolean
      /** 最大扩展词数量 */
      maxExpandedWords?: number
    } = {}
  ): string[] {
    const { includeSubGroups = true, maxExpandedWords = 20 } = options

    const expandedSet = new Set<string>()
    const allGroups = this.baseService.getAllGroups()

    // 找到匹配的组
    const matchingGroupIds: string[] = []
    for (const groupName of groupNames) {
      const normalizedName = groupName.toLowerCase().trim()

      for (const groupId of Object.keys(allGroups)) {
        const normalizedGroupId = groupId.toLowerCase()

        // 精确匹配或前缀匹配 (用于子组)
        if (normalizedGroupId === normalizedName ||
            (includeSubGroups && normalizedGroupId.startsWith(normalizedName + '_'))) {
          matchingGroupIds.push(groupId)
        }
      }
    }

    // 从匹配的组中提取词语
    for (const groupId of matchingGroupIds) {
      const group = allGroups[groupId]
      if (group) {
        for (const word of group.words) {
          // 不添加原始查询词
          if (!queryTokens.some((t) => t.toLowerCase() === word.toLowerCase())) {
            expandedSet.add(word)
          }
        }
        // 也添加自动学习的词语
        if (group.autoLearned) {
          for (const word of group.autoLearned) {
            if (!queryTokens.some((t) => t.toLowerCase() === word.toLowerCase())) {
              expandedSet.add(word)
            }
          }
        }
      }
    }

    const result = Array.from(expandedSet).slice(0, maxExpandedWords)

    if (result.length > 0) {
      logger.debug('Query expanded by specific groups', {
        requestedGroups: groupNames,
        matchedGroups: matchingGroupIds,
        expandedWords: result.length
      })
    }

    return result
  }

  /**
   * 获取所有可用的组名 (用于 UI 自动补全)
   */
  getAvailableGroupNames(): string[] {
    const allGroups = this.baseService.getAllGroups()
    const groupNames = new Set<string>()

    for (const groupId of Object.keys(allGroups)) {
      // 添加完整组名
      groupNames.add(groupId)
      // 添加组类型 (前缀)
      const prefix = groupId.split('_')[0]
      if (prefix) {
        groupNames.add(prefix)
      }
    }

    return Array.from(groupNames).sort()
  }

  /**
   * 根据组类型获取所有相关组
   */
  getGroupsByType(groupType: string): Array<{ id: string; group: SemanticGroup }> {
    const allGroups = this.baseService.getAllGroups()
    const normalizedType = groupType.toLowerCase().trim()
    const result: Array<{ id: string; group: SemanticGroup }> = []

    for (const [groupId, group] of Object.entries(allGroups)) {
      if (groupId.toLowerCase().startsWith(normalizedType)) {
        result.push({ id: groupId, group })
      }
    }

    return result
  }
}

// 单例实例
let nativeSemanticServiceInstance: NativeSemanticGroupService | null = null

/**
 * 获取 Native 语义组服务实例 (单例)
 */
export function getNativeSemanticGroupService(): NativeSemanticGroupService {
  if (!nativeSemanticServiceInstance) {
    nativeSemanticServiceInstance = new NativeSemanticGroupService()
  }
  return nativeSemanticServiceInstance
}
