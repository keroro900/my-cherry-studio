/**
 * 提示词预设选择器组件
 *
 * 功能特性:
 * 1. 支持分类浏览（Tabs）
 * 2. 支持搜索过滤
 * 3. 支持标签筛选
 * 4. 预设预览
 * 5. 一键应用
 *
 * 【SSOT 模式】
 * 所有预设从 presets/ 模块导入，添加新预设只需修改注册表
 *
 * 【重构说明】
 * 使用 PresetCard 和 PresetSelectorBase 统一组件
 */

import { AppstoreOutlined, TagsOutlined } from '@ant-design/icons'
import { Tabs, Tag } from 'antd'
import { memo, useCallback } from 'react'

// 从统一预设模块导入（Single Source of Truth）
import {
  COMMERCIAL_SCENE_PRESETS,
  COMPLEX_PATTERN_STYLE_PRESETS,
  EXTENDED_ETHNICITY_PRESETS,
  MODEL_TYPE_PRESETS,
  type PatternStylePresetDefinition
} from '../../presets'
import type {
  CommercialScenePresetDefinition,
  ExtendedEthnicityPresetDefinition,
  ModelTypePresetDefinition
} from '../../presets/types'
// 导入统一组件
import PresetCard from './PresetCard'
import PresetSelectorBase from './PresetSelectorBase'

// ==================== 类型定义 ====================

// 类型别名，保持向后兼容
type StylePreset = PatternStylePresetDefinition
type CommercialScenePreset = CommercialScenePresetDefinition
type ModelTypePreset = ModelTypePresetDefinition
type EthnicityPreset = ExtendedEthnicityPresetDefinition

type AnyPreset = StylePreset | CommercialScenePreset | ModelTypePreset | EthnicityPreset

interface PromptPresetSelectorProps {
  type?: 'pattern' | 'commercial' | 'model' | 'ethnicity' | 'all'
  onSelect?: (preset: AnyPreset) => void
  onApply?: (prompt: string) => void
  selectedId?: string
  showSearch?: boolean
  showTags?: boolean
  maxHeight?: number
}

// ==================== 辅助函数 ====================

/** 获取商拍场景的分类标签颜色 */
function getCommercialCategoryColor(category: 'studio' | 'indoor' | 'outdoor'): string {
  switch (category) {
    case 'studio':
      return 'purple'
    case 'indoor':
      return 'orange'
    case 'outdoor':
      return 'green'
  }
}

/** 获取商拍场景的分类标签文本 */
function getCommercialCategoryText(category: 'studio' | 'indoor' | 'outdoor'): string {
  switch (category) {
    case 'studio':
      return '影棚'
    case 'indoor':
      return '室内'
    case 'outdoor':
      return '室外'
  }
}

/** 获取年龄段文本 */
function getAgeGroupText(ageGroup: 'small_kid' | 'big_kid' | 'teen' | 'adult'): string {
  switch (ageGroup) {
    case 'small_kid':
      return '小童'
    case 'big_kid':
      return '大童'
    case 'teen':
      return '青少年'
    case 'adult':
      return '成人'
  }
}

// ==================== 子选择器组件 ====================

interface PatternSelectorProps {
  selectedId?: string
  onSelect?: (preset: StylePreset) => void
  onApply?: (prompt: string) => void
  showTags?: boolean
  maxHeight?: number
}

/** 图案风格选择器 */
const PatternSelector = memo(
  ({ selectedId, onSelect, onApply, showTags = true, maxHeight = 400 }: PatternSelectorProps) => {
    const presets = COMPLEX_PATTERN_STYLE_PRESETS.getAllPresets()
    const allTags = COMPLEX_PATTERN_STYLE_PRESETS.getAllTags()

    const searchFilter = useCallback((preset: StylePreset, keyword: string): boolean => {
      const kw = keyword.toLowerCase()
      return (
        preset.label.toLowerCase().includes(kw) ||
        preset.nameEn.toLowerCase().includes(kw) ||
        (preset.description?.toLowerCase().includes(kw) ?? false) ||
        preset.tags.some((tag) => tag.toLowerCase().includes(kw))
      )
    }, [])

    return (
      <PresetSelectorBase
        presets={presets}
        selectedId={selectedId}
        onSelect={onSelect}
        showSearch
        searchPlaceholder="搜索风格预设..."
        showTags={showTags}
        availableTags={allTags}
        maxHeight={maxHeight}
        searchFilter={searchFilter}
        renderCard={(preset, isSelected) => (
          <PresetCard
            key={preset.id}
            title={preset.label}
            description={preset.description}
            tags={preset.tags.slice(0, 3).map((tag) => ({ text: tag, color: 'blue' }))}
            preview={`${preset.prompt.substring(0, 80)}...`}
            isSelected={isSelected}
            onClick={() => onSelect?.(preset)}
            copyContent={preset.prompt}
            applyButtonText={onApply ? '应用此风格' : undefined}
            onApply={onApply ? () => onApply(preset.prompt) : undefined}
          />
        )}
      />
    )
  }
)

PatternSelector.displayName = 'PatternSelector'

interface CommercialSelectorProps {
  selectedId?: string
  onSelect?: (preset: CommercialScenePreset) => void
  maxHeight?: number
}

/** 商拍场景选择器 */
const CommercialSelector = memo(({ selectedId, onSelect, maxHeight = 400 }: CommercialSelectorProps) => {
  const presets = COMMERCIAL_SCENE_PRESETS.getAll()

  return (
    <PresetSelectorBase
      presets={presets}
      selectedId={selectedId}
      onSelect={onSelect}
      maxHeight={maxHeight}
      renderCard={(preset, isSelected) => (
        <PresetCard
          key={preset.id}
          title={preset.label}
          description={preset.description}
          preview={preset.scenePrompt}
          isSelected={isSelected}
          onClick={() => onSelect?.(preset)}>
          <Tag color={getCommercialCategoryColor(preset.category)} style={{ marginTop: 4 }}>
            {getCommercialCategoryText(preset.category)}
          </Tag>
        </PresetCard>
      )}
    />
  )
})

