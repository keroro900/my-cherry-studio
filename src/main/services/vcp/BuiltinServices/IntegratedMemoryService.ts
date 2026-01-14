/**
 * 统一记忆服务 (IntegratedMemoryService)
 *
 * 整合所有记忆相关功能的统一入口，替代以下废弃服务：
 * - LightMemoService → Memory:LightSearch
 * - DeepMemoService → Memory:DeepSearch, Memory:WaveRAGSearch
 * - AIMemoService → Memory:AIMemoSearch, Memory:Extract
 * - MemoryMasterService → Memory:AutoTag, Memory:CreateMemory, Memory:Organize
 *
 * 直接包装 IntegratedMemoryCoordinator，避免代码冗余。
 *
 * @author Cherry Studio Team
 */

import { loggerService } from '@logger'

import type { IntegratedMemoryCoordinator } from '../../memory/IntegratedMemoryCoordinator'
import type { BuiltinServiceResult, BuiltinToolDefinition, IBuiltinService } from './index'

const logger = loggerService.withContext('VCP:IntegratedMemoryService')

export class IntegratedMemoryService implements IBuiltinService {
  name = 'Memory'
  displayName = '统一记忆服务'
  description =
    '整合所有记忆功能的统一入口：轻量搜索、深度搜索、WaveRAG检索、AI记忆提取、自动标签、记忆创建。替代 LightMemo/DeepMemo/AIMemo/MemoryMaster。'
  version = '1.0.0'
  type = 'builtin_service' as const
  author = 'Cherry Studio'
  category = 'memory'

  documentation = `# 统一记忆服务 (Memory)

整合所有记忆功能的统一入口，提供一致的 API 访问记忆系统。

## 命令映射

| 旧工具 | 新命令 | 说明 |
|--------|--------|------|
| LightMemo:SearchRAG | Memory:LightSearch | 轻量级 RAG 搜索 |
| DeepMemo:DeepSearch | Memory:DeepSearch | 两阶段深度搜索 |
| DeepMemo:WaveRAGSearch | Memory:WaveRAGSearch | 三阶段 WaveRAG 检索 |
| AIMemo:Recall | Memory:AIMemoSearch | AI 驱动的记忆召回 |
| AIMemo:Extract | Memory:Extract | 从文本提取记忆 |
| MemoryMaster:AutoTag | Memory:AutoTag | AI 自动标签 |
| MemoryMaster:CreateMemory | Memory:CreateMemory | 创建记忆条目 |
| MemoryMaster:GetTopTags | Memory:GetTopTags | 获取热门标签 |

## 核心特性

- **多后端融合**: 同时搜索日记、笔记、知识库、深度记忆
- **SelfLearning**: 自动学习查询偏好，优化搜索权重
- **TagBoost**: 基于标签共现矩阵增强相关性
- **RRF 融合**: 多源结果的倒数排名融合

## 使用示例

\`\`\`
<<<[TOOL_REQUEST]>>>
tool_name:「始」Memory「末」
command:「始」LightSearch「末」
query:「始」上周讨论的项目方案「末」
k:「始」5「末」
<<<[END_TOOL_REQUEST]>>>
\`\`\`
`

  configSchema = {
    defaultK: {
      type: 'number',
      description: '默认返回结果数量',
      default: 5
    },
    enableLearning: {
      type: 'boolean',
      description: '是否启用学习权重',
      default: true
    },
    defaultTagBoost: {
      type: 'number',
      description: 'Tag 向量增强因子 (0-1)',
      default: 0.3
    },
    backends: {
      type: 'string',
      description: '搜索后端 (逗号分隔): diary,lightmemo,deepmemo,knowledge',
      default: 'diary,lightmemo,deepmemo,knowledge'
    }
  }

