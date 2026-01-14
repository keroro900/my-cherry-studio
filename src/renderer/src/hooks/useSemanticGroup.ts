/**
 * useSemanticGroup - 语义组服务 React Hook
 *
 * 提供渲染进程访问 SemanticGroupService 的便捷接口
 */

import { useCallback, useState } from 'react'

// ==================== 类型定义 ====================

export interface SemanticGroupInfo {
  id: string
  name: string
  description?: string
  keywords: string[]
  priority?: number
  color?: string
}

export interface SemanticGroupStats {
  totalGroups: number
  cachedVectors: number
  cacheHitRate: number
  lastCacheUpdate?: string
}

// ==================== Hook 实现 ====================

/**
 * 语义组服务 Hook
 */
export function useSemanticGroup() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 扩展查询
   */
  const expand = useCallback(
    async (
      query: string,
      options?: { groups?: string[]; maxExpansions?: number }
    ): Promise<{ expandedTerms: string[]; matchedGroups: string[] } | null> => {
      setLoading(true)
      setError(null)
      try {
        const result = await window.api.semanticGroup.expand({
          query,
          groups: options?.groups,
          maxExpansions: options?.maxExpansions
        })
        if (result.success) {
          return {
            expandedTerms: result.expandedTerms || [],
            matchedGroups: result.matchedGroups || []
          }
        }
        setError(result.error || '扩展失败')
        return null
      } catch (err) {
        setError(String(err))
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /**
   * 获取增强向量
   */
  const getEnhancedVector = useCallback(
    async (
      query: string,
      groups?: string[]
    ): Promise<{ vector: number[]; groupContributions: Record<string, number> } | null> => {
      setLoading(true)
      setError(null)
      try {
        const result = await window.api.semanticGroup.getEnhancedVector({ query, groups })
        if (result.success && result.vector) {
          return {
            vector: result.vector,
            groupContributions: result.groupContributions || {}
          }
        }
        setError(result.error || '获取向量失败')
        return null
      } catch (err) {
        setError(String(err))
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /**
   * 列出所有语义组
   */
  const listGroups = useCallback(async (): Promise<SemanticGroupInfo[]> => {
    setLoading(true)
    try {
      const result = await window.api.semanticGroup.listGroups()
      if (result.success && result.groups) {
        return result.groups
      }
      return []
    } catch {
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 添加自定义语义组
   */
  const addGroup = useCallback(async (group: SemanticGroupInfo): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.semanticGroup.addGroup(group)
      if (!result.success) {
        setError(result.error || '添加失败')
      }
      return result.success
    } catch (err) {
      setError(String(err))
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 删除语义组
   */
  const removeGroup = useCallback(async (groupId: string): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.semanticGroup.removeGroup({ groupId })
      if (!result.success) {
        setError(result.error || '删除失败')
      }
      return result.success
    } catch (err) {
      setError(String(err))
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 获取服务统计
   */
  const getStats = useCallback(async (): Promise<SemanticGroupStats | null> => {
    try {
      const result = await window.api.semanticGroup.getStats()
      if (result.success && result.stats) {
        return result.stats
      }
      return null
    } catch {
      return null
    }
  }, [])

  /**
   * 预热缓存
   */
  const warmCache = useCallback(async (): Promise<number> => {
    setLoading(true)
    try {
      const result = await window.api.semanticGroup.warmCache()
      return result.success ? result.cachedCount || 0 : 0
    } catch {
      return 0
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 清除缓存
   */
  const clearCache = useCallback(async (): Promise<boolean> => {
    try {
      const result = await window.api.semanticGroup.clearCache()
      return result.success
    } catch {
      return false
    }
  }, [])

  return {
    loading,
    error,
    expand,
    getEnhancedVector,
    listGroups,
    addGroup,
    removeGroup,
    getStats,
    warmCache,
    clearCache
  }
}

// ==================== 便捷函数 ====================

/**
 * 快速扩展查询 (不使用 Hook)
 */
export async function quickExpandQuery(
  query: string,
  maxExpansions?: number
): Promise<{ expandedTerms: string[]; matchedGroups: string[] }> {
  try {
    const result = await window.api.semanticGroup.expand({ query, maxExpansions })
    if (result.success) {
      return {
        expandedTerms: result.expandedTerms || [],
        matchedGroups: result.matchedGroups || []
      }
    }
    return { expandedTerms: [], matchedGroups: [] }
  } catch {
    return { expandedTerms: [], matchedGroups: [] }
  }
}

/**
 * 快速列出语义组 (不使用 Hook)
 */
export async function quickListGroups(): Promise<SemanticGroupInfo[]> {
  try {
    const result = await window.api.semanticGroup.listGroups()
    if (result.success && result.groups) {
      return result.groups
    }
    return []
  } catch {
    return []
  }
}

export default useSemanticGroup
