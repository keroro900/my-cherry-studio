/**
 * 提示词历史管理 Hook
 *
 * 功能：
 * - 自动保存使用过的提示词
 * - 搜索历史提示词
 * - 收藏常用提示词
 * - 按使用频率排序
 */

import type { PromptHistoryItem } from '@renderer/types'
import { useCallback, useMemo } from 'react'

import { useAppDispatch, useAppSelector } from '../store'
import {
  addPromptHistory,
  clearPromptHistory,
  removePromptHistory,
  selectFavoritePrompts,
  togglePromptFavorite
} from '../store/unifiedPaintings'

// ============================================================================
// 类型定义
// ============================================================================

export interface UsePromptHistoryOptions {
  /** 最大历史记录数 */
  maxItems?: number
  /** 是否按使用频率排序 */
  sortByFrequency?: boolean
}

export interface UsePromptHistoryReturn {
  /** 所有历史记录 */
  history: PromptHistoryItem[]
  /** 收藏的提示词 */
  favorites: PromptHistoryItem[]
  /** 最近使用的提示词 */
  recent: PromptHistoryItem[]
  /** 高频使用的提示词 */
  frequent: PromptHistoryItem[]
  /** 添加到历史 */
  addToHistory: (prompt: string, negativePrompt?: string, modelId?: string, providerId?: string) => void
  /** 从历史中删除 */
  removeFromHistory: (id: string) => void
  /** 清空历史（保留收藏） */
  clearHistory: () => void
  /** 切换收藏状态 */
  toggleFavorite: (id: string) => void
  /** 搜索历史 */
  search: (query: string) => PromptHistoryItem[]
  /** 按模型筛选 */
  filterByModel: (modelId: string) => PromptHistoryItem[]
}

// ============================================================================
// Hook 实现
// ============================================================================

export function usePromptHistory(options: UsePromptHistoryOptions = {}): UsePromptHistoryReturn {
  const { maxItems: _maxItems = 100, sortByFrequency = false } = options
  void _maxItems // 预留参数，后续可用于限制历史记录数量

  const dispatch = useAppDispatch()
  const history = useAppSelector((state) => state.unifiedPaintings?.promptHistory || [])
  const favorites = useAppSelector(selectFavoritePrompts)

  // 最近使用的提示词（按时间排序，取前 10 条）
  const recent = useMemo(() => {
    return [...history].sort((a, b) => b.usedAt - a.usedAt).slice(0, 10)
  }, [history])

  // 高频使用的提示词（按使用次数排序，取前 10 条）
  const frequent = useMemo(() => {
    return [...history].sort((a, b) => b.useCount - a.useCount).slice(0, 10)
  }, [history])

  // 添加到历史
  const addToHistory = useCallback(
    (prompt: string, negativePrompt?: string, modelId?: string, providerId?: string) => {
      if (!prompt.trim()) return

      dispatch(
        addPromptHistory({
          prompt: prompt.trim(),
          negativePrompt: negativePrompt?.trim(),
          modelId,
          providerId
        })
      )
    },
    [dispatch]
  )

  // 从历史中删除
  const removeFromHistory = useCallback(
    (id: string) => {
      dispatch(removePromptHistory(id))
    },
    [dispatch]
  )

  // 清空历史
  const clearHistory = useCallback(() => {
    dispatch(clearPromptHistory())
  }, [dispatch])

  // 切换收藏
  const toggleFavoriteHandler = useCallback(
    (id: string) => {
      dispatch(togglePromptFavorite(id))
    },
    [dispatch]
  )

  // 搜索历史
  const search = useCallback(
    (query: string): PromptHistoryItem[] => {
      if (!query.trim()) return history

      const lowerQuery = query.toLowerCase()
      return history.filter(
        (item) =>
          item.prompt.toLowerCase().includes(lowerQuery) ||
          item.negativePrompt?.toLowerCase().includes(lowerQuery) ||
          item.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
      )
    },
    [history]
  )

  // 按模型筛选
  const filterByModel = useCallback(
    (modelId: string): PromptHistoryItem[] => {
      return history.filter((item) => item.modelId === modelId)
    },
    [history]
  )

  return {
    history: sortByFrequency ? frequent : history,
    favorites,
    recent,
    frequent,
    addToHistory,
    removeFromHistory,
    clearHistory,
    toggleFavorite: toggleFavoriteHandler,
    search,
    filterByModel
  }
}

export default usePromptHistory
