/**
 * 语义组检索器
 *
 * 基于预定义的语义组进行记忆分类和检索：
 * - 自动识别查询所属语义组
 * - 支持多组联合检索
 * - 动态权重调整
 * - 组间关联发现
 *
 * @module memory/retrieval/SemanticGroupRetriever
 */

import { loggerService } from '@logger'

import type { MemoryEntry, MemoryType, RetrievalResult, ScoredMemoryEntry, SemanticGroupDefinition } from '../types'

const logger = loggerService.withContext('SemanticGroupRetriever')

// ==================== 类型定义 ====================

/**
 * 语义组匹配结果
 */
interface GroupMatchResult {
  groupId: string
  confidence: number
  matchedKeywords: string[]
  matchedTypes: MemoryType[]
}

/**
 * 语义组检索选项
 */
interface SemanticGroupSearchOptions {
  /** 目标语义组 ID 列表 */
  groups?: string[]
  /** 查询文本（用于自动识别组） */
  query?: string
  /** 每组返回数量 */
  perGroupLimit?: number
  /** 总返回数量 */
  totalLimit?: number
  /** 最小置信度阈值 */
  minConfidence?: number
  /** 是否包含关联组 */
  includeRelatedGroups?: boolean
  /** 时间范围过滤 */
  timeRange?: {
    start: Date
    end: Date
  }
}

/**
 * 分组检索结果
 */
interface GroupedRetrievalResult {
  groups: Map<string, ScoredMemoryEntry[]>
  totalCount: number
  primaryGroup?: string
  relatedGroups: string[]
}

/**
 * 存储访问器接口
 */
interface StoreAccessor {
  searchByType(types: MemoryType[], query?: string, limit?: number): Promise<MemoryEntry[]>
  searchByTags(tags: string[], limit?: number): Promise<MemoryEntry[]>
  search(query: string, limit?: number): Promise<ScoredMemoryEntry[]>
}

// ==================== 语义组定义 ====================

/**
 * 内置语义组定义
 */
const BUILTIN_SEMANTIC_GROUPS: Record<string, SemanticGroupDefinition> = {
  personal: {
    id: 'personal',
    name: '个人信息',
    description: '用户的个人基本信息',
    keywords: [
      'name',
      'age',
      'location',
      'birthday',
      'occupation',
      'job',
      'work',
      'live',
      '名字',
      '年龄',
      '住址',
      '生日',
      '职业',
      '工作'
    ],
    types: ['fact', 'entity'],
    priority: 10,
    color: '#1890ff'
  },
  preferences: {
    id: 'preferences',
    name: '偏好习惯',
    description: '用户的喜好和习惯',
    keywords: [
      'like',
      'prefer',
      'favorite',
      'hate',
      'dislike',
      'love',
      'enjoy',
      '喜欢',
      '偏好',
      '讨厌',
      '习惯',
      '爱好'
    ],
    types: ['preference'],
    priority: 9,
    color: '#52c41a'
  },
  projects: {
    id: 'projects',
    name: '项目任务',
    description: '用户的项目和任务',
    keywords: [
      'project',
      'task',
      'deadline',
      'goal',
      'plan',
      'todo',
      'work on',
      '项目',
      '任务',
      '截止',
      '目标',
      '计划'
    ],
    types: ['event', 'fact'],
    priority: 8,
    color: '#722ed1'
  },
  social: {
    id: 'social',
    name: '社交关系',
    description: '用户的社交网络',
    keywords: [
      'friend',
      'family',
      'colleague',
      'boss',
      'partner',
      'team',
      '朋友',
      '家人',
      '同事',
      '老板',
      '伙伴',
      '团队'
    ],
    types: ['entity', 'relation'],
    priority: 7,
    color: '#eb2f96'
  },
  learning: {
    id: 'learning',
    name: '学习知识',
    description: '用户的学习内容',
    keywords: [
      'learn',
      'study',
      'understand',
      'know',
      'remember',
      'course',
      '学习',
      '研究',
      '理解',
      '知道',
      '记住',
      '课程'
    ],
    types: ['knowledge', 'fact'],
    priority: 6,
    color: '#fa8c16'
  },
  experiences: {
    id: 'experiences',
    name: '经历体验',
    description: '用户的过往经历',
    keywords: [
      'experience',
      'trip',
      'event',
      'happened',
      'remember when',
      'last time',
      '经历',
      '旅行',
      '事件',
      '发生',
      '记得',
      '上次'
    ],
    types: ['experience', 'event'],
    priority: 5,
    color: '#13c2c2'
  },
  health: {
    id: 'health',
    name: '健康状况',
    description: '用户的健康相关信息',
    keywords: [
      'health',
      'sick',
      'medicine',
      'doctor',
      'exercise',
      'diet',
      '健康',
      '生病',
      '药物',
      '医生',
      '锻炼',
      '饮食'
    ],
    types: ['fact', 'preference'],
    priority: 4,
    color: '#f5222d'
  },
  emotions: {
    id: 'emotions',
    name: '情感状态',
    description: '用户的情绪和感受',
    keywords: [
      'feel',
      'emotion',
      'happy',
      'sad',
      'angry',
      'anxious',
      'stressed',
      '感觉',
      '情绪',
      '开心',
      '难过',
      '生气',
      '焦虑'
    ],
    types: ['experience', 'insight'],
    priority: 3,
    color: '#faad14'
  }
}

