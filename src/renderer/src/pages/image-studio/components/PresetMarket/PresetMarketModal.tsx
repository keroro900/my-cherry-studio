/**
 * 预设市场弹窗组件
 * PresetMarketModal
 *
 * 浏览、搜索和应用图片工坊预设
 */

import {
  AppstoreOutlined,
  HeartOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  UnorderedListOutlined
} from '@ant-design/icons'
import { TopView } from '@renderer/components/TopView'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  selectActiveModule,
  updateEcomConfig,
  updateModelConfig,
  updatePatternConfig
} from '@renderer/store/imageStudio'
import { Button, Empty, Input, message, Modal, Segmented, Select, Spin, Tooltip } from 'antd'
import { Grid3X3, Layers, Palette, Shirt, Sparkles } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { usePresetMarket } from '../../hooks/usePresetMarket'
import type { EcomModuleConfig, ModelModuleConfig, PatternModuleConfig, StudioModule } from '../../types'
import { PRESET_CATEGORIES, type PresetCategory, type PresetSortBy, type StudioPreset } from '../../types/preset-market'
import PresetCard from './PresetCard'
import PresetEditorModal from './PresetEditorModal'

// ============================================================================
// Props 定义
// ============================================================================

interface PresetMarketModalProps {
  resolve: () => void
  initialModule?: StudioModule | 'all'
}

// ============================================================================
// 常量定义
// ============================================================================

const MODULE_OPTIONS = [
  { value: 'all', label: '全部', icon: <Grid3X3 size={14} /> },
  { value: 'ecom', label: '电商', icon: <Sparkles size={14} /> },
  { value: 'model', label: '模特', icon: <Shirt size={14} /> },
  { value: 'pattern', label: '图案', icon: <Palette size={14} /> }
]

const SORT_OPTIONS = [
  { value: 'usageCount', label: '热门' },
  { value: 'createdAt', label: '最新' },
  { value: 'name', label: '名称' },
  { value: 'updatedAt', label: '更新' }
]

// 按模块分组的分类
const CATEGORY_GROUPS: Record<StudioModule | 'common', PresetCategory[]> = {
  common: ['custom'],
  ecom: [
    'kids_clothing',
    'adult_clothing',
    'sportswear',
    'underwear',
    'accessories',
    'footwear',
    'cosmetics',
    'food',
    'electronics',
    'furniture',
    'jewelry'
  ],
  model: ['kids_clothing', 'adult_clothing', 'sportswear'],
  pattern: ['pattern_floral', 'pattern_geometric', 'pattern_abstract', 'pattern_cartoon', 'pattern_seasonal']
}

// ============================================================================
// 主组件
// ============================================================================

