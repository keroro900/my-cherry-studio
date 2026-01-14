/**
 * 检索模式规划器
 *
 * 根据查询内容和上下文，智能选择最佳的检索策略
 */

import { loggerService } from '@logger'

import type { DataSourceType, QueryAnalysis, RetrievalMode, RetrievalPlan, UnifiedSearchOptions } from './types'

const logger = loggerService.withContext('RetrievalPlanner')

// ==================== 时间词汇表 ====================

const TIME_KEYWORDS = {
  today: ['今天', '今日', 'today', '现在', '当前'],
  yesterday: ['昨天', '昨日', 'yesterday'],
  week: ['本周', '这周', '上周', 'this week', 'last week', '一周', '七天'],
  month: ['本月', '这个月', '上个月', 'this month', 'last month', '一个月', '三十天'],
  year: ['今年', '去年', 'this year', 'last year', '一年']
}

const QUESTION_PATTERNS = [
  /^(什么|怎么|如何|为什么|哪个|哪些|是否|能否|可以|有没有)/,
  /^(what|how|why|which|where|when|who|is|are|can|could|would)/i,
  /\?|？$/
]

const RECALL_KEYWORDS = ['回忆', '记得', '之前', '上次', '以前', '曾经', 'remember', 'recall', 'last time']
const SUMMARY_KEYWORDS = ['总结', '概括', '归纳', '汇总', 'summarize', 'summary', 'overview']
const COMPARISON_KEYWORDS = ['对比', '比较', '区别', '差异', 'compare', 'difference', 'versus', 'vs']

// ==================== RetrievalPlanner ====================

export class RetrievalPlanner {
  /**
   * 根据查询和选项生成检索计划
   */
  plan(query: string, options: UnifiedSearchOptions = {}): RetrievalPlan {
    // 分析查询
    const queryAnalysis = this.analyzeQuery(query)

    // 确定数据源
    const sources = this.determineSources(queryAnalysis, options)

    // 确定每个源的 topK
    const sourceTopK = this.determineSourceTopK(sources, options.topK ?? 10)

    // 确定检索模式
    const mode = this.determineMode(queryAnalysis, options)

    // 确定是否使用 TagMemo
    const useTagMemo = this.shouldUseTagMemo(queryAnalysis, options)

    // 确定是否使用 RRF
    const useRRF = sources.length > 1 && (options.useRRF ?? true)

    // 确定是否使用 Reranker
    const useReranker = options.useReranker ?? this.shouldUseReranker(queryAnalysis)

    // 时间过滤
    const timeFilter = this.buildTimeFilter(queryAnalysis, options)

    const plan: RetrievalPlan = {
      sources,
      sourceTopK,
      mode,
      useTagMemo,
      useRRF,
      useReranker,
      timeFilter,
      queryAnalysis
    }

    logger.debug('Generated retrieval plan', {
      query: query.slice(0, 50),
      plan: {
        sources: plan.sources,
        mode: plan.mode,
        useTagMemo: plan.useTagMemo,
        useRRF: plan.useRRF
      }
    })

    return plan
  }

  /**
   * 分析查询内容
   */
  analyzeQuery(query: string): QueryAnalysis {
    const normalizedQuery = query.toLowerCase()

    // 提取关键词
    const keywords = this.extractKeywords(query)

    // 提取标签
    const tags = this.extractTags(query)

    // 检测时间相关性
    const { isTimeRelated, timeReference } = this.detectTimeReference(normalizedQuery)

    // 检测是否为问题
    const isQuestion = QUESTION_PATTERNS.some((p) => p.test(query))

    // 检测查询意图
    const intent = this.detectIntent(normalizedQuery)

    return {
      keywords,
      tags,
      isTimeRelated,
      timeReference,
      isQuestion,
      intent
    }
  }

  /**
   * 提取关键词
   */
  private extractKeywords(query: string): string[] {
    // 移除标点和特殊字符
    const cleaned = query.replace(/[^\w\u4e00-\u9fa5\s]/g, ' ')

    // 分词（简单实现）
    const words = cleaned
      .split(/\s+/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length >= 2 && w.length <= 20)

    // 去重
    return [...new Set(words)]
  }

  /**
   * 提取标签
   */
  private extractTags(query: string): string[] {
    const tags: string[] = []

    // #tag 格式
    const hashTags = query.match(/#[\w\u4e00-\u9fa5]+/g) || []
    tags.push(...hashTags.map((t) => t.slice(1).toLowerCase()))

    // [tag] 格式
    const bracketTags = query.match(/\[([^\]]+)\]/g) || []
    tags.push(...bracketTags.map((t) => t.slice(1, -1).toLowerCase()))

    return [...new Set(tags)]
  }

  /**
   * 检测时间引用
   */
  private detectTimeReference(query: string): {
    isTimeRelated: boolean
    timeReference?: 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'specific'
  } {
    for (const [ref, keywords] of Object.entries(TIME_KEYWORDS)) {
      if (keywords.some((k) => query.includes(k))) {
        return {
          isTimeRelated: true,
          timeReference: ref as 'today' | 'yesterday' | 'week' | 'month' | 'year'
        }
      }
    }

    // 检测具体日期格式
    const datePattern = /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}|(\d{1,2}月\d{1,2}日?)/
    if (datePattern.test(query)) {
      return { isTimeRelated: true, timeReference: 'specific' }
    }

