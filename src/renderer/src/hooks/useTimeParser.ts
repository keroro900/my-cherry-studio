/**
 * useTimeParser - 时间表达式解析器 React Hook
 *
 * 提供渲染进程访问 TimeExpressionParser 的便捷接口
 */

import { useCallback, useState } from 'react'

// ==================== 类型定义 ====================

export type SupportedLocale = 'zh-CN' | 'en-US'

export interface TimeRange {
  expression: string
  start: string // ISO date string
  end: string // ISO date string
  type: string
  originalText: string
}

// ==================== Hook 实现 ====================

/**
 * 时间表达式解析器 Hook
 */
export function useTimeParser() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 解析时间表达式
   */
  const parse = useCallback(async (text: string, locale?: SupportedLocale): Promise<TimeRange[]> => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.timeParser.parse({ text, locale })
      if (result.success) {
        return result.ranges
      }
      setError(result.error || '解析失败')
      return []
    } catch (err) {
      setError(String(err))
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 检查文本是否包含时间表达式
   */
  const hasExpression = useCallback(async (text: string, locale?: SupportedLocale): Promise<boolean> => {
    try {
      const result = await window.api.timeParser.hasExpression({ text, locale })
      return result.success && result.hasExpression
    } catch {
      return false
    }
  }, [])

  /**
   * 获取支持的时间表达式列表
   */
  const getSupportedExpressions = useCallback(
    async (locale?: SupportedLocale): Promise<{ hardcoded: string[]; patterns: string[] } | null> => {
      try {
        const result = await window.api.timeParser.getSupportedExpressions({ locale })
        if (result.success && result.expressions) {
          return result.expressions
        }
        return null
      } catch {
        return null
      }
    },
    []
  )

  /**
   * 设置默认语言区域
   */
  const setLocale = useCallback(async (locale: SupportedLocale): Promise<boolean> => {
    try {
      const result = await window.api.timeParser.setLocale({ locale })
      return result.success
    } catch {
      return false
    }
  }, [])

  return {
    loading,
    error,
    parse,
    hasExpression,
    getSupportedExpressions,
    setLocale
  }
}

// ==================== 便捷函数 ====================

/**
 * 快速解析时间表达式 (不使用 Hook)
 */
export async function quickParseTime(text: string, locale?: SupportedLocale): Promise<TimeRange[]> {
  try {
    const result = await window.api.timeParser.parse({ text, locale })
    if (result.success) {
      return result.ranges
    }
    return []
  } catch {
    return []
  }
}

/**
 * 快速检查是否包含时间表达式 (不使用 Hook)
 */
export async function quickHasTimeExpression(text: string, locale?: SupportedLocale): Promise<boolean> {
  try {
    const result = await window.api.timeParser.hasExpression({ text, locale })
    return result.success && result.hasExpression
  } catch {
    return false
  }
}

export default useTimeParser