const PresetMarketModalContainer: FC<PresetMarketModalProps> = ({ resolve, initialModule }) => {
  const { t, i18n } = useTranslation()
  const dispatch = useAppDispatch()
  const activeModule = useAppSelector(selectActiveModule)
  const isEnglish = i18n.language?.startsWith('en')

  const [open, setOpen] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedPreset, setSelectedPreset] = useState<StudioPreset | null>(null)

  // 使用预设市场 Hook
  const {
    presets,
    total,
    loading,
    error,
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
  } = usePresetMarket({
    initialModule: initialModule || activeModule,
    pageSize: 20
  })

  // 可用分类列表
  const availableCategories = useMemo(() => {
    if (filter.module === 'all') {
      return [...new Set([...CATEGORY_GROUPS.ecom, ...CATEGORY_GROUPS.model, ...CATEGORY_GROUPS.pattern])]
    }
    return CATEGORY_GROUPS[filter.module as StudioModule] || []
  }, [filter.module])

  // 应用预设到当前模块
  const handleApplyPreset = useCallback(
    (preset: StudioPreset) => {
      const config = applyPreset(preset.id)
      if (!config) {
        message.error('应用预设失败')
        return
      }

      // 根据预设的模块类型更新对应的配置
      switch (preset.module) {
        case 'ecom':
          dispatch(updateEcomConfig(config as EcomModuleConfig))
          break
        case 'model':
          dispatch(updateModelConfig(config as ModelModuleConfig))
          break
        case 'pattern':
          dispatch(updatePatternConfig(config as PatternModuleConfig))
          break
      }

      message.success(`已应用预设「${preset.name}」`)
      onClose()
    },
    [applyPreset, dispatch]
  )

  // 复制预设
  const handleDuplicatePreset = useCallback(
    (preset: StudioPreset) => {
      const newPreset = duplicatePreset(preset.id)
      if (newPreset) {
        message.success(`已复制预设为「${newPreset.name}」`)
      } else {
        message.error('复制预设失败')
      }
    },
    [duplicatePreset]
  )

  // 删除预设
  const handleDeletePreset = useCallback(
    (preset: StudioPreset) => {
      if (deletePreset(preset.id)) {
        message.success('已删除预设')
        if (selectedPreset?.id === preset.id) {
          setSelectedPreset(null)
        }
      } else {
        message.error('删除预设失败')
      }
    },
    [deletePreset, selectedPreset]
  )

  // 新建预设
  const handleCreatePreset = useCallback(async () => {
    const result = await PresetEditorModal.create({
      module: filter.module === 'all' ? activeModule : filter.module,
      useCurrentConfig: true
    })
    if (result) {
      refresh()
    }
  }, [filter.module, activeModule, refresh])

  // 编辑预设
  const handleEditPreset = useCallback(
    async (preset: StudioPreset) => {
      const result = await PresetEditorModal.edit(preset)
      if (result) {
        refresh()
        if (selectedPreset?.id === preset.id) {
          setSelectedPreset(result)
        }
      }
    },
    [refresh, selectedPreset]
  )

  const onClose = () => {
    setOpen(false)
  }

  const afterClose = () => {
    resolve()
  }

  return (
    <StyledModal
      open={open}
      onCancel={onClose}
      afterClose={afterClose}
      footer={null}
      title={
        <ModalTitle>
          <Layers size={18} />
          <span>预设市场</span>
          <PresetCount>{total} 个预设</PresetCount>
        </ModalTitle>
      }
      width={1000}
      centered
      styles={{
        content: { padding: 0, overflow: 'hidden', borderRadius: 12 },
        header: { padding: '16px 20px', borderBottom: '1px solid var(--color-border)', margin: 0 },
        body: { padding: 0 }
      }}>
      <ContentWrapper>
        {/* 顶部工具栏 */}
        <Toolbar>
          {/* 模块筛选 */}
          <Segmented
            value={filter.module}
            onChange={(value) => setModule(value as StudioModule | 'all')}
            options={MODULE_OPTIONS.map((opt) => ({
              value: opt.value,
              label: (
                <SegmentedLabel>
                  {opt.icon}
                  <span>{opt.label}</span>
                </SegmentedLabel>
              )
            }))}
          />

          {/* 搜索框 */}
          <SearchInput
            placeholder="搜索预设名称、标签..."
            prefix={<SearchOutlined />}
            value={filter.keyword}
            onChange={(e) => setKeyword(e.target.value)}
            allowClear
          />

          {/* 视图切换 */}
          <ViewToggle>
            <Tooltip title="网格视图">
              <ViewButton $active={viewMode === 'grid'} onClick={() => setViewMode('grid')}>
                <AppstoreOutlined />
              </ViewButton>
            </Tooltip>
            <Tooltip title="列表视图">
              <ViewButton $active={viewMode === 'list'} onClick={() => setViewMode('list')}>
                <UnorderedListOutlined />
              </ViewButton>
            </Tooltip>
          </ViewToggle>

          {/* 新建预设按钮 */}
          <Tooltip title="新建预设">
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreatePreset}>
              新建
            </Button>
          </Tooltip>
        </Toolbar>

        {/* 二级工具栏 */}
        <SubToolbar>
          {/* 分类筛选 */}
          <Select
            value={filter.category}
            onChange={(value) => setCategory(value as PresetCategory | 'all')}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '全部分类' },
              ...availableCategories.map((cat) => ({
                value: cat,
                label: `${PRESET_CATEGORIES[cat]?.icon || ''} ${isEnglish ? PRESET_CATEGORIES[cat]?.labelEn : PRESET_CATEGORIES[cat]?.label}`
              }))
            ]}
          />

          {/* 收藏筛选 */}
          <Button
            type={filter.favoritesOnly ? 'primary' : 'default'}
            icon={<HeartOutlined />}
            onClick={toggleFavoritesOnly}>
            收藏
          </Button>

          <ToolbarSpacer />

          {/* 排序 */}
          <SortWrapper>
            <Select
              value={sortBy}
              onChange={(value) => setSortBy(value as PresetSortBy)}
              style={{ width: 100 }}
              options={SORT_OPTIONS}
            />
            <Tooltip title={ascending ? '升序' : '降序'}>
              <Button
                type="text"
                icon={ascending ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                onClick={toggleSortDirection}
              />
            </Tooltip>
          </SortWrapper>

          {/* 刷新 */}
          <Tooltip title="刷新">
            <Button type="text" icon={<ReloadOutlined />} onClick={refresh} loading={loading} />
          </Tooltip>
        </SubToolbar>

        {/* 内容区域 */}
        <ContentArea>
          <MainContent>
            {loading && presets.length === 0 ? (
              <LoadingWrapper>
                <Spin size="large" />
                <LoadingText>加载预设中...</LoadingText>
              </LoadingWrapper>
            ) : error ? (
              <Empty description={error} />
            ) : presets.length === 0 ? (
              <Empty description="暂无预设" />
            ) : viewMode === 'grid' ? (
              <PresetGrid>
                {presets.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    isSelected={selectedPreset?.id === preset.id}
                    onClick={() => setSelectedPreset(preset)}
                    onApply={() => handleApplyPreset(preset)}
                    onToggleFavorite={() => toggleFavorite(preset.id)}
                    onDelete={() => handleDeletePreset(preset)}
                    onDuplicate={() => handleDuplicatePreset(preset)}
                    onEdit={() => handleEditPreset(preset)}
                  />
                ))}
              </PresetGrid>
            ) : (
              <PresetList>
                {presets.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    compact
                    isSelected={selectedPreset?.id === preset.id}
                    onClick={() => setSelectedPreset(preset)}
                    onApply={() => handleApplyPreset(preset)}
                    onToggleFavorite={() => toggleFavorite(preset.id)}
                    onDelete={() => handleDeletePreset(preset)}
                    onDuplicate={() => handleDuplicatePreset(preset)}
                    onEdit={() => handleEditPreset(preset)}
                  />
                ))}
              </PresetList>
            )}

            {/* 加载更多 */}
            {hasMore && !loading && (
              <LoadMoreWrapper>
                <Button onClick={loadMore}>加载更多</Button>
              </LoadMoreWrapper>
            )}
          </MainContent>

          {/* 详情侧边栏 */}
          {selectedPreset && (
            <DetailSidebar>
              <DetailHeader>
                <DetailIcon>{PRESET_CATEGORIES[selectedPreset.category]?.icon || '📦'}</DetailIcon>
                <DetailTitle>
                  {isEnglish && selectedPreset.nameEn ? selectedPreset.nameEn : selectedPreset.name}
                </DetailTitle>
              </DetailHeader>

              <DetailSection>
                <DetailLabel>描述</DetailLabel>
                <DetailText>
                  {isEnglish && selectedPreset.descriptionEn
                    ? selectedPreset.descriptionEn
                    : selectedPreset.description}
                </DetailText>
              </DetailSection>

              <DetailSection>
                <DetailLabel>模块</DetailLabel>
                <DetailText>
                  {selectedPreset.module === 'ecom' && t('image_studio.modules.ecom')}
                  {selectedPreset.module === 'model' && t('image_studio.modules.model')}
                  {selectedPreset.module === 'pattern' && t('image_studio.modules.pattern')}
                </DetailText>
              </DetailSection>

              <DetailSection>
                <DetailLabel>分类</DetailLabel>
                <DetailText>
                  {isEnglish
                    ? PRESET_CATEGORIES[selectedPreset.category]?.labelEn
                    : PRESET_CATEGORIES[selectedPreset.category]?.label}
                </DetailText>
              </DetailSection>

              {selectedPreset.tags.length > 0 && (
                <DetailSection>
                  <DetailLabel>标签</DetailLabel>
                  <DetailTags>
                    {selectedPreset.tags.map((tag) => (
                      <DetailTag key={tag}>{tag}</DetailTag>
                    ))}
                  </DetailTags>
                </DetailSection>
              )}

              {/* 系统提示词 */}
              {selectedPreset.systemPrompt && (
                <DetailSection>
                  <DetailLabel>🎭 系统提示词（角色）</DetailLabel>
                  <PromptPreviewBox title={selectedPreset.systemPrompt}>
                    {selectedPreset.systemPrompt.length > 100
                      ? `${selectedPreset.systemPrompt.slice(0, 100)}...`
                      : selectedPreset.systemPrompt}
                  </PromptPreviewBox>
                </DetailSection>
              )}

              {/* 用户提示词 */}
              {(selectedPreset.userPrompt || (!selectedPreset.systemPrompt && selectedPreset.promptTemplate)) && (
                <DetailSection>
                  <DetailLabel>📝 用户提示词（需求）</DetailLabel>
                  <PromptPreviewBox title={selectedPreset.userPrompt || selectedPreset.promptTemplate}>
                    {(() => {
                      const text = selectedPreset.userPrompt || selectedPreset.promptTemplate || ''
                      return text.length > 100 ? `${text.slice(0, 100)}...` : text
                    })()}
                  </PromptPreviewBox>
                </DetailSection>
              )}

              <DetailSection>
                <DetailLabel>配置预览</DetailLabel>
                <ConfigPreview>
                  {Object.entries(selectedPreset.config)
                    .slice(0, 6)
                    .map(([key, value]) => (
                      <ConfigItem key={key}>
                        <ConfigKey>{key}</ConfigKey>
                        <ConfigValue>{String(value)}</ConfigValue>
                      </ConfigItem>
                    ))}
                </ConfigPreview>
              </DetailSection>

              <DetailActions>
                <Button type="primary" block onClick={() => handleApplyPreset(selectedPreset)}>
                  应用此预设
                </Button>
              </DetailActions>
            </DetailSidebar>
          )}
        </ContentArea>
      </ContentWrapper>
    </StyledModal>
  )
}

