/**
 * 时间感知检索服务
 * 基于 VCPToolBox 的 ::Time 功能
 *
 * 功能:
 * 1. 解析自然语言时间描述 ("上周", "本季度", "三个月前")
 * 2. 时间范围过滤
 * 3. 时间衰减权重 (越新的内容权重越高)
 */

import { loggerService } from '@logger'
import type { KnowledgeSearchResult } from '@types'

const logger = loggerService.withContext('TimeAwareSearch')

/**
 * 时间范围类型
 */
export type TimeRange =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'week' // 近一周
  | 'two_weeks'
  | 'month' // 近一月
  | 'quarter' // 近三月
  | 'half_year'
  | 'year'
  | 'current_season' // 当前季节
  | 'last_season' // 上一季节
  | 'custom'

/**
 * 季节定义
 */
export type Season = 'spring' | 'summer' | 'fall' | 'winter'

/**
 * 时间范围配置
 */
export interface TimeRangeConfig {
  range: TimeRange
  customStart?: Date
  customEnd?: Date
}

/**
 * 时间感知搜索配置
 */
export interface TimeAwareConfig {
  enabled: boolean
  timeRange: TimeRangeConfig
  decayEnabled?: boolean // 是否启用时间衰减
  decayHalfLife?: number // 衰减半衰期 (天数)
  dateField?: string // 元数据中的日期字段名
}

/**
 * 时间感知搜索结果
 */
export interface TimeAwareResult {
  originalScore: number
  timeAdjustedScore: number
  documentDate?: Date
  ageInDays?: number
  decayFactor?: number
}

/**
 * 自然语言时间解析结果
 */
interface ParsedTimeExpression {
  range: TimeRange
  start: Date
  end: Date
}

export class TimeAwareSearchService {
  private config: TimeAwareConfig

  constructor(config?: Partial<TimeAwareConfig>) {
    this.config = {
      enabled: true,
      timeRange: { range: 'all' },
      decayEnabled: true,
      decayHalfLife: 30, // 30 天半衰期
      dateField: 'captureDate',
      ...config
    }
  }

  /**
   * 解析自然语言时间表达式
   * 支持中英文
   */
  parseTimeExpression(expression: string): ParsedTimeExpression | null {
    const now = new Date()
    const normalized = expression.toLowerCase().trim()

    // 中文时间表达式映射
    const chinesePatterns: Record<string, TimeRange> = {
      今天: 'today',
      昨天: 'yesterday',
      本周: 'week',
      这周: 'week',
      上周: 'week',
      近一周: 'week',
      本月: 'month',
      这个月: 'month',
      近一月: 'month',
      近一个月: 'month',
      本季度: 'quarter',
      近三月: 'quarter',
      近三个月: 'quarter',
      近半年: 'half_year',
      今年: 'year',
      本年: 'year',
      春季: 'current_season',
      夏季: 'current_season',
      秋季: 'current_season',
      冬季: 'current_season'
    }

    // 英文时间表达式映射
    const englishPatterns: Record<string, TimeRange> = {
      today: 'today',
      yesterday: 'yesterday',
      'this week': 'week',
      'last week': 'week',
      'past week': 'week',
      'this month': 'month',
      'last month': 'month',
      'past month': 'month',
      'this quarter': 'quarter',
      'last quarter': 'quarter',
      'past 3 months': 'quarter',
      'past three months': 'quarter',
      'half year': 'half_year',
      'past 6 months': 'half_year',
      'this year': 'year',
      'last year': 'year',
      spring: 'current_season',
      summer: 'current_season',
      fall: 'current_season',
      autumn: 'current_season',
      winter: 'current_season'
    }

    // 尝试匹配模式
    let range: TimeRange = 'all'

    for (const [pattern, r] of Object.entries(chinesePatterns)) {
      if (normalized.includes(pattern)) {
        range = r
        break
      }
    }

    if (range === 'all') {
      for (const [pattern, r] of Object.entries(englishPatterns)) {
        if (normalized.includes(pattern)) {
          range = r
          break
        }
      }
    }

    // 解析相对时间表达式 (如 "3天前", "2 weeks ago")
    const relativePatterns = [
      { regex: /(\d+)\s*天前/, unit: 'day' },
      { regex: /(\d+)\s*周前/, unit: 'week' },
      { regex: /(\d+)\s*月前/, unit: 'month' },
      { regex: /(\d+)\s*days?\s*ago/i, unit: 'day' },
      { regex: /(\d+)\s*weeks?\s*ago/i, unit: 'week' },
      { regex: /(\d+)\s*months?\s*ago/i, unit: 'month' }
    ]

    for (const { regex, unit } of relativePatterns) {
      const match = normalized.match(regex)
      if (match) {
        const value = parseInt(match[1])
        const start = new Date(now)

        switch (unit) {
          case 'day':
            start.setDate(start.getDate() - value)
            break
          case 'week':
            start.setDate(start.getDate() - value * 7)
            break
          case 'month':
            start.setMonth(start.getMonth() - value)
            break
        }

        return { range: 'custom', start, end: now }
      }
    }

    if (range === 'all') {
      return null
    }

    const { start, end } = this.getTimeRangeBounds({ range })
    return { range, start, end }
  }