CommercialSelector.displayName = 'CommercialSelector'

interface ModelSelectorProps {
  selectedId?: string
  onSelect?: (preset: ModelTypePreset) => void
  maxHeight?: number
}

/** 模特类型选择器 */
const ModelSelector = memo(({ selectedId, onSelect, maxHeight = 400 }: ModelSelectorProps) => {
  const presets = MODEL_TYPE_PRESETS.getAll()

  return (
    <PresetSelectorBase
      presets={presets}
      selectedId={selectedId}
      onSelect={onSelect}
      maxHeight={maxHeight}
      renderCard={(preset, isSelected) => (
        <PresetCard
          key={preset.id}
          title={preset.label}
          description={preset.description}
          isSelected={isSelected}
          onClick={() => onSelect?.(preset)}>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <Tag color={preset.gender === 'female' ? 'magenta' : 'blue'}>
              {preset.gender === 'female' ? '女' : '男'}
            </Tag>
            <Tag color="cyan">{getAgeGroupText(preset.ageGroup)}</Tag>
          </div>
        </PresetCard>
      )}
    />
  )
})

ModelSelector.displayName = 'ModelSelector'

interface EthnicitySelectorProps {
  selectedId?: string
  onSelect?: (preset: EthnicityPreset) => void
  maxHeight?: number
}

/** 人种选择器 */
const EthnicitySelector = memo(({ selectedId, onSelect, maxHeight = 400 }: EthnicitySelectorProps) => {
  const presets = EXTENDED_ETHNICITY_PRESETS.getAll()

  return (
    <PresetSelectorBase
      presets={presets}
      selectedId={selectedId}
      onSelect={onSelect}
      maxHeight={maxHeight}
      renderCard={(preset, isSelected) => (
        <PresetCard
          key={preset.id}
          title={preset.label}
          description={preset.description}
          isSelected={isSelected}
          onClick={() => onSelect?.(preset)}
        />
      )}
    />
  )
})

EthnicitySelector.displayName = 'EthnicitySelector'

// ==================== 主组件 ====================

/**
 * 提示词预设选择器
 *
 * @example
 * // 显示所有类型（带 Tabs）
 * <PromptPresetSelector
 *   type="all"
 *   onSelect={(preset) => console.log(preset)}
 *   onApply={(prompt) => setPrompt(prompt)}
 * />
 *
 * @example
 * // 仅显示图案风格
 * <PromptPresetSelector
 *   type="pattern"
 *   selectedId={currentStyleId}
 *   onSelect={handleStyleSelect}
 * />
 */
function PromptPresetSelector({
  type = 'all',
  onSelect,
  onApply,
  selectedId,
  showTags = true,
  maxHeight = 400
}: PromptPresetSelectorProps) {
  // 类型安全的选择处理
  const handlePatternSelect = useCallback(
    (preset: StylePreset) => {
      onSelect?.(preset)
    },
    [onSelect]
  )

  const handleCommercialSelect = useCallback(
    (preset: CommercialScenePreset) => {
      onSelect?.(preset)
    },
    [onSelect]
  )

  const handleModelSelect = useCallback(
    (preset: ModelTypePreset) => {
      onSelect?.(preset)
    },
    [onSelect]
  )

  const handleEthnicitySelect = useCallback(
    (preset: EthnicityPreset) => {
      onSelect?.(preset)
    },
    [onSelect]
  )

  // 单类型模式
  if (type !== 'all') {
    switch (type) {
      case 'pattern':
        return (
          <PatternSelector
            selectedId={selectedId}
            onSelect={handlePatternSelect}
            onApply={onApply}
            showTags={showTags}
            maxHeight={maxHeight}
          />
        )
      case 'commercial':
        return <CommercialSelector selectedId={selectedId} onSelect={handleCommercialSelect} maxHeight={maxHeight} />
      case 'model':
        return <ModelSelector selectedId={selectedId} onSelect={handleModelSelect} maxHeight={maxHeight} />
      case 'ethnicity':
        return <EthnicitySelector selectedId={selectedId} onSelect={handleEthnicitySelect} maxHeight={maxHeight} />
    }
  }

  // 全类型模式（Tabs）
  return (
    <Tabs
      size="small"
      items={[
        {
          key: 'pattern',
          label: (
            <span>
              <AppstoreOutlined /> 图案风格
            </span>
          ),
          children: (
            <PatternSelector
              selectedId={selectedId}
              onSelect={handlePatternSelect}
              onApply={onApply}
              showTags={showTags}
              maxHeight={maxHeight}
            />
          )
        },
        {
          key: 'commercial',
          label: (
            <span>
              <TagsOutlined /> 商拍场景
            </span>
          ),
          children: (
            <CommercialSelector selectedId={selectedId} onSelect={handleCommercialSelect} maxHeight={maxHeight} />
          )
        },
        {
          key: 'model',
          label: '模特类型',
          children: <ModelSelector selectedId={selectedId} onSelect={handleModelSelect} maxHeight={maxHeight} />
        },
        {
          key: 'ethnicity',
          label: '人种设置',
          children: <EthnicitySelector selectedId={selectedId} onSelect={handleEthnicitySelect} maxHeight={maxHeight} />
        }
      ]}
    />
  )
}

export default memo(PromptPresetSelector)

// 导出子选择器供单独使用
export { CommercialSelector, EthnicitySelector, ModelSelector, PatternSelector }