/**
 * 组间关联定义
 */
const GROUP_RELATIONS: Record<string, string[]> = {
  personal: ['preferences', 'social', 'health'],
  preferences: ['personal', 'experiences', 'learning'],
  projects: ['social', 'learning', 'experiences'],
  social: ['personal', 'projects', 'experiences'],
  learning: ['projects', 'preferences', 'experiences'],
  experiences: ['emotions', 'learning', 'social'],
  health: ['personal', 'emotions', 'preferences'],
  emotions: ['experiences', 'health', 'social']
}

// ==================== 语义组检索器 ====================

/**
 * 语义组检索器
 */
export class SemanticGroupRetriever {
  private store: StoreAccessor
  private groups: Record<string, SemanticGroupDefinition>

  constructor(store: StoreAccessor, customGroups?: Record<string, SemanticGroupDefinition>) {
    this.store = store
    this.groups = { ...BUILTIN_SEMANTIC_GROUPS, ...customGroups }
  }

  // ==================== 主检索方法 ====================

  /**
   * 按语义组检索
   */
  async search(options: SemanticGroupSearchOptions): Promise<RetrievalResult> {
    const startTime = Date.now()

    try {
      // 确定目标语义组
      let targetGroups: string[] = options.groups || []

      if (options.query && targetGroups.length === 0) {
        // 自动识别查询所属语义组
        const matches = this.identifyGroups(options.query)
        targetGroups = matches.filter((m) => m.confidence >= (options.minConfidence || 0.3)).map((m) => m.groupId)
      }

      // 如果没有匹配的组，搜索所有组
      if (targetGroups.length === 0) {
        targetGroups = Object.keys(this.groups)
      }

      // 添加关联组
      if (options.includeRelatedGroups) {
        const relatedGroups = new Set<string>()
        for (const groupId of targetGroups) {
          const related = GROUP_RELATIONS[groupId] || []
          related.forEach((g) => relatedGroups.add(g))
        }
        targetGroups = [...new Set([...targetGroups, ...relatedGroups])]
      }

      // 按组检索
      const groupResults = await this.searchByGroups(targetGroups, options)

      // 合并结果
      const allEntries: ScoredMemoryEntry[] = []
      for (const [_groupId, entries] of groupResults.groups) {
        allEntries.push(...entries)
      }

      // 去重和排序
      const deduped = this.deduplicateAndSort(allEntries)
      const limited = deduped.slice(0, options.totalLimit || 20)

      logger.debug('Semantic group search completed', {
        targetGroups,
        resultCount: limited.length,
        timeElapsed: Date.now() - startTime
      })

      return {
        entries: limited,
        metadata: {
          totalFound: allEntries.length,
          timeElapsed: Date.now() - startTime,
          strategy: 'semantic_group',
          groups: targetGroups
        }
      }
    } catch (error) {
      logger.error('Semantic group search failed', { error })
      return {
        entries: [],
        metadata: {
          totalFound: 0,
          timeElapsed: Date.now() - startTime,
          strategy: 'semantic_group',
          error: String(error)
        }
      }
    }
  }

