/**
 * 预设搜索 Hook
 *
 * 提供统一的预设搜索和过滤逻辑，支持：
 * - 关键词搜索
 * - 标签筛选
 * - 自定义搜索函数
 * - 防抖搜索（可选）
 *
 * @module hooks/usePresetSearch
 */

import { useCallback, useMemo, useState } from 'react'

// ==================== 类型定义 ====================

export interface SearchablePreset {
  /** 预设唯一 ID */
  id: string
  /** 显示标题 */
  label: string
  /** 描述文本（可选） */
  description?: string
  /** 标签列表（可选） */
  tags?: string[]
  /** 英文名称（可选，用于搜索） */
  nameEn?: string
}

export interface UsePresetSearchOptions<T extends SearchablePreset> {
  /** 预设数据列表 */
  presets: T[]
  /** 初始关键词 */
  initialKeyword?: string
  /** 初始选中标签 */
  initialTag?: string | null
  /** 自定义搜索过滤函数 */
  customFilter?: (preset: T, keyword: string) => boolean
}

export interface UsePresetSearchReturn<T extends SearchablePreset> {
  /** 搜索关键词 */
  keyword: string
  /** 设置搜索关键词 */
  setKeyword: (value: string) => void
  /** 清除搜索关键词 */
  clearKeyword: () => void
  /** 当前选中的标签 */
  selectedTag: string | null
  /** 设置选中的标签（传入当前标签会取消选中） */
  toggleTag: (tag: string | null) => void
  /** 过滤后的预设列表 */
  filteredPresets: T[]
  /** 所有可用标签（从预设中提取） */
  availableTags: string[]
  /** 是否有搜索/过滤条件 */
  hasFilters: boolean
  /** 重置所有过滤条件 */
  resetFilters: () => void
}

// ==================== 默认搜索函数 ====================

/**
 * 默认搜索过滤函数
 * 搜索 label、description、tags、nameEn 字段
 */
function defaultSearchFilter<T extends SearchablePreset>(preset: T, keyword: string): boolean {
  const kw = keyword.toLowerCase()
  return (
    preset.label.toLowerCase().includes(kw) ||
    (preset.description?.toLowerCase().includes(kw) ?? false) ||
    (preset.tags?.some((tag) => tag.toLowerCase().includes(kw)) ?? false) ||
    (preset.nameEn?.toLowerCase().includes(kw) ?? false)
  )
}

// ==================== Hook 实现 ====================

/**
 * 预设搜索 Hook
 *
 * @example
 * // 基础用法
 * const { keyword, setKeyword, filteredPresets } = usePresetSearch({
 *   presets: patternPresets
 * })
 *
 * @example
 * // 带标签筛选
 * const { keyword, setKeyword, selectedTag, toggleTag, filteredPresets, availableTags } = usePresetSearch({
 *   presets: stylePresets
 * })
 *
 * @example
 * // 自定义搜索函数
 * const { filteredPresets } = usePresetSearch({
 *   presets,
 *   customFilter: (preset, kw) =>
 *     preset.label.includes(kw) || preset.prompt?.includes(kw)
 * })
 */
export function usePresetSearch<T extends SearchablePreset>({
  presets,
  initialKeyword = '',
  initialTag = null,
  customFilter
}: UsePresetSearchOptions<T>): UsePresetSearchReturn<T> {
  const [keyword, setKeyword] = useState(initialKeyword)
  const [selectedTag, setSelectedTag] = useState<string | null>(initialTag)

  // 清除关键词
  const clearKeyword = useCallback(() => {
    setKeyword('')
  }, [])

  // 切换标签
  const toggleTag = useCallback((tag: string | null) => {
    setSelectedTag((prev) => (prev === tag ? null : tag))
  }, [])

  // 重置所有过滤条件
  const resetFilters = useCallback(() => {
    setKeyword('')
    setSelectedTag(null)
  }, [])

  // 计算可用标签
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    presets.forEach((preset) => {
      preset.tags?.forEach((tag) => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [presets])

  // 获取搜索过滤函数
  const searchFilter = customFilter || defaultSearchFilter

  // 过滤预设
  const filteredPresets = useMemo(() => {
    let result = presets

    // 关键词搜索
    if (keyword.trim()) {
      result = result.filter((preset) => searchFilter(preset, keyword))
    }

    // 标签筛选
    if (selectedTag) {
      result = result.filter((preset) => preset.tags?.includes(selectedTag))
    }

    return result
  }, [presets, keyword, selectedTag, searchFilter])

  // 是否有过滤条件
  const hasFilters = keyword.trim().length > 0 || selectedTag !== null

  return {
    keyword,
    setKeyword,
    clearKeyword,
    selectedTag,
    toggleTag,
    filteredPresets,
    availableTags,
    hasFilters,
    resetFilters
  }
}

// ==================== 导出默认搜索函数供外部使用 ====================

export { defaultSearchFilter }