    return { isTimeRelated: false }
  }

  /**
   * 检测查询意图
   */
  private detectIntent(query: string): 'search' | 'recall' | 'summary' | 'comparison' {
    if (RECALL_KEYWORDS.some((k) => query.includes(k))) {
      return 'recall'
    }
    if (SUMMARY_KEYWORDS.some((k) => query.includes(k))) {
      return 'summary'
    }
    if (COMPARISON_KEYWORDS.some((k) => query.includes(k))) {
      return 'comparison'
    }
    return 'search'
  }

  /**
   * 确定数据源
   */
  private determineSources(analysis: QueryAnalysis, options: UnifiedSearchOptions): DataSourceType[] {
    // 如果明确指定了数据源，使用指定的
    if (options.sources && options.sources.length > 0) {
      return options.sources
    }

    const sources: DataSourceType[] = []

    // 回忆类查询优先使用日记
    if (analysis.intent === 'recall' || analysis.isTimeRelated) {
      sources.push('diary')
    }

    // 总结类查询使用知识库
    if (analysis.intent === 'summary' || analysis.intent === 'comparison') {
      sources.push('knowledge')
    }

    // 问题类查询使用两者
    if (analysis.isQuestion) {
      if (!sources.includes('knowledge')) sources.push('knowledge')
      if (!sources.includes('diary')) sources.push('diary')
    }

    // 默认使用知识库和日记
    if (sources.length === 0) {
      sources.push('knowledge', 'diary')
    }

    // 如果有标签，添加 lightmemo
    if (analysis.tags.length > 0) {
      sources.push('lightmemo')
    }

    return [...new Set(sources)]
  }

  /**
   * 确定每个源的 topK
   */
  private determineSourceTopK(sources: DataSourceType[], totalTopK: number): Record<DataSourceType, number> {
    const sourceTopK: Partial<Record<DataSourceType, number>> = {}

    // 简单平均分配，但至少给每个源 5 个
    const perSource = Math.max(5, Math.ceil(totalTopK / sources.length))

    for (const source of sources) {
      sourceTopK[source] = perSource
    }

    return sourceTopK as Record<DataSourceType, number>
  }

  /**
   * 确定检索模式
   */
  private determineMode(analysis: QueryAnalysis, options: UnifiedSearchOptions): RetrievalMode {
    // 如果明确指定了模式，使用指定的
    if (options.mode) {
      return options.mode
    }

    // 总结类查询使用全文
    if (analysis.intent === 'summary') {
      return 'fulltext'
    }

    // 有阈值设置时使用阈值模式
    if (options.threshold !== undefined && options.threshold > 0.1) {
      return 'threshold_rag'
    }

    // 默认使用 RAG
    return 'rag'
  }

  /**
   * 是否使用 TagMemo
   */
  private shouldUseTagMemo(analysis: QueryAnalysis, options: UnifiedSearchOptions): boolean {
    // 明确禁用
    if (options.tagMemoEnabled === false) {
      return false
    }

    // 有标签或 tagBoost > 0
    if (analysis.tags.length > 0 || (options.tagBoost ?? 0) > 0) {
      return true
    }

    // 默认启用
    return options.tagMemoEnabled ?? true
  }

  /**
   * 是否使用 Reranker
   */
  private shouldUseReranker(analysis: QueryAnalysis): boolean {
    // 问题类查询使用 reranker
    if (analysis.isQuestion) {
      return true
    }

    // 对比类查询使用 reranker
    if (analysis.intent === 'comparison') {
      return true
    }

    // 关键词较多时使用 reranker
    if (analysis.keywords.length > 5) {
      return true
    }

    return false
  }

  /**
   * 构建时间过滤器
   */
  private buildTimeFilter(
    analysis: QueryAnalysis,
    options: UnifiedSearchOptions
  ): { start: Date; end: Date } | undefined {
    // 使用选项中的时间范围
    if (options.timeRange && options.timeRange !== 'all') {
      return this.getTimeRangeFilter(options.timeRange)
    }

    // 使用查询分析中的时间引用
    if (analysis.isTimeRelated && analysis.timeReference) {
      return this.getTimeRangeFilter(analysis.timeReference as any)
    }

    return undefined
  }

  /**
   * 获取时间范围过滤器
   */
  private getTimeRangeFilter(range: 'today' | 'week' | 'month' | 'year'): { start: Date; end: Date } {
    const now = new Date()
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)

    const start = new Date(now)
    start.setHours(0, 0, 0, 0)

    switch (range) {
      case 'today':
        // start 已经是今天开始
        break
      case 'week':
        start.setDate(start.getDate() - 7)
        break
      case 'month':
        start.setMonth(start.getMonth() - 1)
        break
      case 'year':
        start.setFullYear(start.getFullYear() - 1)
        break
    }

    return { start, end }
  }
}

// ==================== 导出 ====================

let plannerInstance: RetrievalPlanner | null = null

export function getRetrievalPlanner(): RetrievalPlanner {
  if (!plannerInstance) {
    plannerInstance = new RetrievalPlanner()
  }
  return plannerInstance
}

export function createRetrievalPlanner(): RetrievalPlanner {
  return new RetrievalPlanner()
}
