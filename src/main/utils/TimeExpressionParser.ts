/**
 * TimeExpressionParser - 自然语言时间表达式解析器
 *
 * 从 VCPToolBox/Plugin/RAGDiaryPlugin/timeExpressions.config.js 移植
 *
 * 功能：
 * - 解析中文/英文自然语言时间表达式
 * - 支持硬编码表达式 (今天、昨天、上周、本月等)
 * - 支持动态模式 (N天前、上周一等)
 * - 中文数字转换 (一、二、十一等)
 *
 * @example
 * const parser = new TimeExpressionParser('zh-CN')
 * const ranges = parser.parse('帮我找上周的日记')
 * // => [{ start: Date, end: Date }]
 */

import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

// 扩展 dayjs 插件
dayjs.extend(utc)
dayjs.extend(timezone)

// ======================== 类型定义 ========================

export interface TimeRange {
  start: Date
  end: Date
}

interface HardcodedExpression {
  days?: number
  type?: TimeRangeType
}

type TimeRangeType =
  | 'lastWeek'
  | 'thisWeek'
  | 'lastMonth'
  | 'thisMonth'
  | 'thisMonthStart'
  | 'lastMonthStart'
  | 'lastMonthMid'
  | 'lastMonthEnd'

interface PatternConfig {
  regex: RegExp
  type: PatternType
}

type PatternType = 'daysAgo' | 'lastWeekday' | 'weeksAgo' | 'monthsAgo' | 'timeRange' | 'season'

interface LocaleExpressions {
  hardcoded: Record<string, HardcodedExpression>
  patterns: PatternConfig[]
}

export type SupportedLocale = 'zh-CN' | 'en-US'

// ======================== 时间表达式配置 ========================

const TIME_EXPRESSIONS: Record<SupportedLocale, LocaleExpressions> = {
  'zh-CN': {
    hardcoded: {
      // 基础时间词
      今天: { days: 0 },
      昨天: { days: 1 },
      前天: { days: 2 },
      大前天: { days: 3 },

      // 模糊时间词
      之前: { days: 3 }, // "之前"通常指代不久前，暂定3天
      最近: { days: 5 },
      前几天: { days: 5 },
      前一阵子: { days: 15 },
      近期: { days: 7 },

      // 周/月相关
      上周: { type: 'lastWeek' },
      上个月: { type: 'lastMonth' },
      本周: { type: 'thisWeek' },
      这周: { type: 'thisWeek' },
      本月: { type: 'thisMonth' },
      这个月: { type: 'thisMonth' },
      月初: { type: 'thisMonthStart' }, // 例如本月初
      上个月初: { type: 'lastMonthStart' },
      上个月中: { type: 'lastMonthMid' },
      上个月末: { type: 'lastMonthEnd' }
    },
    patterns: [
      {
        // 匹配 "3天前" 或 "三天前"
        regex: /(\d+|[一二三四五六七八九十]+)天前/,
        type: 'daysAgo'
      },
      {
        // 匹配 "上周一" ... "上周日", "上周天"
        regex: /上周([一二三四五六日天])/,
        type: 'lastWeekday'
      },
      {
        // 匹配 "x周前"
        regex: /(\d+|[一二三四五六七八九十]+)周前/,
        type: 'weeksAgo'
      },
      {
        // 匹配 "x个月前"
        regex: /(\d+|[一二三四五六七八九十]+)个月前/,
        type: 'monthsAgo'
      },
      {
        // 匹配时间范围: "从X到Y", "X到Y", "X至Y"
        // 例如: "从上周一到这周三", "昨天到今天", "上周五到本周一"
        regex: /(?:从)?(上周[一二三四五六日天]|前天|昨天|今天|本周[一二三四五六日天]|这周[一二三四五六日天]|(\d+|[一二三四五六七八九十]+)天前)[到至](上周[一二三四五六日天]|前天|昨天|今天|本周[一二三四五六日天]|这周[一二三四五六日天]|(\d+|[一二三四五六七八九十]+)天前)/,
        type: 'timeRange'
      },
      {
        // 匹配季节表达式: "去年夏天", "今年春天", "前年秋天"
        regex: /(去年|今年|前年|大前年|明年)(春天|夏天|秋天|冬天|春季|夏季|秋季|冬季)/,
        type: 'season'
      }
    ]
  },
  'en-US': {
    hardcoded: {
      today: { days: 0 },
      yesterday: { days: 1 },
      recently: { days: 5 },
      lately: { days: 7 },
      'a while ago': { days: 15 },
      'last week': { type: 'lastWeek' },
      'last month': { type: 'lastMonth' },
      'this week': { type: 'thisWeek' },
      'this month': { type: 'thisMonth' }
    },
    patterns: [
      {
        regex: /(\d+) days? ago/i,
        type: 'daysAgo'
      },
      {
        regex: /last (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
        type: 'lastWeekday'
      },
      {
        regex: /(\d+) weeks? ago/i,
        type: 'weeksAgo'
      },
      {
        regex: /(\d+) months? ago/i,
        type: 'monthsAgo'
      }
    ]
  }
}

// ======================== 工具函数 ========================

/**
 * 中文数字转阿拉伯数字
 * 支持: 一 到 九十九, 以及 "日"/"天" 映射到 7
 *
 * @example
 * chineseToNumber('三') // => 3
 * chineseToNumber('十一') // => 11
 * chineseToNumber('二十三') // => 23
 */
export function chineseToNumber(chinese: string): number {
  const numMap: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    日: 7, // 特殊映射: 上周日 => 星期天
    天: 7 // 特殊映射: 上周天 => 星期天
  }

  // 直接映射
  if (numMap[chinese] !== undefined) {
    return numMap[chinese]
  }

  // 单独的 "十"
  if (chinese === '十') return 10

  // 处理 "十一" 到 "九十九"
  if (chinese.includes('十')) {
    const parts = chinese.split('十')
    const tensPart = parts[0]
    const onesPart = parts[1]

    let total = 0

    if (tensPart === '') {
      // "十"开头, e.g., "十三"
      total = 10
    } else {
      // "二"开头, e.g., "二十三"
      total = (numMap[tensPart] || 1) * 10
    }

    if (onesPart) {
      // e.g., "二十三" 的 "三"
      total += numMap[onesPart] || 0
    }

    return total
  }

  // 尝试解析阿拉伯数字
  return parseInt(chinese, 10) || 0
}

