/**
 * 最近使用预设 Hook
 *
 * 提供最近使用预设的追踪功能，支持：
 * - localStorage 持久化
 * - 自动去重（最近使用的放在最前）
 * - 限制最大数量
 *
 * @module hooks/useRecentPresets
 * @created Phase 4 - 最近使用持久化 Hook
 */

import { loggerService } from '@logger'
import { useCallback, useEffect, useState } from 'react'

const logger = loggerService.withContext('RecentPresets')

// ==================== 常量 ====================

/** 最大最近使用数量 */
const MAX_RECENT_ITEMS = 10

// ==================== 类型定义 ====================

export interface UseRecentPresetsOptions {
  /** localStorage 存储键名 */
  storageKey: string
  /** 最大记录数量（默认 10） */
  maxItems?: number
}

export interface UseRecentPresetsReturn {
  /** 最近使用的预设 ID 列表（按时间倒序，最近在前） */
  recentIds: string[]
  /** 添加到最近使用（自动去重并移到最前） */
  addRecent: (id: string) => void
  /** 从最近使用移除 */
  removeRecent: (id: string) => void
  /** 清空最近使用 */
  clearRecent: () => void
  /** 最近使用数量 */
  count: number
}

// ==================== 辅助函数 ====================

/**
 * 从 localStorage 读取最近使用列表
 */
function loadRecent(storageKey: string): string[] {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string')
      }
    }
  } catch (error) {
    logger.warn(`Failed to load recent presets from localStorage (${storageKey})`, error as Error)
  }
  return []
}

/**
 * 保存最近使用列表到 localStorage
 */
function saveRecent(storageKey: string, recent: string[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(recent))
  } catch (error) {
    logger.warn(`Failed to save recent presets to localStorage (${storageKey})`, error as Error)
  }
}

// ==================== Hook 实现 ====================

/**
 * 最近使用预设 Hook
 *
 * @example
 * // 基础用法
 * const { recentIds, addRecent } = useRecentPresets({
 *   storageKey: 'workflow-recent-presets'
 * })
 *
 * // 在选择预设时记录
 * const handleSelect = (preset) => {
 *   addRecent(preset.id)
 *   onSelect(preset)
 * }
 *
 * @example
 * // 显示最近使用列表
 * const recentPresets = allPresets.filter(p => recentIds.includes(p.id))
 */
export function useRecentPresets({
  storageKey,
  maxItems = MAX_RECENT_ITEMS
}: UseRecentPresetsOptions): UseRecentPresetsReturn {
  const [recentIds, setRecentIds] = useState<string[]>(() => loadRecent(storageKey))

  // 同步到 localStorage
  useEffect(() => {
    saveRecent(storageKey, recentIds)
  }, [storageKey, recentIds])

  // 添加到最近使用（自动去重并移到最前）
  const addRecent = useCallback(
    (id: string): void => {
      setRecentIds((prev) => {
        // 移除已存在的（如果有）
        const filtered = prev.filter((rid) => rid !== id)
        // 添加到最前面
        const newList = [id, ...filtered]
        // 限制最大数量
        return newList.slice(0, maxItems)
      })
    },
    [maxItems]
  )

  // 从最近使用移除
  const removeRecent = useCallback((id: string): void => {
    setRecentIds((prev) => prev.filter((rid) => rid !== id))
  }, [])

  // 清空最近使用
  const clearRecent = useCallback((): void => {
    setRecentIds([])
  }, [])

  return {
    recentIds,
    addRecent,
    removeRecent,
    clearRecent,
    count: recentIds.length
  }
}
