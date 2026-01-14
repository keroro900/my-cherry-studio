/**
 * 预设市场 Hook
 * usePresetMarket
 */

import { useCallback, useEffect, useState } from 'react'

import { presetMarketService } from '../services/PresetMarketService'
import type { ModuleConfig, PresetCategory, PresetFilter, PresetSortBy, StudioModule, StudioPreset } from '../types'

interface UsePresetMarketOptions {
  /** 初始模块筛选 */
  initialModule?: StudioModule | 'all'
  /** 初始分类筛选 */
  initialCategory?: PresetCategory | 'all'
  /** 每页数量 */
  pageSize?: number
}

interface UsePresetMarketReturn {
  /** 预设列表 */
  presets: StudioPreset[]
  /** 总数 */
  total: number
  /** 是否加载中 */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 当前页码 */
  page: number
  /** 是否有更多 */
  hasMore: boolean
  /** 当前筛选条件 */
  filter: PresetFilter
  /** 排序方式 */
  sortBy: PresetSortBy
  /** 升序 */
  ascending: boolean
  /** 设置模块筛选 */
  setModule: (module: StudioModule | 'all') => void
  /** 设置分类筛选 */
  setCategory: (category: PresetCategory | 'all') => void
  /** 设置关键词搜索 */
  setKeyword: (keyword: string) => void
  /** 设置排序 */
  setSortBy: (sortBy: PresetSortBy) => void
  /** 切换排序方向 */
  toggleSortDirection: () => void
  /** 切换仅显示收藏 */
  toggleFavoritesOnly: () => void
  /** 加载更多 */
  loadMore: () => void
  /** 刷新列表 */
  refresh: () => void
  /** 切换收藏 */
  toggleFavorite: (id: string) => void
  /** 应用预设 */
  applyPreset: (id: string) => ModuleConfig | undefined
  /** 删除用户预设 */
  deletePreset: (id: string) => boolean
  /** 复制预设 */
  duplicatePreset: (id: string, newName?: string) => StudioPreset | undefined
}

export function usePresetMarket(options: UsePresetMarketOptions = {}): UsePresetMarketReturn {
  const { initialModule = 'all', initialCategory = 'all', pageSize = 20 } = options

  const [presets, setPresets] = useState<StudioPreset[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const [filter, setFilter] = useState<PresetFilter>({
    module: initialModule,
    category: initialCategory,
    source: 'all',
    favoritesOnly: false,
    keyword: ''
  })

  const [sortBy, setSortByState] = useState<PresetSortBy>('usageCount')
  const [ascending, setAscending] = useState(false)

  // 初始化服务
  useEffect(() => {
    presetMarketService.initialize().catch((err) => {
      setError(err.message)
    })
  }, [])

  // 加载预设
  const loadPresets = useCallback(
    async (resetPage = true) => {
      setLoading(true)
      setError(null)

      try {
        const currentPage = resetPage ? 1 : page
        if (resetPage) setPage(1)

        const result = presetMarketService.queryPresets({
          ...filter,
          sortBy,
          ascending,
          page: currentPage,
          pageSize
        })

        if (resetPage) {
          setPresets(result.presets)
        } else {
          setPresets((prev) => [...prev, ...result.presets])
        }

        setTotal(result.total)
        setHasMore(result.hasMore)
      } catch (err: any) {
        setError(err.message || '加载预设失败')
      } finally {
        setLoading(false)
      }
    },
    [filter, sortBy, ascending, page, pageSize]
  )

  // 当筛选条件变化时重新加载
  useEffect(() => {
    loadPresets(true)
  }, [filter, sortBy, ascending])

  // 设置模块筛选
  const setModule = useCallback((module: StudioModule | 'all') => {
    setFilter((prev) => ({ ...prev, module }))
  }, [])

  // 设置分类筛选
  const setCategory = useCallback((category: PresetCategory | 'all') => {
    setFilter((prev) => ({ ...prev, category }))
  }, [])

  // 设置关键词搜索
  const setKeyword = useCallback((keyword: string) => {
    setFilter((prev) => ({ ...prev, keyword }))
  }, [])

  // 设置排序
  const setSortBy = useCallback((newSortBy: PresetSortBy) => {
    setSortByState(newSortBy)
  }, [])

  // 切换排序方向
  const toggleSortDirection = useCallback(() => {
    setAscending((prev) => !prev)
  }, [])

  // 切换仅显示收藏
  const toggleFavoritesOnly = useCallback(() => {
    setFilter((prev) => ({ ...prev, favoritesOnly: !prev.favoritesOnly }))
  }, [])

  // 加载更多
  const loadMore = useCallback(() => {
    if (!hasMore || loading) return
    setPage((prev) => prev + 1)
    loadPresets(false)
  }, [hasMore, loading, loadPresets])

  // 刷新列表
  const refresh = useCallback(() => {
    loadPresets(true)
  }, [loadPresets])

  // 切换收藏
  const toggleFavorite = useCallback((id: string) => {
    presetMarketService.toggleFavorite(id)
    // 更新本地状态
    setPresets((prev) => prev.map((p) => (p.id === id ? { ...p, isFavorite: !p.isFavorite } : p)))
  }, [])

  // 应用预设
  const applyPreset = useCallback((id: string) => {
    return presetMarketService.applyPreset(id)
  }, [])

  // 删除用户预设
  const deletePreset = useCallback((id: string) => {
    const success = presetMarketService.deletePreset(id)
    if (success) {
      setPresets((prev) => prev.filter((p) => p.id !== id))
      setTotal((prev) => prev - 1)
    }
    return success
  }, [])

  // 复制预设
  const duplicatePreset = useCallback(
    (id: string, newName?: string) => {
      const newPreset = presetMarketService.duplicatePreset(id, newName)
      if (newPreset) {
        // 刷新列表以显示新预设
        loadPresets(true)
      }
      return newPreset
    },
    [loadPresets]
  )

  return {
    presets,
    total,
    loading,
    error,
    page,
    hasMore,
    filter,
    sortBy,
    ascending,
    setModule,
    setCategory,
    setKeyword,
    setSortBy,
    toggleSortDirection,
    toggleFavoritesOnly,
    loadMore,
    refresh,
    toggleFavorite,
    applyPreset,
    deletePreset,
    duplicatePreset
  }
}

export default usePresetMarket