/**
 * 英文星期名转星期数 (0 = Sunday, 6 = Saturday)
 */
function englishWeekdayToNumber(weekday: string): number {
  const map: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  }
  return map[weekday.toLowerCase()] ?? -1
}

// ======================== TimeExpressionParser 类 ========================

export class TimeExpressionParser {
  private locale: SupportedLocale
  private expressions: LocaleExpressions
  private timezone: string

  /**
   * 创建时间表达式解析器
   *
   * @param locale 语言区域 ('zh-CN' | 'en-US')
   * @param timezone 时区 (默认 'Asia/Shanghai')
   */
  constructor(locale: SupportedLocale = 'zh-CN', timezone = 'Asia/Shanghai') {
    this.locale = locale
    this.expressions = TIME_EXPRESSIONS[locale] || TIME_EXPRESSIONS['zh-CN']
    this.timezone = timezone
  }

  /**
   * 切换语言区域
   */
  setLocale(locale: SupportedLocale): void {
    this.locale = locale
    this.expressions = TIME_EXPRESSIONS[locale] || TIME_EXPRESSIONS['zh-CN']
  }

  /**
   * 设置时区
   */
  setTimezone(timezone: string): void {
    this.timezone = timezone
  }

  /**
   * 获取一天的开始和结束边界
   */
  private getDayBoundaries(date: Date | Dayjs): TimeRange {
    const start = dayjs(date).tz(this.timezone).startOf('day')
    const end = dayjs(date).tz(this.timezone).endOf('day')
    return { start: start.toDate(), end: end.toDate() }
  }