  toolDefinitions: BuiltinToolDefinition[] = [
    // ==================== 搜索命令 ====================
    {
      commandIdentifier: 'LightSearch',
      description: `轻量级 RAG 搜索，替代 LightMemo:SearchRAG。
参数:
- query (字符串, 必需): 搜索查询内容
- k (数字, 可选, 默认5): 返回的结果数量
- backends (字符串, 可选): 搜索后端，逗号分隔
- tag_boost (数字, 可选, 0-1): Tag 向量增强因子
- maid (字符串, 可选): 角色名称过滤

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」Memory「末」
command:「始」LightSearch「末」
query:「始」关于上次项目会议的讨论内容「末」
k:「始」5「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'query', description: '搜索查询内容', required: true, type: 'string' },
        { name: 'k', description: '返回的结果数量', required: false, type: 'number', default: 5 },
        { name: 'backends', description: '搜索后端 (逗号分隔)', required: false, type: 'string' },
        { name: 'tag_boost', description: 'Tag 向量增强因子 (0-1)', required: false, type: 'number' },
        { name: 'maid', description: '角色名称过滤', required: false, type: 'string' }
      ],
      example: `<<<[TOOL_REQUEST]>>>
tool_name:「始」Memory「末」
command:「始」LightSearch「末」
query:「始」我昨天学到了什么新知识「末」
<<<[END_TOOL_REQUEST]>>>`
    },
    {
      commandIdentifier: 'DeepSearch',
      description: `两阶段深度搜索（Tantivy 初筛 + Reranker 精排），替代 DeepMemo:DeepSearch。
参数:
- query (字符串, 必需): 搜索查询
- initialK (数字, 可选, 默认50): 初筛结果数量
- finalK (数字, 可选, 默认10): 最终返回数量

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」Memory「末」
command:「始」DeepSearch「末」
query:「始」项目架构设计决策「末」
finalK:「始」5「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'query', description: '搜索查询', required: true, type: 'string' },
        { name: 'initialK', description: '初筛结果数量', required: false, type: 'number', default: 50 },
        { name: 'finalK', description: '最终返回数量', required: false, type: 'number', default: 10 }
      ]
    },
    {
      commandIdentifier: 'WaveRAGSearch',
      description: `WaveRAG 三阶段检索（Lens-Expansion-Focus），替代 DeepMemo:WaveRAGSearch。
适用于需要深度理解和多角度探索的复杂查询。

参数:
- query (字符串, 必需): 搜索查询
- expansionDepth (数字, 可选, 默认2): 扩展深度
- focusThreshold (数字, 可选, 默认0.7): 聚焦阈值

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」Memory「末」
command:「始」WaveRAGSearch「末」
query:「始」总结我在项目管理方面的经验和教训「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'query', description: '搜索查询', required: true, type: 'string' },
        { name: 'expansionDepth', description: '扩展深度 (1-3)', required: false, type: 'number', default: 2 },
        { name: 'focusThreshold', description: '聚焦阈值 (0-1)', required: false, type: 'number', default: 0.7 }
      ]
    },
    {
      commandIdentifier: 'AIMemoSearch',
      description: `AI 驱动的记忆召回，替代 AIMemo:Recall。
参数:
- query (字符串, 必需): 查询内容
- limit (数字, 可选, 默认5): 返回数量
- category (字符串, 可选): 限定类别 (fact/preference/event/emotion/relation/skill)

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」Memory「末」
command:「始」AIMemoSearch「末」
query:「始」用户的饮食偏好「末」
category:「始」preference「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'query', description: '查询内容', required: true, type: 'string' },
        { name: 'limit', description: '返回数量', required: false, type: 'number', default: 5 },
        { name: 'category', description: '限定类别', required: false, type: 'string' }
      ]
    },
    // ==================== 记忆管理命令 ====================
    {
      commandIdentifier: 'CreateMemory',
      description: `创建新的记忆条目，替代 MemoryMaster:CreateMemory。
参数:
- content (字符串, 必需): 记忆内容
- tags (字符串, 可选): 标签列表，逗号分隔
- autoTag (布尔值, 可选, 默认true): 是否自动生成标签

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」Memory「末」
command:「始」CreateMemory「末」
content:「始」今天完成了项目的第一个里程碑「末」
tags:「始」工作,成就,项目「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'content', description: '记忆内容', required: true, type: 'string' },
        { name: 'tags', description: '标签列表，逗号分隔', required: false, type: 'string' },
        { name: 'autoTag', description: '是否自动生成标签', required: false, type: 'boolean', default: true }
      ]
    },
    {
      commandIdentifier: 'AutoTag',
      description: `使用 AI 为内容自动生成标签，替代 MemoryMaster:AutoTag。
参数:
- content (字符串, 必需): 需要打标签的内容
- maxTags (数字, 可选, 默认5): 最大标签数量

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」Memory「末」
command:「始」AutoTag「末」
content:「始」今天学习了 React Hooks 的使用方法「末」
maxTags:「始」3「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'content', description: '需要打标签的内容', required: true, type: 'string' },
        { name: 'maxTags', description: '最大标签数量', required: false, type: 'number', default: 5 }
      ]
    },
    {
      commandIdentifier: 'GetTopTags',
      description: `获取最常用的标签，替代 MemoryMaster:GetTopTags。
参数:
- count (数字, 可选, 默认20): 返回的标签数量

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」Memory「末」
command:「始」GetTopTags「末」
count:「始」10「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [{ name: 'count', description: '返回的标签数量', required: false, type: 'number', default: 20 }]
    },
    {
      commandIdentifier: 'GetStats',
      description: `获取记忆系统统计信息。

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」Memory「末」
command:「始」GetStats「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: []
    },
    {
      commandIdentifier: 'RecordFeedback',
      description: `记录用户反馈，用于优化搜索结果。
参数:
- resultId (字符串, 必需): 结果 ID
- query (字符串, 必需): 原始查询
- positive (布尔值, 可选, 默认true): 是否正向反馈

调用格式:
<<<[TOOL_REQUEST]>>>
tool_name:「始」Memory「末」
command:「始」RecordFeedback「末」
resultId:「始」result-uuid「末」
query:「始」原始查询内容「末」
positive:「始」true「末」
<<<[END_TOOL_REQUEST]>>>`,
      parameters: [
        { name: 'resultId', description: '结果 ID', required: true, type: 'string' },
        { name: 'query', description: '原始查询', required: true, type: 'string' },
        { name: 'positive', description: '是否正向反馈', required: false, type: 'boolean', default: true }
      ]
    },
    // ==================== 向后兼容命令 ====================
    {
      commandIdentifier: 'SearchRAG',
      description: '向后兼容 LightMemo:SearchRAG，等同于 LightSearch',
      parameters: [
        { name: 'query', description: '搜索查询内容', required: true, type: 'string' },
        { name: 'k', description: '返回的结果数量', required: false, type: 'number', default: 5 }
      ]
    },
    {
      commandIdentifier: 'Recall',
      description: '向后兼容 AIMemo:Recall，等同于 AIMemoSearch',
      parameters: [
        { name: 'query', description: '查询内容', required: true, type: 'string' },
        { name: 'limit', description: '返回数量', required: false, type: 'number', default: 5 }
      ]
    }
  ]

  // 延迟加载的协调器实例
  private coordinator: IntegratedMemoryCoordinator | null = null
  private config: Record<string, unknown> = {}
  private lastSearchId: string = ''

  async initialize(): Promise<void> {
    logger.info('IntegratedMemoryService initialized')
  }

  setConfig(config: Record<string, unknown>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取 IntegratedMemoryCoordinator 实例 (延迟加载)
   */
  private async getCoordinator(): Promise<IntegratedMemoryCoordinator> {
    if (!this.coordinator) {
      try {
        const { getIntegratedMemoryCoordinator } = await import('../../memory/IntegratedMemoryCoordinator')
        this.coordinator = getIntegratedMemoryCoordinator()
        logger.debug('IntegratedMemoryCoordinator loaded')
      } catch (error) {
        logger.error('Failed to load IntegratedMemoryCoordinator', {
          error: error instanceof Error ? error.message : String(error)
        })
        throw error
      }
    }
    return this.coordinator
  }

  async execute(command: string, params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const startTime = Date.now()

    try {
      // 命令路由
      switch (command) {
        // 搜索命令
        case 'LightSearch':
        case 'SearchRAG': // 向后兼容
        case 'search':
        case '':
        case undefined:
          return await this.lightSearch(params)

        case 'DeepSearch':
          return await this.deepSearch(params)

        case 'WaveRAGSearch':
          return await this.waveRAGSearch(params)

        case 'AIMemoSearch':
        case 'Recall': // 向后兼容
          return await this.aiMemoSearch(params)

        // 记忆管理命令
        case 'CreateMemory':
          return await this.createMemory(params)

        case 'AutoTag':
          return await this.autoTag(params)

        case 'GetTopTags':
          return await this.getTopTags(params)

        case 'GetStats':
          return await this.getStats()

        case 'RecordFeedback':
          return await this.recordFeedback(params)

        default:
          return {
            success: false,
            error: `Unknown command: ${command}. Available: LightSearch, DeepSearch, WaveRAGSearch, AIMemoSearch, CreateMemory, AutoTag, GetTopTags, GetStats, RecordFeedback`,
            executionTimeMs: Date.now() - startTime
          }
      }
    } catch (error) {
      logger.error('IntegratedMemoryService execute error', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime
      }
    }
  }

  // ==================== 搜索实现 ====================

  /**
   * 轻量级 RAG 搜索
   */
  private async lightSearch(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const query = String(params.query || '')
    const k = Number(params.k) || Number(this.config.defaultK) || 5
    const backendsParam = String(params.backends || this.config.backends || 'diary,lightmemo,deepmemo,knowledge')
    const tagBoost = params.tag_boost !== undefined ? Number(params.tag_boost) : Number(this.config.defaultTagBoost) || 0.3
    const maid = params.maid ? String(params.maid) : undefined

    if (!query.trim()) {
      return { success: false, error: 'Query is required' }
    }

    const startTime = Date.now()

    try {
      const coordinator = await this.getCoordinator()

      const backends = backendsParam
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean) as Array<'diary' | 'lightmemo' | 'deepmemo' | 'meshmemo' | 'knowledge' | 'memory'>

      const results = await coordinator.intelligentSearch(query, {
        topK: k,
        backends,
        applyLearning: this.config.enableLearning !== false,
        recordQuery: this.config.enableLearning !== false,
        tagBoost,
        metadata: maid ? { maid } : undefined
      })

      // 应用 maid 过滤
      let filteredResults = results
      if (maid) {
        filteredResults = results.filter((r) => {
          const metadata = r.metadata as Record<string, unknown> | undefined
          return !metadata?.maid || metadata.maid === maid
        })
      }

      this.lastSearchId = crypto.randomUUID()
      const executionTimeMs = Date.now() - startTime

      return {
        success: true,
        output: this.formatSearchResults(filteredResults, executionTimeMs),
        data: {
          searchId: this.lastSearchId,
          results: filteredResults,
          stats: { totalResults: filteredResults.length, backends, tagBoost, executionTimeMs }
        }
      }
    } catch (error) {
      logger.error('LightSearch failed', error as Error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * 两阶段深度搜索
   */
  private async deepSearch(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const query = String(params.query || '')
    const initialK = Number(params.initialK) || 50
    const finalK = Number(params.finalK) || 10

    if (!query.trim()) {
      return { success: false, error: 'Query is required' }
    }

    const startTime = Date.now()

    try {
      const coordinator = await this.getCoordinator()

      // 阶段 1: 初筛
      const initialResults = await coordinator.intelligentSearch(query, {
        topK: initialK,
        backends: ['deepmemo', 'lightmemo', 'diary'],
        applyLearning: true
      })

      // 阶段 2: 简单重排序
      const queryTerms = query.toLowerCase().split(/\s+/)
      const scored = initialResults.map((r) => {
        const contentLower = r.content.toLowerCase()
        const matchCount = queryTerms.filter((term) => contentLower.includes(term)).length
        const matchRatio = matchCount / queryTerms.length
        const rerankScore = r.score * 0.7 + matchRatio * 0.3
        return { ...r, rerankScore }
      })

      scored.sort((a, b) => b.rerankScore - a.rerankScore)
      const rerankedResults = scored.slice(0, finalK)

      const executionTimeMs = Date.now() - startTime

      const formatted = rerankedResults
        .map((r, i) => `[${i + 1}] (${(r.score * 100).toFixed(1)}%)\n${r.content.slice(0, 400)}...`)
        .join('\n\n---\n\n')

      return {
        success: true,
        output: `🔍 深度搜索结果 (初筛 ${initialResults.length} → 精排 ${rerankedResults.length})\n\n${formatted}\n\n⏱️ 耗时 ${executionTimeMs}ms`,
        data: { results: rerankedResults, stats: { initialCount: initialResults.length, finalCount: rerankedResults.length, executionTimeMs } }
      }
    } catch (error) {
      logger.error('DeepSearch failed', error as Error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * WaveRAG 三阶段检索
   */
  private async waveRAGSearch(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const query = String(params.query || '')
    const expansionDepth = Number(params.expansionDepth) || 2
    const focusThreshold = Number(params.focusThreshold) || 0.7

    if (!query.trim()) {
      return { success: false, error: 'Query is required' }
    }

    const startTime = Date.now()

    try {
      const coordinator = await this.getCoordinator()

      // Lens 阶段
      const lensResults = await coordinator.intelligentSearch(query, { topK: 20, applyLearning: true })

      // Expansion 阶段
      const allTags = lensResults.flatMap((r) => r.matchedTags || [])
      const tagCounts: Record<string, number> = {}
      for (const tag of allTags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      }

      const topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, expansionDepth * 2)
        .map(([tag]) => tag)

      const expandedQueries = topTags.slice(0, expansionDepth).map((tag) => `${query} ${tag}`)

      const expansionResults: Array<{ query: string; results: typeof lensResults }> = []
      for (const eq of expandedQueries) {
        const results = await coordinator.intelligentSearch(eq, { topK: 10, applyLearning: true })
        expansionResults.push({ query: eq, results })
      }

      // Focus 阶段
      type MergedResult = (typeof lensResults)[0] & { phase: string; expandedQuery?: string }
      const allResults: MergedResult[] = [
        ...lensResults.map((r) => ({ ...r, phase: 'lens' })),
        ...expansionResults.flatMap((er) => er.results.map((r) => ({ ...r, phase: 'expansion', expandedQuery: er.query })))
      ]

      // 去重
      const seen = new Set<string>()
      const uniqueResults = allResults.filter((r) => {
        const key = r.content.slice(0, 100)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      const focusedResults = uniqueResults.filter((r) => r.score >= focusThreshold)
      const executionTimeMs = Date.now() - startTime

      const formatted = focusedResults
        .slice(0, 10)
        .map((r, i) => `[${i + 1}] (${(r.score * 100).toFixed(1)}%)\n${r.content.slice(0, 300)}...`)
        .join('\n\n')

      return {
        success: true,
        output: `🌊 WaveRAG 三阶段检索结果\n\nLens: ${lensResults.length} 条 | Expansion: ${expansionResults.length} 个查询 | Focus: ${focusedResults.length} 条\n\n${formatted}\n\n⏱️ 耗时 ${executionTimeMs}ms`,
        data: { lensCount: lensResults.length, expansionQueries: expandedQueries, focusedCount: focusedResults.length, results: focusedResults.slice(0, 10) }
      }
    } catch (error) {
      logger.error('WaveRAGSearch failed', error as Error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * AI 记忆召回
   */
  private async aiMemoSearch(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const query = String(params.query || '')
    const limit = Number(params.limit) || 5

    if (!query.trim()) {
      return { success: false, error: 'Query is required' }
    }

    try {
      const coordinator = await this.getCoordinator()

      // 使用 searchWithSynthesis 进行 AI 增强搜索
      // 参数: query, characterNames[], options
      const results = await coordinator.searchWithSynthesis(query, [], { maxResults: limit })

      return {
        success: true,
        output: results.synthesizedMemory || this.formatSearchResults(results.rawResults, 0),
        data: { results: results.rawResults, synthesis: results.synthesizedMemory }
      }
    } catch (error) {
      logger.error('AIMemoSearch failed', error as Error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // ==================== 记忆管理实现 ====================

  /**
   * 创建记忆
   */
  private async createMemory(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const content = String(params.content || '')
    const tagsStr = params.tags ? String(params.tags) : ''
    const autoTag = params.autoTag !== false

    if (!content.trim()) {
      return { success: false, error: 'Content is required' }
    }

    try {
      const coordinator = await this.getCoordinator()
      const tags = tagsStr ? tagsStr.split(',').map((t) => t.trim()) : []

      const memory = await coordinator.createMemory({ content, tags, autoTag, metadata: { source: 'vcp', createdAt: Date.now() } })

      return {
        success: true,
        output: `✅ 记忆已创建\n\n内容: ${content.slice(0, 100)}...\n标签: ${memory.tags?.join(', ') || '(无)'}\nID: ${memory.id || 'N/A'}`,
        data: { memory }
      }
    } catch (error) {
      logger.error('CreateMemory failed', error as Error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * 自动标签
   */
  private async autoTag(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const content = String(params.content || '')
    const maxTags = Number(params.maxTags) || 5

    if (!content.trim()) {
      return { success: false, error: 'Content is required' }
    }

    try {
      // 使用简单关键词提取（协调器不直接暴露 generateTags）
      // 从标签池获取候选标签并匹配
      const coordinator = await this.getCoordinator()
      const stats = await coordinator.getIntegratedStats()
      const poolTags = stats.tagPoolStats?.topTags || []

      // 匹配内容中的已有标签
      const contentLower = content.toLowerCase()
      const matchedTags = poolTags
        .filter((tag: string) => contentLower.includes(tag.toLowerCase()))
        .slice(0, maxTags)

      // 如果匹配不足，使用简单关键词提取补充
      if (matchedTags.length < maxTags) {
        const words = content
          .replace(/[^\u4e00-\u9fa5a-zA-Z]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 2 && w.length <= 10)

        const wordCount: Record<string, number> = {}
        for (const word of words) {
          wordCount[word] = (wordCount[word] || 0) + 1
        }

        const topWords = Object.entries(wordCount)
          .sort((a, b) => b[1] - a[1])
          .map(([word]) => word)
          .filter((w) => !matchedTags.includes(w))
          .slice(0, maxTags - matchedTags.length)

        matchedTags.push(...topWords)
      }

      const tags = matchedTags.slice(0, maxTags)

      return {
        success: true,
        output: `🏷️ 自动生成的标签：\n\n${tags.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n共 ${tags.length} 个标签`,
        data: { tags }
      }
    } catch (error) {
      logger.error('AutoTag failed', error as Error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * 获取热门标签
   */
  private async getTopTags(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const count = Number(params.count) || 20

    try {
      const coordinator = await this.getCoordinator()
      const stats = await coordinator.getIntegratedStats()
      const topTags = stats.tagPoolStats?.topTags || []

      if (topTags.length === 0) {
        return { success: true, output: '标签池为空，暂无标签统计数据。' }
      }

      const formatted = topTags.slice(0, count).map((tag: string, i: number) => `${i + 1}. ${tag}`).join('\n')

      return {
        success: true,
        output: `🏷️ 热门标签 Top ${Math.min(count, topTags.length)}：\n\n${formatted}`,
        data: { tags: topTags.slice(0, count) }
      }
    } catch (error) {
      logger.error('GetTopTags failed', error as Error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * 获取统计信息
   */
  private async getStats(): Promise<BuiltinServiceResult> {
    try {
      const coordinator = await this.getCoordinator()
      const stats = await coordinator.getIntegratedStats()
      const progress = coordinator.getLearningProgress()

      const output = `📊 记忆系统统计

**学习进度**:
- 查询记录: ${progress.queryCount} 次
- 反馈记录: ${progress.feedbackCount} 次

**热门学习标签**:
${progress.topLearningTags.map((t, i) => `${i + 1}. ${t.tag} (权重: ${t.weight.toFixed(2)})`).join('\n')}

**记忆后端统计**:
${Object.entries(stats.memoryStats.backends)
  .map(([name, info]) => `- ${name}: ${(info as { count?: number }).count || 0} 条`)
  .join('\n')}

**标签池**:
- 总标签数: ${stats.tagPoolStats.totalTags}
- 热门标签: ${stats.tagPoolStats.topTags.slice(0, 5).join(', ')}`

      return { success: true, output, data: { stats, progress } }
    } catch (error) {
      logger.error('GetStats failed', error as Error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * 记录反馈
   */
  private async recordFeedback(params: Record<string, unknown>): Promise<BuiltinServiceResult> {
    const resultId = String(params.resultId || '')
    const query = String(params.query || '')
    const positive = params.positive !== false && params.positive !== 'false'

    if (!resultId || !query) {
      return { success: false, error: 'resultId and query are required' }
    }

    try {
      const coordinator = await this.getCoordinator()

      if (positive) {
        await coordinator.recordPositiveFeedback(this.lastSearchId, resultId, query)
      } else {
        await coordinator.recordNegativeFeedback(this.lastSearchId, resultId, query)
      }

      return {
        success: true,
        output: `✅ ${positive ? '正向' : '负向'}反馈已记录，将用于优化未来搜索结果。`
      }
    } catch (error) {
      logger.error('RecordFeedback failed', error as Error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 格式化搜索结果
   */
  private formatSearchResults(
    results: Array<{ content: string; score: number; backend?: string; matchedTags?: string[]; learning?: { appliedWeight: number } }>,
    executionTimeMs: number
  ): string {
    if (!results || results.length === 0) {
      return '未找到相关记录。'
    }

    const formatted = results
      .map((r, i) => {
        const source = r.backend || 'unknown'
        const learningInfo = r.learning ? ` [学习权重: ${r.learning.appliedWeight.toFixed(2)}]` : ''
        const tags = r.matchedTags && r.matchedTags.length > 0 ? `\n标签: ${r.matchedTags.join(', ')}` : ''

        return `[${i + 1}] (相关度: ${(r.score * 100).toFixed(1)}%${learningInfo})
来源: ${source}${tags}
${r.content.slice(0, 500)}${r.content.length > 500 ? '...' : ''}`
      })
      .join('\n\n---\n\n')

    return `找到 ${results.length} 条相关记录${executionTimeMs > 0 ? ` (耗时 ${executionTimeMs}ms)` : ''}：\n\n${formatted}`
  }

  async shutdown(): Promise<void> {
    this.coordinator = null
    logger.info('IntegratedMemoryService shutdown')
  }
}
