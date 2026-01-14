/**
 * useIntegratedMemory - 统一记忆协调器 React Hook
 *
 * 提供渲染进程访问 IntegratedMemoryCoordinator 的便捷接口
 * 整合 UnifiedMemoryManager、MemoryMasterService、SelfLearningService
 */

import { useCallback, useState } from 'react'

// ==================== 类型定义 ====================

/**
 * 创建的记忆条目 (渲染进程类型)
 *
 * 对应主进程的 CreatedMemoryEntry 类型 (@main/services/memory/IntegratedMemoryCoordinator)
 * 由于进程隔离，需要在此重新定义
 */
export interface CreatedMemoryEntry {
  id: string
  content: string
  title?: string
  tags: string[]
  backend: string
  createdAt: Date
  metadata?: Record<string, unknown>
}

export interface EnhancedSearchResult {
  id: string
  content: string
  score: number
  backend: string
  matchedTags?: string[]
  metadata?: Record<string, unknown>
  learning?: {
    appliedWeight: number
    rawScore: number
    matchedLearningTags: string[]
    userSelectionCount: number
  }
}

export interface IntegratedMemoryStats {
  memoryStats: {
    totalDocuments: number
    backends: Record<string, { count: number; lastUpdated?: Date }>
  }
  learningStats: {
    totalTags: number
    totalQueries: number
    totalFeedback: number
    pendingSuggestions: number
    topTags: Array<{ tag: string; weight: number; queryCount: number }>
  }
  tagPoolStats: {
    totalTags: number
    topTags: string[]
    recentTags: string[]
  }
}

export interface LearningProgress {
  queryCount: number
  feedbackCount: number
  tagWeightRange: { min: number; max: number }
  topLearningTags: Array<{ tag: string; weight: number }>
}

export interface IntegratedMemoryConfig {
  memoryMaster: {
    enabled: boolean
    autoTagOnCreate: boolean
    defaultModelId?: string
    defaultProviderId?: string
    maxTags: number
  }
  selfLearning: {
    enabled: boolean
    recordQueries: boolean
    applyWeights: boolean
    decayHalfLifeDays: number
    feedbackGain: number
    feedbackDecay: number
  }
  search: {
    defaultBackends: Array<'knowledge' | 'diary' | 'memory' | 'lightmemo' | 'deepmemo' | 'meshmemo'>
    useRRF: boolean
    rrfK: number
    defaultTopK: number
    minThreshold: number
  }
}

export type MemoryBackendType = 'knowledge' | 'diary' | 'memory' | 'lightmemo' | 'deepmemo' | 'meshmemo'

// ==================== Hook 实现 ====================

/**
 * 统一记忆协调器 Hook
 */
