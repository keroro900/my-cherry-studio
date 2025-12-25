/**
 * 预设画廊模态框组件
 *
 * 提供统一的画廊式预设选择界面，支持：
 * - Tab 分类过滤（All / Favorites / 按 category）
 * - 搜索过滤（支持防抖）
 * - 卡片网格布局
 * - 预览图（占位符或自定义）
 * - 收藏功能
 * - 双击应用
 *
 * @module components/ConfigForms/PresetGalleryModal
 * @created Phase 3 - 画廊式预设选择模态框
 */

import { CloseOutlined, HeartOutlined, SearchOutlined } from '@ant-design/icons'
import { Empty, Input, Modal, Tabs } from 'antd'
import type { ReactNode } from 'react'
import { memo, useCallback, useMemo, useState } from 'react'
import styled from 'styled-components'

import PresetCard, { type PresetCategory } from './PresetCard'

// ==================== 类型定义 ====================

/** 预设项的基础接口 */
export interface PresetItem {
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
  /** 分类（可选） */
  category?: PresetCategory
}

/** 分类定义 */
export interface CategoryDefinition {
  /** 分类键 */
  key: string
  /** 显示标签 */
  label: string
  /** 图标（可选） */
  icon?: ReactNode
}

/** 卡片渲染属性 */
export interface CardRenderProps {
  isSelected: boolean
  isFavorite: boolean
  onFavoriteToggle: (id: string) => void
  onClick: () => void
  onDoubleClick: () => void
}

/** PresetGalleryModal 的 Props */
export interface PresetGalleryModalProps<T extends PresetItem> {
  /** 模态框是否打开 */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 模态框标题 */
  title?: string

  // 数据
  /** 预设数据列表 */
  presets: T[]
  /** 选中的预设 ID */
  selectedId?: string
  /** 选择回调（单击选中） */
  onSelect?: (preset: T) => void
  /** 应用回调（双击或确认按钮） */
  onApply?: (preset: T) => void

  // 分类（Tab 过滤）
  /** 分类定义列表（不包含 All 和 Favorites，会自动添加） */
  categories?: CategoryDefinition[]
  /** 获取预设的分类键 */
  getCategoryKey?: (preset: T) => string

  // 收藏
  /** 收藏的预设 ID 列表 */
  favoriteIds?: string[]
  /** 收藏切换回调 */
  onFavoriteToggle?: (id: string) => void

  // 搜索
  /** 搜索占位符 */
  searchPlaceholder?: string
  /** 自定义搜索过滤函数 */
  searchFilter?: (preset: T, keyword: string) => boolean

  // 渲染
  /** 自定义卡片渲染（可选，默认使用 PresetCard） */
  renderCard?: (preset: T, props: CardRenderProps) => ReactNode
  /** 获取预设的预览图（可选） */
  getPreviewImage?: (preset: T) => string | undefined
  /** 获取预设的分类显示类型 */
  getPresetCategory?: (preset: T) => PresetCategory | undefined

  // 底部
  /** 底部额外内容（如 "保存当前配置" 按钮） */
  footerExtra?: ReactNode
  /** 是否显示统计信息 */
  showStats?: boolean

  // 尺寸
  /** 模态框宽度 */
  width?: number | string
  /** 内容区域最大高度 */
  contentMaxHeight?: number
}

// ==================== 样式组件 ====================

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--ant-color-border);
`

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--ant-color-text);
`

const CloseButton = styled.button`
  border: none;
  background: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ant-color-text-tertiary);
  transition: color 0.2s;

  &:hover {
    color: var(--ant-color-text);
  }
`

const FilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--ant-color-border);
  background: var(--ant-color-bg-elevated);
`

const TabsWrapper = styled.div`
  flex: 1;

  .ant-tabs {
    margin: 0;
  }

  .ant-tabs-nav {
    margin: 0;
  }

  .ant-tabs-tab {
    padding: 6px 12px;
    font-size: 13px;
  }
`

const SearchWrapper = styled.div`
  width: 200px;