  /**
   * 获取时间范围的起止日期
   */
  getTimeRangeBounds(config: TimeRangeConfig): { start: Date; end: Date } {
    const now = new Date()
    const end = config.customEnd || now

    let start: Date

    switch (config.range) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break

      case 'yesterday':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
        break

      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break

      case 'two_weeks':
        start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
        break

      case 'month':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break

      case 'quarter':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break

      case 'half_year':
        start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
        break

      case 'year':
        start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break

      case 'current_season':
        start = this.getSeasonStart(now)
        break

      case 'last_season':
        const lastSeasonEnd = this.getSeasonStart(now)
        start = new Date(lastSeasonEnd)
        start.setMonth(start.getMonth() - 3)
        break

      case 'custom':
        start = config.customStart || new Date(0)
        break

      case 'all':
      default:
        start = new Date(0)
        break
    }

    return { start, end }
  }

  /**
   * 获取当前季节的开始日期
   */
  private getSeasonStart(date: Date): Date {
    const year = date.getFullYear()
    const month = date.getMonth()

    // 季节定义: 春(3-5), 夏(6-8), 秋(9-11), 冬(12-2)
    if (month >= 2 && month <= 4) {
      // 春季
      return new Date(year, 2, 1)
    } else if (month >= 5 && month <= 7) {
      // 夏季
      return new Date(year, 5, 1)
    } else if (month >= 8 && month <= 10) {
      // 秋季
      return new Date(year, 8, 1)
    } else {
      // 冬季 (跨年)
      return month === 11 ? new Date(year, 11, 1) : new Date(year - 1, 11, 1)
    }
  }

  /**
   * 获取当前季节
   */
  getCurrentSeason(): Season {
    const month = new Date().getMonth()
    if (month >= 2 && month <= 4) return 'spring'
    if (month >= 5 && month <= 7) return 'summer'
    if (month >= 8 && month <= 10) return 'fall'
    return 'winter'
  }

  /**
   * 应用时间感知过滤和权重调整
   */
  applyTimeAwareness(
    results: KnowledgeSearchResult[],
    config?: Partial<TimeAwareConfig>
  ): Array<KnowledgeSearchResult & { timeAwareResult?: TimeAwareResult }> {
    const mergedConfig = { ...this.config, ...config }

    if (!mergedConfig.enabled || mergedConfig.timeRange.range === 'all') {
      return results
    }

    const { start, end } = this.getTimeRangeBounds(mergedConfig.timeRange)

    logger.debug('Applying time awareness', {
      range: mergedConfig.timeRange.range,
      start: start.toISOString(),
      end: end.toISOString()
    })

    const filteredResults: Array<KnowledgeSearchResult & { timeAwareResult?: TimeAwareResult }> = []

    for (const result of results) {
      // 尝试从元数据中获取日期
      const dateValue = result.metadata?.[mergedConfig.dateField!]
      let documentDate: Date | undefined

      if (dateValue) {
        documentDate = new Date(dateValue)
        if (isNaN(documentDate.getTime())) {
          documentDate = undefined
        }
      }

      // 如果没有日期，默认保留
      if (!documentDate) {
        filteredResults.push({
          ...result,
          timeAwareResult: {
            originalScore: result.score,
            timeAdjustedScore: result.score
          }
        })
        continue
      }

      // 时间范围过滤
      if (documentDate < start || documentDate > end) {
        continue
      }

      // 计算时间衰减
      let adjustedScore = result.score
      let decayFactor = 1.0

      if (mergedConfig.decayEnabled) {
        const ageInDays = (end.getTime() - documentDate.getTime()) / (24 * 60 * 60 * 1000)
        const halfLife = mergedConfig.decayHalfLife || 30

        // 指数衰减: score * 0.5^(age/halfLife)
        decayFactor = Math.pow(0.5, ageInDays / halfLife)
        adjustedScore = result.score * (0.7 + 0.3 * decayFactor) // 最多衰减 30%
      }

      filteredResults.push({
        ...result,
        score: adjustedScore,
        timeAwareResult: {
          originalScore: result.score,
          timeAdjustedScore: adjustedScore,
          documentDate,
          ageInDays: (end.getTime() - documentDate.getTime()) / (24 * 60 * 60 * 1000),
          decayFactor
        }
      })
    }

    // 按调整后的分数排序
    filteredResults.sort((a, b) => b.score - a.score)

    logger.debug('Time awareness applied', {
      originalCount: results.length,
      filteredCount: filteredResults.length
    })

    return filteredResults
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<TimeAwareConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取配置
   */
  getConfig(): TimeAwareConfig {
    return { ...this.config }
  }
}

// 导出工厂函数
export function createTimeAwareSearchService(config?: Partial<TimeAwareConfig>): TimeAwareSearchService {
  return new TimeAwareSearchService(config)
}
