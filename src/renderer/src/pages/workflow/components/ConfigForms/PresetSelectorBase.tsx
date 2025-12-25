/**
 * 预设选择器基础组件
 *
 * 提供统一的预设选择器布局和交互模式。
 *
 * 功能特性：
 * 1. 响应式网格布局
 * 2. 搜索过滤
 * 3. 标签筛选
 * 4. 空状态处理
 *
 * @module components/ConfigForms/PresetSelectorBase
 */

import { SearchOutlined } from '@ant-design/icons'
import { Empty, Input, Tag } from 'antd'
import type { ReactNode } from 'react'
import { Fragment, memo, useCallback, useMemo, useState } from 'react'
import styled from 'styled-components'

// ==================== 样式组件 ====================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const SearchBar = styled.div`
  display: flex;
  gap: 8px;
`

const TagsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 0;
`

const PresetGrid = styled.div<{ $maxHeight?: number | null; $minCardWidth?: number; $layout?: 'grid' | 'flex' }>`
  ${({ $layout, $minCardWidth }) =>
    $layout === 'flex'
      ? `
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `
      : `
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(${$minCardWidth || 180}px, 1fr));
    gap: 8px;
  `}
  max-height: ${({ $maxHeight }) => ($maxHeight ? `${$maxHeight}px` : 'none')};
  overflow-y: ${({ $maxHeight }) => ($maxHeight ? 'auto' : 'visible')};
  padding: 4px;
`

const EmptyWrapper = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
`

// ==================== 预设 Chip 样式 (EcomPresetSelector 风格) ====================

export const PresetChip = styled.div<{ $selected: boolean; $size?: 'small' | 'normal' }>`
  padding: ${(props) => (props.$size === 'small' ? '4px 10px' : '8px 12px')};
  border-radius: ${(props) => (props.$size === 'small' ? '4px' : '6px')};
  border: ${(props) => (props.$selected ? '2px solid var(--ant-color-primary)' : '1px solid var(--ant-color-border)')};
  background-color: ${(props) => (props.$selected ? 'var(--ant-color-primary-bg)' : 'var(--ant-color-bg-elevated)')};
  cursor: pointer;
  font-size: ${(props) => (props.$size === 'small' ? '11px' : '12px')};
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  
  &:hover {
    border-color: var(--ant-color-primary);
  }