// ============================================================================
// 静态方法
// ============================================================================

export default class PresetMarketModal {
  static show(props?: { initialModule?: StudioModule | 'all' }) {
    return new Promise<void>((resolve) => {
      TopView.show(
        <PresetMarketModalContainer
          {...props}
          resolve={() => {
            resolve()
            TopView.hide('PresetMarketModal')
          }}
        />,
        'PresetMarketModal'
      )
    })
  }
}

// ============================================================================
// 样式定义
// ============================================================================

const StyledModal = styled(Modal)`
  .ant-modal-content {
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }
  .ant-modal-title {
    font-size: 15px;
    font-weight: 600;
  }
  .ant-modal-close {
    top: 12px;
    right: 12px;
  }
`

const ModalTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-text-1);

  svg {
    color: var(--color-primary);
  }
`

const PresetCount = styled.span`
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-3);
  margin-left: auto;
`

const ContentWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 600px;
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--color-background);
  border-bottom: 1px solid var(--color-border);
`

const SegmentedLabel = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
`

const SearchInput = styled(Input)`
  flex: 1;
  max-width: 300px;
`

const ViewToggle = styled.div`
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
`

const ViewButton = styled.button<{ $active: boolean }>`
  width: 32px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-background)')};
  color: ${(props) => (props.$active ? 'white' : 'var(--color-text-2)')};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-background-soft)')};
  }

  &:not(:last-child) {
    border-right: 1px solid var(--color-border);
  }