  /**
   * 分组检索
   */
  async searchByGroups(groupIds: string[], options: SemanticGroupSearchOptions): Promise<GroupedRetrievalResult> {
    const groups = new Map<string, ScoredMemoryEntry[]>()
    const perGroupLimit = options.perGroupLimit || 10

    for (const groupId of groupIds) {
      const groupDef = this.groups[groupId]
      if (!groupDef) continue

      // 按类型搜索
      const typeResults = await this.store.searchByType(groupDef.types || [], options.query, perGroupLimit)

      // 按关键词搜索
      const keywordResults = await this.store.searchByTags(
        groupDef.keywords.slice(0, 5), // 只使用前5个关键词
        perGroupLimit
      )

      // 合并并评分
      const merged = this.mergeGroupResults(typeResults, keywordResults, groupDef)
      groups.set(groupId, merged.slice(0, perGroupLimit))
    }

    // 确定主要组
    let primaryGroup: string | undefined
    let maxCount = 0
    for (const [groupId, entries] of groups) {
      if (entries.length > maxCount) {
        maxCount = entries.length
        primaryGroup = groupId
      }
    }

    // 计算总数
    let totalCount = 0
    for (const entries of groups.values()) {
      totalCount += entries.length
    }

    return {
      groups,
      totalCount,
      primaryGroup,
      relatedGroups: primaryGroup ? GROUP_RELATIONS[primaryGroup] || [] : []
    }
  }

  // ==================== 语义组识别 ====================

  /**
   * 识别查询所属语义组
   */
  identifyGroups(query: string): GroupMatchResult[] {
    const results: GroupMatchResult[] = []
    const queryLower = query.toLowerCase()
    const queryWords = new Set(queryLower.split(/\s+/))

    for (const [groupId, groupDef] of Object.entries(this.groups)) {
      const matchedKeywords: string[] = []
      const matchedTypes: MemoryType[] = []

      // 检查关键词匹配
      for (const keyword of groupDef.keywords) {
        const keywordLower = keyword.toLowerCase()
        if (queryLower.includes(keywordLower) || queryWords.has(keywordLower)) {
          matchedKeywords.push(keyword)
        }
      }

      // 计算置信度
      const keywordScore = matchedKeywords.length / Math.max(groupDef.keywords.length, 1)
      const priorityBoost = (groupDef.priority ?? 5) / 10
      const confidence = Math.min(keywordScore * 0.7 + priorityBoost * 0.3, 1.0)

      if (confidence > 0.1) {
        results.push({
          groupId,
          confidence,
          matchedKeywords,
          matchedTypes
        })
      }
    }

    // 按置信度排序
    results.sort((a, b) => b.confidence - a.confidence)

    return results
  }

  /**
   * 获取所有语义组定义
   */
  getGroups(): Record<string, SemanticGroupDefinition> {
    return { ...this.groups }
  }

  /**
   * 获取特定语义组
   */
  getGroup(groupId: string): SemanticGroupDefinition | undefined {
    return this.groups[groupId]
  }

  /**
   * 获取组的关联组
   */
  getRelatedGroups(groupId: string): string[] {
    return GROUP_RELATIONS[groupId] || []
  }

  // ==================== 记忆自动分类 ====================