  /**
   * 获取特殊时间范围 (周/月)
   */
  private getSpecialRange(now: Dayjs, type: TimeRangeType): TimeRange {
    let start = now.clone().startOf('day')
    let end = now.clone().endOf('day')

    switch (type) {
      case 'thisWeek':
        start = now.clone().startOf('week')
        end = now.clone().endOf('week')
        break
      case 'lastWeek':
        start = now.clone().subtract(1, 'week').startOf('week')
        end = now.clone().subtract(1, 'week').endOf('week')
        break
      case 'thisMonth':
        start = now.clone().startOf('month')
        end = now.clone().endOf('month')
        break
      case 'lastMonth':
        start = now.clone().subtract(1, 'month').startOf('month')
        end = now.clone().subtract(1, 'month').endOf('month')
        break
      case 'thisMonthStart': // 本月初（1-10号）
        start = now.clone().startOf('month')
        end = now.clone().date(10).endOf('day')
        break
      case 'lastMonthStart': // 上月初（1-10号）
        start = now.clone().subtract(1, 'month').startOf('month')
        end = start.clone().date(10).endOf('day')
        break
      case 'lastMonthMid': // 上月中（11-20号）
        start = now.clone().subtract(1, 'month').startOf('month').date(11).startOf('day')
        end = now.clone().subtract(1, 'month').startOf('month').date(20).endOf('day')
        break
      case 'lastMonthEnd': // 上月末（21号到月底）
        start = now.clone().subtract(1, 'month').startOf('month').date(21).startOf('day')
        end = now.clone().subtract(1, 'month').endOf('month')
        break
    }

    return { start: start.toDate(), end: end.toDate() }
  }

  /**
   * 处理动态模式匹配
   */
  private handleDynamicPattern(match: RegExpExecArray, type: PatternType, now: Dayjs): TimeRange | null {
    const numStr = match[1]

    switch (type) {
      case 'daysAgo': {
        const num = chineseToNumber(numStr)
        const targetDate = now.clone().subtract(num, 'day')
        return this.getDayBoundaries(targetDate.toDate())
      }

      case 'weeksAgo': {
        const num = chineseToNumber(numStr)
        const weekStart = now.clone().subtract(num, 'week').startOf('week')
        const weekEnd = now.clone().subtract(num, 'week').endOf('week')
        return { start: weekStart.toDate(), end: weekEnd.toDate() }
      }

      case 'monthsAgo': {
        const num = chineseToNumber(numStr)
        const monthStart = now.clone().subtract(num, 'month').startOf('month')
        const monthEnd = now.clone().subtract(num, 'month').endOf('month')
        return { start: monthStart.toDate(), end: monthEnd.toDate() }
      }

      case 'lastWeekday': {
        // 中文星期映射
        const zhWeekdayMap: Record<string, number> = {
          一: 1,
          二: 2,
          三: 3,
          四: 4,
          五: 5,
          六: 6,
          日: 0,
          天: 0
        }

        let targetWeekday: number

        if (this.locale === 'zh-CN') {
          targetWeekday = zhWeekdayMap[numStr]
          if (targetWeekday === undefined) return null
        } else {
          targetWeekday = englishWeekdayToNumber(numStr)
          if (targetWeekday < 0) return null
        }

        // dayjs 的 day() 方法返回 0 (Sunday) 到 6 (Saturday)
        let lastWeekDate = now.clone().day(targetWeekday)

        // 如果计算出的日期是今天或未来，则减去一周
        if (lastWeekDate.isSame(now, 'day') || lastWeekDate.isAfter(now)) {
          lastWeekDate = lastWeekDate.subtract(1, 'week')
        }

        return this.getDayBoundaries(lastWeekDate.toDate())
      }

      case 'timeRange': {
        // 处理时间范围表达式: "从X到Y" 或 "X到Y"
        const fullMatch = match[0]
        // 提取开始和结束时间点
        const rangeMatch = fullMatch.match(
          /(?:从)?(上周[一二三四五六日天]|前天|昨天|今天|本周[一二三四五六日天]|这周[一二三四五六日天]|(?:\d+|[一二三四五六七八九十]+)天前)[到至](上周[一二三四五六日天]|前天|昨天|今天|本周[一二三四五六日天]|这周[一二三四五六日天]|(?:\d+|[一二三四五六七八九十]+)天前)/
        )

        if (!rangeMatch) return null

        const startExpr = rangeMatch[1]
        const endExpr = rangeMatch[2]

        const startDate = this.resolveTimePoint(startExpr, now)
        const endDate = this.resolveTimePoint(endExpr, now)

        if (!startDate || !endDate) return null

        // 确保 start <= end
        const actualStart = startDate.isBefore(endDate) ? startDate : endDate
        const actualEnd = startDate.isBefore(endDate) ? endDate : startDate

        return {
          start: actualStart.startOf('day').toDate(),
          end: actualEnd.endOf('day').toDate()
        }
      }

      case 'season': {
        // 处理季节表达式: "去年夏天", "今年春天"
        const yearExpr = match[1] // "去年", "今年", "前年"
        const seasonExpr = match[2] // "春天", "夏天", "秋天", "冬天"

        // 计算年份偏移
        let yearOffset = 0
        switch (yearExpr) {
          case '大前年':
            yearOffset = -3
            break
          case '前年':
            yearOffset = -2
            break
          case '去年':
            yearOffset = -1
            break
          case '今年':
            yearOffset = 0
            break
          case '明年':
            yearOffset = 1
            break
        }

        const targetYear = now.clone().add(yearOffset, 'year').year()

        // 计算季节的月份范围 (北半球)
        let startMonth: number
        let endMonth: number
        switch (seasonExpr) {
          case '春天':
          case '春季':
            startMonth = 3
            endMonth = 5
            break
          case '夏天':
          case '夏季':
            startMonth = 6
            endMonth = 8
            break
          case '秋天':
          case '秋季':
            startMonth = 9
            endMonth = 11
            break
          case '冬天':
          case '冬季':
            // 冬天跨年: 12月到次年2月
            // 简化处理: 使用 12月-2月，但以指定年份为准
            startMonth = 12
            endMonth = 2
            break
          default:
            return null
        }

        if (seasonExpr === '冬天' || seasonExpr === '冬季') {
          // 冬天特殊处理: 12月到次年2月
          const winterStart = dayjs(`${targetYear}-12-01`).startOf('month')
          const winterEnd = dayjs(`${targetYear + 1}-02-01`).endOf('month')
          return { start: winterStart.toDate(), end: winterEnd.toDate() }
        }

        const seasonStart = dayjs(`${targetYear}-${startMonth.toString().padStart(2, '0')}-01`).startOf('month')
        const seasonEnd = dayjs(`${targetYear}-${endMonth.toString().padStart(2, '0')}-01`).endOf('month')

        return { start: seasonStart.toDate(), end: seasonEnd.toDate() }
      }
    }

    return null
  }