`

// ==================== 类型定义 ====================

export interface PresetItem {
  /** 预设唯一 ID */
  id: string
  /** 显示标题 */
  label: string
  /** 描述文本（可选） */
  description?: string
  /** 标签列表（可选） */
  tags?: string[]
}

export interface PresetSelectorBaseProps<T extends PresetItem> {
  /** 预设数据列表 */
  presets: T[]
  /** 选中的预设 ID */
  selectedId?: string
  /** 选择回调 */
  onSelect?: (preset: T) => void
  /** 是否显示搜索栏 */
  showSearch?: boolean
  /** 搜索占位符 */
  searchPlaceholder?: string
  /** 是否显示标签筛选 */
  showTags?: boolean
  /** 可用标签列表（如不提供，从预设中自动提取） */
  availableTags?: string[]
  /** 最大高度 (传 null/undefined 则不限制高度) */
  maxHeight?: number | null
  /** 卡片最小宽度 (仅 grid 模式有效) */
  minCardWidth?: number
  /** 布局模式 */
  layout?: 'grid' | 'flex'
  /** 空状态描述 */
  emptyDescription?: string
  /** 自定义渲染卡片 (如果提供，将使用此函数渲染每个预设) */
  renderCard?: (preset: T, isSelected: boolean) => ReactNode
  /** 如果不提供 renderCard，可以使用默认 Chip 渲染，指定大小 */
  chipSize?: 'small' | 'normal'
  /** 自定义搜索过滤函数 */
  searchFilter?: (preset: T, keyword: string) => boolean
}

// ==================== 主组件 ====================

/**
 * 预设选择器基础组件
 *
 * @example
 * // 基础用法
 * <PresetSelectorBase
 *   presets={patternPresets}
 *   selectedId={selectedId}
 *   onSelect={handleSelect}
 *   renderCard={(preset, isSelected) => (
 *     <PresetCard
 *       title={preset.label}
 *       description={preset.description}
 *       isSelected={isSelected}
 *       onClick={() => handleSelect(preset)}
 *     />
 *   )}
 * />
 *
 * @example
 * // 带搜索和标签
 * <PresetSelectorBase
 *   presets={stylePresets}
 *   showSearch
 *   searchPlaceholder="搜索风格..."
 *   showTags
 *   renderCard={(preset, isSelected) => (
 *     <PresetCard {...} />
 *   )}
 * />
 */
function PresetSelectorBaseInner<T extends PresetItem>({
  presets,
  selectedId,
  onSelect,
  showSearch = false,
  searchPlaceholder = '搜索预设...',
  showTags = false,
  availableTags,
  maxHeight = 400,
  minCardWidth = 180,
  layout = 'grid',
  emptyDescription = '未找到匹配的预设',
  renderCard,
  chipSize = 'normal',
  searchFilter
}: PresetSelectorBaseProps<T>) {
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  // 计算可用标签
  const allTags = useMemo(() => {
    if (availableTags) return availableTags
    const tagSet = new Set<string>()
    presets.forEach((preset) => {
      preset.tags?.forEach((tag) => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [presets, availableTags])

  // 默认搜索过滤
  const defaultSearchFilter = useCallback((preset: T, keyword: string): boolean => {
    const kw = keyword.toLowerCase()
    return (
      preset.label.toLowerCase().includes(kw) ||
      (preset.description?.toLowerCase().includes(kw) ?? false) ||
      (preset.tags?.some((tag) => tag.toLowerCase().includes(kw)) ?? false)
    )
  }, [])

  // 过滤预设
  const filteredPresets = useMemo(() => {
    let result = presets

    // 关键词搜索
    if (searchKeyword) {
      const filterFn = searchFilter || defaultSearchFilter
      result = result.filter((preset) => filterFn(preset, searchKeyword))
    }

    // 标签筛选
    if (selectedTag) {
      result = result.filter((preset) => preset.tags?.includes(selectedTag))
    }

    return result
  }, [presets, searchKeyword, selectedTag, searchFilter, defaultSearchFilter])

  // 处理标签点击
  const handleTagClick = useCallback((tag: string | null) => {
    setSelectedTag((prev) => (prev === tag ? null : tag))
  }, [])

  return (
    <Container>
      {/* 搜索栏 */}
      {showSearch && (
        <SearchBar>
          <Input
            prefix={<SearchOutlined />}
            placeholder={searchPlaceholder}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            allowClear
          />
        </SearchBar>
      )}

      {/* 标签筛选 */}
      {showTags && allTags.length > 0 && (
        <TagsRow>
          <Tag
            color={selectedTag === null ? 'blue' : undefined}
            style={{ cursor: 'pointer' }}
            onClick={() => handleTagClick(null)}>
            全部
          </Tag>
          {allTags.map((tag) => (
            <Tag
              key={tag}
              color={selectedTag === tag ? 'blue' : undefined}
              style={{ cursor: 'pointer' }}
              onClick={() => handleTagClick(tag)}>
              {tag}
            </Tag>
          ))}
        </TagsRow>
      )}

      {/* 预设网格 */}
      <PresetGrid $maxHeight={maxHeight} $minCardWidth={minCardWidth} $layout={layout}>
        {filteredPresets.length > 0 ? (
          filteredPresets.map((preset) => {
            const isSelected = preset.id === selectedId
            if (renderCard) {
              // 修复：在 renderCard 外包装带 key 的 Fragment，确保 React 列表渲染正确
              return <Fragment key={preset.id}>{renderCard(preset, isSelected)}</Fragment>
            }
            // 默认渲染 Chip
            return (
              <PresetChip key={preset.id} $selected={isSelected} $size={chipSize} onClick={() => onSelect?.(preset)}>
                <div style={{ fontWeight: 500 }}>{preset.label}</div>
                {preset.description && (
                  <div style={{ fontSize: '10px', color: 'var(--ant-color-text-tertiary)', marginTop: '2px' }}>
                    {preset.description}
                  </div>
                )}
              </PresetChip>
            )
          })
        ) : (
          <EmptyWrapper>
            <Empty description={emptyDescription} />
          </EmptyWrapper>
        )}
      </PresetGrid>
    </Container>
  )
}

// 使用 memo 优化，但保持泛型支持
const PresetSelectorBase = memo(PresetSelectorBaseInner) as typeof PresetSelectorBaseInner

export default PresetSelectorBase

// ==================== 导出样式组件供外部使用 ====================

export { Container, EmptyWrapper, PresetGrid, SearchBar, TagsRow }