  /**
   * 自动分类记忆到语义组
   */
  classifyMemory(entry: MemoryEntry): GroupMatchResult[] {
    const results: GroupMatchResult[] = []
    const contentLower = entry.content.toLowerCase()
    const entryTags = new Set((entry.metadata.tags || []).map((t) => t.toLowerCase()))

    for (const [groupId, groupDef] of Object.entries(this.groups)) {
      let score = 0
      const matchedKeywords: string[] = []
      const matchedTypes: MemoryType[] = []

      // 类型匹配
      if ((groupDef.types || []).includes(entry.type)) {
        score += 0.3
        matchedTypes.push(entry.type)
      }

      // 关键词匹配
      for (const keyword of groupDef.keywords) {
        const keywordLower = keyword.toLowerCase()
        if (contentLower.includes(keywordLower) || entryTags.has(keywordLower)) {
          matchedKeywords.push(keyword)
          score += 0.1
        }
      }

      // 标签匹配
      for (const tag of entry.metadata.tags || []) {
        if (groupDef.keywords.some((k) => k.toLowerCase() === tag.toLowerCase())) {
          score += 0.15
        }
      }

      // 限制最大分数
      const confidence = Math.min(score, 1.0)

      if (confidence > 0.2) {
        results.push({
          groupId,
          confidence,
          matchedKeywords,
          matchedTypes
        })
      }
    }

    // 按置信度排序
    results.sort((a, b) => b.confidence - a.confidence)

    return results
  }

  /**
   * 批量分类记忆
   */
  classifyMemories(entries: MemoryEntry[]): Map<string, MemoryEntry[]> {
    const grouped = new Map<string, MemoryEntry[]>()

    for (const entry of entries) {
      const matches = this.classifyMemory(entry)
      const primaryGroup = matches[0]?.groupId || 'uncategorized'

      if (!grouped.has(primaryGroup)) {
        grouped.set(primaryGroup, [])
      }
      grouped.get(primaryGroup)!.push(entry)
    }

    return grouped
  }

  // ==================== 辅助方法 ====================

  /**
   * 合并组内结果
   */
  private mergeGroupResults(
    typeResults: MemoryEntry[],
    keywordResults: MemoryEntry[],
    groupDef: SemanticGroupDefinition
  ): ScoredMemoryEntry[] {
    const seen = new Set<string>()
    const merged: ScoredMemoryEntry[] = []

    // 处理类型匹配结果（权重较高）
    for (const entry of typeResults) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id)
        merged.push({
          ...entry,
          score: 0.8 + (groupDef.priority ?? 5) / 100,
          matchReason: `Type match: ${entry.type}`
        })
      }
    }

    // 处理关键词匹配结果
    for (const entry of keywordResults) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id)
        merged.push({
          ...entry,
          score: 0.6 + (groupDef.priority ?? 5) / 100,
          matchReason: 'Keyword match'
        })
      } else {
        // 已存在则提升分数
        const existing = merged.find((e) => e.id === entry.id)
        if (existing) {
          existing.score = Math.min(existing.score + 0.2, 1.0)
        }
      }
    }

    // 按分数排序
    merged.sort((a, b) => b.score - a.score)

    return merged
  }

  /**
   * 去重和排序
   */
  private deduplicateAndSort(entries: ScoredMemoryEntry[]): ScoredMemoryEntry[] {
    const seen = new Map<string, ScoredMemoryEntry>()

    for (const entry of entries) {
      const existing = seen.get(entry.id)
      if (!existing || entry.score > existing.score) {
        seen.set(entry.id, entry)
      }
    }

    const deduped = Array.from(seen.values())
    deduped.sort((a, b) => b.score - a.score)

    return deduped
  }
}

// ==================== 导出语义组常量 ====================

export { BUILTIN_SEMANTIC_GROUPS, GROUP_RELATIONS }

export default SemanticGroupRetriever