  /**
   * 解析单个时间点表达式为 Dayjs 对象
   * 用于 timeRange 模式
   */
  private resolveTimePoint(expr: string, now: Dayjs): Dayjs | null {
    // 处理"今天"、"昨天"、"前天"
    if (expr === '今天') return now.clone()
    if (expr === '昨天') return now.clone().subtract(1, 'day')
    if (expr === '前天') return now.clone().subtract(2, 'day')

    // 处理"N天前"
    const daysAgoMatch = expr.match(/(\d+|[一二三四五六七八九十]+)天前/)
    if (daysAgoMatch) {
      const num = chineseToNumber(daysAgoMatch[1])
      return now.clone().subtract(num, 'day')
    }

    // 处理"上周X"
    const lastWeekMatch = expr.match(/上周([一二三四五六日天])/)
    if (lastWeekMatch) {
      const zhWeekdayMap: Record<string, number> = {
        一: 1,
        二: 2,
        三: 3,
        四: 4,
        五: 5,
        六: 6,
        日: 0,
        天: 0
      }
      const targetWeekday = zhWeekdayMap[lastWeekMatch[1]]
      if (targetWeekday !== undefined) {
        let lastWeekDate = now.clone().day(targetWeekday)
        if (lastWeekDate.isSame(now, 'day') || lastWeekDate.isAfter(now)) {
          lastWeekDate = lastWeekDate.subtract(1, 'week')
        }
        return lastWeekDate
      }
    }

    // 处理"本周X"或"这周X"
    const thisWeekMatch = expr.match(/(?:本周|这周)([一二三四五六日天])/)
    if (thisWeekMatch) {
      const zhWeekdayMap: Record<string, number> = {
        一: 1,
        二: 2,
        三: 3,
        四: 4,
        五: 5,
        六: 6,
        日: 0,
        天: 0
      }
      const targetWeekday = zhWeekdayMap[thisWeekMatch[1]]
      if (targetWeekday !== undefined) {
        return now.clone().day(targetWeekday)
      }
    }

    return null
  }

