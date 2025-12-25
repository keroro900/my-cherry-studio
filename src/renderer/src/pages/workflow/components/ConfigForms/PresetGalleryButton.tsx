/**
 * 预设画廊触发按钮组件
 *
 * 提供一个按钮来触发 PresetGalleryModal，显示当前选中的预设信息。
 * 用于替换旧的下拉式预设选择器。
 *
 * @module components/ConfigForms/PresetGalleryButton
 * @created Phase 5 - 预设选择器升级
 */

import { AppstoreOutlined } from '@ant-design/icons'
import { Button, Space, Tag } from 'antd'
import type { ReactNode } from 'react'
import { memo, useCallback, useState } from 'react'
import styled from 'styled-components'

import { usePresetFavorites } from '../../hooks/usePresetFavorites'
import type { PresetCategory } from './PresetCard'
import PresetGalleryModal, { type CategoryDefinition, type PresetItem } from './PresetGalleryModal'

// ==================== 样式组件 ====================

const TriggerButton = styled(Button)`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 160px;
  text-align: left;
`

const SelectedInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex: 1;
  overflow: hidden;
`

const SelectedLabel = styled.span`
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
`

const SelectedDescription = styled.span`
  font-size: 11px;
  color: var(--ant-color-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
`

const PlaceholderText = styled.span`
  color: var(--ant-color-text-tertiary);
`

// ==================== 类型定义 ====================

export interface PresetGalleryButtonProps<T extends PresetItem> {
  /** 预设数据列表 */
  presets: T[]
  /** 当前选中的预设 ID */
  selectedId?: string
  /** 选择回调 */
  onSelect: (preset: T) => void
  /** 应用回调（双击或确认按钮，可选） */
  onApply?: (preset: T) => void

  /** 按钮占位文本 */
  placeholder?: string
  /** 模态框标题 */
  modalTitle?: string
  /** 按钮图标 */
  icon?: ReactNode
  /** 按钮类型 */
  buttonType?: 'default' | 'primary' | 'dashed' | 'text' | 'link'
  /** 是否禁用 */
  disabled?: boolean
  /** 是否显示分类标签 */
  showCategoryTag?: boolean

  // 分类（Tab 过滤）
  /** 分类定义列表 */
  categories?: CategoryDefinition[]
  /** 获取预设的分类键 */
  getCategoryKey?: (preset: T) => string
  /** 获取预设的分类类型（用于卡片显示） */
  getPresetCategory?: (preset: T) => PresetCategory | undefined

  // 收藏
  /** localStorage 存储键名（用于收藏持久化） */
  favoritesStorageKey?: string

  // 搜索
  /** 搜索占位符 */
  searchPlaceholder?: string
  /** 自定义搜索过滤函数 */
  searchFilter?: (preset: T, keyword: string) => boolean

  // 渲染
  /** 获取预设的预览图（可选） */
  getPreviewImage?: (preset: T) => string | undefined
  /** 获取选中预设的显示信息 */
  getSelectedInfo?: (preset: T) => { label: string; description?: string }

  // 尺寸
  /** 模态框宽度 */
  modalWidth?: number | string
  /** 内容区域最大高度 */
  contentMaxHeight?: number
}

// ==================== 主组件 ====================

/**
 * 预设画廊触发按钮
 *
 * @example
 * // 基础用法
 * <PresetGalleryButton
 *   presets={patternPresets}
 *   selectedId={selectedId}
 *   onSelect={handleSelect}
 *   placeholder="选择图案风格..."
 *   modalTitle="选择图案风格"
 * />
 *
 * @example
 * // 带分类和收藏
 * <PresetGalleryButton
 *   presets={allPresets}
 *   selectedId={selectedId}
 *   onSelect={handleSelect}
 *   categories={[
 *     { key: 'pattern', label: '图案风格' },
 *     { key: 'commercial', label: '商拍场景' },
 *   ]}
 *   getCategoryKey={(p) => p.category}
 *   favoritesStorageKey="workflow-preset-favorites"
 * />
 */
function PresetGalleryButtonInner<T extends PresetItem>({
  presets,
  selectedId,
  onSelect,
  onApply,
  placeholder = '选择预设...',
  modalTitle = '选择预设',
  icon = <AppstoreOutlined />,
  buttonType = 'default',
  disabled = false,
  showCategoryTag = true,
  categories,
  getCategoryKey,
  getPresetCategory,
  favoritesStorageKey = 'workflow-preset-favorites',
  searchPlaceholder,
  searchFilter,
  getPreviewImage,
  getSelectedInfo,
  modalWidth = 800,
  contentMaxHeight = 400
}: PresetGalleryButtonProps<T>) {
  const [modalOpen, setModalOpen] = useState(false)

  // 收藏功能
  const { favoriteIds, toggleFavorite } = usePresetFavorites({
    storageKey: favoritesStorageKey
  })

  // 获取当前选中的预设
  const selectedPreset = presets.find((p) => p.id === selectedId)

  // 处理选择
  const handleSelect = useCallback(
    (preset: T) => {
      onSelect(preset)
    },
    [onSelect]
  )

  // 处理应用（双击）
  const handleApply = useCallback(
    (preset: T) => {
      onSelect(preset)
      onApply?.(preset)
      setModalOpen(false)
    },
    [onSelect, onApply]
  )

  // 获取选中预设的显示信息
  const selectedInfo = selectedPreset
    ? getSelectedInfo
      ? getSelectedInfo(selectedPreset)
      : { label: selectedPreset.label, description: selectedPreset.description }
    : null

  // 获取选中预设的分类
  const selectedCategory = selectedPreset ? (getPresetCategory?.(selectedPreset) ?? selectedPreset.category) : undefined

  return (
    <>
      <TriggerButton type={buttonType} disabled={disabled} onClick={() => setModalOpen(true)} block>
        {icon}
        {selectedInfo ? (
          <SelectedInfo>
            <Space size={4}>
              <SelectedLabel>{selectedInfo.label}</SelectedLabel>
              {showCategoryTag && selectedCategory && <Tag style={{ margin: 0, fontSize: 10 }}>{selectedCategory}</Tag>}
            </Space>
            {selectedInfo.description && <SelectedDescription>{selectedInfo.description}</SelectedDescription>}
          </SelectedInfo>
        ) : (
          <PlaceholderText>{placeholder}</PlaceholderText>
        )}
      </TriggerButton>

      <PresetGalleryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        presets={presets}
        selectedId={selectedId}
        onSelect={handleSelect}
        onApply={handleApply}
        categories={categories}
        getCategoryKey={getCategoryKey}
        getPresetCategory={getPresetCategory}
        favoriteIds={favoriteIds}
        onFavoriteToggle={toggleFavorite}
        searchPlaceholder={searchPlaceholder}
        searchFilter={searchFilter}
        getPreviewImage={getPreviewImage}
        width={modalWidth}
        contentMaxHeight={contentMaxHeight}
      />
    </>
  )
}

// 使用 memo 优化，但保持泛型支持
const PresetGalleryButton = memo(PresetGalleryButtonInner) as typeof PresetGalleryButtonInner

export default PresetGalleryButton

// ==================== 导出样式组件供外部使用 ====================

export { PlaceholderText, SelectedDescription, SelectedInfo, SelectedLabel, TriggerButton }