export function useIntegratedMemory() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ==================== 记忆创建 ====================

  /**
   * 创建记忆 (带自动补标)
   */
  const createMemory = useCallback(
    async (params: {
      content: string
      title?: string
      backend?: 'diary' | 'memory' | 'notes'
      tags?: string[]
      autoTag?: boolean
      modelId?: string
      providerId?: string
      metadata?: Record<string, unknown>
    }): Promise<CreatedMemoryEntry | null> => {
      setLoading(true)
      setError(null)
      try {
        const result = await window.api.integratedMemory.create(params)
        if (result.success && result.entry) {
          return result.entry as CreatedMemoryEntry
        }
        setError(result.error || '创建记忆失败')
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
   * 批量创建记忆
   */
  const batchCreateMemories = useCallback(
    async (
      entries: Array<{ content: string; title?: string; tags?: string[] }>,
      options?: {
        autoTag?: boolean
        backend?: 'diary' | 'memory' | 'notes'
        modelId?: string
        providerId?: string
      }
    ): Promise<CreatedMemoryEntry[]> => {
      setLoading(true)
      setError(null)
      try {
        const result = await window.api.integratedMemory.batchCreate({ entries, options })
        if (result.success && result.entries) {
          return result.entries as CreatedMemoryEntry[]
        }
        setError(result.error || '批量创建失败')
        return []
      } catch (err) {
        setError(String(err))
        return []
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // ==================== 智能搜索 ====================

  /**
   * 智能搜索 (自动应用学习权重)
   */
  const intelligentSearch = useCallback(
    async (
      query: string,
      options?: {
        backends?: MemoryBackendType[]
        topK?: number
        threshold?: number
        applyLearning?: boolean
        recordQuery?: boolean
        userId?: string
        agentId?: string
        knowledgeBaseId?: string
      }
    ): Promise<EnhancedSearchResult[]> => {
      setLoading(true)
      setError(null)
      try {
        const result = await window.api.integratedMemory.intelligentSearch({ query, options })
        if (result.success && result.results) {
          return result.results as EnhancedSearchResult[]
        }
        setError(result.error || '搜索失败')
        return []
      } catch (err) {
        setError(String(err))
        return []
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /**
   * 获取搜索建议
   */
  const getSuggestions = useCallback(async (partialQuery: string, limit?: number): Promise<string[]> => {
    try {
      const result = await window.api.integratedMemory.getSuggestions({ partialQuery, limit })
      if (result.success && result.suggestions) {
        return result.suggestions
      }
      return []
    } catch {
      return []
    }
  }, [])

  // ==================== 反馈学习 ====================

  /**
   * 记录正向反馈
   */
  const recordPositiveFeedback = useCallback(
    async (searchId: string, selectedResultId: string, query: string): Promise<boolean> => {
      try {
        const result = await window.api.integratedMemory.recordPositiveFeedback({
          searchId,
          selectedResultId,
          query
        })
        return result.success
      } catch {
        return false
      }
    },
    []
  )

  /**
   * 记录负向反馈
   */
  const recordNegativeFeedback = useCallback(
    async (searchId: string, ignoredResultId: string, query: string): Promise<boolean> => {
      try {
        const result = await window.api.integratedMemory.recordNegativeFeedback({
          searchId,
          ignoredResultId,
          query
        })
        return result.success
      } catch {
        return false
      }
    },
    []
  )

  // ==================== 统计和状态 ====================

  /**
   * 获取综合统计
   */
  const getStats = useCallback(async (): Promise<IntegratedMemoryStats | null> => {
    setLoading(true)
    try {
      const result = await window.api.integratedMemory.getStats()
      if (result.success && result.stats) {
        return result.stats as IntegratedMemoryStats
      }
      return null
    } catch {
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 获取学习进度
   */
  const getLearningProgress = useCallback(async (): Promise<LearningProgress | null> => {
    try {
      const result = await window.api.integratedMemory.getLearningProgress()
      if (result.success && result.progress) {
        return result.progress as LearningProgress
      }
      return null
    } catch {
      return null
    }
  }, [])

  // ==================== 配置管理 ====================

  /**
   * 获取配置
   */
  const getConfig = useCallback(async (): Promise<IntegratedMemoryConfig | null> => {
    try {
      const result = await window.api.integratedMemory.getConfig()
      if (result.success && result.config) {
        return result.config as IntegratedMemoryConfig
      }
      return null
    } catch {
      return null
    }
  }, [])

  /**
   * 更新配置
   */
  const updateConfig = useCallback(async (updates: Partial<IntegratedMemoryConfig>): Promise<boolean> => {
    try {
      const result = await window.api.integratedMemory.updateConfig(updates)
      return result.success
    } catch {
      return false
    }
  }, [])

  // ==================== 记忆整理 ====================

  /**
   * 智能整理
   */
  const organize = useCallback(
    async (params: {
      backend?: 'diary' | 'memory' | 'lightmemo' | 'deepmemo' | 'meshmemo'
      dateRange?: { start: Date; end: Date }
      tasks: Array<'merge' | 'deduplicate' | 'tag'>
      modelId?: string
      providerId?: string
    }): Promise<{
      success: boolean
      message: string
      processedCount: number
      mergedCount?: number
      taggedCount?: number
      errors?: string[]
    } | null> => {
      setLoading(true)
      setError(null)
      try {
        const result = await window.api.integratedMemory.organize(params)
        if (result.success && result.result) {
          return result.result
        }
        setError(result.error || '整理失败')
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
   * 发现语义关联
   */
  const discoverAssociations = useCallback(async (): Promise<{
    discoveredCount: number
    appliedCount: number
    suggestions: Array<{
      sourceTag: string
      suggestedTag: string
      confidence: number
      discoveredAt: number
      confirmed: boolean
    }>
  } | null> => {
    setLoading(true)
    try {
      const result = await window.api.integratedMemory.discoverAssociations()
      if (result.success) {
        return {
          discoveredCount: result.discoveredCount || 0,
          appliedCount: result.appliedCount || 0,
          suggestions: result.suggestions || []
        }
      }
      return null
    } catch {
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    // 记忆创建
    createMemory,
    batchCreateMemories,
    // 智能搜索
    intelligentSearch,
    getSuggestions,
    // 反馈学习
    recordPositiveFeedback,
    recordNegativeFeedback,
    // 统计和状态
    getStats,
    getLearningProgress,
    // 配置管理
    getConfig,
    updateConfig,
    // 记忆整理
    organize,
    discoverAssociations
  }
}

// ==================== 便捷函数 ====================

/**
 * 快速智能搜索 (不使用 Hook)
 */
export async function quickIntelligentSearch(
  query: string,
  options?: {
    backends?: MemoryBackendType[]
    topK?: number
    threshold?: number
  }
): Promise<EnhancedSearchResult[]> {
  try {
    const result = await window.api.integratedMemory.intelligentSearch({ query, options })
    if (result.success && result.results) {
      return result.results as EnhancedSearchResult[]
    }
    return []
  } catch {
    return []
  }
}

/**
 * 快速创建记忆 (不使用 Hook)
 */
export async function quickCreateMemory(
  content: string,
  options?: {
    title?: string
    backend?: 'diary' | 'memory' | 'notes'
    tags?: string[]
    autoTag?: boolean
  }
): Promise<CreatedMemoryEntry | null> {
  try {
    const result = await window.api.integratedMemory.create({
      content,
      ...options
    })
    if (result.success && result.entry) {
      return result.entry as CreatedMemoryEntry
    }
    return null
  } catch {
    return null
  }
}

export default useIntegratedMemory