`

const ContentArea = styled.div<{ $maxHeight?: number }>`
  padding: 16px 20px;
  overflow-y: auto;
  max-height: ${({ $maxHeight }) => ($maxHeight ? `${$maxHeight}px` : '400px')};
`

const PresetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
`

const EmptyWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 48px;
`

const ModalFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--ant-color-border);
  background: var(--ant-color-bg-elevated);
`

const FooterStats = styled.div`
  font-size: 12px;
  color: var(--ant-color-text-tertiary);
  display: flex;
  gap: 16px;
`

const StatItem = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;

  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ant-color-success);
  }
`

// ==================== 主组件 ====================

/**
 * 预设画廊模态框
 *
 * @example
 * // 基础用法
 * <PresetGalleryModal
 *   open={modalOpen}
 *   onClose={() => setModalOpen(false)}
 *   title="选择图案风格"
 *   presets={patternPresets}
 *   selectedId={selectedId}
 *   onSelect={handleSelect}
 *   onApply={handleApply}
 * />
 *
 * @example
 * // 带分类和收藏
 * <PresetGalleryModal
 *   open={modalOpen}
 *   onClose={() => setModalOpen(false)}
 *   title="选择预设"
 *   presets={allPresets}
 *   categories={[
 *     { key: 'pattern', label: '图案风格' },
 *     { key: 'commercial', label: '商拍场景' },
 *   ]}
 *   getCategoryKey={(preset) => preset.category}
 *   favoriteIds={favorites}
 *   onFavoriteToggle={toggleFavorite}
 *   onSelect={handleSelect}
 *   onApply={handleApply}
 * />
 */
function PresetGalleryModalInner<T extends PresetItem>({
  open,
  onClose,
  title = '选择预设',
  presets,
  selectedId,
  onSelect,
  onApply,
  categories = [],
  getCategoryKey,
  favoriteIds = [],
  onFavoriteToggle,
  searchPlaceholder = '搜索预设...',
  searchFilter,
  renderCard,
  getPreviewImage,
  getPresetCategory,
  footerExtra,
  showStats = true,
  width = 800,
  contentMaxHeight = 400
}: PresetGalleryModalProps<T>) {
  const [searchKeyword, setSearchKeyword] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  // 默认搜索过滤
  const defaultSearchFilter = useCallback((preset: T, keyword: string): boolean => {
    const kw = keyword.toLowerCase()
    return (
      preset.label.toLowerCase().includes(kw) ||
      (preset.description?.toLowerCase().includes(kw) ?? false) ||
      (preset.tags?.some((tag) => tag.toLowerCase().includes(kw)) ?? false) ||
      (preset.nameEn?.toLowerCase().includes(kw) ?? false)
    )
  }, [])

  // 过滤预设
  const filteredPresets = useMemo(() => {
    let result = presets

    // Tab 过滤
    if (activeTab === 'favorites') {
      result = result.filter((preset) => favoriteIds.includes(preset.id))
    } else if (activeTab !== 'all' && getCategoryKey) {
      result = result.filter((preset) => getCategoryKey(preset) === activeTab)
    }

    // 关键词搜索
    if (searchKeyword.trim()) {
      const filterFn = searchFilter || defaultSearchFilter
      result = result.filter((preset) => filterFn(preset, searchKeyword))
    }

    return result
  }, [presets, activeTab, favoriteIds, getCategoryKey, searchKeyword, searchFilter, defaultSearchFilter])

  // 构建 Tab 项
  const tabItems = useMemo(() => {
    const items: Array<{ key: string; label: ReactNode }> = [
      { key: 'all', label: '全部' },
      {
        key: 'favorites',
        label: (
          <span>
            <HeartOutlined /> 收藏
          </span>
        )
      }
    ]

    categories.forEach((cat) => {
      items.push({
        key: cat.key,
        label: cat.icon ? (
          <span>
            {cat.icon} {cat.label}
          </span>
        ) : (
          cat.label
        )
      })
    })

    return items
  }, [categories])

  // 处理选择
  const handleSelect = useCallback(
    (preset: T) => {
      onSelect?.(preset)
    },
    [onSelect]
  )

  // 处理双击应用
  const handleDoubleClick = useCallback(
    (preset: T) => {
      onApply?.(preset)
      onClose()
    },
    [onApply, onClose]
  )

  // 处理收藏切换
  const handleFavoriteToggle = useCallback(
    (id: string) => {
      onFavoriteToggle?.(id)
    },
    [onFavoriteToggle]
  )

  // 检查是否收藏
  const isFavorite = useCallback((id: string) => favoriteIds.includes(id), [favoriteIds])

  // 渲染卡片
  const renderPresetCard = useCallback(
    (preset: T) => {
      const isSelected = preset.id === selectedId
      const favorite = isFavorite(preset.id)
      const category = getPresetCategory?.(preset) ?? preset.category
      const previewImage = getPreviewImage?.(preset)

      const cardProps: CardRenderProps = {
        isSelected,
        isFavorite: favorite,
        onFavoriteToggle: handleFavoriteToggle,
        onClick: () => handleSelect(preset),
        onDoubleClick: () => handleDoubleClick(preset)
      }

      if (renderCard) {
        return renderCard(preset, cardProps)
      }

      return (
        <PresetCard
          key={preset.id}
          id={preset.id}
          title={preset.label}
          description={preset.description}
          tags={preset.tags?.slice(0, 3).map((tag) => ({ text: tag }))}
          category={category}
          previewImage={previewImage}
          showPreview
          isFavorite={favorite}
          onFavoriteToggle={onFavoriteToggle ? handleFavoriteToggle : undefined}
          isSelected={isSelected}
          onClick={() => handleSelect(preset)}
          onDoubleClick={() => handleDoubleClick(preset)}
        />
      )
    },
    [
      selectedId,
      isFavorite,
      getPresetCategory,
      getPreviewImage,
      renderCard,
      handleFavoriteToggle,
      handleSelect,
      handleDoubleClick,
      onFavoriteToggle
    ]
  )

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={width}
      footer={null}
      closable={false}
      destroyOnHidden
      styles={{
        body: { padding: 0 },
        content: { borderRadius: 12, overflow: 'hidden' }
      }}>
      {/* 头部 */}
      <ModalHeader>
        <ModalTitle>{title}</ModalTitle>
        <CloseButton onClick={onClose}>
          <CloseOutlined />
        </CloseButton>
      </ModalHeader>

      {/* 过滤栏 */}
      <FilterBar>
        <TabsWrapper>
          <Tabs activeKey={activeTab} onChange={setActiveTab} size="small" items={tabItems} />
        </TabsWrapper>
        <SearchWrapper>
          <Input
            prefix={<SearchOutlined />}
            placeholder={searchPlaceholder}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            allowClear
            size="small"
          />
        </SearchWrapper>
      </FilterBar>

      {/* 内容区域 */}
      <ContentArea $maxHeight={contentMaxHeight}>
        {filteredPresets.length > 0 ? (
          <PresetGrid>{filteredPresets.map(renderPresetCard)}</PresetGrid>
        ) : (
          <EmptyWrapper>
            <Empty description={searchKeyword ? '未找到匹配的预设' : '暂无预设'} />
          </EmptyWrapper>
        )}
      </ContentArea>

      {/* 底部 */}
      {(footerExtra || showStats) && (
        <ModalFooter>
          <div>{footerExtra}</div>
          {showStats && (
            <FooterStats>
              <StatItem>系统就绪</StatItem>
              <StatItem>{filteredPresets.length} 个预设</StatItem>
            </FooterStats>
          )}
        </ModalFooter>
      )}
    </Modal>
  )
}

// 使用 memo 优化，但保持泛型支持
const PresetGalleryModal = memo(PresetGalleryModalInner) as typeof PresetGalleryModalInner

export default PresetGalleryModal

// ==================== 导出样式组件供外部使用 ====================

export {
  CloseButton,
  ContentArea,
  EmptyWrapper,
  FilterBar,
  FooterStats,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  PresetGrid,
  SearchWrapper,
  StatItem,
  TabsWrapper
}