  /**
   * 解析文本中的所有时间表达式
   *
   * @param text 输入文本
   * @returns 时间范围数组 (已去重)
   *
   * @example
   * parser.parse('帮我找上周的日记')
   * // => [{ start: 2026-01-01T00:00:00, end: 2026-01-07T23:59:59 }]
   *
   * parser.parse('三天前和昨天的记录')
   * // => [{ start: ..., end: ... }, { start: ..., end: ... }]
   */
  parse(text: string): TimeRange[] {
    const now = dayjs().tz(this.timezone)
    let remainingText = text
    const results: TimeRange[] = []

    // 1. 检查硬编码表达式 (从长到短排序，避免短表达式先匹配)
    const sortedHardcodedKeys = Object.keys(this.expressions.hardcoded).sort((a, b) => b.length - a.length)

    for (const expr of sortedHardcodedKeys) {
      if (remainingText.includes(expr)) {
        const config = this.expressions.hardcoded[expr]
        let result: TimeRange | null = null

        if (config.days !== undefined) {
          const targetDate = now.subtract(config.days, 'day')
          result = this.getDayBoundaries(targetDate)
        } else if (config.type) {
          result = this.getSpecialRange(now, config.type)
        }

        if (result) {
          results.push(result)
          remainingText = remainingText.replace(expr, '') // 消费掉匹配的部分
        }
      }
    }

    // 2. 检查动态模式
    for (const pattern of this.expressions.patterns) {
      const globalRegex = new RegExp(pattern.regex.source, pattern.regex.flags.includes('g') ? pattern.regex.flags : pattern.regex.flags + 'g')
      let match: RegExpExecArray | null

      while ((match = globalRegex.exec(remainingText)) !== null) {
        const result = this.handleDynamicPattern(match, pattern.type, now)
        if (result) {
          results.push(result)
          // 简单替换，可能不完美但能处理多数情况
          remainingText = remainingText.replace(match[0], '')
        }
      }
    }

    if (results.length === 0) {
      return []
    }

    // 3. 去重 (使用时间戳)
    const uniqueRanges = new Map<string, TimeRange>()
    results.forEach((r) => {
      const key = `${r.start.getTime()}|${r.end.getTime()}`
      if (!uniqueRanges.has(key)) {
        uniqueRanges.set(key, r)
      }
    })

    return Array.from(uniqueRanges.values())
  }

  /**
   * 检查文本是否包含时间表达式
   */
  hasTimeExpression(text: string): boolean {
    // 检查硬编码表达式
    for (const expr of Object.keys(this.expressions.hardcoded)) {
      if (text.includes(expr)) {
        return true
      }
    }

    // 检查动态模式
    for (const pattern of this.expressions.patterns) {
      if (pattern.regex.test(text)) {
        return true
      }
    }

    return false
  }

  /**
   * 获取支持的表达式列表 (用于帮助文档)
   */
  getSupportedExpressions(): { hardcoded: string[]; patterns: string[] } {
    return {
      hardcoded: Object.keys(this.expressions.hardcoded),
      patterns: this.expressions.patterns.map((p) => p.regex.source)
    }
  }
}

// ======================== 单例管理 ========================

let timeParserInstance: TimeExpressionParser | null = null

/**
 * 获取 TimeExpressionParser 单例
 */
export function getTimeExpressionParser(locale: SupportedLocale = 'zh-CN', timezone?: string): TimeExpressionParser {
  if (!timeParserInstance) {
    timeParserInstance = new TimeExpressionParser(locale, timezone)
  }
  return timeParserInstance
}

/**
 * 便捷函数: 解析时间表达式
 */
export function parseTimeExpressions(text: string, locale: SupportedLocale = 'zh-CN'): TimeRange[] {
  return getTimeExpressionParser(locale).parse(text)
}

/**
 * 便捷函数: 检查是否包含时间表达式
 */
export function hasTimeExpression(text: string, locale: SupportedLocale = 'zh-CN'): boolean {
  return getTimeExpressionParser(locale).hasTimeExpression(text)
}

export default TimeExpressionParser
