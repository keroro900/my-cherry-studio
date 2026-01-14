/**
 * useDiaryFeatures - 日记功能增强 Hook
 *
 * 为笔记页面提供 VCP 日记功能:
 * - 角色日记本列表
 * - 时间表达式搜索
 * - 标签搜索
 * - RAG 语法支持
 */

import { useCallback, useEffect, useState } from 'react'

export interface DiaryBook {
  name: string
  entryCount: number
  latestEntry?: string
}

export interface TimeExpressionResult {
  dateFrom: string
  dateTo: string
  expression: string
}

/**
 * 解析时间表达式
 * 支持: 今天, 昨天, 前天, 这周, 上周, 这个月, 上个月, 过去N天
 */
export function parseTimeExpression(expression: string): TimeExpressionResult | null {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const formatDate = (d: Date) => d.toISOString().split('T')[0]

  const expr = expression.trim().toLowerCase()

  // 今天
  if (expr === '今天' || expr === 'today') {
    return {
      dateFrom: formatDate(today),
      dateTo: formatDate(today),
      expression
    }
  }

  // 昨天
  if (expr === '昨天' || expr === 'yesterday') {
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    return {
      dateFrom: formatDate(yesterday),
      dateTo: formatDate(yesterday),
      expression
    }
  }

  // 前天
  if (expr === '前天') {
    const dayBefore = new Date(today)
    dayBefore.setDate(dayBefore.getDate() - 2)
    return {
      dateFrom: formatDate(dayBefore),
      dateTo: formatDate(dayBefore),
      expression
    }
  }

  // 这周 / 本周
  if (expr === '这周' || expr === '本周' || expr === 'this week') {
    const dayOfWeek = today.getDay() || 7 // 周日为7
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - dayOfWeek + 1) // 周一
    return {
      dateFrom: formatDate(weekStart),
      dateTo: formatDate(today),
      expression
    }
  }

  // 上周
  if (expr === '上周' || expr === 'last week') {
    const dayOfWeek = today.getDay() || 7
    const lastWeekEnd = new Date(today)
    lastWeekEnd.setDate(today.getDate() - dayOfWeek) // 上周日
    const lastWeekStart = new Date(lastWeekEnd)
    lastWeekStart.setDate(lastWeekEnd.getDate() - 6) // 上周一
    return {
      dateFrom: formatDate(lastWeekStart),
      dateTo: formatDate(lastWeekEnd),
      expression
    }
  }

  // 这个月 / 本月
  if (expr === '这个月' || expr === '本月' || expr === 'this month') {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    return {
      dateFrom: formatDate(monthStart),
      dateTo: formatDate(today),
      expression
    }
  }

  // 上个月
  if (expr === '上个月' || expr === 'last month') {
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
    return {
      dateFrom: formatDate(lastMonthStart),
      dateTo: formatDate(lastMonthEnd),
      expression
    }
  }

  // 过去N天 / 最近N天
  const daysMatch = expr.match(/^(过去|最近|last\s*)(\d+)\s*(天|days?)?$/i)
  if (daysMatch) {
    const days = parseInt(daysMatch[2], 10)
    if (days > 0 && days <= 365) {
      const pastDate = new Date(today)
      pastDate.setDate(today.getDate() - days + 1)
      return {
        dateFrom: formatDate(pastDate),
        dateTo: formatDate(today),
        expression
      }
    }
  }

  // 尝试解析日期范围 YYYY-MM-DD 或 YYYY/MM/DD
  const dateRangeMatch = expr.match(/^(\d{4}[-/]\d{2}[-/]\d{2})\s*[~至到-]\s*(\d{4}[-/]\d{2}[-/]\d{2})$/)
  if (dateRangeMatch) {
    return {
      dateFrom: dateRangeMatch[1].replace(/\//g, '-'),
      dateTo: dateRangeMatch[2].replace(/\//g, '-'),
      expression
    }
  }

  // 单个日期
  const singleDateMatch = expr.match(/^(\d{4}[-/]\d{2}[-/]\d{2})$/)
  if (singleDateMatch) {
    const date = singleDateMatch[1].replace(/\//g, '-')
    return {
      dateFrom: date,
      dateTo: date,
      expression
    }
  }

  return null
}

/**
 * 日记功能 Hook
 */
export function useDiaryFeatures() {
  const [diaryBooks, setDiaryBooks] = useState<DiaryBook[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加载日记本列表
  const loadDiaryBooks = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await window.api.vcpDiary.list()
      if (result.success && result.books) {
        setDiaryBooks(
          result.books.map((book) => ({
            name: book.name,
            entryCount: book.entryCount,
            latestEntry: book.latestEntry?.date || book.updatedAt
          }))
        )
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 搜索日记 (支持时间表达式)
  const searchDiary = useCallback(
    async (query: string, options?: { characterName?: string; tags?: string[] }) => {
      setIsLoading(true)
      setError(null)
      try {
        // 检查是否包含时间表达式
        const timeResult = parseTimeExpression(query)

        if (timeResult) {
          // 使用时间范围搜索
          const result = await window.api.vcpDiary.search({
            query: '', // 不限制关键词
            characterName: options?.characterName,
            tags: options?.tags,
            dateFrom: timeResult.dateFrom,
            dateTo: timeResult.dateTo,
            limit: 100
          })
          return result
        }

        // 普通关键词搜索
        const result = await window.api.vcpDiary.search({
          query,
          characterName: options?.characterName,
          tags: options?.tags,
          limit: 100
        })
        return result
      } catch (err) {
        setError(String(err))
        return { success: false, error: String(err) }
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  // 初始加载
  useEffect(() => {
    loadDiaryBooks()
  }, [loadDiaryBooks])

  return {
    diaryBooks,
    isLoading,
    error,
    loadDiaryBooks,
    searchDiary,
    parseTimeExpression
  }
}

/**
 * RAG 语法参考
 */
export const RAG_SYNTAX_REFERENCE = [
  { syntax: '{{日记本}}', description: '全文注入' },
  { syntax: '[[日记本]]', description: 'RAG 片段检索' },
  { syntax: '<<日记本>>', description: '阈值全文' },
  { syntax: '《《日记本》》', description: '阈值 RAG' },
  { syntax: '[[日记本::Time]]', description: '时间感知' },
  { syntax: '[[日记本::TagMemo0.7]]', description: '标签共现增强 (阈值0.7)' },
  { syntax: '[[日记本::Rerank]]', description: '精排重排序' },
  { syntax: '[[日记本::Group(a,b)]]', description: '语义组过滤' },
  { syntax: '[[日记本::AIMemo]]', description: 'AI 综合召回' },
  { syntax: '[[日记本::TopK5]]', description: '限制返回数量' },
  { syntax: '[[日记本:1.5]]', description: '动态 K 值倍数' }
]

export default useDiaryFeatures