`

const SubToolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
`

const ToolbarSpacer = styled.div`
  flex: 1;
`

const SortWrapper = styled.div`
  display: flex;
  align-items: center;
`

const ContentArea = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
`

const MainContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: var(--color-background-soft);

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
  }
`

const PresetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
`

const PresetList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const LoadingWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  gap: 16px;
`

const LoadingText = styled.span`
  font-size: 14px;
  color: var(--color-text-3);
`

const LoadMoreWrapper = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 24px;
`

// ============================================================================
// 详情侧边栏样式
// ============================================================================

const DetailSidebar = styled.div`
  width: 280px;
  border-left: 1px solid var(--color-border);
  background: var(--color-background);
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const DetailHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const DetailIcon = styled.span`
  font-size: 32px;
`

const DetailTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-1);
  line-height: 1.3;
`

const DetailSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const DetailLabel = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

const DetailText = styled.p`
  margin: 0;
  font-size: 13px;
  color: var(--color-text-2);
  line-height: 1.5;
`

const DetailTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`

const DetailTag = styled.span`
  padding: 2px 8px;
  background: var(--color-background-soft);
  border-radius: 4px;
  font-size: 11px;
  color: var(--color-text-2);
`

const PromptPreviewBox = styled.div`
  padding: 10px;
  background: var(--color-background-soft);
  border-radius: 6px;
  border-left: 3px solid var(--color-primary);
  font-size: 12px;
  color: var(--color-text-2);
  line-height: 1.5;
  font-family: monospace;
  word-break: break-all;
  cursor: help;

  &:hover {
    background: var(--color-background-mute);
  }
`

const ConfigPreview = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: var(--color-background-soft);
  border-radius: 6px;
  font-family: monospace;
  font-size: 11px;
`

const ConfigItem = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
`

const ConfigKey = styled.span`
  color: var(--color-text-3);
`

const ConfigValue = styled.span`
  color: var(--color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
`

const DetailActions = styled.div`
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
`
