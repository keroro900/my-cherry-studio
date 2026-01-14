/**
 * 预设收藏 Hook
 *
 * 提供预设收藏功能，支持：
 * - localStorage 持久化
 * - 收藏切换
 * - 收藏状态检查
 *
 * @module hooks/usePresetFavorites
 * @created Phase 4 - 收藏持久化 Hook
 */

import { loggerService } from '@logger'
import { useCallback, useEffect, useState } from 'react'

const logger = loggerService.withContext('PresetFavorites')

// ==================== 常量 ====================

/** 最大收藏数量 */
const MAX_FAVORITES = 50

// ==================== 类型定义 ====================

export interface UsePresetFavoritesOptions {
  /** localStorage 存储键名 */
  storageKey: string
  /** 最大收藏数量（默认 50） */
  maxItems?: number
}

export interface UsePresetFavoritesReturn {
  /** 收藏的预设 ID 列表 */
  favoriteIds: string[]
  /** 检查预设是否已收藏 */
  isFavorite: (id: string) => boolean
  /** 切换收藏状态 */
  toggleFavorite: (id: string) => void
  /** 添加到收藏 */
  addFavorite: (id: string) => void
  /** 从收藏移除 */
  removeFavorite: (id: string) => void
  /** 清空所有收藏 */
  clearFavorites: () => void
  /** 收藏数量 */
  count: number
}

// ==================== 辅助函数 ====================

/**
 * 从 localStorage 读取收藏列表
 */
function loadFavorites(storageKey: string): string[] {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string')
      }
    }
  } catch (error) {
    logger.warn(`Failed to load favorites from localStorage (${storageKey})`, error as Error)
  }
  return []
}

/**
 * 保存收藏列表到 localStorage
 */
function saveFavorites(storageKey: string, favorites: string[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(favorites))
  } catch (error) {
    logger.warn(`Failed to save favorites to localStorage (${storageKey})`, error as Error)
  }
}

// ==================== Hook 实现 ====================

/**
 * 预设收藏 Hook
 *
 * @example
 * // 基础用法
 * const { favoriteIds, isFavorite, toggleFavorite } = usePresetFavorites({
 *   storageKey: 'workflow-preset-favorites'
 * })
 *
 * // 在 PresetCard 中使用
 * <PresetCard
 *   isFavorite={isFavorite(preset.id)}
 *   onFavoriteToggle={toggleFavorite}
 * />
 *
 * @example
 * // 在 PresetGalleryModal 中使用
 * <PresetGalleryModal
 *   favoriteIds={favoriteIds}
 *   onFavoriteToggle={toggleFavorite}
 * />
 */
export function usePresetFavorites({
  storageKey,
  maxItems = MAX_FAVORITES
}: UsePresetFavoritesOptions): UsePresetFavoritesReturn {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadFavorites(storageKey))

  // 同步到 localStorage
  useEffect(() => {
    saveFavorites(storageKey, favoriteIds)
  }, [storageKey, favoriteIds])

  // 检查是否已收藏
  const isFavorite = useCallback((id: string): boolean => favoriteIds.includes(id), [favoriteIds])

  // 切换收藏状态
  const toggleFavorite = useCallback(
    (id: string): void => {
      setFavoriteIds((prev) => {
        if (prev.includes(id)) {
          return prev.filter((fid) => fid !== id)
        } else {
          // 限制最大数量
          const newList = [id, ...prev]
          return newList.slice(0, maxItems)
        }
      })
    },
    [maxItems]
  )

  // 添加到收藏
  const addFavorite = useCallback(
    (id: string): void => {
      setFavoriteIds((prev) => {
        if (prev.includes(id)) return prev
        const newList = [id, ...prev]
        return newList.slice(0, maxItems)
      })
    },
    [maxItems]
  )

  // 从收藏移除
  const removeFavorite = useCallback((id: string): void => {
    setFavoriteIds((prev) => prev.filter((fid) => fid !== id))
  }, [])

  // 清空所有收藏
  const clearFavorites = useCallback((): void => {
    setFavoriteIds([])
  }, [])

  return {
    favoriteIds,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    clearFavorites,
    count: favoriteIds.length
  }
}
